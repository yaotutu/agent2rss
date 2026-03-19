import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { getDatabase } from '../../services/database.js';

// 健康检查响应 Schema
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']).openapi({ example: 'healthy' }),
  version: z.string().openapi({ example: '2.0.0' }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  database: z.string().optional().openapi({ example: 'connected' }),
  error: z.string().optional(),
});

// 服务信息响应 Schema
const ServiceInfoSchema = z.object({
  message: z.string().openapi({ example: 'Agent2RSS Service' }),
  version: z.string().openapi({ example: '2.0.0' }),
  features: z.array(z.string()).openapi({ example: ['AI-friendly API', 'Multi-channel RSS feeds'] }),
  endpoints: z.object({
    swagger: z.string(),
    health: z.string(),
    createPost: z.string(),
    uploadPost: z.string(),
    getChannelFeed: z.string(),
    listChannels: z.string(),
    getChannel: z.string(),
    createChannel: z.string(),
    updateChannel: z.string(),
    deleteChannel: z.string(),
  }),
  authentication: z.object({
    required: z.string(),
    tokenTypes: z.object({
      channel: z.string(),
      admin: z.string(),
    }),
  }),
});

// 健康检查路由
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: '健康检查',
  description: '检查服务和数据库连接状态',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: '服务健康状态',
    },
  },
});

// 服务信息路由
const serviceInfoRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: '服务信息',
  description: '获取 Agent2RSS 服务的基本信息和可用端点',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ServiceInfoSchema,
        },
      },
      description: '服务基本信息',
    },
  },
});

export function registerSystemRoutes(app: OpenAPIHono) {
  // 健康检查
  app.openapi(healthRoute, async (c) => {
    try {
      const db = getDatabase();
      db.query('SELECT 1').get();

      return c.json(
        {
          status: 'healthy' as const,
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          database: 'connected',
        },
        200
      );
    } catch (error) {
      return c.json(
        {
          status: 'unhealthy' as const,
          version: '2.0.0',
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        },
        200
      );
    }
  });

  // 服务信息
  app.openapi(serviceInfoRoute, async (c) => {
    return c.json({
      message: 'Agent2RSS Service',
      version: '2.0.0',
      features: ['AI-friendly API', 'Multi-channel RSS feeds', 'Swagger Documentation'],
      endpoints: {
        swagger: 'GET /doc',
        health: 'GET /health',
        createPost: 'POST /api/channels/:channelId/posts',
        uploadPost: 'POST /api/channels/:channelId/posts/upload',
        getChannelFeed: 'GET /channels/:id/rss.xml',
        listChannels: 'GET /api/channels',
        getChannel: 'GET /api/channels/:id',
        createChannel: 'POST /api/channels',
        updateChannel: 'PUT /api/channels/:id',
        deleteChannel: 'DELETE /api/channels/:id',
      },
      authentication: {
        required: 'Authorization: Bearer <token>',
        tokenTypes: {
          channel: 'ch_xxx (for specific channel)',
          admin: 'AUTH_TOKEN (super admin, for all channels)',
        },
      },
    });
  });
}
