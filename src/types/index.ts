// 主题相关类型
export interface ThemeStyles {
  pre?: string;
  codeInline?: string;
  table?: string;
  thead?: string;
  th?: string;
  td?: string;
  tr?: string;
  blockquote?: string;
  h1?: string;
  h2?: string;
  h3?: string;
  h4?: string;
  h5?: string;
  h6?: string;
  p?: string;
  ul?: string;
  ol?: string;
  li?: string;
  a?: string;
  hr?: string;
  mark?: string;
  ins?: string;
  del?: string;
  img?: string;
}

export interface Theme {
  name: string;
  description: string;
  styles: ThemeStyles;
}

export type Themes = Record<string, Theme>;

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
  contentMarkdown: string;
  summary: string;
  tags?: string[];
  author?: string;
  pubDate: Date;
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
  error?: string;
  details?: ErrorDetails;
}
