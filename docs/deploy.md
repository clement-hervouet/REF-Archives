# Déploiement

> Document de déploiement. **Ébauche** créée au bloc 16 (audit de sécurité) pour y consigner
> les prérequis réseau ; la procédure complète (services Docker, SMTP, crons, sauvegardes,
> SPF/DKIM/DMARC) est à rédiger au bloc 17.

## Prérequis réseau et sécurité

### Le port de l'application n'est jamais publié (M1)

Le service `app` écoute sur le port 3000 **uniquement sur le réseau Docker interne**. Il ne
doit **jamais** être publié sur l'hôte (`ports:` dans `docker-compose.yml`) : seul **Caddy** est
exposé à Internet et relaie vers `app:3000`. Sans cela, un client pourrait atteindre
l'application directement et **falsifier `X-Forwarded-For`** (l'IP de confiance utilisée par le
rate limiting et le journal de sécurité vient de cet en-tête réécrit par Caddy).

**Défense en profondeur côté application** : `src/proxy.ts` refuse (`400`) toute requête dont
l'en-tête `Host` ne correspond pas à l'hôte d'`APP_URL` (ni à un hôte loopback, réservé au
healthcheck Docker interne). Ce garde-fou suppose que **Caddy transmet l'en-tête `Host`
d'origine** (comportement par défaut de `reverse_proxy` en Caddy v2 ; ne pas le réécrire vers
l'upstream). Si `APP_URL` est absent ou invalide, le garde-fou se désactive (fail open) pour ne
jamais couper la production : la vraie protection reste le port non publié ci-dessus.

### Base de données non exposée

Le service `db` reste lui aussi sur le réseau Docker interne, jamais publié (§6.7).

### Healthcheck

Le healthcheck Docker interroge `GET /api/health` (réponse `200 ok`, sans base ni donnée) via
`localhost` à l'intérieur du conteneur : l'hôte loopback est explicitement autorisé par le
garde-fou ci-dessus.
