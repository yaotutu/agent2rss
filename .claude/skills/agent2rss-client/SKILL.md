---
name: agent2rss-client
description: Agent2RSS 服务客户端，帮助用户管理 RSS 频道和推送内容。触发场景：(1) 用户提到"Agent2RSS"、"RSS 频道"、"推送文章/内容"等关键词，(2) 用户想要创建或管理 RSS 订阅，(3) 用户需要发布内容到 RSS Feed，(4) 用户需要使用幂等性防止重复发布。支持 JSON 和文件上传两种方式推送内容。
---

# Agent2RSS Client Skill

帮助用户通过 Agent2RSS 服务创建和管理 RSS 频道，推送内容到 RSS Feed。

## 核心功能

1. **频道管理** - 创建、查询、更新、删除 RSS 频道
2. **内容推送** - 通过 JSON 或文件上传方式发布文章
3. **幂等性支持** - 使用 idempotencyKey 防止重复发布
4. **RSS 订阅** - 生成标准 RSS Feed 供阅读器订阅

## 配置管理

技能使用 `config.json` 存储服务器地址和频道信息：

```json
{
  "serverUrl": "http://localhost:8765",
  "currentChannelId": "default",
  "channels": [
    {
      "id": "default",
      "name": "默认频道",
      "token": "ch_xxx...",
      "postsUrl": "http://localhost:8765/api/channels/default/posts",
      "rssUrl": "http://localhost:8765/channels/default/rss.xml"
    }
  ]
}
```

### 配置初始化

首次使用时，如果 `config.json` 不存在，从 `assets/config-template.json` 复制并提示用户配置服务器地址。

## 认证方式

**标准 Bearer Token 认证**（必需）：

```bash
Authorization: Bearer <channel-token>
```

每个频道有独立的 Token（格式 `ch_xxx...`），创建频道时生成。

## 推荐的推送方式

### ⚠️ 重要：避免 JSON 转义问题

直接在 JSON 请求体中放置 Markdown 内容容易出现转义问题（引号、换行符、反斜杠等）。

**强烈推荐使用文件上传方式**：

### 文件上传（推荐）✅

直接上传 Markdown 文件，无需处理 JSON 转义：

```bash
curl -X POST {serverUrl}/api/channels/{channelId}/posts/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@article.md" \
  -F "idempotencyKey=article-001"
```

**优点**：
- 无需处理 JSON 转义
- 最简单可靠
- 支持所有 Markdown 语法
- 自动提取标题
- 支持幂等性

**可选字段**：
- `title` - 自定义标题
- `tags` - 标签（逗号分隔）
- `author` - 作者名
- `idempotencyKey` - 防止重复发布

### JSON 方式（仅适合简单内容）

如果内容简单且已正确转义，可以使用 JSON 方式。但对于包含复杂 Markdown 的内容，请使用文件上传。

## 常用操作

### 1. 创建频道

```bash
curl -X POST {serverUrl}/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "技术博客",
    "description": "分享技术文章"
  }'
```

响应包含频道 ID 和 Token，保存到 `config.json`。

### 2. 推送内容（JSON 方式 - 仅适合简单内容）

⚠️ **警告**：JSON 方式容易出现转义问题，推荐使用文件上传方式（见上方"推荐的推送方式"章节）。

**最简调用**（仅内容，标题自动提取）：

```bash
curl -X POST {postsUrl} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "content": "# 标题\n\n内容..."
  }'
```

**响应示例**：

```json
{
  "success": true,
  "message": "Post created successfully in channel \"xxx\"",
  "post": {
    "id": "xxx",
    "title": "标题",
    "channel": "default",
    "pubDate": "2024-01-01T00:00:00.000Z"
  },
  "isNew": true
}
```

### 3. 幂等性支持

使用 `idempotencyKey` 防止重复发布：

- 相同频道内相同 key 的请求只会创建一次文章
- 响应中 `isNew: true` 表示新创建，`false` 表示已存在
- 适用于 JSON 和文件上传两种方式

**示例**：

```bash
# 第一次请求 - 创建新文章
curl -X POST {postsUrl} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"content":"# 测试","idempotencyKey":"key1"}'
# 响应: {"success":true,"isNew":true,...}

# 第二次请求 - 返回已存在的文章
curl -X POST {postsUrl} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"content":"# 测试","idempotencyKey":"key1"}'
# 响应: {"success":true,"isNew":false,...}
```

## 工作流程

### 推送单篇文章

1. 从 `config.json` 读取当前频道配置
2. 准备 Markdown 文件
3. **使用文件上传方式推送**（推荐）
4. 可选添加 `idempotencyKey` 防止重复
5. 检查响应中的 `isNew` 字段
6. 提供 RSS Feed URL 供用户订阅

### 创建新频道

1. 提示用户提供频道名称和描述
2. 调用创建频道 API
3. 保存返回的频道 ID 和 Token 到 `config.json`
4. 更新 `currentChannelId` 为新频道
5. 提供 RSS Feed URL

## 错误处理

- **401 Unauthorized**：Token 无效或缺失，检查 `Authorization` 头
- **404 Not Found**：频道不存在，检查频道 ID
- **400 Bad Request**：参数错误，检查必填字段 `content`
- **500 Server Error**：服务器错误，稍后重试

## 参考资料

详细的 API 调用示例和响应格式见 `references/api-examples.md`。

## 注意事项

1. **Token 安全**：不要在公开场合分享频道 Token
2. **内容格式**：支持完整的 Markdown 语法
3. **字符编码**：使用 UTF-8 编码
4. **幂等性键**：建议使用有意义的键（如文章 URL、时间戳等）
5. **认证方式**：必须使用 `Authorization: Bearer` 格式
