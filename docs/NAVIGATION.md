# 導覽列管理

本機 Directus：<http://localhost:8088/admin>。

## 管理選單

「內容 → 導覽項目（navigation）」管理桌面／手機 navbar。頁尾連結由「網站全域設定 → 頁尾連結群組」獨立管理。

| 欄位 | 用途 |
| --- | --- |
| 選單文字 `label` | 顯示名稱 |
| 連結類型 `link_type` | 選擇 Directus 頁面，或自訂網址 |
| 連結頁面 `page` | 選取頁面管理中的頁面，自動使用該頁網址 |
| 連結網址 `href` | 自訂網址時填寫；站內使用 `/guide/`，站外使用完整 `https://…` |
| 排序 `sort` | 數字越小越前面；列表可依排序欄位拖曳排序 |
| 發布狀態 `status` | 草稿、待審核、已發布、已停用；網站只讀已發布 |
| 另開分頁 `open_in_new_tab` | 勾選後另開分頁，自動加上 noopener noreferrer |

新增項目預設是草稿。一般行銷權限可新增、修改、刪除草稿／待審核項目，不能發布或修改已發布項目；審核者／管理員確認連結、順序後發布。已發布項目的更新或停用由管理員處理；一般行銷人員請交給審核者，勿直接複製並發布造成重複連結。建立選單不會自動建立新頁面，站內網址必須已存在，否則 SEO 建置檢查會阻擋部署。至少保留一個已發布項目。

「內容 → 導覽列設定（navbar_settings）」管理 navbar 品牌名稱、符號與品牌連結。此單筆設定允許行銷修改，沒有獨立草稿狀態；修改會出現在下一次建置，正式發布仍須通過部署流程。兩個集合均開啟 Directus 版本管理。

目前維持單層選單；樣式、手機開關與無障礙操作文字由程式管理。頁尾品牌文案、連結與版權文字已移入「網站全域設定」。所選頁面必須已發布；已發布選單若連到草稿、被刪除或不存在的頁面，會阻擋建置。

## 更新如何生效

- 本機 `npm run dev`：儲存已發布的選單／品牌設定後，重新整理網站即可讀取更新，不必重啟開發伺服器。
- 靜態 `dist`／線上網站：必須重新建置、檢查、部署。CMS 按儲存不會自行覆寫 Cloudflare 網站。
- 測試與正式站使用各自 Directus；沿用 [交接 SOP](./HANDOVER.md) 的部署與審核流程。
- CMS 失效、沒有已發布項目、連結格式不合法都會阻擋建置；不會偷偷換回寫死的選單。

## 初始化與維護

```sh
npm run directus:setup
npm run directus:import-navigation
npm run directus:import-site
npm run test:navigation
npm run build
```

初始化腳本只允許操作本機 Directus。匯入只在選單集合為空時新增既有 8 個項目，既有品牌設定與非空選單集合不會覆寫。它是初始化工具，不是內容同步工具；刻意清空集合後再執行會重新加入預設選單。正式環境應依 SOP 做已審核的 schema／權限遷移，不能用本機腳本直接連正式資料庫。

`CONTENT_SOURCE=directus` 使用 CMS；`CONTENT_SOURCE=local` 僅供離線 Markdown 開發與 PR 測試，使用 `directus/navigation-seed.json` 的初始化範例。Staging／Production 強制使用 Directus。API Token 僅用於伺服器端建置／開發請求，不放入瀏覽器。

網站建置政策需對 `navigation`、`pages` 有已發布項目的唯讀權限，對 `navbar_settings`、`site_settings` 有唯讀權限。`directus:setup` 會為既有的「網站建置：已發布文章唯讀」與行銷政策補上缺少的規則，並為導覽加入 `page`／`link_type` 欄位權限；其餘既有自訂規則保留。政策仍需指派給實際帳號／角色，若使用自訂政策名稱，需另外設定同等權限。

Directus 權限與 API 參考：[官方 API 文件](https://docs.directus.io/reference/introduction)。
