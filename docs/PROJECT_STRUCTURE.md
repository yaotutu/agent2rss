# Agent2RSS 模块化架构

## 📦 项目结构树

```
agent2rss/
│
├── 📁 src/                          # 源代码目录
│   ├── 📁 config/                   # 📋 配置模块
│   │   └── index.ts                 #    - 环境变量、常量配置
│   │                                #    - 端口、鉴权、路径等
│   │
│   ├── 📁 types/                    # 🔷 类型定义
│   │   └── index.ts                 #    - TypeScript 接口
│   │                                #    - Theme, Post, WebhookRequest 等
│   │
│   ├── 📁 services/                 # ⚙️ 业务服务
│   │   ├── storage.ts               #    💾 数据存储服务
│   │   │                            #       - readPosts(): 读取文章
│   │   │                            #       - writePosts(): 写入文章
│   │   │                            #       - addPost(): 添加文章
│   │   │                            #       - readThemes(): 读取主题
│   │   │
│   │   ├── theme.ts                 #    🎨 主题管理服务
│   │   │                            #       - loadThemes(): 加载主题
│   │   │                            #       - getTheme(): 获取主题
│   │   │                            #       - addInlineStyles(): 应用样式
│   │   │
│   │   └── markdown.ts              #    📝 Markdown 处理
│   │                                #       - markdownToHtml(): 转 HTML
│   │
│   ├── 📁 utils/                    # 🛠️ 工具函数
│   │   └── index.ts                 #    - generateId(): 生成 UUID
│   │                                #    - getLocalIP(): 获取 IP
│   │                                #    - cleanStyle(): 清理样式
│   │                                #    - generateSummary(): 生成摘要
│   │
│   ├── 📁 routes/                   # 🌐 路由处理
│   │   └── index.ts                 #    - GET /: 服务信息
│   │                                #    - POST /api/webhook: 接收内容
│   │                                #    - GET /rss.xml: RSS Feed
│   │
│   └── index.ts                     # 🚀 主入口（仅 28 行！）
│                                    #    - 加载配置
│                                    #    - 启动服务
│                                    #    - 输出信息
│
├── 📁 data/                         # 💾 数据目录
│   └── posts.json                   #    文章数据存储
│
├── themes.json                      # 🎨 主题配置文件
├── package.json                     # 📦 依赖配置
├── README.md                        # 📖 项目说明
├── ARCHITECTURE.md                  # 🏗️ 架构说明
└── PROJECT_STRUCTURE.md             # 📋 本文件
```

## 🔄 模块依赖关系

```
┌─────────────────────────────────────────┐
│           src/index.ts (主入口)          │
│            启动服务 & 输出信息            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ config/      │  │ routes/      │
│ 配置管理      │  │ 路由处理      │
└──────────────┘  └──────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
 ┌──────────┐    ┌──────────┐    ┌──────────┐
 │ storage/ │    │ markdown/│    │  utils/  │
 │ 数据存储   │    │内容处理   │    │ 工具函数  │
 └──────────┘    └────┬─────┘    └──────────┘
                      │
                      ▼
                ┌──────────┐
                │  theme/  │
                │ 主题管理   │
                └──────────┘
```

## 📊 代码统计

| 模块 | 文件 | 行数 | 职责 |
|------|------|------|------|
| **主入口** | `index.ts` | 28 | 服务启动 |
| **配置** | `config/index.ts` | 24 | 配置管理 |
| **类型** | `types/index.ts` | 57 | 类型定义 |
| **路由** | `routes/index.ts` | 112 | HTTP 处理 |
| **存储服务** | `services/storage.ts` | 56 | 数据读写 |
| **主题服务** | `services/theme.ts` | 153 | 主题管理 |
| **Markdown** | `services/markdown.ts` | 44 | 内容转换 |
| **工具函数** | `utils/index.ts` | 53 | 通用工具 |
| **总计** | **8 个文件** | **527 行** | - |

## 🎯 重构前后对比

### 重构前
```
src/
└── index.ts (418 行，所有代码混在一起)
```

**问题**：
- ❌ 单文件过大
- ❌ 职责不清晰
- ❌ 难以维护
- ❌ 难以扩展

### 重构后
```
src/
├── config/      (配置集中管理)
├── types/       (类型定义独立)
├── services/    (业务逻辑分离)
├── utils/       (工具函数独立)
├── routes/      (路由处理独立)
└── index.ts     (主入口仅 28 行)
```

**优势**：
- ✅ 模块职责清晰
- ✅ 易于理解和维护
- ✅ 便于扩展功能
- ✅ 便于测试
- ✅ 代码复用性高

## 🚀 如何扩展功能

### 1. 添加新的 API 接口

编辑 `src/routes/index.ts`：

```typescript
// 添加文章列表查询接口
app.get('/api/posts', async () => {
  const posts = await readPosts();
  return posts;
});

// 添加单篇文章查询接口
app.get('/api/posts/:id', async ({ params }) => {
  const posts = await readPosts();
  return posts.find(p => p.id === params.id);
});
```

### 2. 添加新的服务

创建 `src/services/yourService.ts`：

```typescript
export function yourFunction() {
  // 你的逻辑
}
```

### 3. 添加新的工具函数

编辑 `src/utils/index.ts`：

```typescript
export function yourUtil() {
  // 你的工具函数
}
```

### 4. 添加新的配置项

编辑 `src/config/index.ts`：

```typescript
export const CONFIG = {
  // ... 现有配置
  yourNewConfig: process.env.YOUR_NEW_CONFIG || 'default',
} as const;
```

## 💡 设计原则

1. **单一职责**: 每个模块只负责一件事
2. **高内聚低耦合**: 模块内部紧密相关，模块间依赖最小
3. **依赖注入**: 通过 import 明确依赖关系
4. **类型安全**: 全面使用 TypeScript
5. **配置集中**: 所有配置在 config 模块

## 📝 注意事项

- 所有 export 都使用 `.js` 扩展名（Bun 要求）
- 模块间通过 import 导入，避免循环依赖
- 新增功能请先添加类型定义
- 保持函数职责单一，便于测试
