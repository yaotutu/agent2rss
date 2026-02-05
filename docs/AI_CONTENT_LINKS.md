# AI 生成内容的链接处理方案

## 问题背景

AI 生成的内容通常没有外部链接，但 RSS 规范要求每个 item 必须有 `link` 字段。

## 解决方案

### 核心设计

- ✅ `link` 参数改为**可选**
- ✅ 未提供时自动生成内部永久链接
- ✅ 格式：`{FEED_URL}/channels/{channelId}/posts/{postId}`
- ✅ 满足 RSS 规范，为未来扩展预留空间

---

## 使用方式

### 方式 1：不提供 link（推荐用于 AI 生成内容）

```bash
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "今日 AI 新闻摘要",
    "content": "# AI 新闻\n\n今天的重要新闻...",
    "channel": "ai-news"
  }'
```

**自动生成的链接**：
```
http://localhost:8765/channels/ai-news/posts/550e8400-e29b-41d4-a716-446655440000
```

### 方式 2：提供外部链接（用于转载内容）

```bash
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "OpenAI 发布 GPT-5",
    "link": "https://openai.com/blog/gpt-5",
    "content": "# GPT-5 发布\n\n内容...",
    "channel": "tech"
  }'
```

**使用提供的链接**：
```
https://openai.com/blog/gpt-5
```

---

## 链接格式说明

### 自动生成的链接结构

```
{FEED_URL}/channels/{channelId}/posts/{postId}
```

**示例**：
```
http://localhost:8765/channels/tech/posts/550e8400-e29b-41d4-a716-446655440000
http://localhost:8765/channels/news/posts/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### 优势

1. **唯一性**：每篇文章有唯一的永久链接
2. **可追溯**：通过链接可以定位到具体频道和文章
3. **可扩展**：未来可以实现 Web 页面展示文章内容
4. **符合规范**：满足 RSS 2.0 规范要求

---

## RSS Feed 中的表现

### 生成的 RSS Item

```xml
<item>
  <title>今日 AI 新闻摘要</title>
  <link>http://localhost:8765/channels/ai-news/posts/550e8400-e29b-41d4-a716-446655440000</link>
  <description>今天的重要新闻...</description>
  <content:encoded><![CDATA[<h1>AI 新闻</h1><p>今天的重要新闻...</p>]]></content:encoded>
  <pubDate>Wed, 15 Jan 2025 10:00:00 GMT</pubDate>
  <guid>550e8400-e29b-41d4-a716-446655440000</guid>
</item>
```

---

## 典型使用场景

### 场景 1：AI 新闻摘要服务

```bash
# AI 每天生成新闻摘要，无外部链接
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "2025-01-15 科技新闻摘要",
    "content": "# 今日科技要闻\n\n1. AI 突破\n2. 新产品发布\n3. ...",
    "channel": "daily-digest",
    "author": "AI Assistant"
  }'
```

**生成链接**：`http://localhost:8765/channels/daily-digest/posts/{uuid}`

### 场景 2：混合内容（AI + 转载）

```bash
# AI 生成的内容（无链接）
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "AI 分析：本周科技趋势",
    "content": "# 趋势分析\n\n...",
    "channel": "analysis"
  }'

# 转载的文章（有链接）
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "OpenAI 官方博客",
    "link": "https://openai.com/blog/...",
    "content": "...",
    "channel": "analysis"
  }'
```

### 场景 3：AI 聊天记录归档

```bash
# 将 AI 对话保存为 RSS
curl -X POST http://localhost:8765/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-token" \
  -d '{
    "title": "与 Claude 的对话 - 2025-01-15",
    "content": "# 对话记录\n\n**User**: ...\n\n**Claude**: ...",
    "channel": "chat-history",
    "tags": ["AI", "对话"]
  }'
```

---

## 未来扩展可能

### 1. Web 页面展示

可以实现一个路由来展示文章内容：

```typescript
app.get('/channels/:channelId/posts/:postId', async ({ params, set }) => {
  // 读取文章内容
  const post = await getPostById(params.postId);

  // 返回 HTML 页面
  return `
    <!DOCTYPE html>
    <html>
      <head><title>${post.title}</title></head>
      <body>
        <h1>${post.title}</h1>
        <div>${post.content}</div>
      </body>
    </html>
  `;
});
```

### 2. 文章分享功能

生成的永久链接可以用于：
- 社交媒体分享
- 邮件通知
- 文章引用

### 3. 统计和分析

通过链接可以追踪：
- 文章访问量
- 热门内容
- 用户行为

---

## API 参数说明

### Webhook 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 文章标题 |
| `link` | string | ❌ | 外部链接（可选，不提供则自动生成） |
| `content` | string | ✅ | 文章内容 |
| `channel` | string | ✅ | 目标频道 ID |
| `contentType` | string | ❌ | 内容类型（markdown/html） |
| `theme` | string | ❌ | 主题（覆盖频道默认） |
| `description` | string | ❌ | 自定义摘要 |
| `tags` | string[] | ❌ | 标签 |
| `author` | string | ❌ | 作者 |

---

## 最佳实践

### 1. AI 生成内容

**推荐**：不提供 `link` 参数
```json
{
  "title": "AI 生成的内容",
  "content": "...",
  "channel": "ai-content"
}
```

### 2. 转载内容

**推荐**：提供原文链接
```json
{
  "title": "转载文章",
  "link": "https://original-source.com/article",
  "content": "...",
  "channel": "repost"
}
```

### 3. 混合场景

根据内容来源灵活选择：
- AI 生成 → 不提供 link
- 外部转载 → 提供 link
- 内部创作 → 可提供也可不提供

---

## 配置说明

### 环境变量

确保设置了 `FEED_URL`：

```bash
# .env
FEED_URL=http://localhost:8765
```

生成的链接会使用这个 URL 作为基础。

### 生产环境

```bash
# 生产环境
FEED_URL=https://rss.yourdomain.com
```

生成的链接：
```
https://rss.yourdomain.com/channels/tech/posts/{uuid}
```

---

## 总结

### 核心优势

1. ✅ **灵活性**：支持有链接和无链接两种场景
2. ✅ **自动化**：AI 调用时无需关心链接问题
3. ✅ **规范性**：满足 RSS 2.0 规范要求
4. ✅ **可扩展**：为未来功能预留空间
5. ✅ **用户友好**：简化 API 调用参数

### 使用建议

- **AI 生成内容**：省略 `link` 参数，让系统自动生成
- **转载内容**：提供原文 `link`，保留来源信息
- **混合使用**：根据实际情况灵活选择

这个方案既解决了 AI 生成内容没有链接的问题，又保持了 API 的灵活性和可扩展性。🎉
