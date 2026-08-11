#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_SCRIPT="$SCRIPT_DIR/run_backup_data.sh"
CRON_LINE="0 3 * * * $RUN_SCRIPT"

chmod +x "$RUN_SCRIPT"

( crontab -l 2>/dev/null | grep -vF "$RUN_SCRIPT"; echo "$CRON_LINE" ) | crontab -

echo "Installed daily backup cron job:"
echo "  $CRON_LINE"
