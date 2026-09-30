#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo '請先安裝並啟動 Docker Desktop'; exit 1; }
mkdir -p directus/database directus/uploads directus/extensions
docker compose up -d
for attempt in {1..30}; do
  if docker compose exec -T directus node -e "fetch('http://127.0.0.1:8055/server/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo 'Directus 已啟動：http://localhost:8088。使用 .env 設定的管理員帳號登入。'
    exit 0
  fi
  sleep 2
done
echo 'Directus 啟動逾時，請執行 npm run directus:logs'
exit 1
