# baccarat-seo-site

以 Astro 靜態輸出建置的百家樂 SEO 內容網站，採用 TypeScript、Tailwind CSS 4 與 Astro Content Collections。

## 本機開發

```bash
npm install
npm run dev
```

## 靜態建置與 Cloudflare Pages

```bash
npm run build
```

Cloudflare Pages 的建置命令使用 `npm run build`，輸出目錄為 `dist`。部署前請設定 `SITE_URL` 為正式網站網址，以產生正確 canonical、sitemap 與 RSS 連結。

文章存放於 `src/content/<category>/`，使用 Markdown frontmatter 管理標題、描述、日期與 FAQ；路由會在建置時自動靜態產生。
