# 後台使用者密碼欄位

Directus 將 `directus_users.password` 儲存為不可逆雜湊，因此既有密碼
無法預覽或還原。本專案的 `password-preview` 自訂欄位只在新增帳號或重設
密碼時，提供「顯示／隱藏」本次輸入的控制。

這是 Directus 系統欄位；Fields REST API 會拒絕修改它的 metadata。部署時
僅在 `directus_fields` 寫入介面設定，絕不讀取或修改 `directus_users.password`
內的密碼雜湊。
