#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo '請先安裝並啟動 Docker Desktop'; exit 1; }
mkdir -p directus/database directus/uploads directus/extensions
docker compose up -d
for attempt in {1..30}; do
  if curl --fail --silent http://localhost:8055/server/health >/dev/null; then
    echo 'Directus 已啟動：http://localhost:8055。使用 .env 設定的管理員帳號登入。'
    exit 0
  fi
  sleep 2
done
echo 'Directus 啟動逾時，請執行 npm run directus:logs'
exit 1
