#!/usr/bin/env bash
# Test de restauration (CLAUDE.md §6.7 : « restauration testée régulièrement »).
# Restaure une sauvegarde dans un PostgreSQL JETABLE (conteneur sans réseau, supprimé à la fin)
# et affiche quelques comptages. La base de production n'est jamais touchée.
# Usage : docker/restore-test.sh [fichier.dump]   (par défaut : la sauvegarde la plus récente)
set -euo pipefail

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
dump="${1:-$(ls -1t "$backup_dir"/ref-archives_*.dump 2> /dev/null | head -n 1 || true)}"
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "Aucune sauvegarde trouvée (dossier : $backup_dir)." >&2
  exit 1
fi

container="ref-archives-restore-test-$$"
trap 'docker rm -f "$container" > /dev/null 2>&1 || true' EXIT

echo "Restauration de test : $dump"
docker run -d --rm --name "$container" --network none \
  -e POSTGRES_PASSWORD=restore-test postgres:16-alpine > /dev/null

for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
# pg_isready répond pendant l'initialisation ; on attend que le serveur définitif accepte une requête.
until docker exec "$container" psql -U postgres -tAc 'SELECT 1' > /dev/null 2>&1; do
  sleep 1
done

docker exec "$container" createdb -U postgres restored
docker exec -i "$container" pg_restore -U postgres -d restored --no-owner --exit-on-error < "$dump"

docker exec "$container" psql -U postgres -d restored -v ON_ERROR_STOP=1 -c "
  SELECT 'dernière migration' AS controle, max(name) AS valeur FROM pgmigrations
  UNION ALL SELECT 'comptes', count(*)::text FROM public.\"user\"
  UNION ALL SELECT 'indemnités', count(*)::text FROM compensation
  UNION ALL SELECT 'matchs', count(*)::text FROM game
  UNION ALL SELECT 'notes', count(*)::text FROM note;"

echo "Restauration de test réussie."
