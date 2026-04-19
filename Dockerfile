# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-bookworm AS build
WORKDIR /app

# Instalar dependencias primero (capa cacheada)
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar el resto del código y construir
COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
