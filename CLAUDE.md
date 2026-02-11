# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Agent2RSS 是一个基于 Bun + ElysiaJS 的高性能 RSS 微服务，支持多频道管理、Markdown/HTML 内容处理和主题系统。

**技术栈**: Bun runtime, ElysiaJS, SQLite, TypeScript, Zod

## 常用命令

### 开发和运行
```bash
# 开发模式（热重载）
bun run dev

# 生产模式
bun run start

# 安装依赖
bun install
```

### 数据库
- 数据库文件位置: `data/agent2rss.db`
- 使用 Bun 内置的 SQLite 驱动
- 数据库在首次启动时自动初始化

### 测试 API
```bash
# 健康检查
curl http://localhost:8765/health

# 查看 API 文档
open http://localhost:8765/swagger

# 创建频道（公开模式）
curl -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name":"测试频道","description":"测试描述"}'

# 发布文章到频道
curl -X POST http://localhost:8765/api/channels/{channel-id}/webhook \
  -H "Content-Type: application/json" \
  -H "x-auth-token: {channel-token}" \
  -d '{"title":"测试文章","content":"# 标题\n内容..."}'

# 获取频道 RSS Feed
curl http://localhost:8765/channels/{channel-id}/rss.xml
```

## 核心架构

### 数据流向

**发布文章流程**:
```
POST /api/channels/:channelId/webhook
  → 鉴权验证 (services/auth.ts)
  → 内容处理 (services/markdown.ts)
  → 主题应用 (services/theme.ts)
  → 数据存储 (services/storage.ts → SQLite)
  → 返回响应
```

**RSS Feed 生成流程**:
```
GET /channels/:id/rss.xml
  → 读取频道配置 (services/storage.ts)
  → 读取文章列表 (SQLite)
  → 生成 RSS XML (feed 库)
  → 返回 XML
```

### 目录结构

```
src/
├── config/
│   ├── index.ts       # 配置聚合和导出
│   └── env.ts         # 环境变量验证（Zod schema）
├── services/
│   ├── database.ts    # SQLite 数据库管理（单例模式）
│   ├── storage.ts     # 数据 CRUD 操作
│   ├── auth.ts        # Token 鉴权逻辑
│   ├── theme.ts       # 主题加载和样式注入
│   ├── markdown.ts    # Markdown 转 HTML（markdown-it）
│   └── logger.ts      # 日志服务（pino）
├── routes/
│   └── index.ts       # 所有 HTTP 路由定义
├── types/
│   └── index.ts       # TypeScript 类型定义
├── utils/
│   └── index.ts       # 工具函数（ID 生成、IP 获取等）
└── index.ts           # 应用入口
```

### 关键模块说明

#### 1. 数据库层 (services/database.ts)
- **单例模式**: `getDatabase()` 返回全局唯一的 SQLite 实例
- **表结构**:
  - `channels`: 频道配置（id, name, description, theme, token 等）
  - `posts`: 文章数据（id, title, content, channel_id 等）
  - `post_tags`: 文章标签（多对多关系）
- **外键约束**: 启用 `PRAGMA foreign_keys = ON`，删除频道时级联删除文章
- **索引优化**: channel_id, pub_date, tag 字段建立索引

#### 2. 存储层 (services/storage.ts)
- 封装所有数据库操作
- 频道管理: `createChannel()`, `readChannel()`, `updateChannel()`, `deleteChannel()`
- 文章管理: `addPost()`, `readPosts()` (支持按频道过滤)
- 自动维护 `maxPosts` 限制（滚动删除旧文章）

#### 3. 鉴权系统 (services/auth.ts)
- **双层鉴权**:
  - 超级管理员 Token (`AUTH_TOKEN` 环境变量) - 全局权限
  - 频道 Token (创建频道时生成) - 频道级权限
- `verifyToken()` 返回 `{ authorized: boolean, isSuperAdmin: boolean, error?: string }`

#### 4. 主题系统 (services/theme.ts)
- 主题配置文件: `themes.json`（根目录）
- 内置主题: github, minimal, dark, modern, elegant, clean, spring
- `addInlineStyles()`: 将主题样式注入 HTML 元素的 style 属性（兼容 RSS 阅读器）

#### 5. Markdown 处理 (services/markdown.ts)
- 使用 `markdown-it` 及 10+ 扩展插件
- 支持: 表格、代码高亮、Emoji、脚注、上下标、标记、缩写等
- `markdownToHtml()`: Markdown → HTML + 主题样式
- `markdownToText()`: Markdown → 纯文本（用于摘要生成）

