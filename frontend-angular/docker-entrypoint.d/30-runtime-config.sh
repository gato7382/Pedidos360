#!/bin/sh
set -eu
mkdir -p /usr/share/nginx/html/assets
cat > /usr/share/nginx/html/assets/config.js <<EOF
window.PEDIDOS360_CONFIG = {
  clientId: "${ENTRA_SPA_CLIENT_ID:-${ENTRA_CLIENT_ID:-d0b2e05c-58b9-4d02-aade-281d22bb3074}}",
  tenantId: "${ENTRA_TENANT_ID:-1a1fed8a-8960-4a10-95a1-f9d77a98832a}",
  scope: "${ENTRA_SCOPE:-api://d0b2e05c-58b9-4d02-aade-281d22bb3074/access_as_user}",
  apiBaseUrl: "${API_BASE_URL:-}"
};
EOF
