import { z } from '@hono/zod-openapi';

// 创建频道请求体
export const CreateChannelBodySchema = z.object({
  name: z.string().openapi({
    description: '频道名称',
    example: '技术资讯',
  }),
  description: z.string().openapi({
    description: '频道描述',
    example: '分享最新的技术动态',
  }),
  theme: z.string().optional().openapi({
    description: '主题名称（可选）。可选值: github, minimal, dark, modern, elegant, clean, spring',
    example: 'github',
  }),
  language: z.string().optional().openapi({
    description: '语言代码（可选，默认 zh-CN）',
    example: 'zh-CN',
  }),
});

// 更新频道请求体
export const UpdateChannelBodySchema = z.object({
  name: z.string().optional().openapi({
    description: '频道名称',
    example: '新的频道名称',
  }),
  description: z.string().optional().openapi({
    description: '频道描述',
    example: '更新后的频道描述',
  }),
  theme: z.string().optional().openapi({
    description: '主题名称。可选值: github, minimal, dark, modern, elegant, clean, spring',
    example: 'dark',
  }),
  language: z.string().optional().openapi({
    description: '语言代码',
    example: 'en-US',
  }),
});

// 频道信息 Schema
export const ChannelInfoSchema = z.object({
  id: z.string().openapi({ example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece' }),
  name: z.string().openapi({ example: '技术资讯' }),
  description: z.string().openapi({ example: '分享最新的技术动态' }),
  theme: z.string().openapi({ example: 'spring' }),
  language: z.string().openapi({ example: 'zh-CN' }),
  token: z.string().optional().openapi({
    description: '仅授权用户可见',
    example: 'ch_4fd9cdce724ffb8d6ec69187b5438ae2',
  }),
  postCount: z.number().openapi({ example: 42 }),
  rssUrl: z.string().openapi({
    description: 'RSS Feed 订阅地址',
    example: 'https://your-domain.com/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml',
  }),
  createdAt: z.string().openapi({ description: 'ISO 8601 日期时间' }),
  updatedAt: z.string().openapi({ description: 'ISO 8601 日期时间' }),
});

// 频道列表响应
export const ChannelListSchema = z.array(ChannelInfoSchema);

// 创建频道成功响应
export const CreateChannelSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().openapi({ example: 'Channel created. Please save your token.' }),
  channel: z.object({
    id: z.string().openapi({
      description: '频道 ID（服务端自动生成的 UUID）',
      example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece',
    }),
    name: z.string().openapi({ example: '技术资讯' }),
    token: z.string().openapi({
      description: '频道密钥（用于发布文章和频道管理鉴权，请妥善保存）',
      example: 'ch_4fd9cdce724ffb8d6ec69187b5438ae2',
    }),
    postsUrl: z.string().openapi({
      description: '发布文章的 API 地址',
      example: 'https://your-domain.com/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/posts',
    }),
    rssUrl: z.string().openapi({
      description: 'RSS Feed 订阅地址',
      example: 'https://your-domain.com/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml',
    }),
  }),
});

// 更新频道成功响应
export const UpdateChannelSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().openapi({ example: 'Channel updated' }),
  channel: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    theme: z.string(),
    language: z.string(),
    createdAt: z.string().openapi({ description: 'ISO 8601 日期时间' }),
    updatedAt: z.string().openapi({ description: 'ISO 8601 日期时间' }),
  }),
});

// 删除频道成功响应
export const DeleteChannelSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().openapi({ example: 'Channel deleted' }),
});
