#!/usr/bin/env bash
# Sauvegarde quotidienne de la base (CLAUDE.md §6.7, docs/deploy.md) :
#   1. pg_dump au format custom (compressé, restaurable table par table) ;
#   2. contrôle du fichier (pg_restore --list) avant de le garder ;
#   3. suppression des sauvegardes locales de plus de BACKUP_RETENTION_DAYS jours ;
#   4. copie distante par rsync over SSH si BACKUP_REMOTE est défini.
# Usage : docker/backup.sh   (depuis le cron de l'hôte, voir docker/crontab.example)
set -euo pipefail
umask 077

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_dir/.env"

env_value() {
  local line
  line="$(grep -E "^$1=" "$env_file" | tail -n 1 || true)"
  line="${line#*=}"
  printf '%s' "${line%$'\r'}"
}

backup_dir="$(env_value BACKUP_DIR)"
backup_dir="${backup_dir:-/var/backups/ref-archives}"
retention_days="$(env_value BACKUP_RETENTION_DAYS)"
retention_days="${retention_days:-14}"
backup_remote="$(env_value BACKUP_REMOTE)"

mkdir -p "$backup_dir"
cd "$repo_dir"

timestamp="$(date +%Y-%m-%d_%H%M%S)"
target="$backup_dir/ref-archives_$timestamp.dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

# Les identifiants sont ceux du conteneur db (variables POSTGRES_*), jamais en argument.
docker compose exec -T db sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner' \
  > "$partial"

# Un dump vide ou illisible ne remplace jamais une bonne sauvegarde.
if [[ ! -s "$partial" ]]; then
  echo "Sauvegarde vide : abandon." >&2
  exit 1
fi
docker compose exec -T db pg_restore --list < "$partial" > /dev/null
mv "$partial" "$target"

# Rétention locale.
find "$backup_dir" -maxdepth 1 -type f -name 'ref-archives_*.dump' -mtime +"$((retention_days - 1))" -delete

# Copie distante : sans --delete, la machine distante garde aussi ce qui a expiré ici (une
# compromission du serveur ne peut pas effacer les copies distantes par ce biais).
if [[ -n "$backup_remote" ]]; then
  rsync --archive --compress --timeout=120 \
    -e "ssh -o BatchMode=yes" \
    "$backup_dir/" "$backup_remote"
fi

echo "Sauvegarde OK : $target ($(du -h "$target" | cut -f1))"
