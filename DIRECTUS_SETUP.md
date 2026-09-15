> 歷史草稿：目前實作與操作步驟請以 [MARKETING_CMS.md](MARKETING_CMS.md) 為準。以下 API 路徑、初始化與範例可能已過時。

# Directus SEO 内容管理系统设置指南

这是为你的 Astro 网站集成 Directus 无头 CMS 的完整设置指南。

## 📋 目录

- [快速开始](#快速开始)
- [系统架构](#系统架构)
- [本地部署](#本地部署)
- [数据模型配置](#数据模型配置)
- [Astro 集成](#astro-集成)
- [营销人员使用指南](#营销人员使用指南)
- [部署到生产环境](#部署到生产环境)
- [故障排除](#故障排除)

---

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- Node.js 22.22.3+
- Git

### 1. 启动 Directus 本地实例

```bash
# 进入项目目录
cd /Users/moby/Documents/site/88baccarat

# 启动 Directus（开发环境使用 SQLite）
docker-compose up -d

# 等待容器启动完成（约 30 秒）
docker-compose logs -f directus
```

### 2. 访问 Directus 后台

打开浏览器访问：**http://localhost:8055**

默认登录凭证：
- **邮箱**: admin@baccarat.local
- **密码**: admin123

### 3. 创建 API 访问令牌

1. 登录后，进入 **Settings** → **API Tokens**
2. 点击 **Create Token**
3. 设置：
   - **Description**: Astro Site
   - **Role**: Choose a role with read permissions
   - **Expiration**: 设置合适的过期时间或永不过期

4. 复制 Token，保存到 `.env.local`：

```bash
DIRECTUS_API_TOKEN=your-copied-token-here
```

---

## 系统架构

```
┌─────────────────────────────────────────┐
│       Directus CMS (http://8055)        │
│  - 内容管理                             │
│  - SEO 元数据管理                       │
│  - 营销人员操作界面                     │
└──────────────┬──────────────────────────┘
               │ REST API
               │
┌──────────────▼──────────────────────────┐
│     Astro 网站 (localhost:3000)         │
│  - 从 Directus 获取内容                │
│  - 生成静态页面                        │
│  - 渲染 SEO 元数据                      │
└─────────────────────────────────────────┘
```

---

## 本地部署

### Docker Compose 说明

**文件**: `docker-compose.yml`

#### 开发环境（默认 - SQLite）

```yaml
services:
  directus:
    image: directus/directus:latest
    ports:
      - "8055:8055"
    environment:
      KEY: your-secret-key
      SECRET: your-secret
      DB_CLIENT: sqlite3  # 使用 SQLite
      DB_FILENAME: /directus/database.sqlite
```

**优点**:
- 无需安装数据库
- 开发快速
- 适合本地测试

**缺点**:
- 不适合多用户并发
- 生产环境不推荐

#### 生产环境（PostgreSQL）

生产部署时，取消注释 `docker-compose.yml` 中的 PostgreSQL 部分，并使用数据库驱动。

---

## 数据模型配置

### Collections（集合）

#### 1. **articles** - 文章集合

用于存储所有文章内容及基本 SEO 信息。

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | ✓ | 唯一标识符 |
| title | String | ✓ | 文章标题 |
| slug | String | ✓ | URL 友好标识（自动生成） |
| content | Text | ✓ | 文章内容（Markdown） |
| description | String | ✓ | 文章摘要（SEO Meta Description） |
| keywords | String | ✗ | SEO 关键字（逗号分隔） |
| category | String | ✓ | 分类：baccarat, strategy, guide, tips, comparison, faq |
| status | String | ✓ | draft, published, archived |
| author | String | ✗ | 作者名称 |
| featured | Boolean | ✗ | 是否精选 |
| image | File | ✗ | 文章封面图片 |
| imageAlt | String | ✗ | 图片 Alt 文本 |
| publishedAt | DateTime | ✓ | 发布时间 |
| updatedAt | DateTime | ✗ | 最后更新时间（自动） |

#### 2. **article_seo** - 文章 SEO 元数据

扩展 SEO 信息（Open Graph, Twitter Cards 等）。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | ✓ | 对应 articles.id |
| title | String | ✗ | OG Title |
| ogImage | String | ✗ | Open Graph 图片 |
| ogDescription | String | ✗ | Open Graph 描述 |
| twitterCard | String | ✗ | Twitter Card 类型 |
| canonicalUrl | String | ✗ | 规范 URL |

#### 3. **categories** - 分类集合

文章分类列表。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | ✓ | 唯一标识符 |
| name | String | ✓ | 分类名称 |
| slug | String | ✓ | URL 友好标识 |
| description | String | ✗ | 分类描述 |
| icon | String | ✗ | 分类图标 |

### 如何在 Directus 中创建 Collections

#### 方式 1：使用 UI 手动创建

1. 登录 Directus → **Data Model** → **Collections**
2. 点击 **Create Collection**
3. 填写各字段（参考上表）
4. 保存

#### 方式 2：使用 API（脚本）

```bash
# 使用提供的 schema.json 自动创建
curl -X POST http://localhost:8055/api/collections \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @directus/schema.json
```

---

## Astro 集成

### 1. 安装依赖

```bash
npm install dotenv
```

### 2. 环境变量配置

在项目根目录创建 `.env.local`（或使用 `.env.directus.local`）：

```env
# Directus 配置
DIRECTUS_URL=http://localhost:8055
DIRECTUS_API_TOKEN=your-api-token-here
```

### 3. Directus 客户端工具

**文件**: `src/lib/directus.ts`

这个工具提供了与 Directus API 交互的方法：

```typescript
// 导入客户端
import { directusClient, type Article } from '@/lib/directus';

// 获取所有已发布的文章
const articles = await directusClient.getArticles({
  limit: 10,
  sort: '-publishedAt'
});

// 按 slug 获取单个文章
const article = await directusClient.getArticleBySlug('how-to-play-baccarat');

// 按分类获取文章
const strategyArticles = await directusClient.getArticlesByCategory('strategy', 5);

// 搜索文章
const results = await directusClient.searchArticles('百家乐', 10);

// 获取相关文章
const relatedArticles = await directusClient.getRelatedArticles(articleId, 5);

// SEO 元数据
const seoMeta = await directusClient.getArticleSEO(articleId);
```

### 4. 在 Astro 页面中使用

**示例**: `src/pages/articles/[slug].astro`

```astro
---
import { directusClient } from '@/lib/directus';
import Layout from '@/layouts/ArticleLayout.astro';

// 从 URL 获取 slug
const { slug } = Astro.params;

// 从 Directus 获取文章
const article = await directusClient.getArticleBySlug(slug);

if (!article) {
  return Astro.redirect('/404');
}

// 获取 SEO 元数据
const seoMeta = await directusClient.getArticleSEO(article.id);

// 获取相关文章
const relatedArticles = await directusClient.getRelatedArticles(article.id, 5);
---

<Layout title={article.title} description={article.description}>
  <article>
    <h1>{article.title}</h1>
    <p class="meta">发布于: {new Date(article.publishedAt).toLocaleDateString()}</p>
    
    <div class="content" set:html={article.content} />
    
    {relatedArticles.length > 0 && (
      <aside>
        <h2>相关文章</h2>
        <ul>
          {relatedArticles.map(a => (
            <li><a href={`/articles/${a.slug}`}>{a.title}</a></li>
          ))}
        </ul>
      </aside>
    )}
  </article>
</Layout>
```

### 5. 在 Astro 中使用 SEO 组件

更新 `src/components/seo/SEO.astro`：

```astro
---
import type { Article } from '@/lib/directus';

interface Props {
  article: Article;
  seoMeta?: any;
}

const { article, seoMeta } = Astro.props;
---

<meta name="description" content={seoMeta?.description || article.description} />
<meta name="keywords" content={article.keywords} />
<meta name="author" content={article.author} />

{seoMeta?.ogImage && (
  <meta property="og:image" content={seoMeta.ogImage} />
)}

<meta property="og:title" content={seoMeta?.ogTitle || article.title} />
<meta property="og:description" content={seoMeta?.ogDescription || article.description} />

{seoMeta?.twitterCard && (
  <meta name="twitter:card" content={seoMeta.twitterCard} />
)}

{seoMeta?.canonicalUrl && (
  <link rel="canonical" href={seoMeta.canonicalUrl} />
)}
```

---

## 营销人员使用指南

### 访问 Directus 后台

1. 打开 http://localhost:8055（本地）或生产环境 URL
2. 使用分配的账户登录
3. 进入 **Articles** 模块

### 创建新文章

1. 点击 **+ Create Item**
2. 填写以下字段：

   | 字段 | 说明 | 示例 |
   |------|------|------|
   | Title | 文章标题 | "百家乐高级策略指南" |
   | Slug | 自动生成或手动填写 | "baccarat-advanced-strategy" |
   | Content | 文章主体（支持 Markdown） | 完整的文章内容 |
   | Description | SEO 摘要（160 字符内） | "学习百家乐的高级策略..." |
   | Keywords | 关键字（逗号分隔） | "百家乐,策略,赢钱,游戏技巧" |
   | Category | 选择分类 | 策略分析 |
   | Status | 发布状态 | 发布 |
   | Author | 作者名称 | "编辑部" |
   | Image | 上传封面 | （选择文件） |
   | Image Alt | 图片描述 | "百家乐策略表" |
   | Published At | 发布时间 | （选择时间） |

3. 点击 **Save** 保存

### 编辑文章

1. 在 **Articles** 列表中找到文章
2. 点击进入编辑页面
3. 修改内容后保存

### 管理 SEO 元数据

1. 在 **article_seo** 模块中创建对应记录
2. 填写 OG 标签等高级 SEO 信息
3. 保存

### 批量操作

- **发布/取消发布**: 选中多个文章 → 批量编辑状态
- **删除**: 选中多个文章 → 批量删除
- **导出**: 导出文章为 CSV（用于备份）

---

## 部署到生产环境

### 步骤 1：配置 PostgreSQL

编辑 `docker-compose.yml`，取消注释 PostgreSQL 和生产 Directus 服务。

### 步骤 2：环境变量

创建 `.env.production`：

```env
DIRECTUS_URL=https://your-domain.com/directus
DIRECTUS_API_TOKEN=production-token
DB_CLIENT=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=directus
DB_PASSWORD=strong-password
DB_NAME=directus
CORS_ENABLED=true
CORS_ORIGIN=https://your-website.com
```

### 步骤 3：部署

```bash
# 使用生产 Compose 文件
docker-compose -f docker-compose.production.yml up -d

# 或在云平台（如 Heroku, Railway, Render）部署
```

### 步骤 4：备份数据库

```bash
# PostgreSQL 备份
pg_dump -U directus directus > backup.sql

# SQLite 备份
cp directus/database.sqlite directus/database.sqlite.backup
```

---

## 故障排除

### 问题：无法连接到 Directus

```bash
# 检查容器状态
docker ps

# 查看容器日志
docker logs directus_baccarat

# 重启容器
docker restart directus_baccarat
```

### 问题：API 返回 401 未授权

- 检查 `DIRECTUS_API_TOKEN` 是否正确设置
- 确认 Token 未过期
- 在 Directus 后台重新生成 Token

### 问题：Markdown 内容渲染不正确

确保在页面中使用 `set:html` 或 `Fragment` 来渲染 HTML：

```astro
<div set:html={article.content} />
```

### 问题：上传的图片无法访问

1. 检查 Directus 上传文件夹权限：`chmod -R 755 directus/uploads`
2. 确认 PUBLIC_URL 配置正确
3. 检查 CORS 是否启用

---

## API 文档参考

### 获取文章列表

```
GET /api/rest/items/articles?filter[status][_eq]=published&limit=10&sort=-publishedAt
Authorization: Bearer YOUR_TOKEN
```

### 获取单个文章

```
GET /api/rest/items/articles/:id
Authorization: Bearer YOUR_TOKEN
```

### 搜索文章

```
GET /api/rest/items/articles?filter[title][_icontains]=keyword&filter[status][_eq]=published
Authorization: Bearer YOUR_TOKEN
```

### 创建文章（管理员）

```
POST /api/rest/items/articles
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "title": "...",
  "slug": "...",
  "content": "...",
  "status": "published"
}
```

---

## 支持和资源

- **Directus 官方文档**: https://docs.directus.io
- **Directus Community**: https://discord.gg/directus
- **Astro 文档**: https://docs.astro.build
- **REST API 规范**: https://docs.directus.io/reference/rest-api-overview

---

**最后更新**: 2024-09-14
