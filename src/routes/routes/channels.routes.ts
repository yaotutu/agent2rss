import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import {
  readChannel,
  readAllChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  readPosts,
} from '../../services/storage.js';
import { verifyToken } from '../../services/auth.js';
import { CONFIG } from '../../config/index.js';
import { generateId, generateChannelToken } from '../../utils/index.js';
import type { Channel } from '../../types/index.js';
import {
  IdParamSchema,
  CreateChannelBodySchema,
  UpdateChannelBodySchema,
  ChannelInfoSchema,
  ChannelListSchema,
  CreateChannelSuccessSchema,
  UpdateChannelSuccessSchema,
  DeleteChannelSuccessSchema,
  ErrorSchema,
  UnauthorizedResponse,
  NotFoundResponse,
  ForbiddenResponse,
} from '../schemas/index.js';

// 获取所有频道路由
const listChannelsRoute = createRoute({
  method: 'get',
  path: '/api/channels',
  tags: ['Channels'],
  summary: '获取所有频道',
  description: '获取所有频道列表。超级管理员（使用 AUTH_TOKEN in Authorization header）可以看到所有频道的 token。',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChannelListSchema,
        },
      },
      description: '频道列表',
    },
  },
});

// 获取单个频道路由
const getChannelRoute = createRoute({
  method: 'get',
  path: '/api/channels/{id}',
  tags: ['Channels'],
  summary: '获取单个频道',
  description: '获取指定频道的详细信息。使用频道 token 或超级管理员 token 可以看到频道 token。',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChannelInfoSchema,
        },
      },
      description: '频道详情',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponse,
        },
      },
      description: '频道不存在',
    },
  },
});

// 创建频道路由
const createChannelRoute = createRoute({
  method: 'post',
  path: '/api/channels',
  tags: ['Channels'],
  summary: '创建频道',
  description:
    '创建新频道并生成唯一的频道 ID 和 token。频道 ID 由服务端自动生成，确保唯一性和安全性。私有模式下需要在请求头中提供超级管理员 token。',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateChannelBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: CreateChannelSuccessSchema,
        },
      },
      description: '频道创建成功',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenResponse,
        },
      },
      description: '禁止访问',
    },
  },
});

// 更新频道路由
const updateChannelRoute = createRoute({
  method: 'put',
  path: '/api/channels/{id}',
  tags: ['Channels'],
  summary: '更新频道',
  description: '更新频道信息。需要在请求头中提供频道 token 或超级管理员 token 进行鉴权。',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateChannelBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateChannelSuccessSchema,
        },
      },
      description: '频道更新成功',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenResponse,
        },
      },
      description: '禁止访问',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponse,
        },
      },
      description: '频道不存在',
    },
  },
});

// 删除频道路由
const deleteChannelRoute = createRoute({
  method: 'delete',
  path: '/api/channels/{id}',
  tags: ['Channels'],
  summary: '删除频道',
  description:
    '删除频道及其所有文章。需要在请求头中提供频道 token 或超级管理员 token 进行鉴权。默认频道不能删除。',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteChannelSuccessSchema,
        },
      },
      description: '频道删除成功',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenResponse,
        },
      },
      description: '禁止访问',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponse,
        },
      },
      description: '频道不存在',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '服务器错误',
    },
  },
});

// 从请求头提取 Bearer Token
function extractBearerToken(c: any): string | undefined {
  const authHeader = c.req.header('authorization');
  if (!authHeader) return undefined;
  return authHeader.replace('Bearer ', '');
}

export function registerChannelRoutes(app: OpenAPIHono) {
  // 获取所有频道
  app.openapi(listChannelsRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const authToken = extractBearerToken(c);
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
        token: isSuperAdmin ? channel.token : undefined,
        postCount: posts.length,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      });
    }

    return c.json(channelList, 200);
  });

  // 获取单个频道
  app.openapi(getChannelRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const { id } = c.req.valid('param');
    const channel = await readChannel(id);

    if (!channel) {
      return c.json(
        {
          success: false,
          error: `Channel "${id}" not found`,
        },
        404
      );
    }

    const authToken = extractBearerToken(c);
    const authResult = await verifyToken(authToken, id);
    const posts = await readPosts(id);

    return c.json(
      {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        theme: channel.theme,
        language: channel.language,
        maxPosts: channel.maxPosts,
        token: authResult.authorized ? channel.token : undefined,
        postCount: posts.length,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      },
      200
    );
  });

  // 创建频道
  app.openapi(createChannelRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const body = c.req.valid('json');

    // 私有模式：需要超级管理员验证
    if (CONFIG.channelCreationMode === 'private') {
      const authToken = extractBearerToken(c);

      if (!authToken || authToken !== CONFIG.authToken) {
        return c.json(
          {
            success: false,
            error: 'Forbidden: Admin token required to create channels',
          },
          403
        );
      }
    }

    // 生成频道密钥
    const channelToken = generateChannelToken();

    const newChannel: Channel = {
      id: generateId(),
      name: body.name,
      description: body.description,
      theme: body.theme || CONFIG.content.defaultTheme,
      language: body.language || 'zh-CN',
      maxPosts: body.maxPosts || 100,
      token: channelToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createChannel(newChannel);

    return c.json(
      {
        success: true,
        message: 'Channel created. Please save your token.',
        channel: {
          id: newChannel.id,
          name: newChannel.name,
          token: channelToken,
          postsUrl: `${CONFIG.feed.url}/api/channels/${newChannel.id}/posts`,
          rssUrl: `${CONFIG.feed.url}/channels/${newChannel.id}/rss.xml`,
        },
      },
      201
    );
  });

  // 更新频道
  app.openapi(updateChannelRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const authToken = extractBearerToken(c);
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json(
        {
          success: false,
          error: 'Forbidden: Invalid token for this channel',
        },
        403
      );
    }

    // 不允许修改 token
    const { token, ...updates } = body as any;
    await updateChannel(id, updates);
    const updatedChannel = await readChannel(id);

    if (!updatedChannel) {
      return c.json(
        {
          success: false,
          error: `Channel "${id}" not found`,
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        message: 'Channel updated',
        channel: {
          id: updatedChannel.id,
          name: updatedChannel.name,
          description: updatedChannel.description,
          theme: updatedChannel.theme,
          language: updatedChannel.language,
          maxPosts: updatedChannel.maxPosts,
          createdAt: updatedChannel.createdAt.toISOString(),
          updatedAt: updatedChannel.updatedAt.toISOString(),
        },
      },
      200
    );
  });

  // 删除频道
  app.openapi(deleteChannelRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const { id } = c.req.valid('param');
    const authToken = extractBearerToken(c);
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json(
        {
          success: false,
          error: 'Forbidden: Invalid token for this channel',
        },
        403
      );
    }

    try {
      await deleteChannel(id);
      return c.json(
        {
          success: true,
          message: 'Channel deleted',
        },
        200
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: (error as Error).message,
        },
        500
      );
    }
  });
}
