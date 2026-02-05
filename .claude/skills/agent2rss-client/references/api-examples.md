# Agent2RSS API 调用示例

本文档提供完整的 API 调用示例，包括请求格式和响应示例。

## 基础信息

- **默认服务器**: `http://111.228.1.24:8765`
- **API 基础路径**: `/api`
- **内容类型**: `application/json`

## 1. 创建频道

### 请求

```bash
curl -X POST http://111.228.1.24:8765/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "技术博客",
    "description": "分享技术文章和教程"
  }'
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece",
    "name": "技术博客",
    "description": "分享技术文章和教程",
    "token": "ch_4fd9cdce724ffb8d6ec69187b5438ae2",
    "webhookUrl": "http://111.228.1.24:8765/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/webhook",
    "rssUrl": "http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml",
    "createdAt": "2026-02-05T10:30:00.000Z"
  }
}
```

### 字段说明

- `id`: 频道唯一标识符（UUID）
- `name`: 频道名称
- `description`: 频道描述
- `token`: 频道 Token，用于 Webhook 鉴权（格式：`ch_` + 32位随机字符串）
- `webhookUrl`: Webhook 推送地址
- `rssUrl`: RSS Feed 订阅地址
- `createdAt`: 创建时间（ISO 8601 格式）

## 2. 推送内容到频道

### 请求（完整参数）

```bash
curl -X POST http://111.228.1.24:8765/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/webhook \
  -H "Content-Type: application/json" \
  -H "x-auth-token: ch_4fd9cdce724ffb8d6ec69187b5438ae2" \
  -d '{
    "title": "如何使用 Agent2RSS",
    "content": "# Agent2RSS 使用指南\n\n## 简介\n\nAgent2RSS 是一个将任意内容转换为 RSS Feed 的服务...\n\n## 功能特性\n\n- 支持 Markdown 格式\n- 自动生成 RSS Feed\n- 提供 Webhook API\n\n## 使用方法\n\n1. 创建频道\n2. 推送内容\n3. 订阅 RSS",
    "description": "详细介绍 Agent2RSS 的使用方法和功能特性",
    "author": "Claude",
    "tags": ["教程", "RSS", "技术"]
  }'
```

### 请求（最小参数）

```bash
curl -X POST http://111.228.1.24:8765/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/webhook \
  -H "Content-Type: application/json" \
  -H "x-auth-token: ch_4fd9cdce724ffb8d6ec69187b5438ae2" \
  -d '{
    "title": "简单的文章标题",
    "content": "这是文章的正文内容。"
  }'
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "item_1234567890",
    "title": "如何使用 Agent2RSS",
    "description": "详细介绍 Agent2RSS 的使用方法和功能特性",
    "author": "Claude",
    "tags": ["教程", "RSS", "技术"],
    "publishedAt": "2026-02-05T15:30:00.000Z"
  }
}
```

### 字段说明

**必填字段**:
- `title`: 文章标题（字符串）
- `content`: 文章内容（支持 Markdown 格式）

**可选字段**:
- `description`: 文章摘要/描述（字符串）
- `author`: 作者名称（字符串）
- `tags`: 标签数组（字符串数组）

**请求头**:
- `Content-Type: application/json`（必填）
- `x-auth-token: {频道Token}`（必填，用于鉴权）

## 3. 获取频道信息

### 请求

```bash
curl -X GET http://111.228.1.24:8765/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece \
  -H "x-auth-token: ch_4fd9cdce724ffb8d6ec69187b5438ae2"
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece",
    "name": "技术博客",
    "description": "分享技术文章和教程",
    "rssUrl": "http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml",
    "webhookUrl": "http://111.228.1.24:8765/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/webhook",
    "itemCount": 5,
    "createdAt": "2026-02-05T10:30:00.000Z",
    "updatedAt": "2026-02-05T15:30:00.000Z"
  }
}
```

## 4. 获取 RSS Feed

### 请求

```bash
curl -X GET http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml
```

### 响应示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>技术博客</title>
    <description>分享技术文章和教程</description>
    <link>http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece</link>
    <atom:link href="http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>Wed, 05 Feb 2026 15:30:00 GMT</lastBuildDate>

    <item>
      <title>如何使用 Agent2RSS</title>
      <description>详细介绍 Agent2RSS 的使用方法和功能特性</description>
      <link>http://111.228.1.24:8765/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/items/item_1234567890</link>
      <guid>item_1234567890</guid>
      <pubDate>Wed, 05 Feb 2026 15:30:00 GMT</pubDate>
      <author>Claude</author>
      <category>教程</category>
      <category>RSS</category>
      <category>技术</category>
    </item>
  </channel>
</rss>
```

## 错误响应示例

### 401 未授权

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing token"
}
```

### 400 请求参数错误

```json
{
  "success": false,
  "error": "Validation error: title is required"
}
```

### 404 频道不存在

```json
{
  "success": false,
  "error": "Channel not found"
}
```

### 500 服务器错误

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## 使用技巧

### 1. Markdown 内容格式化

推送内容时，可以使用完整的 Markdown 语法：

```markdown
# 一级标题

## 二级标题

**粗体文本** 和 *斜体文本*

- 列表项 1
- 列表项 2

[链接文本](https://example.com)

\`\`\`javascript
// 代码块
console.log('Hello, World!');
\`\`\`
```

### 2. 批量推送

可以使用脚本批量推送多篇文章：

```bash
#!/bin/bash

WEBHOOK_URL="http://111.228.1.24:8765/api/channels/YOUR_CHANNEL_ID/webhook"
TOKEN="ch_YOUR_TOKEN"

for file in articles/*.md; do
  title=$(basename "$file" .md)
  content=$(cat "$file")

  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-auth-token: $TOKEN" \
    -d "{\"title\": \"$title\", \"content\": $(jq -Rs . <<< "$content")}"

  sleep 1
done
```

### 3. 测试连接

快速测试服务器是否可用：

```bash
curl -I http://111.228.1.24:8765/health
```

## 注意事项

1. **Token 安全**: 不要在公开场合分享你的频道 Token
2. **内容长度**: 建议单篇文章内容不超过 100KB
3. **推送频率**: 建议每次推送间隔至少 1 秒
4. **字符编码**: 所有内容使用 UTF-8 编码
5. **特殊字符**: JSON 中的特殊字符需要转义（如 `"`, `\`, 换行符等）
