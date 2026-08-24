#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

echo "Starting postgres + backend (docker) on :8000 ..."
docker compose up -d --build postgres backend

cleanup() {
  echo "Stopping postgres + backend ..."
  docker compose stop postgres backend
}
trap cleanup EXIT INT TERM

echo "Starting frontend (npm run dev) on :5173 ..."
cd src/frontend
npm run dev
