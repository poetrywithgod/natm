#!/usr/bin/env bash
# Creates the 4 NATM Sentry projects via the Sentry API and prints each
# project's DSN. Requires: SENTRY_AUTH_TOKEN, SENTRY_ORG (org slug).
# Run this once. Safe to re-run -- Sentry rejects a duplicate slug rather
# than creating a second copy, and this script just reports that and
# moves on.

set -euo pipefail

: "${SENTRY_AUTH_TOKEN:?Set SENTRY_AUTH_TOKEN first (from Settings > Auth Tokens)}"
: "${SENTRY_ORG:?Set SENTRY_ORG to your org slug, e.g. export SENTRY_ORG=ctrl-build}"

AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
API="https://sentry.io/api/0"

# Grab the first team in the org -- most orgs have exactly one to start.
# Override by exporting SENTRY_TEAM yourself if you use multiple teams.
if [ -z "${SENTRY_TEAM:-}" ]; then
  SENTRY_TEAM=$(curl -s -H "$AUTH_HEADER" "$API/organizations/$SENTRY_ORG/teams/" | \
    node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log(t[0]?.slug||'')})")
  if [ -z "$SENTRY_TEAM" ]; then
    echo "No team found in org '$SENTRY_ORG' -- create one first, or export SENTRY_TEAM=<slug>." >&2
    exit 1
  fi
  echo "Using team: $SENTRY_TEAM (override with SENTRY_TEAM=... if wrong)"
fi

# name:slug:platform:env-var-name
PROJECTS=(
  "NATM Staff:natm-staff:javascript-react:VITE_SENTRY_DSN"
  "NATM Student-Parent:natm-student-parent:javascript-react:VITE_SENTRY_DSN"
  "NATM Super Admin:natm-super-admin:javascript-react:VITE_SENTRY_DSN"
  "NATM CCSF Site:natm-ccsf-site:javascript-astro:SENTRY_DSN"
)

echo
echo "===================================================================="
echo " DSNs -- copy these into each app's Vercel env vars (see step 3)"
echo "===================================================================="

for entry in "${PROJECTS[@]}"; do
  IFS=":" read -r name slug platform envvar <<< "$entry"

  create_resp=$(curl -s -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -X POST "$API/teams/$SENTRY_ORG/$SENTRY_TEAM/projects/" \
    -d "{\"name\":\"$name\",\"slug\":\"$slug\",\"platform\":\"$platform\"}")

  # Whether just-created or already existing, fetch the DSN the same way.
  dsn=$(curl -s -H "$AUTH_HEADER" "$API/projects/$SENTRY_ORG/$slug/keys/" | \
    node -e "process.stdin.on('data',d=>{const k=JSON.parse(d);console.log(k[0]?.dsn?.public||'')})")

  if [ -z "$dsn" ]; then
    echo "  ! $slug -- failed to get DSN. Response was: $create_resp" >&2
    continue
  fi

  printf "  %-22s %-12s %s\n" "$slug" "($envvar)" "$dsn"
done

echo "===================================================================="
