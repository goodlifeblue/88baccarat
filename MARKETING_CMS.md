# Directus 行銷文章管理

本文件是目前實作的操作入口。網站維持 Astro 靜態輸出，網址維持 `/<category>/<slug>/`。

## 已完成的文章模板

Breadcrumb → 唯一 H1 → 作者／發布與更新日期 → 目錄 → Markdown 內文（H2、H3、圖片、表格）→ FAQ → 相關文章。

Article Schema 自動產生；FAQ 有內容才顯示區塊及 FAQ Schema。SEO 標題與 H1 可分開設定。內文 H1 會轉為 H2，原始 HTML 不會執行；請使用 Markdown 插入圖片及表格。

## 本機啟動

1. 安裝並啟動 Docker Desktop。將 `.env.example` 複製成 `.env`，設定 `DIRECTUS_SECRET`、`DIRECTUS_ADMIN_EMAIL`、`DIRECTUS_ADMIN_PASSWORD`，使用自行產生的密碼與 secret。
2. 執行 `npm run directus:init`，開啟 http://localhost:8055 登入。
3. 在管理員使用者資料設定 static token，填入 `.env` 的 `DIRECTUS_ADMIN_TOKEN`。
4. 執行 `npm run directus:setup` 建立 articles、article_relations 與欄位。可重跑，只新增缺少的欄位／關聯，不覆蓋既有欄位。`schema.json` 是這個腳本的 API 定義檔，不是 Directus schema snapshot，不要拿它直接執行 schema apply。
5. 執行 `npm run directus:import` 匯入現有 Markdown。匯入維持原 slug 與分類，狀態為 published；已有同 slug 的文章會跳過，不覆寫行銷修改。
6. 建立下述建置讀取帳號，把它的 static token 設為 `DIRECTUS_API_TOKEN`。
7. 設定 `CONTENT_SOURCE=directus` 與正式 `SITE_URL`，執行 `npm run build`。

`.env.directus.local` 不會自動載入；請把需要的值放在 `.env` 或環境變數。所有 token 都是伺服器環境變數，請勿使用 PUBLIC_ 前綴，也不要將管理員 token 放進部署環境。

沒有 Directus 時保留 `CONTENT_SOURCE=local`，網站會使用原 Markdown。啟用 directus 後採單一 CMS 資料來源，不混入本機舊文章；API 錯誤或不合法內容會使建置失敗。

## 後台欄位與編輯規則

| 欄位 | 用途 | 行銷權限 |
| --- | --- | --- |
| title | 文章標題／H1 | 可編輯 |
| slug | 網址 | 建立時填寫；之後由管理員修改 |
| category | 文章分類 | 草稿／待審核可編輯 |
| excerpt | 摘要 | 可編輯 |
| cover_image | 媒體庫封面 | 可編輯 |
| content | Markdown 內文 | 可編輯 |
| author | 作者 | 可編輯 |
| status | draft／review／published／archived | 行銷僅可草稿／送審；審核者發布或下架 |
| published_at | 發布時間 | 審核者設定；發布文章不可留空 |
| updated_at | 更新時間 | Directus 自動記錄，不可寫入 |
| seo_title | SEO Title | 可編輯；未填使用標題 |
| seo_description | Meta Description | 可編輯；未填使用摘要 |
| canonical | 標準網址 | 後台提示欄位，不儲存；網站依 SITE_URL、分類、slug 自動產生 |
| noindex | 禁止索引 | 僅管理員可修改；預設 false，true 時輸出 robots noindex |
| created_by | 建立者 | Directus user-created 自動記錄，不可寫入 |

FAQ、相關文章、封面替代文字及精選設定保留。FAQ 用可排序問題／答案清單；內文圖片以 `![替代文字](網址)` 設定。related 直接選取文章，網站僅顯示已發布文章。cover_image 優先於舊圖片網址 image。

category 的 baccarat、strategy、guide、tips、comparison 各有文章頁。faq 分類只供常見問題彙整，不建立獨立文章頁。已發布文章的編輯交由審核者處理，避免修改直接進入正式網站。此版本沒有草稿版本分支；需要修改已發布文章时，由審核者操作，或先退回草稿（下一次建置將下架）。

