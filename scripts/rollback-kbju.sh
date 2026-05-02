#!/usr/bin/env bash
# Rollback helper for ARCH-001@0.4.0 §10.5 Rollback Sequence.
#
# Runs §10.5.1 pre-flight (DB snapshot, migration check),
# §10.5.2 code rollback + health-check loop on http://127.0.0.1:9464/metrics,
# and posts a Telegram PO ping to $PO_ALERT_CHAT_ID on success.
# Aborts with non-zero exit when health checks fail.
#
# Usage:
#   scripts/rollback-kbju.sh <last-good-commit-sha>
#
# Required env vars (loaded from .env or shell):
#   POSTGRES_USER, POSTGRES_DB, TELEGRAM_BOT_TOKEN, PO_ALERT_CHAT_ID

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <last-good-commit-sha>" >&2
  exit 64
fi

LAST_GOOD_COMMIT="$1"

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"
: "${PO_ALERT_CHAT_ID:?PO_ALERT_CHAT_ID is required}"

# --- §10.5.1 Pre-flight checks ---

echo "[1/4] Pre-flight: verifying last-good commit..."
git fetch origin
if ! git log --oneline "${LAST_GOOD_COMMIT}" -1 >/dev/null 2>&1; then
  echo "ERROR: commit ${LAST_GOOD_COMMIT} not reachable" >&2
  exit 1
fi

echo "[2/4] Pre-flight: snapshotting current DB before rollback..."
mkdir -p backups
PRE_ROLLBACK_DUMP="backups/pre-rollback-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres \
  pg_dump -Fc -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${PRE_ROLLBACK_DUMP}"
chmod 0600 "${PRE_ROLLBACK_DUMP}"

echo "  Checking for forward migrations since last-good deploy..."
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
  "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;" || true

echo "  Checking VPS disk and PostgreSQL reachability..."
df -h /
docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

# --- §10.5.2 Code rollback ---

echo "[3/4] Rolling back code to ${LAST_GOOD_COMMIT}..."
git checkout "${LAST_GOOD_COMMIT}"
docker compose pull
docker compose up -d --remove-orphans
docker compose ps

# --- §10.5.2 Health-check loop ---

echo "[4/4] Health check: waiting for metrics endpoint at http://127.0.0.1:9464/metrics..."
HEALTHY=false
for i in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:9464/metrics > /dev/null 2>&1; then
    echo "  metrics endpoint healthy after ${i}s"
    HEALTHY=true
    break
  fi
  sleep 1
done

if [[ "${HEALTHY}" != "true" ]]; then
  echo "ERROR: metrics endpoint not healthy after 30s — rollback failed" >&2
  curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${PO_ALERT_CHAT_ID}" \
    -d text="⚠️ Rollback to ${LAST_GOOD_COMMIT} FAILED — health checks not passing. See VPS." || true
  exit 1
fi

# --- Telegram PO ping on success ---

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${PO_ALERT_CHAT_ID}" \
  -d text="⏮️ Rolled back to ${LAST_GOOD_COMMIT} — health checks passing"

echo "Rollback to ${LAST_GOOD_COMMIT} complete and healthy."
