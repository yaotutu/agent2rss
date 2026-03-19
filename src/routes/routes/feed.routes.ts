import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { Feed } from 'feed';
import { readChannel, readPosts } from '../../services/storage.js';
import { CONFIG } from '../../config/index.js';
import { IdParamSchema, NotFoundResponse } from '../schemas/index.js';

// RSS Feed 路由
const getFeedRoute = createRoute({
  method: 'get',
  path: '/channels/{id}/rss.xml',
  tags: ['RSS'],
  summary: '获取频道 RSS Feed',
  description: '获取指定频道的 RSS Feed（XML 格式）',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/xml': {
          schema: z.string().openapi({
            description: 'RSS Feed XML 内容',
            example: '<?xml version="1.0" encoding="utf-8"?><rss version="2.0">...</rss>',
          }),
        },
      },
      description: 'RSS Feed',
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

export function registerFeedRoutes(app: OpenAPIHono) {
  app.openapi(getFeedRoute, async (c) => {
    const { id } = c.req.valid('param');

    // 读取频道配置
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

    // 读取该频道的文章
    const posts = await readPosts(id);

    // 生成 RSS Feed
    const feed = new Feed({
      title: channel.name,
      description: channel.description,
      id: `${CONFIG.feed.url}/channels/${id}`,
      link: `${CONFIG.feed.url}/channels/${id}`,
      language: channel.language || CONFIG.feed.language,
      feedLinks: {
        rss: `${CONFIG.feed.url}/channels/${id}/rss.xml`,
      },
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: posts.length > 0 ? posts[0].pubDate : new Date(),
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
        category: post.tags?.map((tag) => ({ name: tag })),
      });
    }

    // 设置 Content-Type 并返回 XML
    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.text(feed.rss2());
  });
}
