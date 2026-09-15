> 歷史草稿：目前實作與操作步驟請以 [MARKETING_CMS.md](MARKETING_CMS.md) 為準。以下 API 路徑、初始化與範例可能已過時。

# 🚀 Directus + Astro 快速启动指南

**目标**: 在 5 分钟内让 Directus CMS 运行起来！

---

## 第一步：启动 Directus（2 分钟）

```bash
# 进入项目目录
cd /Users/moby/Documents/site/88baccarat

# 方式 1: 使用初始化脚本（推荐）
bash directus/init.sh

# 方式 2: 手动启动
docker-compose up -d
sleep 30
```

✅ **检查**：打开 http://localhost:8055

---

## 第二步：获取 API Token（2 分钟）

### 在 Directus 后台：

1. **登录**
   - 邮箱: `admin@baccarat.local`
   - 密码: `admin123`

2. **创建 API Token**
   - 点击左上角 **Settings** ⚙️
   - 选择 **Access Control** → **API Tokens**
   - 点击 **Create Token** 按钮
   - 设置：
     - **Description**: `Astro Site`
     - **Role**: 选择读权限角色
     - **Expiration**: 永不过期（或自定义）
   - 复制 Token（一个长字符串）

### 保存 Token 到项目：

```bash
# 编辑或创建 .env.local
echo "DIRECTUS_API_TOKEN=你复制的token" >> .env.local
```

✅ **完成**！Token 已配置

---

## 第三步：测试集成（1 分钟）

```bash
# 进入项目目录
cd /Users/moby/Documents/site/88baccarat

# 安装依赖（如果还没有）
npm install dotenv

# 启动 Astro 开发服务器
npm run dev
```

打开 http://localhost:3000 测试网站！

---

## 第四步：创建第一篇文章（可选，5 分钟）

### 在 Directus 后台：

1. 点击左侧 **Articles** 模块
2. 点击 **+ Create Item**
3. 填写：
   - **Title**: "我的第一篇文章"
   - **Content**: "这是文章内容"
   - **Description**: "这是SEO描述"
   - **Category**: 选择一个分类
   - **Status**: Published
   - **Published At**: 现在
4. 点击 **Save**

### 在 Astro 中查看：

访问 http://localhost:3000/articles/我的第一篇文章 (slug 自动生成)

---

## 项目文件结构

```
📦 项目根目录
├── docker-compose.yml           # Docker 配置
├── DIRECTUS_SETUP.md            # 详细设置文档
├── QUICK_START.md               # 本文件
├── .env.example                 # 环境变量模板
├── .env.local                   # 本地配置（创建后）
├── .env.directus.local          # Directus 配置
├── directus/
│   ├── init.sh                  # 初始化脚本
│   ├── schema.json              # 数据模型定义
│   ├── database/                # 数据库文件（SQLite）
│   ├── uploads/                 # 上传文件存储
│   └── extensions/              # Directus 扩展
└── src/
    ├── lib/
    │   ├── directus.ts          # Directus API 客户端
    │   └── directus-queries.ts  # 查询辅助函数
    └── pages/
        └── articles/
            ├── [slug].astro.example  # 动态文章页面示例
            └── index.astro           # 文章列表页（待创建）
```

---

## 常用命令

```bash
# 查看 Directus 日志
docker logs directus_baccarat -f

# 停止 Directus
docker-compose down

# 重启 Directus
docker-compose restart

# 删除 Directus 数据（谨慎！）
docker-compose down -v

# 备份数据库
cp directus/database.sqlite directus/database.sqlite.backup

# 恢复数据库
cp directus/database.sqlite.backup directus/database.sqlite
```

---

## 环境变量设置

**本地开发 (.env.local)**

```env
DIRECTUS_URL=http://localhost:8055
DIRECTUS_API_TOKEN=你的token
```

**生产环境**

```env
DIRECTUS_URL=https://your-domain.com
DIRECTUS_API_TOKEN=生产token
```

---

## 常见问题

### Q: 无法访问 http://localhost:8055？

A:

```bash
# 检查容器是否运行
docker ps | grep directus

# 查看日志
docker logs directus_baccarat

# 重启容器
docker-compose restart
```

### Q: API Token 不工作？

A:

1. 确认 Token 已生成且未过期
2. 检查 .env.local 中的 Token 正确无误
3. 在 Directus 中重新生成 Token

### Q: 页面加载很慢？

A:

- 检查 Directus 容器是否正常运行
- 查看浏览器控制台是否有错误
- 检查网络连接

### Q: 如何在生产环境部署？

A: 查看 [DIRECTUS_SETUP.md](DIRECTUS_SETUP.md) 的"部署到生产环境"部分

---

## 下一步

✅ 基本设置完成后，建议：

1. **阅读完整文档**: [DIRECTUS_SETUP.md](DIRECTUS_SETUP.md)
2. **创建数据模型**: 按需扩展 Articles Collection
3. **配置营销人员账户**: 在 Directus 中为团队成员创建用户
4. **集成到页面**: 使用 `src/lib/directus-queries.ts` 在 Astro 页面中获取内容
5. **设置自动发布**: 配置 Directus Webhooks 触发 Astro 重新构建

---

## 帮助和支持

- **Directus 官方**: https://docs.directus.io
- **Astro 官方**: https://docs.astro.build
- **GitHub Issues**: 在项目 GitHub 上报告问题
- **Discord 社区**: 在 Directus Discord 服务器上提问

---

**祝你使用愉快！🎉**
