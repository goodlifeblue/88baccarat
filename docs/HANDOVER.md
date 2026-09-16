# 交付與維護手冊

## 目前實際狀態

- 本機 Astro + Docker Directus 可運作，資料庫為 SQLite。
- 專案已新增三環境檢查、SEO gate、GitHub Actions 定義及交付規範。
- 已唯讀核對 GitHub goodlifeblue/88baccarat：main 尚未受保護，未列出任何部署 Environment。
- Staging／Production 主機、網域、Access、CI secrets、分支保護、Environment 審核者**尚未完成平台設定**。
- `config/deployment.json` 的網址與 Pages project 刻意留空；`config/url-baseline.json` 尚未核准。發布預設停用。
- 這些程式檢查不能阻止持有 Cloudflare 正式部署權限的人繞過 repo 手動上傳。真正的限制由帳號權限、CI 專用 Token、分支保護與審核者共同建立。

## 架構與責任

| 系統 | 管理內容 | 負責人（交付時填寫） |
| --- | --- | --- |
| Astro repo | 版型、元件、SEO/Schema、路由、Directus API、CSS/JS | 待指定 |
| Directus | 文章、FAQ、封面/圖片、相關文章、SEO 標題/描述、301 | 待指定 |
| Cloudflare Pages | 靜態檔案、_redirects 執行、網域及 HTTPS | 待指定 |
| DNS / 網域註冊商 | 網域持有、DNS、續約 | 待指定 |
| 備份與事故處理 | 資料保留、還原演練、回復窗口 | 待指定 |

既有 13 個入口頁面、首頁 Banner／區塊、導覽、頁尾、SEO 預設值與 404 文案已移入 Directus；16 個圖片／影片素材已存入 Files。操作見 [頁面管理](./PAGES.md) 與 [導覽管理](./NAVIGATION.md)。程式保留版型、互動、既有文章路由與 SEO／安全規則；正式網址仍由部署環境管理。

## 三環境

| 環境 | APP_ENV | CMS/資料 | 索引 | 更新方式 |
| --- | --- | --- | --- | --- |
| Local | local（預設） | localhost:8055，獨立資料 | noindex + Disallow | npm run dev／build |
| Staging | staging | 獨立遠端 CMS/DB/uploads/帳號 | noindex + X-Robots-Tag + Access | develop CI |
| Production | production | 正式專用 CMS/DB/uploads/帳號 | 可索引；核准例外除外 | main + 審核後 CI |

非本機建置不讀取本機 .env。Staging 與 Production 的前台網址、CMS 網址及 Pages project 必須不同，且與 config/deployment.json 完全一致。不同網址不代表資料庫已隔離，負責人仍需檢查實際 DB、儲存桶及 Token。Local 只允許存取 loopback CMS；目前的 setup/import/真實 Hook 測試/backup 均限本機。

## 首次啟用發布（由專案擁有者完成）

1. 建立獨立 Staging、Production Directus，分開資料庫與 uploads。不得從 Staging 掛載正式磁碟或使用正式寫入 Token。
2. 建立兩個獨立 Cloudflare Pages project。Staging project 的 production branch 設 develop，正式 project 設 main。關閉 Cloudflare Git 自動部署與現有 Deploy Hook，避免繞過本 repo 的 gate；本流程由 Actions 上傳。
3. Staging 啟用 Cloudflare Access，保護自訂 staging 網域、project 的 pages.dev 網域以及所有 preview/分支入口。只保護一個網域會留下其他入口。驗證未登入時拿不到內容；noindex 不等於存取限制。
4. 以 PR 填好 config/deployment.json：兩個 siteUrl、directusUrl、pagesProject。網址必須是 HTTPS 正式主機，不能填 localhost 或 example.com。
5. 將現有正式站 Sitemap、重要落地頁與歷史網址清單比對 config/url-baseline.json。本檔目前只是本機頁面快照，不宣稱是線上完整清單。完成審閱後才設 approved=true、siteUrl=正式根網址。不要為了讓錯誤消失而自動刪掉舊路徑；移除頁面先補有效 301。
6. GitHub 建立 staging、production Environments。限制 staging 只允許 develop；production 只允許 main，設定必要審核者、禁止自行審核與管理員繞過（依帳號方案可用功能）。若方案不支援所需保護，維持部署停用，先調整方案或選用可強制審核的 CI。
7. 每個 Environment 分別設定 Variables：SITE_URL、DIRECTUS_URL、DIRECTUS_LEGACY_URLS（選填）、CLOUDFLARE_ACCOUNT_ID；Secrets：DIRECTUS_API_TOKEN、CLOUDFLARE_API_TOKEN。CMS Token 只能讀 published 文章、關聯、enabled redirects，不可為管理員。
8. Cloudflare Token 只放 CI Environment，不放 Mac、repo 或 repo-wide secrets。正式帳號只讓少數發布負責人管理；一般開發者沒有正式 Pages 編輯/部署權限。若 Token 的權限粒度只到帳號，建議 Staging/Production 分屬不同 Cloudflare 帳號，避免測試 Token 可寫正式 project。
9. main、develop 啟用分支保護：禁止直接 push/force push、要求 PR 與 checks job、必要審閱、限制管理員繞過。為 workflows、config/、SEO/路由與 Directus schema 指定實際負責人的 CODEOWNERS；此 repo 未虛構帳號或寫入無效審核人。
10. 上述設定完成後才將 Repository Variable ENABLE_RELEASE_PIPELINE 設為 true。先合併 develop，驗證 staging 可用、Access 與 SEO 報告，再合併 main。不要略過首次 staging 發布。

