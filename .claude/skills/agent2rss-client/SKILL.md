---
name: agent2rss-client
description: Agent2RSS 服务客户端，帮助用户管理 RSS 频道和推送内容。触发场景：(1) 用户提到"Agent2RSS"、"RSS 频道"、"推送文章/内容"等关键词，(2) 用户想要创建或管理 RSS 订阅，(3) 用户需要发布内容到 RSS Feed。
---

# Agent2RSS Client 技能

这是一个轻量级技能，帮助 Claude 使用 Agent2RSS 服务管理 RSS 频道和推送内容。

## 配置管理

### 配置文件位置
`config.json`（位于技能目录下，随项目保存）

### 配置文件结构
```json
{
  "serverUrl": "http://111.228.1.24:8765",
  "currentChannelId": null,
  "channels": []
}
```

### 频道数据结构
```json
{
  "id": "8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece",
  "name": "技术博客",
  "description": "分享技术文章",
  "token": "ch_4fd9cdce724ffb8d6ec69187b5438ae2",
  "webhookUrl": "http://111.228.1.24:8765/api/channels/8cf83b0d.../webhook",
  "rssUrl": "http://111.228.1.24:8765/channels/8cf83b0d.../rss.xml",
  "createdAt": "2026-02-05T10:30:00Z"
}
```

### 首次使用初始化
1. 检查配置文件是否存在（使用 Read 工具）
2. 如果不存在，使用 AskUserQuestion 询问服务器地址：
   - 问题："请选择或输入你的 Agent2RSS 服务器地址"
   - 选项 1：`http://111.228.1.24:8765`（默认服务器，推荐）
   - 选项 2：`http://localhost:8765`（本地开发）
   - 用户可以选择 "Other" 输入自定义地址
3. 引导用户创建第一个频道：
   - 使用 AskUserQuestion 询问频道名称和描述
   - 调用 API 创建频道（参考"创建频道"工作流程）
4. 保存配置文件（使用 Write 工具）：
   - 保存服务器地址
   - 保存频道信息到 `channels` 数组
   - 设置 `currentChannelId` 为新创建的频道 ID
5. 显示初始化成功信息：
   - 服务器地址
   - 频道名称
   - RSS URL（用户可以添加到 RSS 阅读器）
   - 提示用户现在可以开始推送内容

**服务器地址询问示例**：
```
AskUserQuestion(
  questions=[{
    "question": "请选择或输入你的 Agent2RSS 服务器地址",
    "header": "服务器地址",
    "options": [
      {
        "label": "http://111.228.1.24:8765（推荐）",
        "description": "使用默认公共服务器"
      },
      {
        "label": "http://localhost:8765",
        "description": "本地开发服务器"
      }
    ],
    "multiSelect": false
  }]
)
```

**频道信息询问示例**：
```
AskUserQuestion(
  questions=[
    {
      "question": "请输入频道名称",
      "header": "频道名称",
      "options": [
        {
          "label": "我的频道",
          "description": "使用默认名称"
        },
        {
          "label": "技术博客",
          "description": "技术相关内容"
        }
      ],
      "multiSelect": false
    },
    {
      "question": "请输入频道描述",
      "header": "频道描述",
      "options": [
        {
          "label": "Claude 创建的 RSS 频道",
          "description": "使用默认描述"
        },
        {
          "label": "分享技术文章和教程",
          "description": "技术内容描述"
        }
      ],
      "multiSelect": false
    }
  ]
)
```

**注意**：
- 用户总是可以选择 "Other" 来输入自定义服务器地址、频道名称或描述
- 初始化完成后，用户即可直接使用该频道推送内容，无需额外配置

## 核心工作流程

### 1. 创建频道

**步骤 1：询问用户**
使用 AskUserQuestion 工具收集信息：
- `name`（必填，默认值："我的频道"）
- `description`（必填，默认值："Claude 创建的 RSS 频道"）

**步骤 2：调用 API**
```bash
curl -X POST {serverUrl}/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name": "频道名称", "description": "频道描述"}'
```

**步骤 3：保存频道信息**
1. 解析 API 返回的 JSON 响应
2. 读取当前配置文件（Read 工具）
3. 将新频道添加到 `channels` 数组
4. 设置 `currentChannelId` 为新频道的 ID
5. 保存配置文件（Write 工具）

