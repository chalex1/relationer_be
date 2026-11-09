FROM node:22.12-alpine AS frontend-build

WORKDIR /frontend
RUN apk add --no-cache openjdk21-jre
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
# generate-api.mjs resolves ../backend/openapi.yaml from /frontend.
COPY backend/openapi.yaml /backend/openapi.yaml
RUN npm run build

FROM caddy:2.10-alpine

COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /frontend/dist /srv