#### 6. 路由层 (routes/index.ts)
- **Swagger 文档**: 自动生成 API 文档（`@elysiajs/swagger`）
- **类型验证**: 使用 Elysia 的 `t` schema 进行请求/响应验证
- **错误处理**: 全局 `onError` 处理器，统一错误响应格式

### 环境变量配置

必需变量（在 `src/config/env.ts` 中验证）:
- `PORT`: 服务端口（默认 8765）
- `AUTH_TOKEN`: 超级管理员 Token（必填）
- `FEED_URL`: RSS Feed 基础 URL（必填，如 `http://192.168.1.100:8765`）
- `LOG_LEVEL`: 日志级别（debug/info/warn/error，默认 info）
- `NODE_ENV`: 环境（development/production，默认 development）
- `CHANNEL_CREATION_MODE`: 频道创建模式（public/private，默认 public）

**重要**: 启动时会自动验证环境变量，失败则退出进程。

## 开发注意事项

### 数据库操作
- 始终通过 `getDatabase()` 获取数据库实例，不要直接创建新连接
- 使用参数化查询防止 SQL 注入: `db.query('SELECT * FROM posts WHERE id = ?').get(id)`
- 修改 schema 后需要手动迁移或删除 `data/agent2rss.db` 重新初始化

### 频道管理
- 频道 ID 由服务端自动生成（UUID），不允许客户端指定
- 频道 Token 在创建时生成，只返回一次，无法找回（类似 API Key）
- 默认频道 `default` 不能删除（在 `deleteChannel()` 中硬编码保护）

### 鉴权逻辑
- Webhook 请求必须在 Header 中提供 `x-auth-token`
- 私有模式 (`CHANNEL_CREATION_MODE=private`) 下，创建频道需要超级管理员 Token
- 更新/删除频道需要频道 Token 或超级管理员 Token

### 主题开发
- 主题配置在 `themes.json` 中定义
- 样式必须使用内联 CSS（RSS 阅读器不支持 `<style>` 标签）
- 添加新主题后需要重启服务（主题在启动时加载）

### 内容处理
- 支持 Markdown 和 HTML 两种输入格式
- Markdown 会自动应用主题样式
- HTML 内容直接存储，不做额外处理
- 摘要自动从 HTML 提取前 N 个字符（去除标签）

### 错误处理
- 使用 Elysia 的全局错误处理器统一响应格式
- 验证错误返回 422，未授权返回 401，禁止访问返回 403
- 数据库错误会被捕获并返回 500

### 日志记录
- 使用 pino 日志库（高性能结构化日志）
- 开发环境使用 pino-pretty 美化输出
- 所有请求自动记录（method, url）

## 常见任务

### 添加新的 API 端点
1. 在 `src/routes/index.ts` 中添加路由
2. 使用 Elysia 的 `t` schema 定义请求/响应类型
3. 在 `detail` 中添加 Swagger 文档信息
4. 如需数据库操作，调用 `services/storage.ts` 中的函数

### 添加新的主题
1. 在 `themes.json` 中添加主题配置
2. 定义 `name`, `description`, `styles` 字段
3. `styles` 中的 CSS 属性使用驼峰命名（如 `fontSize`）
4. 重启服务加载新主题

### 修改数据库 Schema
1. 修改 `src/services/database.ts` 中的 `initializeSchema()`
2. 删除 `data/agent2rss.db` 文件
3. 重启服务自动重建数据库
4. **注意**: 生产环境需要编写迁移脚本

### 添加新的环境变量
1. 在 `.env.example` 中添加示例值
2. 在 `src/config/env.ts` 的 `envSchema` 中添加验证规则
3. 在 `src/config/index.ts` 中导出配置项
4. 更新文档说明新变量的用途

## 部署相关

### systemd 服务
项目根目录有 `agent2rss.service` 文件，可用于 systemd 管理：
```bash
sudo cp agent2rss.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agent2rss
sudo systemctl start agent2rss
```

### 数据持久化
- 数据库文件: `data/agent2rss.db`
- 确保 `data/` 目录有写权限
- 建议定期备份数据库文件

### 性能优化
- Bun 运行时性能优于 Node.js
- SQLite 已建立索引优化查询
- 考虑使用反向代理（Nginx/Caddy）处理 HTTPS 和缓存

## 文档资源

- API 文档: `http://localhost:8765/swagger`
- 架构说明: `docs/ARCHITECTURE.md`
- 多频道指南: `docs/MULTI_CHANNEL.md`
- API 参考: `docs/API.md`
- 项目结构: `docs/PROJECT_STRUCTURE.md`