**步骤 4：提示用户**
显示以下信息：
- 频道创建成功
- RSS URL（用户可以添加到 RSS 阅读器）
- Webhook URL（用于推送内容）
- Token（用于 API 鉴权）

### 2. 推送内容

**步骤 1：检查当前频道**
1. 读取配置文件（Read 工具）
2. 检查 `currentChannelId` 是否存在
3. 如果不存在，提示用户创建或选择频道

**步骤 2：收集内容**
使用 AskUserQuestion 工具收集信息：
- `title`（必填）
- `content`（必填，支持 Markdown）
- `description`（可选，文章摘要）
- `author`（可选）
- `tags`（可选，逗号分隔）

**步骤 3：调用 Webhook API**
```bash
curl -X POST {webhookUrl} \
  -H "Content-Type: application/json" \
  -H "x-auth-token: {token}" \
  -d '{
    "title": "文章标题",
    "content": "# Markdown 内容\n\n正文...",
    "description": "文章摘要",
    "author": "作者名",
    "tags": ["技术", "教程"]
  }'
```

**步骤 4：确认推送**
- 显示推送成功消息
- 提供 RSS URL 供用户查看

### 3. 管理频道

#### 列出所有频道
1. 读取配置文件（Read 工具）
2. 显示所有频道信息：
   - 频道名称
   - 描述
   - 创建时间
   - 是否为当前频道（标记 ✓）

#### 切换当前频道
1. 列出所有频道
2. 询问用户选择频道（使用频道名称或索引）
3. 更新 `currentChannelId`
4. 保存配置文件（Write 工具）

#### 查看频道详情
显示当前频道的完整信息：
- 频道名称和描述
- RSS URL
- Webhook URL
- Token
- 创建时间

#### 删除频道
1. 列出所有频道
2. 询问用户确认删除
3. 从 `channels` 数组中移除
4. 如果删除的是当前频道，清空 `currentChannelId`
5. 保存配置文件（Write 工具）

### 4. 快速推送（简化流程）

当用户直接提供内容时（例如："推送这篇文章到 RSS"），可以跳过询问步骤：
1. 从用户消息中提取 title 和 content
2. 使用默认值填充可选字段
3. 直接调用 Webhook API
4. 确认推送成功

## 错误处理

### 配置文件不存在
- 提示：首次使用需要初始化配置
- 引导用户选择服务器地址
- 创建配置文件

### 当前频道未设置
- 提示：需要先创建或选择一个频道
- 提供选项：
  1. 创建新频道
  2. 从现有频道中选择

### API 调用失败
- 显示错误信息（HTTP 状态码和响应内容）
- 可能的原因：
  - 网络连接问题
  - 服务器不可用
  - Token 无效
  - 请求参数错误
- 建议用户检查：
  - 服务器地址是否正确
  - 网络连接是否正常
  - Token 是否有效

### 配置文件损坏
- 提示：配置文件格式错误
- 建议：备份当前配置，重新初始化

## 工具使用指南

### Read 工具
用于读取配置文件：
```
Read(file_path="config.json")
```

### Write 工具
用于保存配置文件：
```
Write(
  file_path="config.json",
  content=json.dumps(config, indent=2)
)
```

### Bash 工具
用于调用 API：
```
Bash(
  command='curl -X POST ... -d \'{"key": "value"}\'',
  description="调用 Agent2RSS API"
)
```

### AskUserQuestion 工具
用于收集用户输入：
```
AskUserQuestion(
  questions=[{
    "question": "请输入频道名称",
    "header": "频道名称",
    "options": [...]
  }]
)
```

## 安全注意事项

1. **Token 保护**：配置文件包含敏感的 Token，不要在日志或输出中显示完整 Token
2. **HTTPS 优先**：建议用户使用 HTTPS 服务器地址
3. **输入验证**：在调用 API 前验证用户输入（非空、格式正确）
4. **错误信息**：不要在错误信息中泄露敏感信息

## 默认值

- 频道名称：`"我的频道"`
- 频道描述：`"Claude 创建的 RSS 频道"`
- 服务器地址：`"http://111.228.1.24:8765"`
- 作者：`"Claude"`

## 参考文档

详细的 API 调用示例请参考：`references/api-examples.md`
