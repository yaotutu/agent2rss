import { Elysia, t } from 'elysia';
import { Feed } from 'feed';
import { CONFIG } from '../config/index.js';
import type { WebhookRequest, ApiResponse, Channel } from '../types/index.js';
import {
  addPost,
  readPosts,
  readAllPosts,
  readChannel,
  readAllChannels,
  createChannel,
  updateChannel,
  deleteChannel
} from '../services/storage.js';
import { markdownToHtml } from '../services/markdown.js';
import { generateSummary, generateId } from '../utils/index.js';

/**
 * 创建路由
 */
export function createRoutes() {
  const app = new Elysia();

  // 根路径 - 服务信息
  app.get('/', () => ({
    message: 'Agent2RSS Service',
    version: '2.0.0',
    features: ['Multi-channel RSS feeds'],
    endpoints: {
      webhook: 'POST /api/webhook',
      rss: 'GET /rss.xml',
      channelRss: 'GET /channels/:id/rss.xml',
      channels: 'GET /api/channels',
      createChannel: 'POST /api/channels',
      updateChannel: 'PUT /api/channels/:id',
      deleteChannel: 'DELETE /api/channels/:id',
    }
  }));

  // ============================================================
  // Webhook - 接收内容（channel 参数必填）
  // ============================================================

  app.post('/api/webhook', async ({ body, headers, set }): Promise<ApiResponse> => {
    try {
      // 鉴权检查
      const authToken = headers['x-auth-token'];
      if (!authToken || authToken !== CONFIG.authToken) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      // 验证频道是否存在
      const channelId = body.channel;  // 必填参数
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
    } catch (error) {
      console.error('Error processing webhook:', error);
      set.status = 500;
      return { success: false, error: 'Internal server error' };
    }
  }, {
    body: t.Object({
      title: t.String(),
      link: t.Optional(t.String()),  // 改为可选
      content: t.String(),
      channel: t.String(),  // 必填
      contentType: t.Optional(t.Union([t.Literal('markdown'), t.Literal('html')])),
      theme: t.Optional(t.String()),
      description: t.Optional(t.String()),
      tags: t.Optional(t.Array(t.String())),
      author: t.Optional(t.String())
    })
  });

  // ============================================================
  // RSS Feed - 聚合所有频道
  // ============================================================

  app.get('/rss.xml', async ({ set }) => {
    try {
      const posts = await readAllPosts();

      const feed = new Feed({
        title: CONFIG.feed.title,
        description: CONFIG.feed.description,
        id: CONFIG.feed.url,
        link: CONFIG.feed.url,
        language: CONFIG.feed.language,
        feedLinks: {
          rss: `${CONFIG.feed.url}/rss.xml`
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
    } catch (error) {
      console.error('Error generating RSS:', error);
      set.status = 500;
      return { error: 'Failed to generate RSS feed' };
    }
  });

  // ============================================================
  // 频道 RSS Feed - 动态路由
  // ============================================================

  app.get('/channels/:id/rss.xml', async ({ params, set }) => {
    try {
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
    } catch (error) {
      console.error('Error generating RSS:', error);
      set.status = 500;
      return { error: 'Failed to generate RSS feed' };
    }
  });

  // ============================================================
  // 频道管理 API
  // ============================================================

  // 获取所有频道
  app.get('/api/channels', async () => {
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
        postCount: posts.length,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      });
    }

    return channelList;
  });

  // 获取单个频道
  app.get('/api/channels/:id', async ({ params, set }) => {
    const channel = await readChannel(params.id);
    if (!channel) {
      set.status = 404;
      return { error: `Channel "${params.id}" not found` };
    }

    const posts = await readPosts(params.id);

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      theme: channel.theme,
      language: channel.language,
      maxPosts: channel.maxPosts,
      postCount: posts.length,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };
  });

  // 创建频道
  app.post('/api/channels', async ({ body, set }) => {
    try {
      const newChannel: Channel = {
        id: body.id,
        name: body.name,
        description: body.description,
        theme: body.theme || CONFIG.content.defaultTheme,
        language: body.language || 'zh-CN',
        maxPosts: body.maxPosts,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createChannel(newChannel);

      set.status = 201;
      return {
        success: true,
        message: 'Channel created',
        channel: newChannel
      };
    } catch (error) {
      set.status = 400;
      return { error: (error as Error).message };
    }
  }, {
    body: t.Object({
      id: t.String(),
      name: t.String(),
      description: t.String(),
      theme: t.Optional(t.String()),
      language: t.Optional(t.String()),
      maxPosts: t.Optional(t.Number()),
    })
  });

  // 更新频道
  app.put('/api/channels/:id', async ({ params, body, set }) => {
    try {
      await updateChannel(params.id, body);
      const updatedChannel = await readChannel(params.id);

      return {
        success: true,
        message: 'Channel updated',
        channel: updatedChannel
      };
    } catch (error) {
      set.status = 404;
      return { error: (error as Error).message };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      description: t.Optional(t.String()),
      theme: t.Optional(t.String()),
      language: t.Optional(t.String()),
      maxPosts: t.Optional(t.Number()),
    })
  });

  // 删除频道
  app.delete('/api/channels/:id', async ({ params, set }) => {
    try {
      await deleteChannel(params.id);
      return { success: true, message: 'Channel deleted' };
    } catch (error) {
      set.status = 400;
      return { error: (error as Error).message };
    }
  });

  return app;
}
