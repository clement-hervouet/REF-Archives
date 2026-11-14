# Déploiement

Procédure de mise en production de REF-Archives sur le serveur Ubuntu auto-hébergé
(CLAUDE.md §3.1, §6.7, §10.2). Toutes les commandes se lancent **sur le serveur**, en SSH, depuis
`/opt/ref-archives` sauf mention contraire.

## 0. Vue d'ensemble

```
Internet ──443──► Caddy (projet Compose séparé, réseau caddy_default)
                    │  TLS, HSTS, X-Forwarded-For fixé par Caddy
                    ▼
            ref-archives-app:3000  ◄── réseau caddy_default ──► postfix (boky/postfix) ──► Gmail
                    │
              réseau internal (sans Internet)
                    ▼
                   db (PostgreSQL 16, volume pgdata)
```

| Fichier                         | Rôle                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `compose.prod.yml`              | Stack de production : `db`, `app`, `tools` (profil, outils ponctuels)   |
| `docker/Dockerfile`             | Image multi-étapes : `runner` (servie, non-root, standalone) et `tools` |
| `docker/env.production.example` | Modèle du `.env` de production                                          |
| `docker/Caddyfile`              | Bloc de site à ajouter au Caddyfile existant                            |
| `docker/cron-job.sh`            | Appel d'un job planifié (`reminders`, `purge-data`, `purge-accounts`)   |
| `docker/backup.sh`              | `pg_dump` quotidien, rétention 14 jours, copie rsync                    |
| `docker/restore-test.sh`        | Restauration d'une sauvegarde dans un PostgreSQL jetable                |
| `docker/crontab.example`        | Crons de l'hôte                                                         |

Le code est construit **sur le serveur** (`git pull` puis `docker compose build`) : rien à publier
depuis la CI.

## 1. Prérequis

- Ubuntu 24.04 LTS, Docker Engine et le plugin Compose (`docker compose version`).
- Un utilisateur de déploiement membre du groupe `docker` (les commandes ci-dessous ne demandent
  pas `sudo`, sauf la création des dossiers).
- Le projet Compose de **Caddy** démarré, avec son réseau `caddy_default` :
  `docker network ls | grep caddy_default`.
- Le conteneur **postfix** (`boky/postfix`) branché sur `caddy_default`. Noter son nom :
  `docker network inspect caddy_default --format '{{range .Containers}}{{.Name}} {{end}}'`.
- DNS : un enregistrement `A` (et `AAAA` si IPv6) `ref.clement-hervouet.fr` vers le serveur.
  Vérifier avec `dig +short ref.clement-hervouet.fr` avant de recharger Caddy (sinon le
  certificat Let's Encrypt échoue).
- Pare-feu : seuls 22, 80 et 443 ouverts. La stack ne publie **aucun** port (voir §2).

## 2. Règles de sécurité réseau (à ne jamais casser)

### Le port de l'application n'est jamais publié (M1)

Le service `app` écoute sur le port 3000 **uniquement sur les réseaux Docker**. Il ne doit
**jamais** recevoir de `ports:` : seul **Caddy** est exposé à Internet et relaie vers
`ref-archives-app:3000` (alias unique sur `caddy_default`, partagé avec d'autres projets).

Caddy **remplace** `X-Forwarded-For` et `X-Real-IP` par l'IP qu'il voit (`header_up … {client_ip}`
dans `docker/Caddyfile`). `src/server/auth/client-ip.ts` lit la première valeur de
`X-Forwarded-For` : derrière ce Caddy, elle ne peut donc pas être forgée par le client, et le
rate limiting par IP ne peut pas être contourné (audit 16c). Si Caddy est un jour placé derrière
un autre proxy (Cloudflare…), configurer `trusted_proxies` dans Caddy pour que `{client_ip}`
reste l'IP réelle.

**Défense en profondeur côté application** : `src/proxy.ts` refuse (`400`) toute requête dont
l'en-tête `Host` ne correspond pas à l'hôte d'`APP_URL` (ni à un hôte loopback, réservé au
healthcheck Docker interne). Caddy transmet l'en-tête `Host` d'origine par défaut : ne pas le
réécrire vers l'upstream. Si `APP_URL` est absent ou invalide, le garde-fou se désactive (fail
open) ; mais l'application refuse alors de démarrer (validation de l'env), donc ce cas ne se
produit pas en production.

