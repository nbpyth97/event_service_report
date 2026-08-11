#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

echo "Starting local dev stack: frontend on :5173, backend on :8000"
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
