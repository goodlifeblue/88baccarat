# CMS 內容功能要求

本專案的行銷後台必須防止誤填造成前台故障。新增或修改 Directus 功能時，同步處理：

- 欄位的中文操作提示，以及錯誤時可理解的欄位／項目訊息。
- 伺服器端儲存驗證；不能只依賴 UI 必填或前台檢查。
- 草稿與發布條件、啟用前所需資料、圖片／影片類型及連結格式。
- 關聯內容、刪除、下架、批次修改對網站的影響。
- 正常流程與誤操作的測試；拒絕的操作不得損壞原資料。

目前規則及維護指令見 `docs/CONTENT_GUARDS.md`。修改 schema 時，同步檢查 `directus/hooks/redirects/field-rules.json`、`content-validation.mjs` 與 `directus/content-guard-settings.mjs`。保留使用者既有內容與權限設定；實際 API 測試使用臨時資料並清除。
