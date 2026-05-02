#!/usr/bin/env bash
# Backup helper for ARCH-001@0.4.0 §10.4 Backup Sequence.
#
# Usage:
#   scripts/backup-kbju.sh
#
# Required env vars (loaded from .env or shell):
#   POSTGRES_USER, POSTGRES_DB

set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

mkdir -p backups
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_PATH="backups/kbju-${TIMESTAMP}.dump"

docker compose exec -T postgres \
  pg_dump -Fc -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${DUMP_PATH}"
chmod 0600 "${DUMP_PATH}"

echo "Backup written to ${DUMP_PATH}"
