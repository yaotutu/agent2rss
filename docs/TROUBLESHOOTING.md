# Agent2RSS 故障排除指南

本文档帮助您解决在使用 Agent2RSS 时可能遇到的常见问题。

## 目录

- [常见错误](#常见错误)
  - [1. JSON 解析错误（400 Bad Request）](#1-json-解析错误400-bad-request)
  - [2. 鉴权失败（401 Unauthorized）](#2-鉴权失败401-unauthorized)
  - [3. 频道不存在（404 Not Found）](#3-频道不存在404-not-found)
- [最佳实践](#最佳实践)
  - [使用 curl 的推荐方式](#使用-curl-的推荐方式)
  - [使用 CLI 工具的推荐方式](#使用-cli-工具的推荐方式)
- [获取帮助](#获取帮助)

---

## 常见错误

### 1. JSON 解析错误（400 Bad Request）

**错误信息示例**：
```json
{
  "success": false,
  "error": "请求体解析失败",
  "details": {
    "type": "JSON_PARSE_ERROR",
    "message": "无法解析请求体中的 JSON 数据",
    "commonCauses": [
      "JSON 格式不正确（缺少引号、括号不匹配等）",
      "在命令行直接使用多行 JSON 时，shell 对特殊字符的处理",
      "Content-Type 不是 application/json",
      "请求体为空"
    ],
    "solutions": [
      "使用文件方式传递 JSON：curl -d @payload.json",
      "确保 Content-Type: application/json",
      "使用 JSON 验证工具检查格式：jq . payload.json",
      "考虑使用 CLI 工具：bun run cli push"
    ]
  }
}
```

**常见原因**：
- 在命令行直接使用多行 JSON 时，shell 对特殊字符处理不当
- JSON 格式错误（缺少引号、括号不匹配）
- Content-Type 不是 `application/json`
- 请求体为空

**解决方案**：

#### ✅ 方案 1：使用文件上传接口（最简单 - 推荐）

```bash
# 直接上传 Markdown 文件 - 最简单的方式！
curl -X POST "http://localhost:8765/api/channels/default/upload" \
  -H "Authorization: Bearer ch_xxx" \
  -F "file=@article.md"

# 带可选字段
curl -X POST "http://localhost:8765/api/channels/default/upload" \
  -H "Authorization: Bearer ch_xxx" \
  -F "file=@article.md" \
  -F "author=张三" \
  -F "tags=技术,教程"
```

**优点**:
- ✅ 极简调用 - 一条 curl 命令搞定
- ✅ 自动提取标题 - 从 Markdown 第一个 # 标题提取
- ✅ 无 JSON 转义问题 - 直接上传文件
- ✅ 通用性强 - 任何 HTTP 客户端都支持

#### ✅ 方案 2：使用 JSON 文件（程序化调用）

```bash
# 1. 创建 JSON 文件
cat > payload.json << 'EOF'
{
  "title": "文章标题",
  "content": "# Markdown 内容\n\n这是文章正文...",
  "contentType": "markdown"
}
EOF

# 2. 使用 @ 符号引用文件
curl -X POST "http://localhost:8765/api/channels/xxx/webhook" \
  -H "Content-Type: application/json" \
  -H "authorization: your-token" \
  -d @payload.json
```

#### ✅ 方案 3：使用 Shell CLI 工具（批量操作）

**安装 CLI 工具**:
```bash
# 方法 1: 从项目目录安装（自动）
cd /path/to/agent2rss
./scripts/install-cli.sh install

# 方法 2: 手动安装
sudo cp bin/agent2rss /usr/local/bin/
sudo chmod +x /usr/local/bin/agent2rss

# 验证安装
agent2rss --version
```

**使用 CLI 工具**:
```bash
# 1. 初始化配置
agent2rss init

# 2. 推送 Markdown 文件（自动提取标题）
agent2rss push -f article.md

# 3. 指定频道和 token
agent2rss push -c my-channel -t ch_xxx -f article.md

# 4. 批量推送
for file in articles/*.md; do
  agent2rss push -f "$file"
done
```

**CLI 工具依赖**:
- `curl` - HTTP 客户端
- `bun` 或 `node` - JSON 处理（项目已有 Bun，无需额外安装）

**注意**: CLI 工具已移除 `jq` 依赖，使用 Node.js/Bun 处理 JSON。如果您的环境没有 Node.js/Bun，请安装 Bun：

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# 或使用 Homebrew (macOS)
brew install bun
```

#### ✅ 方案 4：使用 heredoc（注意引号）

```bash
curl -X POST "http://localhost:8765/api/channels/xxx/webhook" \
  -H "Content-Type: application/json" \
  -H "authorization: your-token" \
  -d @- << 'EOF'
{
  "title": "文章标题",
  "content": "# Markdown 内容",
  "contentType": "markdown"
}
EOF
```

**关键点**：heredoc 的结束标记 `EOF` 周围的引号很重要：
- `<< 'EOF'`：单引号表示内容原样，不进行变量替换
- `<< EOF`：无引号会进行变量替换，可能导致 JSON 解析失败

#### ❌ 避免的做法

```bash
# 不推荐：直接在命令行中写多行 JSON
curl -X POST "..." -d '{
  "title": "标题",
  "content": "内容"  # 特殊字符可能导致解析失败
}'

# 不推荐：缺少引号的 heredoc
curl -X POST "..." -d @- << EOF  # 缺少引号，$符号会被替换
{
  "title": "价格",
  "content": "只需 $100"  # $100 会被当作变量
}
EOF
```

---

### 2. 鉴权失败（401 Unauthorized）

**错误信息示例**：
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**常见原因**：
1. 缺少 `authorization` 请求头
2. Token 不正确
3. Token 与频道不匹配

**解决方案**：

#### 检查 Token

```bash
# 查看所有频道（使用超级管理员 token）
curl -X GET "http://localhost:8765/api/channels" \
  -H "authorization: YOUR_ADMIN_AUTH_TOKEN"

# 查看单个频道（使用频道 token 或超级管理员 token）
curl -X GET "http://localhost:8765/api/channels/YOUR_CHANNEL_ID" \
  -H "authorization: YOUR_CHANNEL_TOKEN"
```

#### 重要提示

- **Token 只在创建频道时返回一次**，请妥善保存
- 如果丢失了频道 token，只能使用超级管理员 token 查询
- 超级管理员 token 是环境变量 `AUTH_TOKEN` 的值（在 `.env` 文件中配置）

---

### 3. 频道不存在（404 Not Found）

**错误信息示例**：
```json
{
  "success": false,
  "error": "Channel \"xxx\" not found"
}
```

**常见原因**：
1. 频道 ID 错误
2. 频道已被删除
3. 使用了错误的 URL 路径

**解决方案**：

#### 列出所有频道

```bash
# 使用超级管理员 token 查看所有频道
curl -X GET "http://localhost:8765/api/channels" \
  -H "authorization: YOUR_ADMIN_AUTH_TOKEN" | jq
```

#### 创建新频道（公开模式）

```bash
curl -X POST "http://localhost:8765/api/channels" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的频道",
    "description": "频道描述"
  }'
```

#### 创建新频道（私有模式）

```bash
curl -X POST "http://localhost:8765/api/channels" \
  -H "Content-Type: application/json" \
  -H "authorization: YOUR_ADMIN_AUTH_TOKEN" \
  -d '{
    "name": "我的频道",
    "description": "频道描述"
  }'
```

---

## 最佳实践

### 使用 curl 的推荐方式

#### 1. 始终使用文件传递 JSON

```bash
# 创建临时 JSON 文件
cat > /tmp/payload.json << 'EOF'
{
  "title": "文章标题",
  "content": "# Markdown 内容",
  "contentType": "markdown"
}
EOF

# 推送
curl -X POST "$AGENT2RSS_URL/api/channels/$CHANNEL_ID/webhook" \
  -H "Content-Type: application/json" \
  -H "authorization: $CHANNEL_TOKEN" \
  -d @/tmp/payload.json
```

#### 2. 使用 jq 验证 JSON 格式

```bash
# 验证 JSON 文件
jq . payload.json

# 如果输出格式化的 JSON，说明格式正确
# 如果报错，说明格式有问题
```

#### 3. 保存常用的频道配置到环境变量

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# Agent2RSS 配置
export AGENT2RSS_URL="http://localhost:8765"
export CHANNEL_ID="your-channel-id"
export CHANNEL_TOKEN="your-channel-token"
export ADMIN_AUTH_TOKEN="your-admin-auth-token"
```

然后创建便捷函数：

```bash
# 创建文章函数
create-post() {
  local title="$1"
  local content="$2"

  cat > /tmp/payload.json << EOF
{
  "title": "$title",
  "content": $(echo "$content" | jq -Rs .),
  "contentType": "markdown"
}
EOF

  curl -X POST "$AGENT2RSS_URL/api/channels/$CHANNEL_ID/webhook" \
    -H "Content-Type: application/json" \
    -H "authorization: $CHANNEL_TOKEN" \
    -d @/tmp/payload.json
}

# 使用示例
create-post "测试文章" "# 标题\n\n内容"
```

---

### 使用 CLI 工具的推荐方式

#### 1. 安装 CLI 工具

```bash
# 方法 1: 从项目目录安装（推荐）
cd /path/to/agent2rss
./scripts/install-cli.sh install

# 方法 2: 手动安装
sudo cp bin/agent2rss /usr/local/bin/
sudo chmod +x /usr/local/bin/agent2rss

# 方法 3: 安装到用户目录（无需 sudo）
mkdir -p ~/.local/bin
cp bin/agent2rss ~/.local/bin/
chmod +x ~/.local/bin/agent2rss
export PATH="$PATH:$HOME/.local/bin"

# 验证安装
agent2rss --version
```

#### 2. 检查依赖

CLI 工具依赖以下系统工具:
- `curl` - HTTP 客户端
- `bun` 或 `node` - JSON 处理（项目已有 Bun）

检查并安装依赖:
```bash
# 检查是否已安装
command -v curl && echo "✅ curl 已安装"
command -v bun && echo "✅ Bun 已安装"
command -v node && echo "✅ Node.js 已安装"

# 安装 Bun（推荐）
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# 或使用 Homebrew (macOS)
brew install bun

# 如果已有 Node.js，无需安装 Bun
```

#### 3. 初始化配置

```bash
agent2rss init
```

按照提示输入：
- API 地址（默认：http://localhost:8765）
- 默认频道 ID
- 频道 Token

配置会保存到 `~/.agent2rssrc` 文件。

#### 4. 推送单个文件

```bash
# 推送 Markdown 文件（自动提取标题）
agent2rss push -f article.md

# 推送 JSON 文件
agent2rss push -f payload.json

# 显示详细输出
agent2rss push -v -f article.md
```

#### 5. 指定频道和 Token

```bash
# 不使用配置文件，直接指定参数
agent2rss push -c my-channel -t ch_xxx -f article.md

# 只指定频道，token 从配置文件读取
agent2rss push -c my-channel -f article.md
```

#### 6. 批量推送

```bash
# 推送目录下所有 .md 文件
for file in articles/*.md; do
  echo "正在推送: $file"
  agent2rss push -f "$file"
  echo "---"
done

# 使用 find 推送子目录中的文件
find articles -name "*.md" -exec agent2rss push -f {} \;
```

#### 7. 从标准输入推送

```bash
# 管道输入
echo "# 测试文章\n\n内容" | agent2rss push

# 或使用 heredoc
agent2rss push << 'EOF'
# 测试文章

这是文章内容。
EOF
```

#### CLI 工具的优势

- ✅ 自动处理 JSON 序列化，避免特殊字符问题
- ✅ 支持从文件读取内容（.md 和 .json）
- ✅ 友好的错误提示和解决方案
- ✅ 配置管理，避免重复输入 token
- ✅ 支持批量操作
- ✅ 自动提取 Markdown 标题

---

## 获取帮助

### 查看 API 文档

启动服务后访问：
- Swagger UI：http://localhost:8765/swagger
- 健康检查：http://localhost:8765/health

### 查看日志

#### 开发环境

```bash
bun run dev
# 日志会直接输出到终端
```

#### 生产环境（systemd）

```bash
# 查看实时日志
journalctl -u agent2rss -f

# 查看最近 100 条日志
journalctl -u agent2rss -n 100

# 查看今天的日志
journalctl -u agent2rss --since today
```

### 常用调试命令

```bash
# 1. 测试服务是否运行
curl http://localhost:8765/health

# 2. 查看所有频道
curl http://localhost:8765/api/channels \
  -H "authorization: YOUR_ADMIN_AUTH_TOKEN"

# 3. 验证 JSON 文件
jq . payload.json

# 4. 测试 webhook（使用 CLI 工具）
bun run cli push -f test.md

# 5. 查看 RSS Feed
curl http://localhost:8765/channels/default/rss.xml
```

### 常见问题快速参考

| 问题 | 解决方案 |
|------|---------|
| JSON 解析失败 | 使用文件方式传递 JSON，或使用 CLI 工具 |
| 鉴权失败 | 检查 token 是否正确，使用超级管理员 token 查询频道 |
| 频道不存在 | 使用 `/api/channels` 列出所有频道 |
| 找不到 token | 使用超级管理员 token 查询频道信息 |
| 文章没有显示在 RSS | 等待 RSS 阅读器刷新（通常 5-30 分钟） |
| Markdown 样式不生效 | 检查主题名称是否正确，支持：github, minimal, dark, modern, elegant, clean, spring |

### 提交问题

如果以上方法都无法解决您的问题，请：

1. 查看完整的错误信息
2. 检查服务日志
3. 访问 Swagger 文档测试 API
4. 提交 Issue 到项目仓库，包含：
   - 错误信息
   - 使用的命令
   - 服务日志
   - 环境信息（操作系统、Bun 版本等）

---

**Sources:**
- [Reddit - 2025 CLI Framework Recommendations](https://www.reddit.com/r/comments/1ipe4dw/askjs_what_are_your_2025_gotos_for_building_cli/)
- [Gud CLI on GitHub](https://github.com/ryangoree/gud-cli)
- [Yargs Cross-Platform Support (CSDN)](https://blog.csdn.net/gitblog_00689/article/details/150757657)
- [2025 CLI Stack (ryoppippi.com)](https://ryoppippi.com/blog/2025-08-12-my-js-cli-stack-2025-en)
