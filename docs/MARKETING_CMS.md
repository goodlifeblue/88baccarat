# Directus 行銷文章管理

環境與正式部署請以 [交付與維護手冊](HANDOVER.md) 為準。正式 Deploy Hook 暫不開啟，先經 CI 審核與 SEO gate。

本文件是目前實作的操作入口。網站維持 Astro 靜態輸出，網址維持 `/<category>/<slug>/`。

Articles、Pages、Redirects 列表皆顯示建立時間、更新時間與最後編輯者，由系統自動記錄。Articles 原有發布時間、更新時間與建立者保留。新資料尚未修改時，最後編輯者／更新時間可能為空；既有資料依活動紀錄回填，有缺漏的歷史資料不猜測。文章改網址自動產生或更新的 Redirects 也會記錄時間與操作帳號。

## 已完成的文章模板

Breadcrumb → 唯一 H1 → 作者／發布與更新日期 → 目錄 → Markdown 內文（H2、H3、圖片、表格）→ FAQ → 相關文章。

Article Schema 自動產生；FAQ 有內容才顯示區塊及 FAQ Schema。SEO 標題與 H1 可分開設定。內文 H1 會轉為 H2，原始 HTML 不會執行；請使用 Markdown 插入圖片及表格。

## 本機啟動

1. 安裝並啟動 Docker Desktop。將 `.env.example` 複製成 `.env`，設定 `DIRECTUS_SECRET`、`DIRECTUS_ADMIN_EMAIL`、`DIRECTUS_ADMIN_PASSWORD`，使用自行產生的密碼與 secret。
2. 執行 `npm run directus:init`，開啟 http://localhost:8088 登入。
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

category 的 baccarat、strategy、guide、tips、comparison 各有文章頁。faq 分類只供常見問題彙整，不建立獨立文章頁。已發布文章的編輯交由審核者處理，避免修改直接進入正式網站。articles 已啟用 Content Versioning；已發布內容由審核者建立版本、審閱後 Promote。不要退回草稿代替版本，否則下一次建置將下架。行銷的版本編輯權限需另行審核配置。

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
DIRECTUS_LEGACY_URLS=http://localhost:8088
```

轉換的是輸出 HTML，不會自動改寫後台儲存的 Markdown。既有網站 `/images/...` 圖片與外站圖片保持原路徑，不會被自動搬入媒體庫。搬遷時須一起搬資料庫及 uploads，保留原 File ID。

驗證：`node scripts/test-directus-assets.mjs`、`npm run test:directus`。圖片路徑處理不改變靜態建置／開發同步頻率。

## 301 轉址規則

後台 `redirects` 集合只有四個業務欄位：old_path、new_path、status_code（固定 301）、enabled。另有系統 UUID 主鍵。目前單站使用，不需要 site 欄位。管理員可管理規則；一般行銷帳號未額外開放轉址寫入權限。

```text
old_path: /guide/baccarat-rule/
new_path: /guide/baccarat-rules/
status_code: 301
enabled: true
```

路徑必須以 `/` 開頭；目前不支援外站 URL、query、fragment、萬用字元與百分比編碼。文章網址請填尾斜線。建置會檢查重複來源、循環、已存在頁面的來源衝突，以及 Cloudflare 的 2000 筆靜態規則限制；連續轉址會合併到最終目的地。停用規則不輸出。若已有 public/_redirects，請先把規則整合到 CMS，避免兩份規則互相覆蓋。

執行 `npm run build` 後，`dist/_redirects` 會包含：

```text
/guide/baccarat-rule/ /guide/baccarat-rules/ 301
```

將整份 dist 上傳 Cloudflare Pages 後，由 Cloudflare 回傳 HTTP 301 與 Location。Astro 的 dev／preview 不負責執行這份規則；它也不是 HTML meta refresh。CMS 修改規則後需要重新建置與上傳，不會立刻影響已上線網站。自訂 Pages Functions 若接管相同路由，需自行處理轉址。

### 自動記錄文章改址

本機 Compose 已掛載 `directus/hooks/redirects`。Directus 啟動時會安裝 SQLite trigger：已發布文章修改 slug／category，且儲存後仍是 published 時，在相同資料庫交易中記錄舊 → 新網址。既有指向舊網址的規則一併更新；改回先前 slug 時解除該目標的舊規則。更新失敗會一起回滾。草稿、待審核文章與 FAQ 彙整集合不自動產生轉址。

新環境先啟動 Directus，再執行 `npm run directus:setup`，最後 `docker compose restart directus` 啟用觸發器。若建置帳號使用其他 policy 名稱，需自行加上 redirects 的 read 權限（enabled = true）。

目前自動記錄實作限定 SQLite；搬到 PostgreSQL 或不支援自訂 extension 的遠端方案時，必須另做等效觸發器。資料庫中的 trigger 會隨 SQLite 備份保留，移除 extension 不會自動移除 trigger。

驗證：`node scripts/test-redirects.mjs` 驗證規則，`npm run test:directus` 驗證產出檔案；`node scripts/test-directus-hook.mjs` 會在實際後台建立並清除暫時文章，驗證改址與回滾。

## 導覽列

選單與 navbar 品牌設定已移入 Directus，請依 [導覽管理 SOP](NAVIGATION.md) 新增、排序、送審及發布。桌面與手機版共用相同資料。

## 整站頁面與網站設定

首頁、文章列表、一頁式、特殊頁、Banner、頁尾與共用文案均已移入 Directus；請依 [整站內容管理 SOP](PAGES.md) 操作。程式維持版型與部署保護，CMS 管理內容。

## 編輯防呆與警示

圖片上傳每張上限 **5 MB**，超過請先壓縮或降低尺寸。替換圖片超限時，後台會顯示錯誤並保留原圖；影片不適用此圖片限制。

文章、頁面、導覽、輪播、全站設定、相關文章及轉址均有儲存檢查；欄位下方會顯示操作提醒。若出現中文錯誤提示，依訊息補齊資料後再儲存。草稿未完成時不要發布；未完成的輪播或浮動按鈕先停用。

首頁、全站設定與正在引用的媒體有刪除保護；下架頁面前先處理導覽與其他引用。完整規則與維護方式見 [後台內容防呆](CONTENT_GUARDS.md)。

## 首頁新增區塊與挑選文章

文章尚未完成時，保持狀態「暫存文章（草稿）」並按右上角儲存。標題、分類、摘要、內文、網址可留白；之後從文章清單重新開啟編輯。暫存不會發布到前台，離開前需手動儲存。既有網址權限保持不變：若首次暫存未填網址，發布前請管理員補填。完整規則見 [文章暫存](CONTENT_GUARDS.md#文章暫存)。

左側「首頁區塊」可新增區塊、直接新增文章、勾選既有文章，並分別拖曳區塊及文章排序。草稿文章不會出現在前台；區塊由行銷主管啟用。完整操作見 [首頁區塊管理](HOMEPAGE_BLOCKS.md)。
