#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/postgres_bck.log"

cd "$PROJECT_DIR"
# shellcheck disable=SC1091
[ -f .env ] && . ./.env

export DAY="$(date +%d)"
export MONTH="$(date +%m)"
export YEAR="$(date +%Y)"

{
  echo "[$(date -Iseconds)] starting backup for $YEAR-$MONTH-$DAY"
  docker compose --profile backup up -d --no-deps backup_postgres
  docker wait meeting-scheduler-backup
  docker logs meeting-scheduler-backup
  docker rm meeting-scheduler-backup >/dev/null
  echo "[$(date -Iseconds)] backup finished"
} >> "$LOG_FILE" 2>&1
