import { z } from '@hono/zod-openapi';

// 统一错误响应 Schema
export const ErrorSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: '错误信息' }),
  details: z.record(z.string(), z.any()).optional().openapi({
    description: '错误详情',
    example: { field: 'content', issue: 'Required field missing' },
  }),
});

// 未授权响应
export const UnauthorizedResponse = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: 'Authorization header missing or invalid' }),
  details: z
    .object({
      expected: z.string().openapi({ example: 'Authorization: Bearer <token>' }),
      help: z.string().openapi({ example: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN' }),
    })
    .optional(),
});

// 未找到响应
export const NotFoundResponse = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: 'Channel "xxx" not found' }),
  details: z
    .object({
      channelId: z.string().optional(),
      help: z.string().optional(),
    })
    .optional(),
});

// 禁止访问响应
export const ForbiddenResponse = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: 'Forbidden: Invalid token for this channel' }),
});
