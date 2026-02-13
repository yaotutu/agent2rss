# Agent2RSS API 文档

## 📋 目录

- [快速开始](#快速开始)
- [认证方式](#认证方式)
- [API 端点](#api-端点)
  - [创建文章](#1-创建文章)
  - [获取 RSS Feed](#2-获取-rss-feed)
  - [频道管理](#3-频道管理)
- [代码示例](#代码示例)
- [错误处理](#错误处理)
- [常见问题](#常见问题)

---

## 快速开始

### 1. 启动服务

```bash
bun run dev
```

服务启动后会显示：

```
🚀 Agent2RSS 服务已启动

📰 频道 RSS Feed:
   http://localhost:8765/channels/{channel-id}/rss.xml

📡 创建文章 API:
   POST http://localhost:8765/api/channels/{channel-id}/posts
   鉴权: Authorization: Bearer <token>

📚 API 文档:
   http://localhost:8765/swagger
```

### 2. 配置认证 Token

编辑 `.env` 文件，设置超级管理员 Token：

```env
AUTH_TOKEN=your-super-admin-token-here
```

⚠️ **重要**：请使用强密码作为 Token！

### 3. 创建频道并获取 Token

```bash
# 创建频道（公开模式无需认证）
curl -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的频道",
    "description": "频道描述"
  }'

# 响应会返回频道 Token（只显示一次，请妥善保存）
{
  "success": true,
  "message": "Channel created. Please save your token.",
  "channel": {
    "id": "8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece",
    "name": "我的频道",
    "token": "ch_xxx",
    "webhookUrl": "POST /api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/posts",
    "rssUrl": "/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml"
  }
}
```

---

## 认证方式

### 标准 Authorization Bearer（推荐）

所有 API 请求必须在请求头中包含认证 Token：

```bash
Authorization: Bearer ch_xxx
```

**Token 类型**：
1. **频道 Token** (`ch_xxx`) - 管理单个频道
2. **超级管理员 Token** (`AUTH_TOKEN`) - 管理所有频道

### 示例

```bash
# 使用频道 Token
curl -X POST 'http://localhost:8765/api/channels/default/posts' \
  -H 'Authorization: Bearer ch_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"content": "..."}'

# 使用超级管理员 Token
curl http://localhost:8765/api/channels \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

---

## API 端点

### 1. 创建文章

**端点**: `POST /api/channels/:channelId/posts`

**描述**: 向指定频道添加新文章。支持 Markdown 和 HTML 格式，自动提取标题、生成链接和摘要。

#### 请求头

| 字段 | 值 | 必需 |
|------|-----|------|
| Content-Type | application/json | ✅ |
| Authorization | Bearer ch_xxx | ✅ |

#### 请求体

| 字段 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | Markdown 或 HTML 内容 |
| title | string | ❌ | 自动提取 | 文章标题（从第一个 # 标题提取） |
| link | string | ❌ | 自动生成 | 文章链接 |
| contentType | auto/markdown/html | ❌ | auto | 内容类型（auto=自动检测） |
| theme | string | ❌ | 频道默认 | 覆盖频道主题 |
| description | string | ❌ | 自动生成 | 文章摘要 |
| tags | string/string[] | ❌ | [] | 标签（支持逗号分隔字符串或数组） |
| author | string | ❌ | - | 作者名称 |

#### 请求示例

**最小化示例**（推荐）：

```bash
curl -X POST 'http://localhost:8765/api/channels/default/posts' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ch_xxx' \
  -d '{
    "content": "# AI 技术最新进展\n\n今天，AI 领域取得了**重大突破**。"
  }'
```

**完整示例**：

```bash
curl -X POST 'http://localhost:8765/api/channels/default/posts' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ch_xxx' \
  -d '{
    "content": "# AI 技术突破\n\n今天，AI 领域取得了重大突破。\n\n## 主要亮点\n\n- 性能提升 50%\n- 成本降低 30%",
    "title": "自定义标题",
    "tags": "AI, 技术, 创新",
    "author": "AI Reporter"
  }'
```

#### 响应示例

**成功**（200）：

```json
{
  "success": true,
  "message": "Post created successfully in channel \"default\"",
  "post": {
    "id": "8f1dd58e-6ac0-4c89-a1cc-d985e1b490be",
    "title": "AI 技术最新进展",
    "channel": "default",
    "pubDate": "2026-02-10T14:34:23.592Z"
  }
}
```

**失败**（400/401/404）：

```json
{
  "success": false,
  "error": "Missing required field: content",
  "details": {
    "field": "content",
    "issue": "Required field missing",
    "expected": { "content": "string (required)" },
    "example": { "content": "# My Article\n\nContent here..." }
  }
}
```

---

### 2. 获取 RSS Feed

**端点**: `GET /channels/:id/rss.xml`

**描述**: 获取指定频道的 RSS Feed（XML 格式）。

#### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✅ | 频道 ID |

#### 示例

```bash
curl http://localhost:8765/channels/default/rss.xml
```

#### 响应

返回标准的 RSS 2.0 XML 格式。

---

### 3. 频道管理

#### 3.1 获取所有频道

**端点**: `GET /api/channels`

**鉴权**: 需要超级管理员 Token

**示例**：

```bash
curl http://localhost:8765/api/channels \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

**响应**：

```json
[
  {
    "id": "default",
    "name": "AI Briefing",
    "description": "Daily news summaries",
    "theme": "spring",
    "language": "zh-CN",
    "maxPosts": 100,
    "token": "ch_xxx",  // 只有超级管理员可见
    "postCount": 42,
    "createdAt": "2026-02-05T13:35:41.183Z",
    "updatedAt": "2026-02-05T13:35:41.183Z"
  }
]
```

#### 3.2 获取单个频道

**端点**: `GET /api/channels/:id`

**鉴权**: 需要频道 Token 或超级管理员 Token

**示例**：

```bash
curl http://localhost:8765/api/channels/default \
  -H 'Authorization: Bearer ch_xxx'
```

#### 3.3 创建频道

**端点**: `POST /api/channels`

**鉴权**: 私有模式需要超级管理员 Token

**请求体**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✅ | 频道名称 |
| description | string | ✅ | 频道描述 |
| theme | string | ❌ | 主题（默认：spring） |
| language | string | ❌ | 语言（默认：zh-CN） |
| maxPosts | number | ❌ | 最大文章数（默认：100） |

**示例**：

```bash
curl -X POST http://localhost:8765/api/channels \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "技术资讯",
    "description": "分享最新的技术动态"
  }'
```

#### 3.4 更新频道

**端点**: `PUT /api/channels/:id`

**鉴权**: 需要频道 Token 或超级管理员 Token

**示例**：

```bash
curl -X PUT http://localhost:8765/api/channels/default \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ch_xxx' \
  -d '{
    "name": "新名称",
    "description": "新描述"
  }'
```

#### 3.5 删除频道

**端点**: `DELETE /api/channels/:id`

**鉴权**: 需要频道 Token 或超级管理员 Token

**示例**：

```bash
curl -X DELETE http://localhost:8765/api/channels/default \
  -H 'Authorization: Bearer ch_xxx'
```

---

## 代码示例

### JavaScript/TypeScript

```javascript
// 创建文章
const response = await fetch('http://localhost:8765/api/channels/default/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ch_xxx'
  },
  body: JSON.stringify({
    content: '# 标题\n\n内容...'
  })
});

const result = await response.json();
console.log(result);
```

### Python

```python
import requests

url = 'http://localhost:8765/api/channels/default/posts'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ch_xxx'
}
data = {
    'content': '# 标题\n\n内容...'
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func main() {
    data := map[string]string{
        "content": "# 标题\n\n内容...",
    }
    jsonData, _ := json.Marshal(data)

    req, _ := http.NewRequest(
        "POST",
        "http://localhost:8765/api/channels/default/posts",
        bytes.NewBuffer(jsonData),
    )
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer ch_xxx")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
}
```

---

## 错误处理

### 错误响应格式

所有错误都遵循统一格式：

```json
{
  "success": false,
  "error": "错误描述",
  "details": {
    "reason": "具体原因",
    "help": "解决建议",
    ...
  }
}
```

### 常见错误

#### 1. 鉴权失败（401）

```json
{
  "success": false,
  "error": "Authorization header missing or invalid",
  "details": {
    "expected": "Authorization: Bearer <token>",
    "help": "Provide a channel token (ch_xxx) or admin AUTH_TOKEN"
  }
}
```

**解决**：使用 `Authorization: Bearer ch_xxx` 格式。

#### 2. 频道不存在（404）

```json
{
  "success": false,
  "error": "Channel \"xxx\" not found",
  "details": {
    "channelId": "xxx",
    "help": "Use GET /api/channels to list all available channels"
  }
}
```

**解决**：检查频道 ID 是否正确。

#### 3. 参数验证失败（400/422）

```json
{
  "success": false,
  "error": "Missing required field: content",
  "details": {
    "field": "content",
    "issue": "Required field missing",
    "expected": { "content": "string (required)" },
    "example": { "content": "# My Article\n\nContent here..." }
  }
}
```

**解决**：确保提供必需的 `content` 字段。

#### 4. JSON 解析失败（400）

```json
{
  "success": false,
  "error": "请求体解析失败",
  "details": {
    "type": "JSON_PARSE_ERROR",
    "message": "无法解析请求体中的 JSON 数据",
    "commonCauses": [
      "JSON 格式不正确（缺少引号、括号不匹配等）",
      "Content-Type 不是 application/json"
    ],
    "solutions": [
      "确保 JSON 格式正确",
      "设置 Content-Type: application/json"
    ]
  }
}
```

---

## 常见问题

### Q1: Token 在哪里获取？

**A**: 创建频道时会返回 token（只显示一次），或使用超级管理员 Token 查询：

```bash
curl http://localhost:8765/api/channels \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

### Q2: 如何使用多个频道？

**A**: 每个频道有独立的 Token 和 ID：

```bash
# 频道 1
curl -X POST 'http://localhost:8765/api/channels/channel1/posts' \
  -H 'Authorization: Bearer ch_xxx1' \
  -d '{"content": "..."}'

# 频道 2
curl -X POST 'http://localhost:8765/api/channels/channel2/posts' \
  -H 'Authorization: Bearer ch_xxx2' \
  -d '{"content": "..."}'
```

### Q3: 支持 HTML 内容吗？

**A**: 支持。两种方式：

```json
{
  "content": "<h1>标题</h1><p>内容</p>",
  "contentType": "html"
}
```

或使用 `auto`（默认）自动检测。

### Q4: 标题可以自动提取吗？

**A**: 可以！从 Markdown 第一个 `#` 标题自动提取：

```json
{
  "content": "# 这是标题\n\n内容会自动提取这个标题"
}
```

### Q5: 旧的 webhook 和 upload 接口还能用吗？

**A**: 不能。v2.0.0 已完全移除旧接口，请使用新的 `/posts` 接口。

### Q6: X-Auth-Token 还支持吗？

**A**: 不支持。v2.0.0 只支持 `Authorization: Bearer` 标准方式。

---

## 相关资源

- **AI 专用指南**: [AI_QUICK_START.md](./AI_QUICK_START.md)
- **故障排除**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **多频道管理**: [MULTI_CHANNEL.md](./MULTI_CHANNEL.md)
- **Swagger 文档**: http://localhost:8765/swagger

---

## 变更日志

### v2.0.0 (2026-02-10)

**新增**：
- ✨ 统一的 `/posts` 接口
- ✨ 支持自动标题提取
- ✨ 支持自动内容类型检测
- ✨ 详细的错误提示（details 字段）

**移除**：
- ❌ `/webhook` 接口
- ❌ `/upload` 接口
- ❌ `X-Auth-Token` 鉴权

**变更**：
- 🔀 鉴权改为 `Authorization: Bearer`
- 🔀 tags 参数支持字符串或数组
- 🔀 contentType 新增 `auto` 选项
