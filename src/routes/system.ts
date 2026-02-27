import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { Feed } from 'feed';
import { swaggerUI } from '@hono/swagger-ui';
import { CONFIG } from '../config/index.js';
import { readChannel, readPosts } from '../services/storage.js';
import { getDatabase } from '../services/database.js';
import type { AppVariables } from './middleware.js';

/**
 * 注册系统相关路由。
 *
 * 端点：
 * - GET /          服务信息（端点列表、认证说明）
 * - GET /health    健康检查（服务状态 + 数据库连通性）
 * - GET /swagger   Swagger UI 交互文档
 * - GET /doc       OpenAPI JSON 规范（供 Swagger UI 加载）
 * - GET /channels/:id/rss.xml  生成标准 RSS 2.0 Feed
 */
export function registerSystemRoutes(app: OpenAPIHono<{ Variables: AppVariables }>) {

  // ============================================================
  // API 文档
  // ============================================================

  // Swagger UI：提供可交互的 API 文档界面，从 /doc 加载 OpenAPI 规范
  app.get('/swagger', swaggerUI({ url: '/doc' }));

  // OpenAPI JSON 规范：由 @hono/zod-openapi 根据路由定义自动生成
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      title: 'Agent2RSS API',
      version: '2.0.0',
      description: '多频道 RSS 微服务 - 将任意内容转换为 RSS Feed\n\n## RSS Feed 访问\n\n获取频道 RSS Feed：`GET /channels/{channel-id}/rss.xml`',
    },
    tags: [
      { name: 'Posts', description: '内容接收接口' },
      { name: 'RSS', description: 'RSS Feed 生成' },
      { name: 'Channels', description: '频道管理' },
      { name: 'System', description: '系统信息' },
    ],
  });

  // ============================================================
  // 根路径：服务信息
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['System'],
    summary: '服务信息',
    description: '返回服务基本信息、所有可用端点列表和认证说明。',
    responses: { 200: { description: '服务基本信息' } },
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
          // 频道 token：创建频道时生成，格式 ch_xxx，只对对应频道有效
          channel: 'ch_xxx (for specific channel)',
          // 超级管理员 token：来自环境变量 AUTH_TOKEN，对所有频道有效
          admin: 'AUTH_TOKEN (super admin, for all channels)',
        },
      },
    });
  });

  // ============================================================
  // 健康检查
  // ============================================================

  app.openapi(createRoute({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: '健康检查',
    description: '检查服务运行状态和数据库连通性。可用于负载均衡器的存活探针。',
    responses: { 200: { description: '服务状态' } },
  }), async (c) => {
    try {
      // 执行最简单的 SQL 查询验证数据库连接是否正常
      const db = getDatabase();
      db.query('SELECT 1').get();
      return c.json({
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      // 数据库连接失败时返回 unhealthy 状态（HTTP 状态码仍为 200，由调用方判断 status 字段）
      return c.json({
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ============================================================
  // RSS Feed 生成
  // ============================================================

  /**
   * GET /channels/:id/rss.xml
   *
   * 根据频道 ID 生成标准 RSS 2.0 XML，供 RSS 阅读器订阅。
   *
   * 无需鉴权，任何人都可以订阅公开的 RSS Feed。
   *
   * Feed 内容：
   * - 频道信息作为 Feed 元数据（title、description、language 等）
   * - 文章按发布时间倒序排列
   * - 文章内容为经过主题样式处理的 HTML（内联 CSS，兼容 RSS 阅读器）
   * - 支持标签（category）和作者信息
   */
  app.get('/channels/:id/rss.xml', async (c) => {
    const channelId = c.req.param('id');

    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json({ error: `Channel "${channelId}" not found` }, 404);
    }

    const posts = await readPosts(channelId);

    // 使用 feed 库构建标准 RSS 2.0 结构
    const feed = new Feed({
      title: channel.name,
      description: channel.description,
      id: `${CONFIG.feed.url}/channels/${channelId}`,
      link: `${CONFIG.feed.url}/channels/${channelId}`,
      language: channel.language || CONFIG.feed.language,
      feedLinks: { rss: `${CONFIG.feed.url}/channels/${channelId}/rss.xml` },
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      // updated 使用最新文章的发布时间，无文章时使用当前时间
      updated: posts.length > 0 ? posts[0].pubDate : new Date(),
    });

    for (const post of posts) {
      feed.addItem({
        title: post.title,
        id: post.id,
        link: post.link,
        description: post.summary,   // RSS <description>：摘要文本
        content: post.content,       // RSS <content:encoded>：完整 HTML 内容
        date: post.pubDate,
        author: post.author ? [{ name: post.author }] : undefined,
        // 将标签数组转换为 RSS category 格式
        category: post.tags?.map((tag) => ({ name: tag })),
      });
    }

    // 返回 XML，明确指定 charset 避免中文乱码
    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.body(feed.rss2());
  });
}
