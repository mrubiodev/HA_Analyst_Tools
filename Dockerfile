# ── Stage 1: Build ──────────────────────────────────────────
# node:22-bookworm: glibc + prebuilts de canvas disponibles
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . ./
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]