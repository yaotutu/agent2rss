import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { Feed } from 'feed';
import { CONFIG } from '../config/index.js';
import type { WebhookRequest, ApiResponse, Channel } from '../types/index.js';
import {
  addPost,
  readPosts,
  readChannel,
  readAllChannels,
  createChannel,
  updateChannel,
  deleteChannel
} from '../services/storage.js';
import { markdownToHtml } from '../services/markdown.js';
import { generateSummary, generateId, generateChannelToken } from '../utils/index.js';
import { verifyToken } from '../services/auth.js';
import { getDatabase } from '../services/database.js';

/**
 * 创建路由
 */
export function createRoutes() {
  const app = new Elysia();

  // ============================================================
  // Swagger API 文档
  // ============================================================

  app.use(swagger({
    documentation: {
      info: {
        title: 'Agent2RSS API',
        version: '2.0.0',
        description: '多频道 RSS 微服务 - 将任意内容转换为 RSS Feed\n\n## RSS Feed 访问\n\n获取频道 RSS Feed：`GET /channels/{channel-id}/rss.xml`\n\n示例：\n- http://localhost:8765/channels/default/rss.xml\n- http://localhost:8765/channels/tech/rss.xml'
      },
      tags: [
        { name: 'Webhook', description: '内容接收接口' },
        { name: 'RSS', description: 'RSS Feed 生成' },
        { name: 'Channels', description: '频道管理' },
        { name: 'System', description: '系统信息' }
      ]
    }
  }));

  // ============================================================
  // 全局错误处理
  // ============================================================

  app.onError(({ error, code, set }) => {
    if (code === 'VALIDATION') {
      set.status = 422;
      return { success: false, error: '请求参数验证失败', details: error };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { success: false, error: '资源不存在' };
    }

    console.error('请求处理失败:', error);
    set.status = 500;
    return { success: false, error: '服务器内部错误' };
  });

  // ============================================================
  // 健康检查端点
  // ============================================================

  app.get('/health', async () => {
    try {
      // 检查数据库连接
      const db = getDatabase();
      db.query('SELECT 1').get();

      return {
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        database: 'connected'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }, {
    detail: {
      summary: '健康检查',
      description: '检查服务和数据库连接状态',
      tags: ['System']
    }
  });

  // ============================================================
  // 根路径 - 服务信息
  // ============================================================

  app.get('/', () => ({
    message: 'Agent2RSS Service',
    version: '2.0.0',
    features: ['Multi-channel RSS feeds', 'Swagger API Documentation'],
    endpoints: {
      swagger: 'GET /swagger',
      health: 'GET /health',
      webhook: 'POST /api/channels/:channelId/webhook',
      channelRss: 'GET /channels/:id/rss.xml',
      channels: 'GET /api/channels',
      createChannel: 'POST /api/channels',
      updateChannel: 'PUT /api/channels/:id',
      deleteChannel: 'DELETE /api/channels/:id',
    }
  }), {
    detail: {
      summary: '服务信息',
      description: '获取 Agent2RSS 服务的基本信息和可用端点',
      tags: ['System']
    }
  });

  // ============================================================
  // Webhook - 频道专属接收内容
  // ============================================================

  app.post('/api/channels/:channelId/webhook', async ({ params, body, headers, set }): Promise<ApiResponse> => {
    // 鉴权检查
    const authToken = headers['x-auth-token'];
    const channelId = params.channelId;

    // 验证 token
    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      set.status = 401;
      return {
        success: false,
        error: authResult.error || 'Unauthorized'
      };
    }

    // 验证频道是否存在
    const channel = await readChannel(channelId);
    if (!channel) {
      set.status = 404;
      return { success: false, error: `Channel "${channelId}" not found` };
    }

    // 内容处理
    const contentType = body.contentType || 'markdown';
    const theme = body.theme || channel.theme || CONFIG.content.defaultTheme;
    const html = contentType === 'html'
      ? body.content
      : markdownToHtml(body.content, theme);

    const summary = body.description || generateSummary(html, CONFIG.content.defaultSummaryLength);

    // 生成文章 ID
    const postId = generateId();

    // 自动生成链接（如果未提供）
    const postLink = body.link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

    // 创建新文章
    const newPost = {
      id: postId,
      title: body.title,
      link: postLink,
      content: html,
      contentMarkdown: body.content,
      summary,
      tags: body.tags,
      author: body.author,
      pubDate: new Date(),
      channel: channelId,
    };

    // 保存到指定频道
    await addPost(newPost, channelId);

    return {
      success: true,
      message: `Post added to channel "${channelId}"`,
      post: {
        id: newPost.id,
        title: newPost.title,
        channel: channelId,
        pubDate: newPost.pubDate
      }
    };
  }, {
    params: t.Object({
      channelId: t.String({
        description: '频道 ID',
        examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
      })
    }),
    body: t.Object({
      title: t.String({
        description: '文章标题',
        examples: ['如何使用 Bun 构建高性能应用']
      }),
      content: t.String({
        description: '文章内容（Markdown 或 HTML）',
        examples: ['# 标题\n\n这是文章内容...']
      }),
      link: t.Optional(t.String({
        description: '文章链接（可选，不提供则自动生成）',
        examples: ['https://example.com/post/123']
      })),
      contentType: t.Optional(t.Union([t.Literal('markdown'), t.Literal('html')], {
        description: '内容类型，默认 markdown',
        examples: ['markdown']
      })),
      theme: t.Optional(t.String({
        description: '主题名称（可选）。可选值: github, minimal, dark, modern, elegant, clean, spring',
        examples: ['github']
      })),
      description: t.Optional(t.String({
        description: '文章摘要（可选）',
        examples: ['本文介绍如何使用 Bun 构建高性能应用']
      })),
      tags: t.Optional(t.Array(t.String(), {
        description: '标签列表',
        examples: [['技术', 'Bun']]
      })),
      author: t.Optional(t.String({
        description: '作者名称',
        examples: ['张三']
      }))
    }),
    response: {
      200: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Post added to channel "8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece"'] }),
        post: t.Object({
          id: t.String({ examples: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] }),
          title: t.String({ examples: ['如何使用 Bun 构建高性能应用'] }),
          channel: t.String({ examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece'] }),
          pubDate: t.Date({ examples: [new Date().toISOString()] })
        })
      }),
      401: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Unauthorized'] })
      }),
      404: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Channel "xxx" not found'] })
      })
    },
    detail: {
      summary: '频道专属 Webhook',
      description: '向指定频道添加新文章，支持 Markdown 和 HTML 格式。需要在请求头中提供该频道的 token (x-auth-token) 进行鉴权。',
      tags: ['Webhook']
    }
  });

  // ============================================================
  // 频道 RSS Feed
  // ============================================================

  app.get('/channels/:id/rss.xml', async ({ params, set }) => {
    const channelId = params.id;

    // 读取频道配置
    const channel = await readChannel(channelId);
    if (!channel) {
      set.status = 404;
      return { error: `Channel "${channelId}" not found` };
    }

    // 读取该频道的文章
    const posts = await readPosts(channelId);

    // 生成 RSS Feed
    const feed = new Feed({
      title: channel.name,
      description: channel.description,
      id: `${CONFIG.feed.url}/channels/${channelId}`,
      link: `${CONFIG.feed.url}/channels/${channelId}`,
      language: channel.language || CONFIG.feed.language,
      feedLinks: {
        rss: `${CONFIG.feed.url}/channels/${channelId}/rss.xml`
      },
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: posts.length > 0 ? posts[0].pubDate : new Date()
    });

    for (const post of posts) {
      feed.addItem({
        title: post.title,
        id: post.id,
        link: post.link,
        description: post.summary,
        content: post.content,
        date: post.pubDate,
        author: post.author ? [{ name: post.author }] : undefined,
        category: post.tags?.map(tag => ({ name: tag }))
      });
    }

    set.headers['Content-Type'] = 'application/xml; charset=utf-8';
    return feed.rss2();
  }, {
    params: t.Object({
      id: t.String({
        description: '频道 ID',
        examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
      })
    }),
    response: {
      200: t.String({
        description: 'RSS Feed XML 内容',
        contentType: 'application/xml; charset=utf-8'
      }),
      404: t.Object({
        error: t.String({ examples: ['Channel "xxx" not found'] })
      })
    },
    detail: {
      summary: '获取频道 RSS Feed',
      description: '获取指定频道的 RSS Feed（XML 格式）',
      tags: ['RSS']
    }
  });

  // ============================================================
  // 频道管理 API
  // ============================================================

  // 获取所有频道
  app.get('/api/channels', async ({ headers }) => {
    const authToken = headers['x-auth-token'];
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
        // 只有超级管理员能看到所有 token
        token: isSuperAdmin ? channel.token : undefined,
        postCount: posts.length,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      });
    }

    return channelList;
  }, {
    response: {
      200: t.Array(t.Object({
        id: t.String({ examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece'] }),
        name: t.String({ examples: ['技术资讯'] }),
        description: t.String({ examples: ['分享最新的技术动态'] }),
        theme: t.String({ examples: ['spring'] }),
        language: t.String({ examples: ['zh-CN'] }),
        maxPosts: t.Number({ examples: [100] }),
        token: t.Optional(t.String({
          description: '仅超级管理员可见',
          examples: ['ch_4fd9cdce724ffb8d6ec69187b5438ae2']
        })),
        postCount: t.Number({ examples: [42] }),
        createdAt: t.Date(),
        updatedAt: t.Date()
      }))
    },
    detail: {
      summary: '获取所有频道',
      description: '获取所有频道列表。超级管理员（使用 AUTH_TOKEN）可以看到所有频道的 token。',
      tags: ['Channels']
    }
  });

  // 获取单个频道
  app.get('/api/channels/:id', async ({ params, headers, set }) => {
    const channel = await readChannel(params.id);
    if (!channel) {
      set.status = 404;
      return { error: `Channel "${params.id}" not found` };
    }

    const authToken = headers['x-auth-token'];
    const authResult = await verifyToken(authToken, params.id);

    const posts = await readPosts(params.id);

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      theme: channel.theme,
      language: channel.language,
      maxPosts: channel.maxPosts,
      // 只有有权限的用户能看到 token
      token: authResult.authorized ? channel.token : undefined,
      postCount: posts.length,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };
  }, {
    params: t.Object({
      id: t.String({
        description: '频道 ID',
        examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
      })
    }),
    response: {
      200: t.Object({
        id: t.String({ examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece'] }),
        name: t.String({ examples: ['技术资讯'] }),
        description: t.String({ examples: ['分享最新的技术动态'] }),
        theme: t.String({ examples: ['spring'] }),
        language: t.String({ examples: ['zh-CN'] }),
        maxPosts: t.Number({ examples: [100] }),
        token: t.Optional(t.String({
          description: '仅授权用户可见',
          examples: ['ch_4fd9cdce724ffb8d6ec69187b5438ae2']
        })),
        postCount: t.Number({ examples: [42] }),
        createdAt: t.Date(),
        updatedAt: t.Date()
      }),
      404: t.Object({
        error: t.String({ examples: ['Channel "xxx" not found'] })
      })
    },
    detail: {
      summary: '获取单个频道',
      description: '获取指定频道的详细信息。使用频道 token 或超级管理员 token 可以看到频道 token。',
      tags: ['Channels']
    }
  });

  // 创建频道
  app.post('/api/channels', async ({ body, headers, set }) => {
    // 私有模式：需要超级管理员验证
    if (CONFIG.channelCreationMode === 'private') {
      const authToken = headers['x-auth-token'];

      // 验证是否为超级管理员
      if (!authToken || authToken !== CONFIG.authToken) {
        set.status = 403;
        return {
          success: false,
          error: 'Forbidden: Admin token required to create channels'
        };
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
      maxPosts: body.maxPosts,
      token: channelToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createChannel(newChannel);

    set.status = 201;
    return {
      success: true,
      message: 'Channel created. Please save your token.',
      channel: {
        id: newChannel.id,
        name: newChannel.name,
        token: channelToken,
        webhookUrl: `${CONFIG.feed.url}/api/channels/${newChannel.id}/webhook`,
        rssUrl: `${CONFIG.feed.url}/channels/${newChannel.id}/rss.xml`,
      }
    };
  }, {
    body: t.Object({
      name: t.String({
        description: '频道名称',
        examples: ['技术资讯']
      }),
      description: t.String({
        description: '频道描述',
        examples: ['分享最新的技术动态和开发经验']
      }),
      theme: t.Optional(t.String({
        description: '主题名称（可选）。可选值: github, minimal, dark, modern, elegant, clean, spring（默认）',
        examples: ['github']
      })),
      language: t.Optional(t.String({
        description: '语言代码（可选，默认 zh-CN）',
        examples: ['zh-CN']
      })),
      maxPosts: t.Optional(t.Number({
        description: '最大文章数（可选，默认 100）',
        examples: [100]
      })),
    }),
    response: {
      201: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Channel created. Please save your token.'] }),
        channel: t.Object({
          id: t.String({
            description: '频道 ID（服务端自动生成的 UUID）',
            examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
          }),
          name: t.String({ examples: ['技术资讯'] }),
          token: t.String({
            description: '频道密钥（用于 Webhook 鉴权，请妥善保存）',
            examples: ['ch_4fd9cdce724ffb8d6ec69187b5438ae2']
          }),
          webhookUrl: t.String({
            description: 'Webhook 调用地址（频道专属）',
            examples: ['https://your-domain.com/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/webhook']
          }),
          rssUrl: t.String({
            description: 'RSS Feed 订阅地址',
            examples: ['https://your-domain.com/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/rss.xml']
          })
        })
      }),
      403: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Forbidden: Admin token required to create channels'] })
      }),
      500: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Channel "xxx" already exists'] })
      })
    },
    detail: {
      summary: '创建频道',
      description: '创建新频道并生成唯一的频道 ID 和 token。频道 ID 由服务端自动生成，确保唯一性和安全性。私有模式下需要在请求头中提供超级管理员 token (x-auth-token)。',
      tags: ['Channels']
    }
  });

  // 更新频道
  app.put('/api/channels/:id', async ({ params, body, headers, set }) => {
    const authToken = headers['x-auth-token'];
    const authResult = await verifyToken(authToken, params.id);

    if (!authResult.authorized) {
      set.status = 403;
      return { error: 'Forbidden: Invalid token for this channel' };
    }

    // 不允许修改 token
    const { token, ...updates } = body as any;
    await updateChannel(params.id, updates);
    const updatedChannel = await readChannel(params.id);

    return {
      success: true,
      message: 'Channel updated',
      channel: updatedChannel
    };
  }, {
    body: t.Object({
      name: t.Optional(t.String({
        description: '频道名称',
        examples: ['新的频道名称']
      })),
      description: t.Optional(t.String({
        description: '频道描述',
        examples: ['更新后的频道描述']
      })),
      theme: t.Optional(t.String({
        description: '主题名称。可选值: github, minimal, dark, modern, elegant, clean, spring',
        examples: ['dark']
      })),
      language: t.Optional(t.String({
        description: '语言代码',
        examples: ['en-US']
      })),
      maxPosts: t.Optional(t.Number({
        description: '最大文章数',
        examples: [200]
      })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Channel updated'] }),
        channel: t.Object({
          id: t.String(),
          name: t.String(),
          description: t.String(),
          theme: t.String(),
          language: t.String(),
          maxPosts: t.Number(),
          createdAt: t.Date(),
          updatedAt: t.Date()
        })
      }),
      403: t.Object({
        error: t.String({ examples: ['Forbidden: Invalid token for this channel'] })
      }),
      404: t.Object({
        error: t.String({ examples: ['Channel "xxx" not found'] })
      })
    },
    detail: {
      summary: '更新频道',
      description: '更新频道信息。需要在请求头中提供频道 token 或超级管理员 token 进行鉴权。',
      tags: ['Channels']
    }
  });

  // 删除频道
  app.delete('/api/channels/:id', async ({ params, headers, set }) => {
    const authToken = headers['x-auth-token'];
    const authResult = await verifyToken(authToken, params.id);

    if (!authResult.authorized) {
      set.status = 403;
      return { error: 'Forbidden: Invalid token for this channel' };
    }

    await deleteChannel(params.id);
    return { success: true, message: 'Channel deleted' };
  }, {
    response: {
      200: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Channel deleted'] })
      }),
      403: t.Object({
        error: t.String({ examples: ['Forbidden: Invalid token for this channel'] })
      }),
      404: t.Object({
        error: t.String({ examples: ['Channel "xxx" not found'] })
      }),
      500: t.Object({
        error: t.String({ examples: ['Cannot delete default channel'] })
      })
    },
    detail: {
      summary: '删除频道',
      description: '删除频道及其所有文章。需要在请求头中提供频道 token 或超级管理员 token 进行鉴权。默认频道不能删除。',
      tags: ['Channels']
    }
  });

  return app;
}