### Base de données non exposée

Le service `db` n'est que sur le réseau `internal` (`internal: true` : pas d'accès Internet), sans
`ports:` (§6.7).

### Conteneur durci

`app` tourne en utilisateur `node` (non-root), système de fichiers en lecture seule (sauf
`/tmp` et le cache Next.js en tmpfs), sans aucune capacité Linux, avec `no-new-privileges`.
Les fichiers servis appartiennent à root : le processus ne peut pas les réécrire.

### Healthcheck

Le healthcheck de l'image interroge `GET /api/health` (réponse `200 ok`, sans base ni donnée) sur
`127.0.0.1:3000`, à l'intérieur du conteneur.

## 3. Premier déploiement

### 3.1. Récupérer le code

```bash
sudo mkdir -p /opt/ref-archives /var/backups/ref-archives /var/log/ref-archives
sudo chown "$USER": /opt/ref-archives /var/backups/ref-archives /var/log/ref-archives
git clone https://github.com/clement-hervouet/REF-Archives.git /opt/ref-archives
cd /opt/ref-archives
```

### 3.2. Créer le `.env` de production

```bash
cp docker/env.production.example .env
chmod 600 .env
openssl rand -hex 32      # → POSTGRES_PASSWORD (hexadécimal : il entre dans une URL)
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → CRON_SECRET
nano .env
```

