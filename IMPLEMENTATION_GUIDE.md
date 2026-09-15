> 歷史草稿：目前實作與操作步驟請以 [MARKETING_CMS.md](MARKETING_CMS.md) 為準。以下 API 路徑、初始化與範例可能已過時。

# Directus + Astro 完整实施指南

## 📖 目录

- [项目概述](#项目概述)
- [核心特性](#核心特性)
- [快速启动](#快速启动)
- [营销人员使用指南](#营销人员使用指南)
- [技术文档](#技术文档)
- [常见问题](#常见问题)

---

## 项目概述

这是一个**混合内容管理解决方案**，结合：

- **Directus** 作为无头 CMS（营销人员的后台管理系统）
- **Astro** 作为前端框架（高性能静态网站生成）
- **SQLite** 本地数据库（开发环境）
- **PostgreSQL** 生产数据库（可选）

### 核心工作流

```
营销人员在 Directus 中创建/编辑内容
         ↓
     REST API
         ↓
Astro 网站从 API 获取数据
         ↓
生成静态 HTML（高速）
         ↓
用户访问网站
```

---

## 核心特性

✅ **SEO 友好**

- 完整的元数据管理（标题、描述、关键字）
- Open Graph / Twitter Cards 支持
- 规范 URL 管理
- 自动生成网站地图

✅ **营销人员友好**

- 直观的 Web UI（无需编码）
- 批量操作支持
- 计划发布功能
- 内容版本控制

✅ **开发者友好**

- TypeScript 支持
- REST API
- 静态生成（SSG）
- 模块化代码结构

✅ **性能优化**

- 静态网站（极快加载）
- CDN 友好
- 图片自动优化
- 零运行时开销

---

## 快速启动

### 前置要求

- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)
- 安装 [Node.js 22+](https://nodejs.org)
- 安装 [Git](https://git-scm.com)

### 步骤 1：启动 Directus（第一次需要 1-2 分钟）

```bash
cd /Users/moby/Documents/site/88baccarat

# 方式 A: 使用自动化脚本（推荐）
bash directus/init.sh

# 方式 B: 使用 npm 命令
npm run directus:init

# 方式 C: 手动启动
docker-compose up -d
```

**预期结果**：

```
✅ Directus 已启动！
🌐 访问 http://localhost:8055
```

### 步骤 2：首次登录 Directus

打开浏览器访问：**http://localhost:8055**

**默认凭证**：

- 邮箱: `admin@baccarat.local`
- 密码: `admin123`

> ⚠️ **生产环境**：更改这些凭证！

### 步骤 3：生成 API Token

1. 点击左上角 **⚙️ Settings**
2. 选择 **Access Control** → **API Tokens**
3. 点击 **+ Create Token**
4. 填写：
   - **Description**: `Astro Site`
   - **Role**: `Editor` 或 `Viewer`
   - **Expiration**: 按需选择
5. 复制生成的 Token

### 步骤 4：配置 Astro

```bash
# 在项目根目录创建 .env.local
cat > .env.local << EOF
DIRECTUS_URL=http://localhost:8055
DIRECTUS_API_TOKEN=<粘贴你的token>
EOF

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 查看网站！

---

## 营销人员使用指南

### 核心模块介绍

#### 📝 **Articles** - 文章内容管理

这是主要的内容编辑区域。

**创建新文章**：

1. 点击左侧菜单 **Articles**
2. 点击蓝色 **+ Create Item** 按钮
3. 填写必填字段：

| 字段             | 说明                      | 示例                                        |
| ---------------- | ------------------------- | ------------------------------------------- |
| **Title**        | 文章标题                  | "百家乐基础知识"                            |
| **Content**      | 文章内容（支持 Markdown） | 完整的文章正文                              |
| **Description**  | SEO 摘要（160 字以内）    | "学习百家乐的基础规则和玩法..."             |
| **Category**     | 文章分类                  | 选择：baccarat, strategy, guide, tips...    |
| **Status**       | 发布状态                  | **Draft**（草稿）或 **Published**（已发布） |
| **Published At** | 发布时间                  | 点击日期选择器                              |

4. **可选字段**：
   - **Image**: 上传封面图片
   - **Image Alt**: 图片描述（SEO 用）
   - **Keywords**: 关键字（逗号分隔）
   - **Featured**: 勾选标记为精选

5. 点击 **Save** 保存

#### 🏷️ **Categories** - 分类管理

管理文章分类。预设分类：

- 百家樂知識 (baccarat)
- 策略分析 (strategy)
- 遊戲指南 (guide)
- 遊戲技巧 (tips)
- 遊戲比較 (comparison)
- 常見問題 (faq)

**添加新分类**：

1. 点击 **Categories**
2. 点击 **+ Create Item**
3. 填写 **Name** 和 **Slug**
4. 保存

#### 🔍 **SEO Metadata** - 高级 SEO 设置

为文章配置 Open Graph 和 Twitter Cards 标签。

**添加 SEO 元数据**：

1. 点击 **article_seo**
2. 点击 **+ Create Item**
3. 填写：
   - **OG Title**: Facebook 分享标题
   - **OG Image**: Facebook 分享图片
   - **OG Description**: Facebook 分享描述
   - **Twitter Card**: Twitter 卡片类型
   - **Canonical URL**: 规范 URL

### 常见操作

#### ✏️ 编辑已有文章

1. 点击 **Articles**
2. 在列表中找到要编辑的文章
3. 点击标题进入编辑页面
4. 修改内容
5. 点击 **Save**

#### 🗑️ 删除文章

1. 在文章列表中勾选要删除的文章（多选）
2. 点击顶部 **⋯** 菜单
3. 选择 **Delete**

#### 📅 计划发布

1. 创建或编辑文章
2. 将 **Status** 设置为 **Draft**
3. 设置 **Published At** 为未来的时间
4. 保存

> 系统会在指定时间自动发布文章

#### 🔄 批量编辑

1. 在列表中选择多个文章
2. 点击顶部菜单栏的编辑按钮
3. 批量修改字段（如分类、作者等）
4. 保存

#### 🔎 搜索和筛选

**搜索**：在顶部搜索框输入关键字

**筛选**：

1. 点击 **Filter** 按钮
2. 选择筛选条件（如 Status, Category, Featured）
3. 应用

---

## 技术文档

### 项目结构

```
项目根目录/
├── docker-compose.yml              # Docker 容器配置
├── QUICK_START.md                  # 快速启动（本文件）
├── DIRECTUS_SETUP.md               # 详细技术文档
├── directus/
│   ├── init.sh                     # 初始化脚本
│   ├── schema.json                 # 数据模型定义
│   ├── database/                   # SQLite 数据库
│   ├── uploads/                    # 上传文件
│   └── extensions/                 # Directus 扩展
│
├── src/
│   ├── lib/
│   │   ├── directus.ts             # API 客户端
│   │   └── directus-queries.ts     # 查询助手
│   │
│   ├── components/
│   │   └── seo/                    # SEO 组件
│   │
│   ├── content/                    # 内容文件
│   │
│   └── pages/
│       ├── articles/
│       │   ├── [slug].astro.example    # 动态路由示例
│       │   └── index.astro            # 文章列表页
│       └── ...
│
├── .env.local                      # 本地配置（本地创建）
├── .env.example                    # 配置模板
└── package.json                    # npm 依赖
```

### API 集成示例

#### 在 Astro 页面中获取数据

```astro
---
// src/pages/articles/[slug].astro
import { getArticleBySlug } from '@/lib/directus-queries';

const { slug } = Astro.params;
const article = await getArticleBySlug(slug);
---

<article>
  <h1>{article.title}</h1>
  <p>{article.description}</p>
  <div set:html={article.content} />
</article>
```

#### 使用 Directus 客户端

```typescript
import { directusClient } from "@/lib/directus";

// 获取文章列表
const articles = await directusClient.getArticles({
  limit: 10,
  category: "strategy",
  sort: "-publishedAt",
});

// 按 slug 获取单篇文章
const article = await directusClient.getArticleBySlug("my-article");

// 获取 SEO 元数据
const seoMeta = await directusClient.getArticleSEO(articleId);

// 搜索文章
const results = await directusClient.searchArticles("百家乐", 10);
```

### 环境变量

**开发环境** (`.env.local`)：

```env
DIRECTUS_URL=http://localhost:8055
DIRECTUS_API_TOKEN=your_local_token
```

**生产环境** (`.env.production`)：

```env
DIRECTUS_URL=https://your-domain.com/directus
DIRECTUS_API_TOKEN=your_production_token
```

### npm 命令

```bash
# 开发
npm run dev              # 启动 Astro 开发服务器

# 构建
npm run build            # 构建生产版本
npm run preview          # 预览构建结果

# Directus 管理
npm run directus:start   # 启动 Directus
npm run directus:stop    # 停止 Directus
npm run directus:init    # 初始化（首次运行）
npm run directus:logs    # 查看 Directus 日志
```

---

## 常见问题

### Q: 我是营销人员，技术问题怎么办？

A: 需要技术支持时，联系你的开发团队。提供：

- 具体错误信息（截图）
- 你在做什么
- 预期结果是什么

### Q: 文章发布后多久会显示在网站上？

A:

- **立即发布**：发布时立即生效（如果网站启用了增量生成）
- **定时发布**：系统会在指定时间自动发布
- **全网更新**：通常在发布后 24 小时内完全更新

### Q: 可以撤回已发布的文章吗？

A:

1. 编辑文章
2. 将 **Status** 改为 **Draft** 或 **Archived**
3. 保存

文章会立即下线。

### Q: 如何分配用户权限？

A: 需要管理员在 Directus 中配置：

1. 进入 **Settings** → **Access Control** → **Users**
2. 点击 **+ Create User**
3. 填写用户信息
4. 选择 **Role**（权限角色）
5. 保存

**预设角色**：

- **Admin**: 完全访问
- **Editor**: 可创建/编辑内容
- **Viewer**: 只读权限

### Q: 图片上传失败怎么办？

A:

```bash
# 检查上传文件夹权限
chmod -R 755 directus/uploads

# 重启 Directus
docker-compose restart directus
```

### Q: 如何备份内容？

A:

```bash
# 备份 SQLite 数据库
cp directus/database.sqlite directus/database.sqlite.backup

# 备份上传的文件
cp -r directus/uploads/ directus/uploads.backup/
```

### Q: 如何恢复备份？

A:

```bash
# 停止 Directus
npm run directus:stop

# 恢复数据库
cp directus/database.sqlite.backup directus/database.sqlite

# 重启 Directus
npm run directus:start
```

### Q: 可以在生产环境使用吗？

A: 可以，但需要：

1. ✅ 使用 **PostgreSQL** 数据库（不是 SQLite）
2. ✅ 配置 **HTTPS** 和安全令牌
3. ✅ 设置 **备份和恢复**计划
4. ✅ 配置 **监控和告警**
5. ✅ 更改 **默认密码**

详见 [DIRECTUS_SETUP.md](DIRECTUS_SETUP.md) 的生产部署章节。

---

## 支持资源

- 📖 [完整技术文档](DIRECTUS_SETUP.md)
- 🌐 [Directus 官方文档](https://docs.directus.io)
- 🚀 [Astro 官方文档](https://docs.astro.build)
- 💬 [Directus Discord 社区](https://discord.gg/directus)
- 🐛 [报告问题 / 反馈](https://github.com/your-repo/issues)

---

**最后更新**: 2024-09-14
**版本**: 1.0.0

祝你使用愉快！如有问题，请联系技术团队。 🚀
