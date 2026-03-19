// 主题相关类型（简化版，使用 CSS 文件）
export interface Theme {
  name: string;
  description: string;
  cssFile?: string;
}

export type Themes = Record<string, Theme>;

// ============== 数据库行类型 ==============

/** 数据库中的频道行 */
export interface DBChannel {
  id: string;
  name: string;
  description: string;
  theme: string | null;
  language: string | null;
  max_posts: number;
  token: string;
  created_at: string;
  updated_at: string;
}

/** 数据库中的文章行 */
export interface DBPost {
  id: string;
  title: string;
  link: string;
  content: string;
  content_markdown: string | null;
  summary: string;
  author: string | null;
  pub_date: string;
  channel_id: string;
  idempotency_key: string | null;
}

/** 数据库中的标签行 */
export interface DBPostTag {
  post_id: string;
  tag: string;
}

/** 数据库中的频道配置行 */
export interface DBChannelConfig {
  id: string;
  max_posts: number | null;
}

// ============== 应用层类型 ==============

// 存储数据类型
export interface StorageData {
  posts: Post[];
  channels: Record<string, Channel>;
}

// 频道相关类型
export interface Channel {
  id: string;                    // 唯一标识符 (如: tech, news)
  name: string;                  // 显示名称
  description: string;           // RSS 描述
  theme?: string;                // 主题 (默认使用全局配置)
  maxPosts?: number;             // 最大文章数 (默认使用全局配置)
  language?: string;             // 语言 (默认: zh-CN)
  token: string;                 // 频道密钥 (用于鉴权)
  createdAt: Date;
  updatedAt: Date;
}

// 文章相关类型
export interface Post {
  id: string;
  channel: string;               // 所属频道 ID（必填）
  title: string;
  link: string;
  content: string;
  contentMarkdown?: string;
  summary: string;
  tags?: string[];
  author?: string;
  pubDate: Date;
  idempotencyKey?: string;       // 幂等性键，防止重复发布
}

// Webhook 请求类型（保留用于向后兼容）
export interface WebhookRequest {
  title: string;
  link?: string;                 // 可选，不提供则自动生成内部链接
  content: string;
  channel: string;               // 目标频道（必填）
  contentType?: 'markdown' | 'html';
  theme?: string;
  description?: string;
  tags?: string[];
  author?: string;
}

// 统一的文章创建请求（AI 友好）
export interface CreatePostRequest {
  content: string;                                    // 必需，Markdown 或 HTML 内容
  title?: string;                                     // 可选，默认从 content 提取
  link?: string;                                      // 可选，默认自动生成
  contentType?: 'auto' | 'markdown' | 'html';        // 默认 'auto'
  theme?: string;                                     // 可选，覆盖频道默认主题
  description?: string;                               // 可选，默认自动生成摘要
  tags?: string | string[];                           // 统一支持两种类型
  author?: string;                                    // 可选
  idempotencyKey?: string;                            // 幂等性键，防止重复发布
}

// 错误详情
export interface ErrorDetails {
  reason?: string;
  field?: string;
  issue?: string;
  channelId?: string;
  provided?: string;
  expected?: string;
  expectedFormat?: string;
  availableChannels?: string[];
  help?: string;
  docs?: string;
  commonCauses?: string[];
  solutions?: string[];
}

// 改进的错误响应
export interface ErrorResponse {
  success: false;
  error: string;
  details?: ErrorDetails;
}

// API 响应类型
export interface ApiResponse {
  success?: boolean;
  message?: string;
  post?: {
    id: string;
    title: string;
    channel?: string;
    pubDate: Date;
  };
  isNew?: boolean;                                    // 是否为新创建的文章（幂等性支持）
  error?: string;
  details?: ErrorDetails;
}
