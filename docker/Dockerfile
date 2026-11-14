# syntax=docker/dockerfile:1
#
# Image de production de REF-Archives (CLAUDE.md §6.7, docs/deploy.md).
# Construite SUR le serveur depuis la racine du dépôt :
#   docker compose build
#
# Étapes :
#   deps    : dépendances installées depuis le lockfile (--frozen-lockfile, §6.4 A08) ;
#   builder : `next build` en mode standalone ;
#   tools   : outils ponctuels (migrations, premier admin, test d'envoi d'email), lancés avec
#             `docker compose run --rm tools …` ; jamais exposée, jamais démarrée en continu ;
#   runner  : image servie, minimale et non-root (server.js + .next/static + public).

# Même version majeure de Node que la CI (.github/workflows/ci.yml).
ARG NODE_IMAGE=node:22-alpine

# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
# pnpm à la version exacte de `packageManager` (package.json), via corepack.
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Le cache du store pnpm accélère les reconstructions sans entrer dans l'image.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------------------------
FROM deps AS builder
COPY . .
# Aucune variable de production n'est nécessaire au build : `instrumentation-node.ts` ne bloque
# pas pendant `next build` et l'environnement est validé au démarrage du serveur (fail fast).
RUN pnpm build

# ---------------------------------------------------------------------------------------------
FROM deps AS tools
# Seulement ce dont les scripts ont besoin : le code source importé par `admin-create.mts`
# (imports relatifs en .ts, types retirés par Node), les scripts et les migrations SQL.
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY db ./db
ENV NODE_ENV=production
USER node
# Exemples (docs/deploy.md) :
#   docker compose run --rm tools node scripts/db.mts migrate
#   docker compose run --rm tools node scripts/admin-create.mts prenom.nom@example.fr
#   docker compose run --rm tools node scripts/email-test.mts destinataire@example.fr
CMD ["node", "scripts/db.mts", "migrate"]

# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Fichiers appartenant à root et en lecture seule pour l'utilisateur `node` : un attaquant qui
# prendrait la main sur le processus ne pourrait pas réécrire le code servi.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Seul dossier où Next.js écrit à l'exécution (cache). En production, compose.prod.yml monte
# un tmpfs à cet endroit et passe le reste du système de fichiers en lecture seule.
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000

# `/api/health` ne touche ni à la base ni à la session (§10.2). Hôte 127.0.0.1 : autorisé par
# le garde-fou `Host` de `proxy.ts` (loopback réservé au healthcheck interne).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "server.js"]
