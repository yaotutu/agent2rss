import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { CONFIG } from '../config/index.js';
import {
  readChannel,
  readAllChannels,
  readPosts,
  createChannel,
  updateChannel,
  deleteChannel,
} from '../services/storage.js';
import { verifyToken } from '../services/auth.js';
import { generateId, generateChannelToken } from '../utils/index.js';
import type { Channel } from '../types/index.js';
import { extractToken, type AppVariables } from './middleware.js';

/**
 * 注册频道管理路由。
 *
 * 端点：
 * - GET    /api/channels        获取所有频道列表
 * - GET    /api/channels/:id    获取单个频道详情
 * - POST   /api/channels        创建新频道
 * - PUT    /api/channels/:id    更新频道配置
 * - DELETE /api/channels/:id    删除频道（级联删除所有文章）
 *
 * 鉴权说明：
 * - GET 接口无需鉴权，但携带有效 token 时会额外返回 token 字段
 * - POST 接口在 private 模式下需要超级管理员 token
 * - PUT/DELETE 接口需要频道 token 或超级管理员 token
 */
export function registerChannelRoutes(app: OpenAPIHono<{ Variables: AppVariables }>) {

  // ============================================================
  // 获取所有频道
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/api/channels',
    tags: ['Channels'],
    summary: '获取所有频道',
    responses: { 200: { description: '频道列表' } },
  }), async (c) => {
    // 检查是否为超级管理员：超级管理员可以看到所有频道的 token 字段
    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    const isSuperAdmin = authToken === CONFIG.authToken && CONFIG.authToken !== '';

    const channels = await readAllChannels();
    const channelList = [];

    for (const [id, channel] of Object.entries(channels)) {
      const posts = await readPosts(id);
      channelList.push({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        theme: channel.theme,
        language: channel.language,
        maxPosts: channel.maxPosts,
        // 非超级管理员隐藏 token，避免泄露
        token: isSuperAdmin ? channel.token : undefined,
        postCount: posts.length,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      });
    }

    return c.json(channelList);
  });

  // ============================================================
  // 获取单个频道
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '获取单个频道',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      }),
    },
    responses: {
      200: { description: '频道详情' },
      404: { description: '频道不存在' },
    },
  }), async (c) => {
    const { id } = c.req.valid('param');
    const channel = await readChannel(id);

    if (!channel) {
      return c.json({ error: `Channel "${id}" not found` }, 404);
    }

    // 携带有效 token（频道 token 或超级管理员 token）时才返回 token 字段
    // 这样频道所有者可以通过此接口找回自己的 token
    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    const authResult = await verifyToken(authToken, id);
    const posts = await readPosts(id);

    return c.json({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      theme: channel.theme,
      language: channel.language,
      maxPosts: channel.maxPosts,
      token: authResult.authorized ? channel.token : undefined,
      postCount: posts.length,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    });
  });

  // ============================================================
  // 创建频道
  // ============================================================

  app.openapi(createRoute({
    method: 'post',
    path: '/api/channels',
    tags: ['Channels'],
    summary: '创建频道',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().openapi({ description: '频道名称', example: '技术资讯' }),
              description: z.string().openapi({ description: '频道描述', example: '分享最新的技术动态' }),
              theme: z.string().optional().openapi({ description: '主题名称（可选）' }),
              language: z.string().optional().openapi({ description: '语言代码（可选，默认 zh-CN）' }),
              maxPosts: z.number().optional().openapi({ description: '最大文章数（可选，默认 100）' }),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: '频道创建成功' },
      403: { description: '无权限（私有模式下需要超级管理员 token）' },
    },
  }), async (c) => {
    // private 模式：只有超级管理员可以创建频道，防止任意用户创建
    // public 模式（默认）：任何人都可以创建频道
    if (CONFIG.channelCreationMode === 'private') {
      const authHeader = c.req.header('authorization');
      const authToken = authHeader?.replace('Bearer ', '');
      if (!authToken || authToken !== CONFIG.authToken) {
        return c.json({
          success: false,
          error: 'Forbidden: Admin token required to create channels',
        }, 403);
      }
    }

    const body = c.req.valid('json');
    // 生成频道 token（格式：ch_xxx），创建后只返回一次，无法找回
    const channelToken = generateChannelToken();

    const newChannel: Channel = {
      id: generateId(),
      name: body.name,
      description: body.description,
      theme: body.theme || CONFIG.content.defaultTheme,
      language: body.language || 'zh-CN',
      maxPosts: body.maxPosts,
      token: channelToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createChannel(newChannel);

    return c.json({
      success: true,
      // 提醒调用方保存 token，后续无法通过 API 找回（除非使用超级管理员 token）
      message: 'Channel created. Please save your token.',
      channel: {
        id: newChannel.id,
        name: newChannel.name,
        token: channelToken,
        postsUrl: `${CONFIG.feed.url}/api/channels/${newChannel.id}/posts`,
        rssUrl: `${CONFIG.feed.url}/channels/${newChannel.id}/rss.xml`,
      },
    }, 201);
  });

  // ============================================================
  // 更新 / 删除频道（需要 token）
  // ============================================================

  // PUT 和 DELETE 都需要 token，通过 extractToken 中间件统一提取
  // 注意：此处不使用 requireChannelAuth，因为 GET /api/channels/:id 不需要强制 token
  // 而 app.use 会匹配所有方法，所以只提取 token，鉴权逻辑在各路由处理器内完成
  app.use('/api/channels/:id', extractToken);

  app.openapi(createRoute({
    method: 'put',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '更新频道',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().optional(),
              description: z.string().optional(),
              theme: z.string().optional(),
              language: z.string().optional(),
              maxPosts: z.number().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: '更新成功' },
      403: { description: '无权限' },
    },
  }), async (c) => {
    const { id } = c.req.valid('param');
    // 直接从请求头读取 token（不依赖 context，因为 GET 同路径不走 extractToken）
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json({ error: 'Forbidden: Invalid token for this channel' }, 403);
    }

    const body = c.req.valid('json');
    await updateChannel(id, body as any);
    const updatedChannel = await readChannel(id);

    return c.json({ success: true, message: 'Channel updated', channel: updatedChannel });
  });

  app.openapi(createRoute({
    method: 'delete',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '删除频道',
    description: '删除频道及其所有文章（级联删除，不可恢复）。',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      }),
    },
    responses: {
      200: { description: '删除成功' },
      403: { description: '无权限' },
    },
  }), async (c) => {
    const { id } = c.req.valid('param');
    const authToken = c.req.header('authorization')?.replace('Bearer ', '');
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json({ error: 'Forbidden: Invalid token for this channel' }, 403);
    }

    // deleteChannel 内部对 'default' 频道有保护，不允许删除
    await deleteChannel(id);
    return c.json({ success: true, message: 'Channel deleted' });
  });
}
