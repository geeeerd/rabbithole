FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY scripts/check-bundle.mjs scripts/collect-web-licenses.mjs /build/scripts/
RUN npm run build

FROM python:3.11-slim-bookworm AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv UV_LINK_MODE=copy
WORKDIR /build/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.11-slim-bookworm
ENV PATH="/opt/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/rabbithole/backend
COPY --from=dependencies /opt/venv /opt/venv
COPY backend/app ./app
COPY data/ /srv/rabbithole/data/
COPY --from=frontend /build/frontend/dist /srv/rabbithole/frontend/dist
USER 10001:10001
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.production:production_app --factory --host 0.0.0.0 --port \"${PORT:-8000}\" --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\" --limit-concurrency 64 --timeout-keep-alive 5 --no-access-log"]
