import { z } from '@hono/zod-openapi';

// 创建文章请求体
export const CreatePostBodySchema = z.object({
  content: z.string().openapi({
    description: '文章内容（Markdown 或 HTML）',
    example: '# 标题\n\n这是文章内容...',
  }),
  title: z.string().optional().openapi({
    description: '文章标题（可选，默认从内容提取第一个 # 标题）',
    example: '自定义标题',
  }),
  link: z.string().optional().openapi({
    description: '文章链接（可选，默认自动生成内部链接）',
    example: 'https://example.com/post/123',
  }),
  contentType: z.enum(['auto', 'markdown', 'html']).optional().openapi({
    description: '内容类型（默认为 auto，自动检测）',
    example: 'auto',
  }),
  theme: z.string().optional().openapi({
    description: '主题名称（可选，覆盖频道默认主题）',
    example: 'github',
  }),
  description: z.string().optional().openapi({
    description: '文章摘要（可选，默认从内容生成）',
    example: '这是一篇关于 Bun 的教程',
  }),
  author: z.string().optional().openapi({
    description: '作者名称',
    example: '张三',
  }),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .openapi({
      description: '标签（数组或逗号分隔的字符串）',
      example: ['技术', '教程'],
    }),
  idempotencyKey: z.string().max(255).optional().openapi({
    description: '幂等性键，防止重复发布。相同频道内相同 key 的请求只会创建一次文章',
    example: 'article-2024-01-01-001',
  }),
});

// 创建文章成功响应
export const CreatePostSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().openapi({ example: 'Post created successfully in channel "xxx"' }),
  post: z.object({
    id: z.string(),
    title: z.string(),
    channel: z.string(),
    pubDate: z.string().openapi({ description: 'ISO 8601 日期时间' }),
  }),
  isNew: z.boolean().openapi({
    description: '是否为新创建的文章。false 表示已存在（幂等性键匹配）',
    example: true,
  }),
});

// 验证错误响应
export const ValidationErrorSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: 'Missing required field: content' }),
  details: z.object({
    field: z.string(),
    issue: z.string(),
    provided: z.any(),
    expected: z.any(),
    example: z.any(),
  }),
});