## 權限

`directus:setup` 會建立獨立的「文章行銷（草稿與送審）」policy，定義見 `directus/marketing-permissions.json`。不自動指派使用者或角色。請將它指派給行銷角色，避免同時掛上其他更寬鬆的 policy（Directus 權限會合併）。既有同名 policy 保留不覆寫，需人工核對。唯讀介面之外，也透過 API 欄位白名單限制 slug、發布時間、noindex 等欄位。

- 行銷：讀取文章，新增草稿／送審，僅更新 draft／review。無刪文、發布或自動欄位寫入權限。相關文章關聯只允許修改草稿／待審核文章。
- 審核者：由管理員另建 policy，允許審閱、設定 published_at、發布及退稿。不可把審核者 policy 指派給一般行銷。
- 網站建置：只讀 articles（status = published）及 article_relations（article_id.status = published）；不給後台或寫入權限。設定其 static token 至 DIRECTUS_API_TOKEN。
- 媒體：行銷的上傳／讀取權限另依網站資料夾設定。Public policy 僅允許讀取網站圖片資料夾的 directus_files；圖片 URL 不帶 token，不應開放私人媒體庫。

舊 schema 若尚未轉換，setup 在修改前會停止。請先備份，再透過 Directus API／後台遷移 description → excerpt、cover → cover_image、publishedAt → published_at、updatedAt → updated_at、seoTitle → seo_title、seoDescription → seo_description；已儲存的 canonical 覆寫值不再使用。前台讀取仍相容舊欄位，但新匯入使用新命名。

## 發布上線

行銷儲存 published 內容後，需重新建置並部署才會更新。Cloudflare Pages 建置指令為 `npm run build`，輸出 `dist`，設定 CONTENT_SOURCE、DIRECTUS_URL、DIRECTUS_API_TOKEN、SITE_URL。雲端建置必須能連上 Directus；localhost 只適用本機。

可在 Directus Flow 設定 articles 的 create／update／delete 事件，以及 article_relations 的變更事件，透過 HTTP POST 呼叫 Cloudflare Pages Deploy Hook。下架與刪除也必須觸發建置，不能只監聽狀態改為 published。Hook URL 視同密鑰，僅放後台。此專案尚未設定實際的部署 Hook。

## 驗證

- `npm run build`：Astro 型別檢查與靜態建置。
- `npm run test:directus`：以暫時的本機 API 驗證遠端 Markdown、單一 H1、表格、圖片、FAQ、Article Schema、SEO 覆寫、相關文章、分頁、草稿排除、RSS，審核文章排除、自動 canonical、noindex，以及 CMS 斷線會阻止建置。需要允許本機監聽埠。

模擬測試不代表實際 Directus schema、帳號權限與部署 Hook 已完成驗證。

## 可搬移的圖片路徑

封面 `cover_image` 使用 Directus Files 關聯，只儲存 File ID。內文圖片上傳至 Directus 媒體庫後，建議以相對路徑插入：

```markdown
![圖片替代文字](/assets/12345678-1234-1234-1234-123456789abc)
```

亦支援直接用 UUID 當圖片目的地，以及 Markdown reference-style 圖片。Astro 在渲染時依 `DIRECTUS_URL` 組合封面、內文和 SEO 圖片網址，支援 Directus 部署於子路徑。圖片查詢參數如 width/key 保留，但移除 access_token；媒體須有適當公開讀取權限。

若編輯器已插入完整 CMS 網址，同環境網址會自動解析。搬遷後將舊 CMS 基底網址加入 `DIRECTUS_LEGACY_URLS`（逗號分隔），可讓舊內文圖片改用新主機：

```env
DIRECTUS_URL=https://cms.example.com
DIRECTUS_LEGACY_URLS=http://localhost:8055
```

轉換的是輸出 HTML，不會自動改寫後台儲存的 Markdown。既有網站 `/images/...` 圖片與外站圖片保持原路徑，不會被自動搬入媒體庫。搬遷時須一起搬資料庫及 uploads，保留原 File ID。

驗證：`node scripts/test-directus-assets.mjs`、`npm run test:directus`。圖片路徑處理不改變靜態建置／開發同步頻率。
