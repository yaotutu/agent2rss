import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { Feed } from 'feed';
import { CONFIG } from '../config/index.js';
import type { Channel } from '../types/index.js';
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
import { generateSummary, generateId, generateChannelToken, extractTitleFromMarkdown } from '../utils/index.js';
import { verifyToken } from '../services/auth.js';
import { getDatabase } from '../services/database.js';
import { logger } from '../services/logger.js';

export function createRoutes() {
  const app = new OpenAPIHono();

  // 请求日志中间件
  app.use('*', async (c, next) => {
    logger.info({ method: c.req.method, url: c.req.url }, '收到请求');
    await next();
  });

  // 全局错误处理
  app.onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({
        success: false,
        error: '请求体解析失败',
        details: {
          type: 'JSON_PARSE_ERROR',
          message: '无法解析请求体中的 JSON 数据',
          commonCauses: [
            'JSON 格式不正确（缺少引号、括号不匹配等）',
            '在命令行直接使用多行 JSON 时，shell 对特殊字符的处理',
            'Content-Type 不是 application/json',
            '请求体为空'
          ],
          solutions: [
            '使用文件方式传递 JSON：curl -d @payload.json',
            '确保 Content-Type: application/json',
            '使用 JSON 验证工具检查格式：jq . payload.json'
          ]
        }
      }, 400);
    }
    logger.error({ error: err.message }, '请求处理失败');
    return c.json({ success: false, error: '服务器内部错误' }, 500);
  });

  app.notFound((c) => c.json({ success: false, error: '资源不存在' }, 404));

  // Swagger UI
  app.get('/swagger', swaggerUI({ url: '/doc' }));
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      title: 'Agent2RSS API',
      version: '2.0.0',
      description: '多频道 RSS 微服务 - 将任意内容转换为 RSS Feed\n\n## RSS Feed 访问\n\n获取频道 RSS Feed：`GET /channels/{channel-id}/rss.xml`'
    },
    tags: [
      { name: 'Posts', description: '内容接收接口' },
      { name: 'RSS', description: 'RSS Feed 生成' },
      { name: 'Channels', description: '频道管理' },
      { name: 'System', description: '系统信息' }
    ]
  });

  // ============================================================
  // 健康检查
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: '健康检查',
    responses: { 200: { description: '服务状态' } }
  }), async (c) => {
    try {
      const db = getDatabase();
      db.query('SELECT 1').get();
      return c.json({ status: 'healthy', version: '2.0.0', timestamp: new Date().toISOString(), database: 'connected' });
    } catch (error) {
      return c.json({ status: 'unhealthy', error: (error as Error).message, timestamp: new Date().toISOString() });
    }
  });

  // ============================================================
  // 根路径
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['System'],
    summary: '服务信息',
    responses: { 200: { description: '服务基本信息' } }
  }), (c) => {
    return c.json({
      message: 'Agent2RSS Service',
      version: '2.0.0',
      features: ['AI-friendly API', 'Multi-channel RSS feeds', 'Swagger Documentation'],
      endpoints: {
        swagger: 'GET /swagger',
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
          admin: 'AUTH_TOKEN (super admin, for all channels)'
        }
      }
    });
  });

  // ============================================================
  // 创建文章（JSON）
  // ============================================================

  const createPostRoute = createRoute({
    method: 'post',
    path: '/api/channels/{channelId}/posts',
    tags: ['Posts'],
    summary: '创建文章（AI 友好）',
    description: '向指定频道添加新文章。自动提取标题、生成链接和摘要。支持 Markdown 和 HTML 格式。',
    request: {
      params: z.object({ channelId: z.string().openapi({ param: { name: 'channelId', in: 'path' }, description: '频道 ID', example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece' }) }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              content: z.string().openapi({ description: '文章内容（Markdown 或 HTML）', example: '# 标题\n\n这是文章内容...' }),
              title: z.string().optional().openapi({ description: '文章标题（可选，默认从内容提取第一个 # 标题）' }),
              link: z.string().optional().openapi({ description: '文章链接（可选，默认自动生成内部链接）' }),
              contentType: z.enum(['auto', 'markdown', 'html']).optional().openapi({ description: '内容类型（默认为 auto，自动检测）' }),
              theme: z.string().optional().openapi({ description: '主题名称（可选，覆盖频道默认主题）' }),
              description: z.string().optional().openapi({ description: '文章摘要（可选，默认从内容生成）' }),
              author: z.string().optional().openapi({ description: '作者名称' }),
              tags: z.union([z.array(z.string()), z.string()]).optional().openapi({ description: '标签（数组或逗号分隔的字符串）' }),
              idempotencyKey: z.string().max(255).optional().openapi({ description: '幂等性键，防止重复发布', example: 'article-2024-01-01-001' })
            })
          }
        }
      }
    },
    responses: {
      200: { description: '文章创建成功' },
      400: { description: '请求参数错误' },
      401: { description: '未授权' },
      404: { description: '频道不存在' }
    }
  });

  app.openapi(createPostRoute, async (c) => {
    const { channelId } = c.req.valid('param');
    const body = c.req.valid('json');

    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');

    if (!authToken) {
      return c.json({ success: false, error: 'Authorization header missing or invalid', details: { expected: 'Authorization: Bearer <token>', help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN' } }, 401);
    }

    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      return c.json({ success: false, error: authResult.error || 'Unauthorized', details: authResult.details }, 401);
    }

    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json({ success: false, error: `Channel "${channelId}" not found`, details: { channelId, help: 'Use GET /api/channels to list all available channels' } }, 404);
    }

    if (!body.content) {
      return c.json({ success: false, error: 'Missing required field: content', details: { field: 'content', issue: 'Required field missing', example: { content: '# My Article\n\nContent here...' } } }, 400);
    }

    let title = body.title;
    if (!title) title = extractTitleFromMarkdown(body.content);
    if (!title) title = 'Untitled Post';

    let contentType = body.contentType || 'auto';
    if (contentType === 'auto') {
      contentType = body.content.trimStart().startsWith('<') ? 'html' : 'markdown';
    }

    const theme = body.theme || channel.theme || CONFIG.content.defaultTheme;
    const html = contentType === 'html' ? body.content : markdownToHtml(body.content, theme);
    const summary = body.description || generateSummary(html, CONFIG.content.defaultSummaryLength);
    const postId = generateId();
    const postLink = body.link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

    let tags: string[] | undefined;
    if (body.tags) {
      tags = Array.isArray(body.tags) ? body.tags : body.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    }

    const newPost = {
      id: postId, title, link: postLink, content: html, contentMarkdown: body.content,
      summary, tags, author: body.author, pubDate: new Date(), channel: channelId,
      idempotencyKey: body.idempotencyKey,
    };

    const result = await addPost(newPost, channelId);

    return c.json({
      success: true,
      message: result.isNew ? `Post created successfully in channel "${channelId}"` : `Post already exists (idempotency key matched)`,
      post: { id: result.id, title: newPost.title, channel: channelId, pubDate: newPost.pubDate },
      isNew: result.isNew
    });
  });

  // ============================================================
  // 文件上传
  // ============================================================

  app.post('/api/channels/:channelId/posts/upload', async (c) => {
    const channelId = c.req.param('channelId');

    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');

    if (!authToken) {
      return c.json({ success: false, error: 'Authorization header missing or invalid', details: { expected: 'Authorization: Bearer <token>', help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN' } }, 401);
    }

    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      return c.json({ success: false, error: authResult.error || 'Unauthorized', details: authResult.details }, 401);
    }

    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json({ success: false, error: `Channel "${channelId}" not found`, details: { channelId, help: 'Use GET /api/channels to list all available channels' } }, 404);
    }

    try {
      const formData = await c.req.parseBody();
      const file = formData['file'];

      if (!file || typeof file === 'string' || !(file instanceof File)) {
        return c.json({ success: false, error: 'Missing required field: file', details: { field: 'file', issue: 'Required field missing or not a file', example: 'article.md' } }, 400);
      }

      const fileName = file.name;
      if (!fileName.toLowerCase().endsWith('.md') && !fileName.toLowerCase().endsWith('.markdown')) {
        return c.json({ success: false, error: 'Invalid file type', details: { field: 'file', issue: 'File must have .md or .markdown extension', expected: ['.md', '.markdown'] } }, 400);
      }

      const fileContent = await file.text();
      if (!fileContent.trim()) {
        return c.json({ success: false, error: 'File content is empty', details: { field: 'file', issue: 'Uploaded file is empty' } }, 400);
      }

      const title = formData['title'] as string | undefined;
      const link = formData['link'] as string | undefined;
      const contentType = formData['contentType'] as string | undefined;
      const theme = formData['theme'] as string | undefined;
      const description = formData['description'] as string | undefined;
      const author = formData['author'] as string | undefined;
      const tagsRaw = formData['tags'] as string | undefined;
      const idempotencyKey = formData['idempotencyKey'] as string | undefined;

      let postTitle = title || extractTitleFromMarkdown(fileContent) || 'Untitled Post';

      let contentTypeValue = contentType || 'auto';
      if (contentTypeValue === 'auto') {
        contentTypeValue = fileContent.trimStart().startsWith('<') ? 'html' : 'markdown';
      }

      const effectiveTheme = theme || channel.theme || CONFIG.content.defaultTheme;
      const html = contentTypeValue === 'html' ? fileContent : markdownToHtml(fileContent, effectiveTheme);
      const summary = description || generateSummary(html, CONFIG.content.defaultSummaryLength);
      const postId = generateId();
      const postLink = link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

      let tagsArray: string[] | undefined;
      if (tagsRaw) {
        tagsArray = tagsRaw.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      }

      const newPost = {
        id: postId, title: postTitle, link: postLink, content: html, contentMarkdown: fileContent,
        summary, tags: tagsArray, author, pubDate: new Date(), channel: channelId, idempotencyKey,
      };

      const result = await addPost(newPost, channelId);

      return c.json({
        success: true,
        message: result.isNew ? `Post created successfully in channel "${channelId}" from uploaded file "${fileName}"` : `Post already exists (idempotency key matched)`,
        post: { id: result.id, title: newPost.title, channel: channelId, pubDate: newPost.pubDate },
        isNew: result.isNew
      });
    } catch (error) {
      logger.error({ error }, 'File upload error');
      return c.json({ success: false, error: 'Server error processing file upload', details: { error: error instanceof Error ? error.message : 'Unknown error' } }, 500);
    }
  });

  // ============================================================
  // RSS Feed
  // ============================================================

  app.get('/channels/:id/rss.xml', async (c) => {
    const channelId = c.req.param('id');

    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json({ error: `Channel "${channelId}" not found` }, 404);
    }

    const posts = await readPosts(channelId);

    const feed = new Feed({
      title: channel.name,
      description: channel.description,
      id: `${CONFIG.feed.url}/channels/${channelId}`,
      link: `${CONFIG.feed.url}/channels/${channelId}`,
      language: channel.language || CONFIG.feed.language,
      feedLinks: { rss: `${CONFIG.feed.url}/channels/${channelId}/rss.xml` },
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

    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.body(feed.rss2());
  });

  // ============================================================
  // 频道管理
  // ============================================================

  // 获取所有频道
  app.openapi(createRoute({
    method: 'get',
    path: '/api/channels',
    tags: ['Channels'],
    summary: '获取所有频道',
    responses: { 200: { description: '频道列表' } }
  }), async (c) => {
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
        token: isSuperAdmin ? channel.token : undefined,
        postCount: posts.length,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      });
    }

    return c.json(channelList);
  });

  // 获取单个频道
  app.openapi(createRoute({
    method: 'get',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '获取单个频道',
    request: { params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }) },
    responses: { 200: { description: '频道详情' }, 404: { description: '频道不存在' } }
  }), async (c) => {
    const { id } = c.req.valid('param');
    const channel = await readChannel(id);
    if (!channel) {
      return c.json({ error: `Channel "${id}" not found` }, 404);
    }

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

  // 创建频道
  const createChannelRoute = createRoute({
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
            })
          }
        }
      }
    },
    responses: {
      201: { description: '频道创建成功' },
      403: { description: '无权限' }
    }
  });

  app.openapi(createChannelRoute, async (c) => {
    if (CONFIG.channelCreationMode === 'private') {
      const authHeader = c.req.header('authorization');
      const authToken = authHeader?.replace('Bearer ', '');
      if (!authToken || authToken !== CONFIG.authToken) {
        return c.json({ success: false, error: 'Forbidden: Admin token required to create channels' }, 403);
      }
    }

    const body = c.req.valid('json');
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
      message: 'Channel created. Please save your token.',
      channel: {
        id: newChannel.id,
        name: newChannel.name,
        token: channelToken,
        postsUrl: `${CONFIG.feed.url}/api/channels/${newChannel.id}/posts`,
        rssUrl: `${CONFIG.feed.url}/channels/${newChannel.id}/rss.xml`,
      }
    }, 201);
  });

  // 更新频道
  app.openapi(createRoute({
    method: 'put',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '更新频道',
    request: {
      params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().optional(),
              description: z.string().optional(),
              theme: z.string().optional(),
              language: z.string().optional(),
              maxPosts: z.number().optional(),
            })
          }
        }
      }
    },
    responses: { 200: { description: '更新成功' }, 403: { description: '无权限' } }
  }), async (c) => {
    const { id } = c.req.valid('param');
    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json({ error: 'Forbidden: Invalid token for this channel' }, 403);
    }

    const body = c.req.valid('json');
    const { ...updates } = body as any;
    await updateChannel(id, updates);
    const updatedChannel = await readChannel(id);

    return c.json({ success: true, message: 'Channel updated', channel: updatedChannel });
  });

  // 删除频道
  app.openapi(createRoute({
    method: 'delete',
    path: '/api/channels/{id}',
    tags: ['Channels'],
    summary: '删除频道',
    request: { params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }) },
    responses: { 200: { description: '删除成功' }, 403: { description: '无权限' } }
  }), async (c) => {
    const { id } = c.req.valid('param');
    const authHeader = c.req.header('authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    const authResult = await verifyToken(authToken, id);

    if (!authResult.authorized) {
      return c.json({ error: 'Forbidden: Invalid token for this channel' }, 403);
    }

    await deleteChannel(id);
    return c.json({ success: true, message: 'Channel deleted' });
  });

  return app;
}
