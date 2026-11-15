#!/usr/bin/env bash
# Mise à jour de REF-Archives en production.
# Usage : bash docker/update.sh [-f|--force]
#   -f, --force : reconstruit et redéploie même s'il n'y a aucun nouveau commit.

# Tout le script est dans main() : bash le lit en entier avant de l'exécuter,
# donc le `git pull` peut modifier ce fichier sans casser l'exécution en cours.
main() {
  set -Eeuo pipefail

  local force=0
  case "${1:-}" in
    -f|--force) force=1 ;;
    "") ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac

  # Racine du dépôt = dossier parent de docker/, peu importe d'où on lance le script
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$root"

  # Empêche deux mises à jour en même temps
  exec 9>"/tmp/ref-archives-update.lock"
  if ! flock -n 9; then
    echo "Une mise à jour est déjà en cours." >&2
    exit 1
  fi

  local step="initialisation"
  trap 'echo; echo "✗ Échec pendant : $step" >&2; echo "  La sauvegarde faite au début reste disponible si besoin." >&2' ERR

  run() { step="$1"; shift; echo; echo "▶ $step"; "$@"; }

  # 1. Y a-t-il quelque chose à mettre à jour ?
  run "Récupération des changements distants" git fetch --quiet
  local local_rev remote_rev
  local_rev="$(git rev-parse HEAD)"
  remote_rev="$(git rev-parse '@{u}')"

  if [[ "$local_rev" == "$remote_rev" && $force -eq 0 ]]; then
    echo "Déjà à jour ($(git log -1 --format='%h %s')). Rien à faire."
    echo "Utilise --force pour reconstruire quand même."
    exit 0
  fi

  if [[ "$local_rev" != "$remote_rev" ]]; then
    echo "Nouveaux commits :"
    git log --oneline "HEAD..@{u}"
  fi

  # 2. Sauvegarde AVANT toute modification
  run "Sauvegarde de la base" bash docker/backup.sh

  # 3. Code, images, migration, redémarrage
  run "Mise à jour du code"           git pull --ff-only
  run "Build de l'image app"          docker compose build app
  run "Build de l'image tools"        docker compose --profile tools build tools
  run "Migration de la base"          docker compose run --rm tools node scripts/db.mts migrate
  run "Redémarrage de l'app"          docker compose up -d app
  run "État des conteneurs"           docker compose ps
  run "Nettoyage des images orphelines" docker image prune -f

  trap - ERR
  echo
  echo "✓ Mise à jour terminée : $(git log -1 --format='%h %s')"
}

main "$@"
