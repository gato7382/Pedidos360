FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src src
COPY public public
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/pedidos360/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /etc/nginx/snippets
COPY api-routes.conf /etc/nginx/snippets/pedidos360-api-routes.conf
COPY proxy_params /etc/nginx/proxy_params
COPY docker-entrypoint.d/30-runtime-config.sh /docker-entrypoint.d/30-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/30-runtime-config.sh
EXPOSE 80 3000