À renseigner : `POSTGRES_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `SMTP_HOST` (nom du conteneur
postfix, voir §1 ; garder `SMTP_IGNORE_TLS=true`, voir §3.7), `EMAIL_FROM` (l'alias Gmail « Envoyer en tant que »), `BACKUP_REMOTE`.
Garder `COMPOSE_FILE=compose.prod.yml` : c'est lui qui permet d'écrire `docker compose …` sans
`-f`. Vérifier l'interpolation (aucune erreur, valeurs attendues) :

```bash
docker compose config --quiet && echo OK
```

> **Ne jamais changer `POSTGRES_PASSWORD` après le premier démarrage** sans changer aussi le mot de
> passe dans PostgreSQL (`ALTER ROLE`) : l'image `postgres` ne l'applique qu'à l'initialisation du
> volume.

### 3.3. Construire les images

```bash
docker compose build app
docker compose --profile tools build tools
```

### 3.4. Base de données, migrations, premier admin

```bash
docker compose up -d db
docker compose run --rm tools node scripts/db.mts migrate
docker compose run --rm tools node scripts/admin-create.mts prenom.nom@example.fr
```

`admin-create` demande le mot de passe en mode masqué (12 caractères minimum). Le seed
(`db/seed.sql`, données de développement) ne se lance **jamais** en production. Un avertissement
`MODULE_TYPELESS_PACKAGE_JSON` de Node dans la sortie de ces outils est sans conséquence.

### 3.5. Démarrer l'application

```bash
docker compose up -d app
docker compose ps            # app doit passer « healthy » en moins d'une minute
docker compose logs -f app   # Ctrl+C pour quitter
```

Si `app` redémarre en boucle, la première ligne de ses logs nomme les variables d'environnement
invalides (jamais leurs valeurs).

### 3.6. Caddy

Ajouter le contenu de `docker/Caddyfile` au Caddyfile du projet Caddy
(`/etc/docker/volumes/caddy/…`), puis :

```bash
docker exec <conteneur-caddy> caddy validate --config /etc/caddy/Caddyfile
docker exec <conteneur-caddy> caddy reload --config /etc/caddy/Caddyfile
```

Le placeholder `{client_ip}` demande Caddy 2.7 ou plus (`docker exec <conteneur-caddy> caddy
version`). Sur une version plus ancienne, le remplacer par `{remote_host}`.

Le journal d'accès est volontairement absent du bloc : les URL du flux iCal contiennent le jeton
secret, qui ne doit jamais être journalisé (§5.4). Pour en activer un, exclure ce chemin, par
exemple avec `log_skip /api/ical/*` dans le bloc de site.

### 3.7. Emails (relais postfix)

1. Vérifier que le domaine de `EMAIL_FROM` figure dans `ALLOWED_SENDER_DOMAINS` du conteneur
   postfix (`docker inspect <conteneur-postfix> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ALLOWED`).
2. Envoyer un email de test :

   ```bash
   docker compose run --rm tools node scripts/email-test.mts ton.adresse@example.fr
   ```

3. Résultats possibles :
   - `Email envoyé.` : vérifier la réception, puis dans Gmail « Afficher l'original » : `SPF`,
     `DKIM` et `DMARC` doivent être `PASS` (voir §3.8).
   - `code=ESOCKET` ou `code=ECONNECTION` : le script ne journalise que le code (jamais
     d'adresse), il faut donc distinguer deux causes. D'abord, la joignabilité :
     `docker run --rm --network caddy_default alpine nc -zv <SMTP_HOST> 587`.
     - Échec : `SMTP_HOST` ne résout pas ou postfix n'écoute pas sur `SMTP_PORT`.
     - Succès : c'est très probablement le certificat. Confirmer avec
       `docker run --rm --network caddy_default alpine/openssl s_client -starttls smtp -connect <SMTP_HOST>:587 </dev/null`
       (`verify error … self-signed certificate`). C'est le cas du postfix de production
       (certificat `CN=localhost`) : d'où `SMTP_IGNORE_TLS=true` dans le `.env` (§3.2). Avec
       cette option, l'application ne tente pas STARTTLS ; le trafic app → postfix reste en clair
       mais ne quitte pas le réseau Docker, et postfix → Gmail reste chiffré. L'application
       refuse de démarrer si l'option est combinée à `SMTP_USER` (des identifiants ne partent
       jamais en clair) ou à `SMTP_SECURE=true`. **Ne pas** désactiver la vérification des
       certificats à la place.
   - `responseCode=5xx` : postfix refuse l'expéditeur (voir point 1) ou Gmail refuse le relais
     (`docker logs <conteneur-postfix>`).

### 3.8. SPF, DKIM, DMARC

Les emails partent par le relais postfix, qui s'authentifie chez Gmail : c'est Gmail qui les
remet aux destinataires. Pour le domaine de `EMAIL_FROM` :

- **SPF** : l'enregistrement TXT du domaine doit autoriser Gmail :
  `v=spf1 include:_spf.google.com ~all` (à fusionner avec un SPF existant : un seul TXT `v=spf1`
  par domaine).
- **DKIM** : un compte Gmail gratuit signe avec `d=gmail.com`, pas avec le domaine. Une signature
  au nom du domaine demande Google Workspace (clé DKIM publiée en DNS) ou un autre relais qui
  signe pour le domaine.
- **DMARC** : `_dmarc.<domaine>` TXT, commencer par `v=DMARC1; p=none; rua=mailto:<adresse>` pour
  observer les rapports. Ne passer à `p=quarantine` qu'une fois SPF ou DKIM **alignés** sur le
  domaine de `From:` (sinon les emails de l'application seraient mis en spam ou rejetés).

Le diagnostic qui fait foi : l'en-tête `Authentication-Results` d'un email reçu (§3.7, étape 3).
Le site PHP qui utilise déjà ce relais est soumis aux mêmes règles : ne rien changer qui le casse.

### 3.9. Crons et sauvegardes

1. Clé SSH vers la machine de sauvegarde, pour l'utilisateur qui lance les crons :

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""   # si aucune clé n'existe
   ssh-copy-id utilisateur@machine-distante
   ssh -o BatchMode=yes utilisateur@machine-distante true && echo OK
   ```

2. Premier passage manuel de chaque script :

   ```bash
   bash docker/backup.sh
   bash docker/restore-test.sh
   bash docker/cron-job.sh purge-data
   bash docker/cron-job.sh purge-accounts
   bash docker/cron-job.sh reminders
   ```

   Chaque job répond par un objet JSON de compteurs. Une `401` signifie que `CRON_SECRET` du
   `.env` ne correspond pas à celui du conteneur (relancer `docker compose up -d app` après une
   modification du `.env`) ; une `404`, que `CRON_SECRET` est vide.

3. Installer les crons : vérifier le fuseau du serveur (`timedatectl`), adapter les heures de
   `docker/crontab.example`, puis `crontab -e` et coller son contenu.

Dans le décompte de `reminders`, `failed` compte les emails non partis (relais injoignable) : le
job ne réserve pas la période dans ce cas, le passage du lendemain réessaie.

## 4. Vérifications après le premier déploiement

```bash
# HSTS et en-têtes posés par l'application (CSP à nonce, X-Frame-Options…)
curl -sI https://ref.clement-hervouet.fr/login
# Aucun port de la stack n'est publié sur l'hôte (sortie vide attendue)
docker compose ps --format '{{.Name}} {{.Ports}}' | grep -- '->' || echo "aucun port publié"
# Le port 3000 n'est pas joignable de l'extérieur (depuis TON PC, pas le serveur) : échec attendu
curl -m 5 http://<ip-du-serveur>:3000/api/health
```

Puis dans l'application : connexion avec le compte admin, saisie du barème commun
(`/admin/bareme-commun`), invitation de test vers une autre adresse (réception de l'email,
acceptation), « Mot de passe oublié » (email de réinitialisation, puis alerte « mot de passe
modifié »), abonnement au flux iCal depuis Google Agenda, installation de la PWA sur le téléphone.

## 5. Mettre à jour

```bash
cd /opt/ref-archives
bash docker/backup.sh                       # toujours une sauvegarde avant une migration
git pull --ff-only
docker compose build app
docker compose --profile tools build tools
docker compose run --rm tools node scripts/db.mts migrate
docker compose up -d app
docker compose ps
docker image prune -f                       # images orphelines des builds précédents
```

Les migrations passent **avant** le redémarrage de l'app : pendant quelques secondes, l'ancienne
version tourne sur le nouveau schéma. Les migrations du projet sont additives ; une migration qui
supprime ou renomme une colonne encore lue par l'ancienne version demande un arrêt de `app`
avant la migration (`docker compose stop app`).

**Revenir en arrière** : `git checkout <commit précédent>`, reconstruire et relancer `app`. Si une
migration posait problème, restaurer la sauvegarde faite juste avant (§6) plutôt que de lancer une
migration descendante en production.

## 6. Restaurer une sauvegarde

À faire seulement après un incident. Tester d'abord le fichier avec `docker/restore-test.sh`.

```bash
cd /opt/ref-archives
docker compose stop app
docker compose exec -T db sh -c 'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error' < /var/backups/ref-archives/ref-archives_AAAA-MM-JJ_HHMMSS.dump
docker compose up -d app
```

Toutes les sessions restent celles de la sauvegarde : les utilisateurs déconnectés depuis
retrouvent leur session si elle n'avait pas expiré. En cas de doute (incident de sécurité),
vider la table `session` après la restauration pour forcer une reconnexion de tous.

## 7. Commandes utiles

```bash
docker compose ps
docker compose logs --tail 200 app
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose restart app
docker compose down          # arrête la stack ; le volume pgdata est conservé
```

Ne **jamais** lancer `docker compose down -v` : `-v` supprime le volume de la base.
