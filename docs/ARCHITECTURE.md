# Agent2RSS 项目架构说明

## 📁 目录结构

```
agent2rss/
├── src/
│   ├── config/           # 配置模块
│   │   └── index.ts      # 环境变量、常量配置
│   ├── types/            # 类型定义
│   │   └── index.ts      # TypeScript 接口和类型
│   ├── services/         # 业务服务
│   │   ├── storage.ts    # 数据存储服务
│   │   ├── theme.ts      # 主题管理服务
│   │   └── markdown.ts   # Markdown 处理服务
│   ├── utils/            # 工具函数
│   │   └── index.ts      # 通用工具函数
│   ├── routes/           # 路由处理
│   │   └── index.ts      # HTTP 路由定义
│   └── index.ts          # 主入口（精简）
├── data/                 # 数据存储目录
│   └── posts.json        # 文章数据
├── themes.json           # 主题配置
├── package.json
└── README.md
```

## 🏗️ 模块说明

### 1. **config** - 配置模块
集中管理所有配置项：
- 服务端口
- 鉴权 Token
- RSS Feed 配置
- 数据存储路径
- 内容处理配置

### 2. **types** - 类型定义
定义所有 TypeScript 类型：
- `Theme`: 主题结构
- `Post`: 文章结构
- `WebhookRequest`: Webhook 请求
- `ApiResponse`: API 响应

### 3. **services** - 业务服务

#### storage.ts - 数据存储服务
- `readPosts()`: 读取文章列表
- `writePosts()`: 写入文章列表
- `addPost()`: 添加新文章
- `readThemes()`: 读取主题配置

#### theme.ts - 主题管理服务
- `loadThemes()`: 加载主题
- `getTheme()`: 获取指定主题
- `addInlineStyles()`: 为 HTML 添加内联样式

#### markdown.ts - Markdown 处理服务
- `markdownToHtml()`: Markdown 转 HTML

### 4. **utils** - 工具函数
- `generateId()`: 生成 UUID
- `getLocalIP()`: 获取本机 IP
- `cleanStyle()`: 清理样式字符串
- `generateSummary()`: 生成摘要

### 5. **routes** - 路由处理
定义所有 HTTP 路由：
- `GET /`: 服务信息
- `POST /api/webhook`: 接收内容
- `GET /rss.xml`: RSS Feed

## 🔄 数据流

### Webhook 请求流程
```
1. POST /api/webhook
   ↓
2. routes/index.ts - 鉴权检查
   ↓
3. services/markdown.ts - 内容处理
   ↓
4. services/theme.ts - 应用主题
   ↓
5. services/storage.ts - 保存数据
   ↓
6. 返回响应
```

### RSS Feed 生成流程
```
1. GET /rss.xml
   ↓
2. services/storage.ts - 读取文章
   ↓
3. routes/index.ts - 生成 RSS
   ↓
4. 返回 XML
```

## 🚀 扩展功能指南

### 添加新的 API 接口

在 `src/routes/index.ts` 中添加新路由：

```typescript
// 示例：添加文章列表接口
app.get('/api/posts', async () => {
  const posts = await readPosts();
  return posts.map(p => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    pubDate: p.pubDate
  }));
});
```

### 添加新的工具函数

在 `src/utils/index.ts` 中添加：

```typescript
export function yourUtilFunction() {
  // 你的工具函数
}
```

### 添加新的服务

在 `src/services/` 下创建新文件：

```typescript
// src/services/yourService.ts
export function yourServiceFunction() {
  // 你的服务逻辑
}
```

### 添加新的配置项

在 `src/config/index.ts` 中添加：

```typescript
export const CONFIG = {
  // 现有配置...
  yourConfig: process.env.YOUR_CONFIG || 'default',
} as const;
```

## 📝 最佳实践

1. **单一职责**: 每个模块只负责一个特定功能
2. **依赖注入**: 通过 import 导入依赖，避免全局变量
3. **类型安全**: 所有函数都使用 TypeScript 类型
4. **错误处理**: 所有异步操作都包含 try-catch
5. **配置集中**: 所有配置都在 `config/index.ts` 中管理

## 🔧 调试技巧

### 查看当前主题配置
```typescript
import { getAllThemes } from './services/theme.js';
console.log(getAllThemes());
```

### 查看当前配置
```typescript
import { CONFIG } from './config/index.js';
console.log(CONFIG);
```

### 测试单个服务
```typescript
import { markdownToHtml } from './services/markdown.js';
const html = markdownToHtml('# Test', 'github');
console.log(html);
```
