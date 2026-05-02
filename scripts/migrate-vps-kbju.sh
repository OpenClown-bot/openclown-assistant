#!/usr/bin/env bash
# VPS migration helper for ARCH-001@0.4.0 §10.6 VPS Migration Runbook.
#
# Runs the §10.6 sequence including setWebhook + getWebhookInfo verification.
# Fails fast if getWebhookInfo reports an error (last_error_date != null).
#
# Usage:
#   scripts/migrate-vps-kbju.sh <new-vps-host> <new-webhook-url>
#
# Required env vars (loaded from .env or shell):
#   POSTGRES_USER, POSTGRES_DB, TELEGRAM_BOT_TOKEN
#
# Required ssh access: agent-forwarded key for <new-vps-host>.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <new-vps-host> <new-webhook-url>" >&2
  exit 64
fi

NEW_VPS="$1"
NEW_WEBHOOK_URL="$2"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_NAME="kbju-migration-${TIMESTAMP}.dump"
DUMP_PATH="backups/${DUMP_NAME}"

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

# --- §10.6.1 Pre-flight ---

echo "[pre-flight] Checking services healthy on OLD VPS..."
docker compose ps
curl -fsS --max-time 2 http://127.0.0.1:9464/metrics > /dev/null && echo "  metrics OK"
df -h /

# --- §10.6.2 Stop, snapshot, transfer ---

echo "[1/5] Stopping user-facing skills on OLD VPS..."
docker compose stop \
  kbju-telegram-entrypoint \
  kbju-onboarding \
  kbju-meal-logging \
  kbju-history-privacy \
  kbju-summary

echo "[2/5] Snapshotting Postgres to ${DUMP_PATH}..."
mkdir -p backups
docker compose exec -T postgres \
  pg_dump -Fc -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${DUMP_PATH}"
chmod 0600 "${DUMP_PATH}"

echo "[3/5] Transferring dump and .env.production to ${NEW_VPS}..."
scp "${DUMP_PATH}" "${NEW_VPS}:/srv/openclown-assistant/backups/"
scp .env.production "${NEW_VPS}:/srv/openclown-assistant/.env.production"

# --- §10.6.3 Bring the new VPS up ---

echo "[4/5] Bringing the new VPS up..."
ssh "${NEW_VPS}" bash -lc "
  set -euo pipefail &&
  cd /srv/openclown-assistant &&
  git fetch origin && git checkout main &&
  docker compose pull &&
  docker compose up -d postgres &&
  sleep 5 &&
  docker compose exec -T postgres \
    pg_restore -U '${POSTGRES_USER}' -d '${POSTGRES_DB}' \
    /srv/openclown-assistant/backups/${DUMP_NAME} &&
  docker compose up -d --remove-orphans &&
  docker compose ps
"

# --- §10.6.4 Re-register the Telegram webhook ---

echo "[5/5] Re-registering Telegram webhook to ${NEW_WEBHOOK_URL}..."
SET_RESULT="$(curl -fsS -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d url="${NEW_WEBHOOK_URL}" \
  -d drop_pending_updates=false)"

echo "setWebhook response: ${SET_RESULT}"

echo "Verifying getWebhookInfo..."
HOOK_INFO="$(curl -fsS \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")"

echo "getWebhookInfo response: ${HOOK_INFO}"

# Fail fast if getWebhookInfo reports an error
LAST_ERROR=$(echo "${HOOK_INFO}" | grep -oE '"last_error_date"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' || true)
if [[ -n "${LAST_ERROR}" ]]; then
  echo "ERROR: getWebhookInfo reports last_error_date is set — webhook not functioning" >&2
  echo "${HOOK_INFO}" >&2
  exit 1
fi

HOOK_URL=$(echo "${HOOK_INFO}" | grep -oE '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"' || true)
if [[ "${HOOK_URL}" != "${NEW_WEBHOOK_URL}" ]]; then
  echo "ERROR: getWebhookInfo url does not match ${NEW_WEBHOOK_URL} (got: ${HOOK_URL})" >&2
  echo "${HOOK_INFO}" >&2
  exit 1
fi

echo
echo "Migration complete. Manual checklist (ARCH-001@0.4.0 §10.6.5):"
echo "  - Send a /start ping from PO Telegram and confirm a Russian reply within 5s"
echo "  - ssh ${NEW_VPS} 'docker compose logs --since=2m kbju-telegram-entrypoint | grep telegram_update_received'"
echo "  - Put the OLD VPS into read-only mode (docker compose down, close port 443)"
