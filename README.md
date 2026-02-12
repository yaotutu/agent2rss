# Agent2RSS

一个基于 Bun + ElysiaJS 的高性能 RSS 微服务，支持 Markdown 和 HTML 内容，提供丰富的主题系统和**多频道支持**。

## ✨ 功能特性

- ⚡ **高性能**: 基于 Bun 运行时和 ElysiaJS 框架
- 🔒 **安全鉴权**: 使用 Token 验证 Webhook 请求
- 🎯 **多频道支持**: 创建多个独立的 RSS Feed，每个频道独立配置
- 📝 **双模式支持**: Markdown 自动美化 / HTML 完全自定义
- 🎨 **精选主题**: 6 个内置主题，完美兼容 RSS 阅读器
- 📰 **RSS 2.0**: 生成标准 RSS 2.0 格式的 feed
- 💾 **滚动存储**: 自动保留最新 100 条记录（每个频道独立）
- 🏷️ **标签支持**: 支持文章标签和作者信息
- 📊 **灵活摘要**: 自动生成或自定义摘要
- 🌈 **扩展语法**: 支持 10+ Markdown 扩展（表格、代码高亮、Emoji 等）

## 🆕 多频道功能 (v2.0)

### 核心特性
- ✅ 每个频道独立的配置（标题、描述、主题）
- ✅ 创建频道一次设置，永久使用
- ✅ 发布文章只需指定频道 ID
- ✅ 频道独立存储，互不干扰
- ✅ 支持频道增删改查管理

### 典型场景
```
/channels/tech/rss.xml     → 科技频道 RSS
/channels/news/rss.xml     → 新闻频道 RSS
/channels/blog/rss.xml     → 博客频道 RSS
/rss.xml                   → 聚合所有频道（默认）
```

## 🚀 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

### 3. 启动服务

```bash
bun run start
```

## 📡 API 文档

### 发布文章 API

#### POST `/api/channels/:channelId/posts`

向指定频道发布文章（AI 友好接口）。

**特点：**
- 自动提取标题（从内容中提取第一个 # 标题）
- 自动生成链接（如果未提供）
- 支持 Markdown 和 HTML 格式
- 需要频道级别的鉴权

```bash
POST /api/channels/{channel-id}/posts
```

**请求头:**
```
Content-Type: application/json
Authorization: Bearer {channel-token}
```

**请求体:**
```json
{
  "content": "# 文章标题\n\n文章内容...",  // 必填，支持 Markdown 或 HTML
  "title": "自定义标题",                   // 可选，默认从 content 提取
  "link": "https://example.com",           // 可选，默认自动生成
  "contentType": "markdown",               // 可选: "auto", "markdown", "html"
  "theme": "github",                       // 可选，覆盖频道默认主题
  "description": "文章摘要",               // 可选，默认自动生成
  "tags": ["标签1", "标签2"],              // 可选，支持数组或逗号分隔字符串
  "author": "作者名"                       // 可选
}
```

#### POST `/api/channels/:channelId/posts/upload`

**新增功能**：上传 Markdown 文件创建文章。

```bash
POST /api/channels/{channel-id}/posts/upload
```

**请求头:**
```
Content-Type: multipart/form-data
Authorization: Bearer {channel-token}
```

**表单字段:**
- `file`: Markdown 文件 (.md 或 .markdown)
- `title`: 可选，自定义标题（默认从文件中提取）
- `link`: 可选，自定义链接（默认自动生成）
- `contentType`: 可选，内容类型（"auto", "markdown", "html"）
- `theme`: 可选，主题（覆盖频道默认主题）
- `description`: 可选，描述（默认自动生成）
- `author`: 可选，作者
- `tags`: 可选，标签（逗号分隔字符串）

**使用示例:**
```bash
curl -X POST "http://localhost:8765/api/channels/{channel-id}/posts/upload" \
  -H "Authorization: Bearer {channel-token}" \
  -F "file=@article.md" \
  -F "title=自定义标题" \
  -F "tags=技术,AI"
```

### 频道管理 API

#### 创建频道
```bash
POST /api/channels
```

```json
{
  "id": "tech",              // 必填，频道唯一标识
  "name": "科技频道",         // 必填，显示名称
  "description": "最新科技资讯", // 必填，RSS 描述
  "theme": "github",         // 可选，主题
  "language": "zh-CN",       // 可选，语言
  "maxPosts": 50             // 可选，最大文章数
}
```

#### 查看频道列表
```bash
GET /api/channels
```

#### 查看单个频道
```bash
GET /api/channels/:id
```

#### 更新频道
```bash
PUT /api/channels/:id
```

#### 删除频道
```bash
DELETE /api/channels/:id
```

### POST /api/webhook

**重要变更**: `channel` 参数现在是**必填**的！

**请求参数**：

```json
{
  "title": "文章标题",              // 必填
  "link": "https://example.com",   // 可选，不提供则自动生成
  "content": "内容",               // 必填
  "channel": "tech",               // 必填，目标频道 ID
  "contentType": "markdown",       // 可选: "markdown" | "html"
  "theme": "github",               // 可选，覆盖频道默认主题
  "description": "自定义摘要",     // 可选
  "tags": ["标签1", "标签2"],     // 可选
  "author": "作者名"              // 可选
}
```

**重要说明**：
- `link` 参数现在是**可选**的
- 如果不提供，系统会自动生成内部永久链接
- 特别适合 AI 生成的内容（通常没有外部链接）
- 详见：[AI 内容链接处理方案](docs/AI_CONTENT_LINKS.md)