CI 的 production promotion 檢查要求 main 的 Git tree 與已成功發布的 develop tree 相同，並有未過期的 staging artifact。它比對程式版本，**不代表兩套 CMS 的內容相同或已完成內容審核**。main 有額外修補時須先回到 develop 驗收；不可只在 main 改 hotfix。

## 日常改版

feature/* → PR 到 develop → checks → staging 自動部署 → 人工驗收 → PR 到 main → production Environment 審核 → 重新讀取正式 CMS、建置、seo-check → 保存 artifact → CI 部署。

開發者不在 Mac 執行 production build/deploy。不要將 Local 的 dist 手動上傳正式 project；Local 產物含 noindex。即使本機偽造 CI 環境變數，沒有正式 Cloudflare Token 就無法透過正常權限部署，因此平台權限不可省略。

內容發布不必改程式碼：完成內容審核後，由發布負責人在 main 執行 Reviewed site release 的 workflow_dispatch；同样須通過 Environment 審核與 gate。暫不設 Directus 自動直連正式 Deploy Hook。

## SEO gate

`npm run build` 最後一定執行 `npm run seo-check`；失敗回傳非零狀態，不會進入 CI 部署。也可對目前 dist 單獨執行 seo-check。

檢查：每頁唯一且非空的 H1/Title/Description、自我 canonical、環境 robots/meta/header、XML Sitemap 完整性、Article/FAQ/WebSite 基本 Schema、圖片 URL/本機檔案/alt 屬性、站內連結與錨點、既有網址保留或有效 301、轉址循環/衝突、產物環境與頁面雜湊。

config/seo-policy.json 管理有意 noindex 的正式頁面（預設僅 404）及外部圖片來源。例外修改需要 PR 審查。正式文章本身若意外設定 noindex，gate 會阻擋，不會自動忽略。

報告位於 .artifacts/seo-report.json；dist/release-manifest.json 記錄環境、Git SHA、時間、路徑及頁面雜湊。外部圖片/連結只查 URL 格式與來源，本 gate 不做遠端可用性探測、不評分內容品質，也無法保證 Google 收錄。正式前仍需人工檢查實際圖片可讀性、Access、HTTPS 與關鍵落地頁。

## 文章發布與版本

新文章：draft → review → 審核者確認網址/日期/圖片/FAQ → published → 觸發受審核的網站發布。

行銷 policy 只允許修改 draft/review，不可直接改 published；不能拿管理員帳號作為日常行銷帳號。角色多個 policy 的權限會合併，需避免額外授予寫入權限。草稿不會出現在公開前台，現階段也沒有已實作的公開 Preview Token 頁面。

已發布文章修改：setup 會開啟 Directus articles Content Versioning。由有權限的審核者建立獨立版本，先於 Directus 預覽/審閱，必要時將草稿副本放到獨立 Staging 驗收；核准後 Promote 到主版本，再走網站發布。一般行銷的版本編輯/提升權限尚未額外開放，需以測試帳號確認後設定；不要用「把正式文章改回 draft」代替版本，否則下一次建置會下架。

改 slug/分類必須經審核。SQLite 的自動 301 只涵蓋已發布且儲存後仍 published 的網址變動；版本 Promote 後也必須在 redirects 清單核對規則，因系統事件行為或權限可能不同。保留舊網址清單，build 會檢查缺頁是否有有效 301。

## 不可任意變更

slug、URL 結構、canonical、robots、Sitemap、Schema、redirects、Directus 欄位名稱、APP_ENV/網域/Token、CMS 權限、資料庫引擎、CI 與 Pages branch 設定。

以上變更必須附：影響頁面、遷移步驟、測試證據、301（若需要）、回復方式。升級依賴/Directus 先在 Local 與 Staging 驗证，固定版本，禁止直接更新正式容器為 latest。

## 備份與還原

本機：`npm run backup:local`。會短暫停止 Directus、封存資料庫/圖片/Schema/Hook/Compose、驗證 archive 可讀並產生 SHA-256，最後恢復原本服務狀態。資料在 backups/（不進 Git）。不要把這個本機腳本直接套用到正式。

備份雖排除 .env，資料庫本身仍含帳號、Token 與內容，需加密存放並限制權限。保留 .env/密鑰於密碼管理工具；不要把明文秘密寫進交付包。

正式站建議每日備份、重要資料變更前額外備份；由負責人決定保留期、可接受遺失時間（RPO）及恢復時間（RTO），並記錄異地副本。SQLite 用停機副本或正式 SQLite backup API；PostgreSQL 使用一致性備份，不能直接複製運作中的資料檔。

還原演練先在獨立目錄與測試環境進行：核對 SHA-256 → 解壓可信 archive → 比對 schema/程式版本 → 啟動隔離 Directus → 核對文章數、圖片、帳號、FAQ、Redirects → 網站 build/seo-check → 記錄耗時與結果。不得第一次還原就覆蓋正式資料。

實際事故還原：限制內容寫入 → 先備份故障當下資料 → 停止服務 → 保留原 database/uploads 並替換為經驗證的配對副本 → 使用對應版本的程式與 Hook 啟動 → 核對內容 → 建置與受控發布。SQLite 的自動 301 trigger 隨 DB 備份保留；換 PostgreSQL 時需要另做等效遷移。

## 故障回復

- 僅版型/JS 回歸：由有權限的發布負責人於 Cloudflare 回復上一個已驗收的部署；比對 release manifest，記錄事故。這不會回復 CMS。
- 內容誤改：先停止新發布，使用 Directus revision/version 或經驗證備份修復內容，再建置發布；不要用舊 dist 掩蓋資料庫仍錯誤的狀態。
- CMS 斷線：建置會失敗，保留既有已部署靜態頁面；媒體若依賴 CMS 可能同時受影響。
- Token 外洩：撤銷並更換對應 Token，檢查紀錄，再重跑受保護 CI。

GitHub artifact 保留 30 天，不是永久備份；正式發布紀錄與必要產物要另外保存。將「誰可回復、如何聯絡、允許的事故處理窗口」補入交接清單。

## 交接驗收清單

- [ ] Git repo、Cloudflare、網域註冊商、Directus 主機及備份的組織所有權已交接
- [ ] 所有環境網址、Pages project、DB/儲存位置、版本與維護人已登記
- [ ] 帳號採個人登入，管理員與行銷分離，備援管理員可用
- [ ] Secrets 已透過密碼管理工具移交，離職/交接 Token 已輪替
- [ ] staging 全部公開入口都經 Access 驗證，資料未連正式 DB
- [ ] main/develop 分支保護、production 審核者與最小 Cloudflare 權限已實測
- [ ] 正式網址 baseline 已核准；一次正常發布及一次故障阻擋演練完成
- [ ] 一次備份還原與部署回復演練完成，RPO/RTO/保留期已登記
- [ ] 操作人已閱讀 COMMANDS.md、MARKETING_CMS.md 與本文件

參考：[GitHub Environment 保護](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)、[Cloudflare Preview/Access](https://developers.cloudflare.com/pages/configuration/preview-deployments/)、[Directus Content Versions](https://docs.directus.io/reference/system/versions)。
