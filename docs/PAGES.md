# Directus 整站內容管理

本機後台：<http://localhost:8055/admin>。網站：<http://localhost:4321>。

## 從哪裡修改

| Directus 內容集合 | 管理內容 |
| --- | --- |
| 頁面管理 `pages` | 首頁與既有 12 個入口頁面、新增頁面、頁面類型、標題、SEO、Markdown、Banner、內容區塊、FAQ |
| 導覽項目 `navigation` | Navbar 名稱、頁面關聯／自訂網址、順序、另開分頁、發布／停用 |
| 導覽列設定 `navbar_settings` | Navbar 品牌名稱、符號、品牌連結 |
| 網站全域設定 `site_settings` | 網站名稱、SEO／圖片預設值、內頁 Banner、分類文字與圖示、頁尾群組／文案、404、共用 UI 標籤、CTA |
| 文章 `articles` | 文章內容、封面、分類、FAQ、SEO 與相關文章 |
| Files → 網站公開素材 | 16 個已匯入素材與後續網站圖片／影片 |

實際網站模式為 `CONTENT_SOURCE=directus`，以上內容不再從 Astro 頁面中的固定文案讀取。`directus/seeds/`、`src/content/` 與 public 素材仍保留為初始化／離線開發範例，不是第二個正式內容來源。CMS 失效會阻擋建置，不會回退到舊資料。

## Page Type

| 類型 | 使用方式 |
| --- | --- |
| Single Page（一頁式） | 編輯 Markdown 內容，搭配可排序的內容區塊與 FAQ；適合介紹／教學頁 |
| Article List（文章列表） | 選擇既有文章分類或 all，自動列出該範圍的已發布文章；也可加介紹內容與區塊 |
| Custom Page（特殊頁） | 選擇「內容區塊」、「首頁 Banner＋內容區塊」、「彙整所有文章 FAQ」版型 |

「特殊頁」使用已支援的 Astro 版型，不執行後台提供的 JavaScript 或原始 HTML。要新增程式功能或全新版型仍走 PR；既有內容修改不必開 VS Code。

內容區塊使用 Directus 的表單式清單，可新增、編輯、排序：文字內容、文章卡片、分類輪播、說明卡片、行動按鈕。文章卡片可選分類、精選條件與數量。Banner 圖片／影片使用檔案選擇器。FAQ 使用問題／答案清單。

## 新增頁面並加入 Navbar

1. 在「頁面管理」新增草稿，填標題、摘要、Page Type、網址，例如 `/campaign/summer/`。
2. 編輯內容、SEO Title／Description、Banner 或區塊，送審。
3. 審核者確認後設成已發布；一般行銷政策只能建立／修改草稿與待審核內容。
4. 在「導覽項目」新增項目，選「連結類型：Directus 頁面」，再選剛才建立的頁面。
5. 設定文字、排序與另開分頁，完成審核後發布選單。
6. 本機開發模式重新整理即可看到新頁面與選單；線上仍須通過建置、SEO 檢查與正式部署。

現有 8 個 Navbar 項目已關聯到對應頁面，頁面網址由關聯自動取得。不必在兩處手動維護網址。停用／刪除頁面之前先處理導覽、頁尾、文章等站內連結；連到未發布頁面的選單會阻擋建置。

一般行銷政策不能修改既有頁面 `path`，也不能直接修改已發布頁面。管理員可管理發布內容；若要保留線上版本同時準備修改，可由具版本權限的審核者使用 Directus 版本管理。這次沒有新增未發布頁面的公開預覽網址。

Navbar 品牌與網站全域設定是單筆設定，行銷可以修改，沒有獨立發布狀態；修改會進入下次建置。正式部署審核仍是最後的發布關卡。

## 網址與 SEO

- 保留既有網址與文章路由，Canonical 由環境網址和頁面路徑產生，行銷不手填 Canonical。
- 頁面路徑以 `/` 開頭、結尾，不使用 query、fragment 或副檔名；首頁是 `/`。
- `/baccarat/*`、`/strategy/*`、`/guide/*`、`/tips/*`、`/comparison/*` 的子路徑保留給文章。新增一般頁面請用其他路徑。
- 既有文章分類代碼屬於程式路由契約；後台可改分類顯示文字，新增分類代碼需同步調整路由。
- 改 `pages.path` 目前不自動建立 301，需在 Redirects 建立舊 → 新路徑，並維護正式 URL baseline。文章既有的 slug 自動轉址機制不受影響。
- 修改 `seo_title` 會完整覆寫 Title；不填則由頁面標題＋網站名稱產生。
- 草稿不生成路由。Markdown 的 H1 轉成 H2，原始 HTML 不執行，模板保持唯一 H1。
- Local／Staging 維持 noindex；正式環境仍受既有 SEO gate 保護。

## 圖片與影片

遷移工具將 public 圖片與首頁影片匯入「網站公開素材」資料夾，資料庫存 File ID 或 `/assets/<id>`，網站依環境的 DIRECTUS_URL 組合 URL，不存本機完整網址。

「網站公開素材」可匿名讀取，僅放要公開到網站的檔案。其他資料夾不因這次設定而公開。行銷可在此資料夾上傳／選擇檔案，沒有刪除既有媒體權限，避免移除仍被引用的素材。分類清單的圖示欄位接受 File ID 或 `/assets/<id>`；Banner、影片與共用圖片使用檔案選擇器。

素材參照仍由 Directus 提供；Cloudflare 上線時必須使用持續可連線的對應遠端 Directus，不能依賴本機 localhost。

## 初始化、驗證與交接

```sh
npm run backup:local
npm run directus:setup
npm run directus:import-navigation
npm run directus:import-site
npm run test:navigation
npm run test:pages
npm run test:directus
npm run build
```

以上維護工具只允許本機。整站匯入保留既有同路徑頁面、單筆設定、文章文字、Navbar 名稱與排序，重跑不重複上傳同一來源素材。現有文章僅替換本機媒體參照；Directus 可能因此自動更新文章更新時間。

初始化後，以 Directus 為準。匯入不是雙向同步；改 seeds 不會覆寫 CMS 內容。正式與測試環境需要各自遷移 schema、權限、資料及 Files，依 [交接手冊](./HANDOVER.md) 做已審核操作，禁止用本機工具直接連正式庫。