**鉴权**：Header 中需要 `Authorization: Bearer <token>` (频道 token 或超级管理员 token)

### GET /channels/:id/rss.xml

获取指定频道的 RSS 2.0 格式的 feed。

## 🎨 主题系统

### 内置 6 个精选主题

| 主题 | 风格 | 适用场景 |
|------|------|----------|
| **github** | GitHub 官方风格 | 技术文档 |
| **minimal** | 极简设计 | 长文阅读 |
| **dark** | 暗色护眼 | 夜间阅读 |
| **modern** | 现代简约 | 日常内容 |
| **elegant** | 优雅精致 | 正式文档 |
| **clean** | 清爽明快 | 轻松阅读 |

### 使用主题

```json
{
  "theme": "modern"
}
```

## 📝 内容类型

### Markdown 模式（默认）

```json
{
  "contentType": "markdown",
  "content": "# 标题\n\n**粗体**内容",
  "theme": "github"
}
```

**支持的扩展语法**：
- ✅ 表格
- ✅ 代码高亮
- ✅ 删除线 `~~text~~`
- ✅ 上标 `x^2^`
- ✅ 下标 `H~2~O`
- ✅ 标记 `==highlight==`
- ✅ 插入 `++insert++`
- ✅ 脚注
- ✅ 定义列表
- ✅ Emoji `:smile:`

### HTML 模式

```json
{
  "contentType": "html",
  "content": "<!DOCTYPE html><html>...</html>"
}
```

直接使用原始 HTML，不做任何处理。

## 📊 使用示例

### 示例 1：创建频道并发布文章

#### 步骤 1：创建频道（只需一次）

```bash
curl -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{
    "name": "科技频道",
    "description": "最新科技资讯和趋势",
    "theme": "github"
  }'
```

#### 步骤 2：发布文章到频道（JSON 方式）

```bash
curl -X POST http://localhost:8765/api/channels/{channel-id}/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {channel-token}" \
  -d '{
    "title": "如何使用 Bun",
    "content": "# Bun 入门\n\n## 安装\n\n```bash\ncurl -fsSL https://bun.sh/install | bash\n```",
    "tags": ["技术", "Bun"]
  }'
```

#### 步骤 3：发布文章到频道（文件上传方式）

```bash
curl -X POST "http://localhost:8765/api/channels/{channel-id}/posts/upload" \
  -H "Authorization: Bearer {channel-token}" \
  -F "file=@article.md" \
  -F "tags=技术,AI"
```

#### 步骤 4：订阅频道 RSS

```
http://localhost:8765/channels/{channel-id}/rss.xml
```

### 示例 2：多频道管理

```bash
# 创建多个频道
curl -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{"name": "新闻频道", "description": "每日新闻"}'

curl -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{"name": "博客频道", "description": "个人博客"}'

# 查看所有频道
curl http://localhost:8765/api/channels

# 发布到不同频道（JSON 方式）
curl -X POST http://localhost:8765/api/channels/{channel-id}/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {channel-token}" \
  -d '{"title": "新闻", "content": "新闻内容...", "channel": "news"}'

# 发布到不同频道（文件上传方式）
curl -X POST "http://localhost:8765/api/channels/{channel-id}/posts/upload" \
  -H "Authorization: Bearer {channel-token}" \
  -F "file=@news_article.md"
```

### 示例 3：订阅 RSS Feed

```bash
# 订阅特定频道
curl http://localhost:8765/channels/tech/rss.xml

# 订阅聚合频道（所有文章）
curl http://localhost:8765/rss.xml
```

## 🔧 项目结构

```
agent2rss/
├── src/
│   ├── config/               # 配置管理
│   ├── types/                # 类型定义
│   ├── services/             # 业务服务
│   ├── utils/                # 工具函数
│   ├── routes/               # 路由处理
│   └── index.ts              # 主应用
├── data/
│   └── posts.json            # 数据存储
├── docs/                     # 📚 详细文档
│   ├── ARCHITECTURE.md       # 架构说明
│   └── PROJECT_STRUCTURE.md  # 项目结构详解
├── themes.json               # 主题配置
└── README.md                 # 项目文档
```

## 📚 详细文档

- **[多频道使用指南](docs/MULTI_CHANNEL.md)** - 多频道功能完整文档、API 说明、使用示例
- **[架构说明](docs/ARCHITECTURE.md)** - 模块化架构详解、设计原则、扩展指南
- **[项目结构](docs/PROJECT_STRUCTURE.md)** - 目录结构、模块依赖、代码统计

## 🧪 测试脚本

项目提供了完整的多频道功能测试脚本：

```bash
# 启动服务
bun run dev

# 在另一个终端运行测试
./test-multi-channel.sh
```

测试脚本会自动：
- ✅ 创建多个频道
- ✅ 发布文章到不同频道
- ✅ 测试 RSS Feed 生成
- ✅ 测试错误处理
- ✅ 测试频道管理功能

## 🎯 主题选择建议

1. **技术文档** → github
2. **长文阅读** → minimal
3. **夜间阅读** → dark
4. **日常内容** → modern
5. **正式文档** → elegant
6. **轻松阅读** → clean

## 🔍 故障排查

### 主题未生效

1. 检查主题名称是否正确
2. 查看服务启动日志，确认主题已加载
3. 检查 `themes.json` 文件是否存在

### 鉴权失败

1. 确认 `Authorization: Bearer <token>` header 正确
2. 检查环境变量 `AUTH_TOKEN` 是否设置
3. 确保使用正确的 token 类型（频道 token 或超级管理员 token）

## 📄 许可证

MIT
