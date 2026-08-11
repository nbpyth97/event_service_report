# Local dev only — not used in prod (prod frontend is a static build rsynced
# to the VPS by CI, see .github/workflows/deploy.yml). This exists purely so
# `docker-compose.dev.yml` can bring the frontend up without a local Node
# toolchain.
FROM node:22-alpine

WORKDIR /app

CMD ["sh", "-c", "npm ci && npm run dev -- --host"]
