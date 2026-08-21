#!/usr/bin/env bash
# deploy.sh — full first-time (or re-deploy) for the meeting-scheduler stack.
#
# Run from the repo root:
#   bash infra/scripts/deploy.sh
#
# What it does, in order:
#   1. Spin up Postgres + backend via Docker Compose
#   2. Copy nginx site config and enable it
#   3. Obtain/renew TLS cert with certbot (webroot challenge via nginx)
#   4. Reload nginx
#   5. Print smoke-test curl
#
# Assumptions:
#   - .env is already present in the repo root (copied manually)
#   - nginx is already installed and running on the host
#   - certbot is installed (apt install certbot python3-certbot-nginx)
#   - DNS for DOMAIN already points to this server
#   - The script is idempotent — safe to re-run for updates

set -euo pipefail

DOMAIN="meeting-schedule.bakery-avenida.cloud"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONF_SRC="$(cd "$(dirname "$0")/../.." && pwd)/infra/nginx/meeting-scheduler.conf"
NGINX_CONF_DEST="$NGINX_SITES_AVAILABLE/meeting-scheduler.conf"
WEBROOT="/var/www/meeting-scheduler"

# ── 1. Backend + Postgres ─────────────────────────────────────────────────────
echo "==> Starting Postgres and backend containers..."
docker compose up -d --build --remove-orphans postgres backend

echo "==> Waiting for backend to become healthy..."
for i in $(seq 1 30); do
    if docker compose exec -T backend curl -sf http://localhost:8000/api/health/live >/dev/null 2>&1; then
        echo "    Backend is up."
        break
    fi
    [ "$i" -eq 30 ] && { echo "ERROR: backend did not become healthy in time"; exit 1; }
    sleep 2
done

# ── 2. Run Alembic migrations ─────────────────────────────────────────────────
echo "==> Running database migrations..."
docker compose exec -T backend uv run alembic upgrade head

# ── 3. Build frontend (static files for nginx to serve) ───────────────────────
echo "==> Building frontend..."
FRONTEND_DIR="$(cd "$(dirname "$0")/../.." && pwd)/src/frontend"
cd "$FRONTEND_DIR"
npm ci --prefer-offline
npm run build
cd - >/dev/null

echo "==> Copying frontend dist to $WEBROOT..."
sudo mkdir -p "$WEBROOT"
sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$WEBROOT/"
sudo chown -R www-data:www-data "$WEBROOT"

# ── 4. Enable nginx site config ───────────────────────────────────────────────
echo "==> Installing nginx site config..."
sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
if [ ! -L "$NGINX_SITES_ENABLED/meeting-scheduler.conf" ]; then
    sudo ln -s "$NGINX_CONF_DEST" "$NGINX_SITES_ENABLED/meeting-scheduler.conf"
fi

# Validate config before reloading
sudo nginx -t
sudo systemctl reload nginx

# ── 5. TLS certificate ────────────────────────────────────────────────────────
# If cert already exists certbot --non-interactive skips re-issue silently.
echo "==> Obtaining/renewing TLS certificate for $DOMAIN..."
sudo certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    -d "$DOMAIN"

# certbot --nginx rewrites the nginx config in place; reload again to pick up
# the updated ssl_certificate directives it inserts.
sudo nginx -t
sudo systemctl reload nginx

# ── 6. Smoke test ─────────────────────────────────────────────────────────────
echo ""
echo "==> Smoke test:"
curl -sf "https://$DOMAIN/api/health/live" && echo "  /api/health/live OK" || echo "  WARNING: health check failed — check logs"

echo ""
echo "Deploy complete. If this is the first run, create the initial staff user:"
echo ""
echo "  docker compose exec backend uv run python -m scripts.create_user \\"
echo "    --tenant-slug <slug> --name \"<name>\" --password \"<password>\""
