import { z } from '@hono/zod-openapi';

// 通用参数 Schema
export const ChannelIdParamSchema = z.object({
  channelId: z.string().openapi({
    param: { name: 'channelId', in: 'path' },
    description: '频道 ID',
    example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece',
  }),
});

export const IdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    description: '频道 ID',
    example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece',
  }),
});
