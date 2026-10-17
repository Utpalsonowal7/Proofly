#!/usr/bin/env bash
set -euo pipefail

image="${1:?Provide the application image}"
migration_image="${2:?Provide the migration image}"
for ref in "$image" "$migration_image"; do
  [[ "$ref" =~ ^ghcr\.io/[a-z0-9._/-]+:[a-f0-9]{40}$ ]] || { echo "Use immutable commit-tagged GHCR images." >&2; exit 1; }
done
cd "${PROOFLY_DIRECTORY:-/opt/proofly}"
test -f .env.production || { echo "Configure .env.production before deploying." >&2; exit 1; }
candidate="$(mktemp .release-candidate.XXXXXX)"
trap 'rm -f "$candidate"' EXIT
printf 'PROOFLY_IMAGE=%s\nPROOFLY_MIGRATION_IMAGE=%s\n' "$image" "$migration_image" > "$candidate"
compose=(docker compose --env-file "$candidate" -f compose.production.yaml)
"${compose[@]}" pull
# Migrations are forward-only. Keep schema changes compatible with the previous application image.
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --no-deps app
ready=false
for attempt in {1..20}; do
  if curl --fail --silent --max-time 4 http://127.0.0.1:3000/api/health > /dev/null; then ready=true; break; fi
  sleep 3
done
if [[ "$ready" == true ]]; then
  if [[ -f .release.env ]]; then cp .release.env .previous-release.env; fi
  mv "$candidate" .release.env
  echo "Proofly is ready at the requested commit."
else
  echo "Readiness check failed. Restoring the previous application image." >&2
  if [[ -f .release.env ]]; then
    docker compose --env-file .release.env -f compose.production.yaml up -d --no-deps app
    curl --fail --silent --retry 10 --retry-delay 3 --retry-connrefused --max-time 4 http://127.0.0.1:3000/api/health > /dev/null
  else
    "${compose[@]}" stop app
    echo "No previous release exists; the unsuccessful application was stopped." >&2
  fi
  exit 1
fi
