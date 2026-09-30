# baccarat-seo-site

以 Astro 靜態輸出建置的百家樂 SEO 內容網站，採用 TypeScript、Tailwind CSS 4 與 Astro Content Collections。

## 發布保護

預設 APP_ENV=local，保持禁止索引。`npm run build` 現在包含 `npm run seo-check`；正式建置僅允許 GitHub Actions 的 main。

[交付與維護手冊](docs/HANDOVER.md) 說明 Local → Staging → Production、分支/Environment 保護、內容發布、SEO gate、備份與回復。部署流程預設停用；先填寫 config/deployment.json、核准網址基準並完成平台權限設定。

## 指令與操作文件

[完整文件索引](docs/README.md)

- [專案指令手冊](docs/COMMANDS.md)：啟動、重啟、匯入、建置、Cloudflare 上傳、測試與常見錯誤。
- [行銷 CMS 操作文件](docs/MARKETING_CMS.md)：欄位、權限、圖片與 301 規則。

## 本機開發

```bash
npm install
npm run dev
```

## 靜態建置與 Cloudflare Pages

```bash
npm run build
```

Cloudflare Pages 的建置命令使用 `npm run build`，輸出目錄為 `dist`。各環境需設定對應 `SITE_URL`；robots 與 Sitemap 由建置自動產生。正式發布使用受保護的 CI 流程，勿手動上傳 Local 產物。

文章存放於 `src/content/<category>/`，使用 Markdown frontmatter 管理標題、描述、日期與 FAQ；路由會在建置時自動靜態產生。

## Directus 行銷內容管理

文章模板已支援 Directus，包含 H2/H3、圖片、表格、FAQ、相關文章及自動 SEO Schema。設定 `CONTENT_SOURCE=directus` 後，首頁、列表、文章、FAQ 彙整與 RSS 皆讀取 CMS。

請依 [行銷 CMS 操作文件](docs/MARKETING_CMS.md) 啟動後台、建立欄位並匯入 Markdown。預設 `CONTENT_SOURCE=local` 保留本機開發。

## Navbar 內容管理

桌面／手機導覽、選單排序與 navbar 品牌資料已移入 Directus。詳見 [導覽管理 SOP](docs/NAVIGATION.md)。

首頁與入口頁面支援 Single Page／Article List／Custom Page，頁面、網站全域內容及媒體都由 Directus 管理，見 [整站內容管理](docs/PAGES.md)。
