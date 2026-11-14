#!/usr/bin/env bash
# Déclenche un job planifié de l'application (CLAUDE.md §9, docs/deploy.md).
# Usage : docker/cron-job.sh <reminders|purge-data|purge-accounts>
#
# Appelé par le cron de l'hôte. La requête passe par l'URL publique (Caddy), comme celle d'un
# client : le port de l'app n'est jamais publié. Le secret est lu dans `.env` et transmis à curl
# par un descripteur de fichier : il n'apparaît ni dans `ps` ni dans l'historique du shell.
set -euo pipefail

job="${1:-}"
case "$job" in
  reminders | purge-data | purge-accounts) ;;
  *)
    echo "Usage : $0 <reminders|purge-data|purge-accounts>" >&2
    exit 2
    ;;
esac

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_dir/.env"

# Lit une variable de .env sans l'exécuter (EMAIL_FROM contient des chevrons : pas de `source`).
env_value() {
  local line
  line="$(grep -E "^$1=" "$env_file" | tail -n 1 || true)"
  line="${line#*=}"
  printf '%s' "${line%$'\r'}"
}

app_url="$(env_value APP_URL)"
cron_secret="$(env_value CRON_SECRET)"
if [[ -z "$app_url" || -z "$cron_secret" ]]; then
  echo "APP_URL ou CRON_SECRET absent de $env_file" >&2
  exit 1
fi

# Réponse attendue : un objet JSON de compteurs (aucune donnée personnelle), affiché pour le
# journal du cron. -f : code de sortie non nul si la route répond 4xx/5xx.
curl --fail --silent --show-error --max-time 300 \
  -X POST \
  -H @<(printf 'Authorization: Bearer %s\n' "$cron_secret") \
  "$app_url/api/cron/$job"
echo
