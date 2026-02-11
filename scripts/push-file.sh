#!/usr/bin/env bash
# 简单的文件推送脚本（使用 Node.js/Bun 处理 JSON）
# 用法: ./push-file.sh <file.md> [channel-id] [token]
#
# 示例:
#   ./push-file.sh article.md
#   ./push-file.sh article.md default ch_xxx

set -euo pipefail

# 配置
API_URL="${API_URL:-http://localhost:8765}"
CHANNEL_ID="${2:-${CHANNEL_ID:-default}}"
AUTH_TOKEN="${3:-${AUTH_TOKEN:-}}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 工具函数
info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}" >&2
}

warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# 显示帮助
show_help() {
  cat << EOF
用法: $(basename "$0") <file.md> [channel-id] [token]

参数:
  file.md       要推送的 Markdown 文件
  channel-id    频道 ID (默认: default)
  token         频道 Token (默认: 从环境变量 AUTH_TOKEN 读取)

示例:
  # 使用默认频道
  $(basename "$0") article.md

  # 指定频道
  $(basename "$0") article.md my-channel

  # 指定频道和 token
  $(basename "$0") article.md my-channel ch_xxx

环境变量:
  API_URL       API 地址 (默认: http://localhost:8765)
  CHANNEL_ID    默认频道 ID (默认: default)
  AUTH_TOKEN    默认频道 Token

依赖:
  - curl (HTTP 客户端)
  - bun 或 node (JSON 处理)
EOF
}

# 检查参数
if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  show_help
  exit 0
fi

FILE="$1"

# 检查文件是否存在
if [[ ! -f "$FILE" ]]; then
  error "文件不存在: $FILE"
  exit 1
fi

# 检查 token
if [[ -z "$AUTH_TOKEN" ]]; then
  error "缺少频道 Token"
  echo ""
  echo "请设置环境变量 AUTH_TOKEN 或作为第三个参数提供:"
  echo "  export AUTH_TOKEN=ch_xxx"
  echo "  $(basename "$0") $FILE"
  echo ""
  echo "或直接提供:"
  echo "  $(basename "$0") $FILE $CHANNEL_ID ch_xxx"
  exit 1
fi

# 检查 Node.js/Bun
if command -v bun >/dev/null 2>&1; then
  NODE_CMD="bun"
elif command -v node >/dev/null 2>&1; then
  NODE_CMD="node"
else
  error "需要 Node.js 或 Bun 来处理 JSON"
  echo ""
  echo "请安装其中之一:"
  echo "  # 使用 Homebrew (macOS)"
  echo "  brew install bun"
  echo ""
  echo "  # 或使用官方安装脚本"
  echo "  curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# 使用 Node.js/Bun 转义文件内容为 JSON
ESCAPED_CONTENT=$($NODE_CMD -e "
  const fs = require('fs');
  const content = fs.readFileSync('$FILE', 'utf8');
  console.log(JSON.stringify(content));
")

# 调用 API
info "推送文件: $FILE"
info "频道: $CHANNEL_ID"
info "API: $API_URL"

response=$(curl -s -X POST "${API_URL}/api/channels/${CHANNEL_ID}/upload" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: ${AUTH_TOKEN}" \
  -d "{\"content\":$ESCAPED_CONTENT}")

# 使用 Node.js/Bun 解析响应
SUCCESS=$($NODE_CMD -e "try { console.log(JSON.parse('$response').success || false) } catch { console.log('false') }")

if [[ "$SUCCESS" == "true" ]]; then
  POST_ID=$($NODE_CMD -e "console.log(JSON.parse('$response').post.id)")
  TITLE=$($NODE_CMD -e "console.log(JSON.parse('$response').post.title)")
  success "推送成功!"
  info "文章 ID: $POST_ID"
  info "标题: $TITLE"
  info "RSS: ${API_URL}/channels/${CHANNEL_ID}/rss.xml"
else
  ERROR_MSG=$($NODE_CMD -e "try { console.log(JSON.parse('$response').error || '未知错误') } catch { console.log('解析响应失败') }")
  error "推送失败: $ERROR_MSG"
  echo "$response"
  exit 1
fi
