# 專案指令手冊

## 本專案固定網址

`npm run dev` 會先檢查 4388。若同一專案已在執行，顯示現有網址並正常結束，不啟動第二份；若是其他或無法確認的程序，報錯且不停止它。身分辨識使用本機 `lsof` 與 `ps`，無法辨識時不會自動終止程序。

需要重啟本專案時，依序執行：

```sh
npm run dev:stop
npm run dev
```

停止指令只處理已確認工作目錄與 Astro 命令屬於本專案的 4388 程序，不停止其他專案或 Directus。一般修改程式由 Astro 自動更新，無須重複啟動。

| 服務 | 網址 | 啟動指令 |
| --- | --- | --- |
| Astro 開發站 | http://localhost:4388 | `npm run dev` |
| 靜態預覽 | http://localhost:4389 | `npm run preview`（先建置） |
| Directus 後台 | http://localhost:8088/admin | `npm run directus:start` |

本專案不再使用 4321／4322 或主機 8055。Astro 綁定 127.0.0.1 並啟用 strictPort，連接埠被占用會報錯，不會自動換到另一個專案的埠。Docker Compose 專案固定為 `88baccarat`，主機 8088 對應容器內部 8055，沿用本專案的 database／uploads 目錄。

Directus 使用專案專屬 session／refresh Cookie 名稱，避免其他 localhost Directus 覆蓋登入狀態（[官方設定](https://docs.directus.io/self-hosted/config-options)）。舊書籤請更新，後台需重新登入。`DIRECTUS_LEGACY_URLS` 保留舊 8055 素材網址的轉換相容性。

正式站的新流程以 [交付與維護手冊](docs/HANDOVER.md) 為準：Production 僅由受保護 CI 發布，本機 dist 僅供本機/隔離測試使用。

所有專案指令都在專案根目錄執行：

```bash
cd /Users/moby/Documents/site/88baccarat
```

專案指定 Node.js 22.22.3（見 `.nvmrc`）與 npm 10.9.8。Docker Desktop 必須先啟動，才能操作本機 Directus。

## 每天開工

```bash
open -a Docker
```

等待 Docker 顯示 Running，再執行：

```bash
npm run directus:start
npm run dev
```

- 網站：http://localhost:4388（實際連接埠以終端機輸出為準）
- Directus：http://localhost:8088
- `npm run dev` 會持續執行；按 `Ctrl+C` 停止，其他指令可另開終端機執行。

## 安裝依賴

| 指令 | 用途 |
| --- | --- |
| `node --version` | 查看 Node.js 版本 |
| `npm --version` | 查看 npm 版本 |
| `npm ci` | 依鎖定檔安裝依賴；會重建 node_modules，適合剛下載專案時使用 |
| `npm install` | 安裝依賴並同步鎖定檔；適合依賴宣告與鎖定檔不一致時使用 |
| `npm run` | 列出 package.json 中的指令 |

若出現找不到 dotenv，先執行 `npm install`，再重跑原本指令。不要刪除 .env 或資料庫。

## Docker 與 Directus

| 指令 | 用途 |
| --- | --- |
| `open -a Docker` | 在 macOS 開啟 Docker Desktop |
| `docker desktop status` | 查看 Docker Desktop 狀態 |
| `docker info` | 確認 Docker 引擎是否正常 |
| `docker compose version` | 查看 Compose 版本 |
| `npm run directus:start` | 啟動 Directus，等同 `docker compose up -d` |
| `docker compose restart directus` | 重啟 Directus，不重新載入修改後的 Compose 環境設定 |
| `docker compose up -d` | 啟動服務；設定變更時重建容器，套用 .env／docker-compose.yml |
| `npm run directus:stop` | 停止並移除本專案容器及網路，等同 `docker compose down` |
| `docker compose ps -a` | 查看容器狀態，包含已停止的容器 |
| `npm run directus:logs` | 持續查看 Directus 記錄；按 Ctrl+C 結束查看，不會停止服務 |
| `docker compose logs --tail 50 directus` | 查看最近 50 行記錄 |
| `curl --fail http://localhost:8088/server/health` | 檢查健康狀態；正常回傳 `{"status":"ok"}` |

資料庫與上傳檔案以資料夾掛載保存，`directus:stop` 不會刪除 `directus/database/`、`directus/uploads/`。修改 .env 的管理員帳密不會自動更改已建立的 Directus 帳號，帳號更新需在後台處理。

若下載映像時出現 `docker-credential-desktop: executable file not found`，可使用：

```bash
PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH" docker compose up -d
```

## 首次初始化與文章匯入

首次建立 .env 時，若檔案尚不存在，才執行以下指令；已有設定不要覆蓋：

```bash
cp -n .env.example .env
```

填寫設定後，依序執行：

```bash
npm run directus:init
npm run directus:setup
docker compose restart directus
npm run directus:import
```

| 指令 | 執行效果 |
| --- | --- |
| `npm run directus:init` | 建立本機資料夾、啟動容器並等待健康檢查 |
| `npm run directus:setup` | 建立缺少的文章／相關文章／Redirects 欄位與關聯，以及權限政策；不自動指派使用者 |
| `docker compose restart directus` | 欄位建立後重新載入自動轉址 extension，安裝 SQLite trigger |
| `npm run directus:import` | 將 src/content 下的 Markdown 匯入為 published 文章；同 slug 已存在則跳過，不覆寫後台內容 |

`setup` 與 `import` 需要 .env 的 `DIRECTUS_ADMIN_TOKEN`。先登入後台，在管理員使用者資料產生並儲存靜態 Token，再填入 .env。不要將 Token 貼入對話或提交 Git。

匯入保留既有圖片網址，不會自動上傳圖片到 Directus Files。舊 schema 若不符合目前命名，setup 會停止並提示遷移，請勿直接刪除資料。

## 網站開發、建置與預覽

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 執行 Astro 檢查、讀取內容並輸出靜態網站至 dist |
| `npm run preview` | 預覽已建置的 dist，不會重新抓取 Directus 或重新建置 |

目前 CMS 內容在載入／建置時讀取。後台修改後，本機開發請在執行 dev 的終端機按 `Ctrl+C`，再執行 `npm run dev`。正式輸出則重新執行 `npm run build`。

## 上傳 Cloudflare Pages

目前採本機建置、手動上傳，執行：

```bash
npm run build
```

完成後將整份 `dist` 上傳至 Cloudflare Pages。這個指令本身不會部署，也不需要把 Docker、.env 或資料庫上傳。

- 建置前將 SITE_URL 設為實際網站網址；robots 與 Sitemap 由建置產生，請檢查輸出與 SEO 報告。
- CONTENT_SOURCE=directus 時，本機 Directus 必須運作且讀取 Token 有權限。
- Directus 圖片若指向 localhost，上線後訪客無法存取；public/images 內的圖片會一起打包。
- Local/Staging 自動輸出 `noindex, nofollow`；Production 由環境與核准的 SEO 例外控制。
- CMS 模式會產生 `dist/_redirects`，必須一起上傳。301 由 Cloudflare Pages 執行，dev／preview 不會執行此檔案。
- 日後改用 Cloudflare Git 建置：Build command 為 `npm run build`，輸出目錄為 `dist`；Directus 必須可從雲端存取，並在 Cloudflare 設定環境變數。

## 測試與檢查

| 指令 | 驗證範圍／影響 |
| --- | --- |
| `npm run build` | 型別、靜態頁面與目前 CMS 資料／轉址規則 |
| `npm run test:directus` | 啟動暫時本機模擬 API，測試文章、SEO、圖片、草稿排除及 _redirects；不修改真實 CMS 文章 |
| `node scripts/test-directus-assets.mjs` | 圖片在本機、遠端及子路徑環境的 URL 解析 |
| `node scripts/test-redirects.mjs` | 301 路徑驗證、循環、重複、停用與轉址鏈 |
| `node scripts/test-directus-hook.mjs` | 連線真實 Directus，建立並清除暫時文章與規則，驗證改址及交易回滾；需管理員 Token |
| `git diff --check` | 檢查變更中的空白格式問題 |

模擬 API 測試需要允許本機監聽埠。測試後若要上傳網站，請再執行正式 `npm run build`，以目前環境的內容為準。

## 環境變數用途

在 .env 編輯設定，不要把真實密碼或 Token 寫進文件。

| 變數 | 用途 |
| --- | --- |
| `CONTENT_SOURCE` | local 讀取 Markdown；directus 讀取 CMS |
| `SITE_URL` | 前台網站正式網址，供 canonical、分享連結等使用 |
| `DIRECTUS_URL` | CMS 基底網址；本機為 http://localhost:8088 |
| `DIRECTUS_API_TOKEN` | 網站建置用唯讀 Token，需讀取已發布文章、關聯及已啟用轉址 |
| `DIRECTUS_ADMIN_TOKEN` | 欄位初始化、匯入及真實後台測試使用的管理員 Token |
| `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` | 第一次建立 Directus 管理員時使用 |
| `DIRECTUS_SECRET` | Directus 服務密鑰 |
| `DIRECTUS_LEGACY_URLS` | 搬遷前的 Directus 基底網址，逗號分隔，用來轉換舊圖片連結 |

Compose 會將 DIRECTUS_URL 傳入容器的 PUBLIC_URL，不必另外設定一份本機 PUBLIC_URL。`.env.directus.local` 不會由目前腳本自動載入。

資料模型、權限與圖片／301 詳細說明請看 [行銷 CMS 操作文件](MARKETING_CMS.md)。

## 發布防護與備份指令

| 指令 | 用途 |
| --- | --- |
| `npm run seo-check` | 檢查目前 dist 的環境、SEO、既有網址與 301；失敗回傳非零狀態 |
| `npm run test:release` | 驗證錯誤 canonical/noindex/連結/圖片/Schema/網址移除會被阻擋 |
| `npm run backup:local` | 短暫停止本機 Directus，備份資料庫/圖片/設定至 backups，最後恢復原狀態 |

正式部署沒有提供本機 npm deploy 指令；CI 執行 `node scripts/deploy-pages.mjs`，腳本拒絕一般本機環境。不要把正式憑證放進 .env。

## 導覽列管理

操作方式見 [導覽管理 SOP](docs/NAVIGATION.md)。

```sh
npm run directus:setup              # 建立導覽資料表及補齊權限（本機）
npm run directus:import-navigation  # 空集合才匯入原有選單，不覆寫既有內容
npm run directus:import-site        # 匯入頁面／全域設定／媒體，並關聯導覽
npm run directus:migrate-hero       # 舊 Hero 轉成第一張輪播，保留既有輪播與開關
npm run test:navigation             # 連結安全、草稿排除與失敗阻擋測試
npm run test:pages                  # 頁面類型、路徑、區塊與安全 Markdown
```

pages 日期欄位由 `npm run directus:setup` 建立並加入列表。已有本機 SQLite 資料需回填時，執行 `python3 directus/backfill-page-dates.py`，只會將缺少的日期依 Directus 活動紀錄補齊；不改文章或頁面文案，也不連線遠端資料庫。

同一指令也會建立「最後編輯者」欄位及列表顯示。既有本機頁面以 `python3 directus/backfill-page-editors.py` 依活動紀錄回填缺少的編輯者，不變更頁面內容與日期。

Articles 與 Redirects 也顯示建立時間、更新時間與最後編輯者。執行 `npm run directus:setup` 後，可用 `python3 directus/backfill-content-audit.py` 回填有活動紀錄的既有資料；既有日期與編輯者不覆寫。舊自動轉址若沒有活動紀錄，未知日期／編輯者保持空白。再執行 `docker compose restart directus` 啟用新版轉址觸發器，後續文章改網址會同步記錄轉址日期與操作帳號。
