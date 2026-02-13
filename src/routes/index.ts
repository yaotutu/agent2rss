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
import { generateSummary, generateId, generateChannelToken, extractTitleFromMarkdown } from '../utils/index.js';
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

  app.onError(async ({ error, code, set }) => {
    if (code === 'VALIDATION') {
      set.status = 422;
      return { success: false, error: '请求参数验证失败', details: error };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { success: false, error: '资源不存在' };
    }

    // 新增：识别 PARSE 错误（JSON 解析失败）
    if (code === 'PARSE') {
      // 导入 logger 记录详细错误
      try {
        const { default: logger } = await import('../services/logger.js');
        logger.error({
          error: error.message,
          code,
          timestamp: new Date().toISOString()
        }, 'JSON parse error');
      } catch (logError) {
        console.error('Failed to log parse error:', logError);
      }

      set.status = 400;
      return {
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
            '使用 JSON 验证工具检查格式：jq . payload.json',
            '考虑使用 CLI 工具：bun run cli push'
          ],
          example: 'curl -X POST "http://localhost:8765/api/channels/xxx/webhook" -H "Content-Type: application/json" -d @payload.json'
        }
      };
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
  // 创建文章 - AI 友好的统一接口
  // ============================================================

  app.post('/api/channels/:channelId/posts', async ({ params, body, headers, set }): Promise<ApiResponse> => {
    const channelId = params.channelId;

    // 鉴权检查 - 使用标准 Authorization: Bearer
    const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');

    if (!authToken) {
      set.status = 401;
      return {
        success: false,
        error: 'Authorization header missing or invalid',
        details: {
          expected: 'Authorization: Bearer <token>',
          help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN'
        }
      };
    }

    // 验证 token
    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      set.status = 401;
      return {
        success: false,
        error: authResult.error || 'Unauthorized',
        details: authResult.details
      };
    }

    // 验证频道是否存在
    const channel = await readChannel(channelId);
    if (!channel) {
      set.status = 404;
      return {
        success: false,
        error: `Channel "${channelId}" not found`,
        details: {
          channelId,
          help: 'Use GET /api/channels to list all available channels'
        }
      };
    }

    // 验证必需字段
    if (!body.content) {
      set.status = 400;
      return {
        success: false,
        error: 'Missing required field: content',
        details: {
          field: 'content',
          issue: 'Required field missing',
          provided: body,
          expected: { content: 'string (required)' },
          example: { content: '# My Article\n\nContent here...' }
        }
      };
    }

    // 自动提取标题（如果未提供）
    let title = body.title;
    if (!title) {
      title = extractTitleFromMarkdown(body.content);
    }
    if (!title) {
      title = 'Untitled Post';
    }

    // 内容类型自动检测或使用指定值
    let contentType = body.contentType || 'auto';
    if (contentType === 'auto') {
      // 简单的启发式检测：如果包含 HTML 标签，则认为是 HTML
      contentType = body.content.trimStart().startsWith('<') ? 'html' : 'markdown';
    }

    // 内容处理
    const theme = body.theme || channel.theme || CONFIG.content.defaultTheme;
    const html = contentType === 'html'
      ? body.content
      : markdownToHtml(body.content, theme);

    const summary = body.description || generateSummary(html, CONFIG.content.defaultSummaryLength);

    // 生成文章 ID
    const postId = generateId();

    // 自动生成链接（如果未提供）
    const postLink = body.link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

    // 处理标签（支持字符串或数组）
    let tags: string[] | undefined = undefined;
    if (body.tags) {
      if (Array.isArray(body.tags)) {
        tags = body.tags;
      } else if (typeof body.tags === 'string') {
        tags = body.tags.split(',').map(t => t.trim()).filter(t => t);
      }
    }

    // 创建新文章
    const newPost = {
      id: postId,
      title,
      link: postLink,
      content: html,
      contentMarkdown: body.content,
      summary,
      tags,
      author: body.author,
      pubDate: new Date(),
      channel: channelId,
      idempotencyKey: body.idempotencyKey,
    };

    // 保存到指定频道（支持幂等性）
    const result = await addPost(newPost, channelId);

    return {
      success: true,
      message: result.isNew
        ? `Post created successfully in channel "${channelId}"`
        : `Post already exists (idempotency key matched)`,
      post: {
        id: result.id,
        title: newPost.title,
        channel: channelId,
        pubDate: newPost.pubDate
      },
      isNew: result.isNew
    };
  }, {
    params: t.Object({
      channelId: t.String({
        description: '频道 ID',
        examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
      })
    }),
    body: t.Object({
      content: t.String({
        description: '文章内容（Markdown 或 HTML）',
        examples: ['# 标题\n\n这是文章内容...']
      }),
      title: t.Optional(t.String({
        description: '文章标题（可选，默认从内容提取第一个 # 标题）',
        examples: ['自定义标题']
      })),
      link: t.Optional(t.String({
        description: '文章链接（可选，默认自动生成内部链接）',
        examples: ['https://example.com/post/123']
      })),
      contentType: t.Optional(t.Union([
        t.Literal('auto'),
        t.Literal('markdown'),
        t.Literal('html')
      ], {
        description: '内容类型（默认为 auto，自动检测）',
        examples: ['auto']
      })),
      theme: t.Optional(t.String({
        description: '主题名称（可选，覆盖频道默认主题）',
        examples: ['github', 'minimal']
      })),
      description: t.Optional(t.String({
        description: '文章摘要（可选，默认从内容生成）',
        examples: ['这是一篇关于 Bun 的教程']
      })),
      author: t.Optional(t.String({
        description: '作者名称',
        examples: ['张三']
      })),
      tags: t.Optional(t.Union([
        t.Array(t.String()),
        t.String()
      ], {
        description: '标签（数组或逗号分隔的字符串）',
        examples: [['技术', '教程'], '技术,教程']
      })),
      idempotencyKey: t.Optional(t.String({
        description: '幂等性键，防止重复发布。相同频道内相同 key 的请求只会创建一次文章',
        maxLength: 255,
        examples: ['article-2024-01-01-001']
      }))
    }),
    response: {
      200: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Post created successfully in channel "xxx"'] }),
        post: t.Object({
          id: t.String(),
          title: t.String(),
          channel: t.String(),
          pubDate: t.Date()
        }),
        isNew: t.Boolean({
          description: '是否为新创建的文章。false 表示已存在（幂等性键匹配）',
          examples: [true]
        })
      }),
      400: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Missing required field: content'] }),
        details: t.Object({
          field: t.String(),
          issue: t.String(),
          provided: t.Any(),
          expected: t.Any(),
          example: t.Any()
        })
      }),
      401: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Unauthorized'] }),
        details: t.Object({
          expected: t.String(),
          help: t.String()
        })
      }),
      404: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Channel "xxx" not found'] }),
        details: t.Object({
          channelId: t.String(),
          help: t.String()
        })
      })
    },
    detail: {
      summary: '创建文章（AI 友好）',
      description: '向指定频道添加新文章。自动提取标题、生成链接和摘要。支持 Markdown 和 HTML 格式。需要在请求头中提供该频道的 token (Authorization: Bearer) 进行鉴权。',
      tags: ['Posts']
    }
  });

  // ============================================================
  // 文件上传 - 上传 Markdown 文件
  // ============================================================

  app.post('/api/channels/:channelId/posts/upload', async ({ params, headers, set, body }) => {
    const channelId = params.channelId;

    // 鉴权检查 - 使用标准 Authorization: Bearer
    const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');

    if (!authToken) {
      set.status = 401;
      return {
        success: false,
        error: 'Authorization header missing or invalid',
        details: {
          expected: 'Authorization: Bearer <token>',
          help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN'
        }
      };
    }

    // 验证 token
    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      set.status = 401;
      return {
        success: false,
        error: authResult.error || 'Unauthorized',
        details: authResult.details
      };
    }

    // 验证频道是否存在
    const channel = await readChannel(channelId);
    if (!channel) {
      set.status = 404;
      return {
        success: false,
        error: `Channel "${channelId}" not found`,
        details: {
          channelId,
          help: 'Use GET /api/channels to list all available channels'
        }
      };
    }

    try {
      // Access the file and other fields from the body as defined in the schema
      const { file, title, link, contentType, theme, description, author, tags, idempotencyKey } = body;

      // Check if file exists and is a proper file
      if (!file || typeof file === 'string' || !(file instanceof File)) {
        set.status = 400;
        return {
          success: false,
          error: 'Missing required field: file',
          details: {
            field: 'file',
            issue: 'Required field missing or not a file',
            expected: { file: 'markdown file' },
            example: { file: 'article.md' }
          }
        };
      }

      // 验证文件类型
      const fileName = file.name;
      const fileExtension = fileName.toLowerCase().split('.').pop();

      if (!fileName.toLowerCase().endsWith('.md') && !fileName.toLowerCase().endsWith('.markdown')) {
        set.status = 400;
        return {
          success: false,
          error: 'Invalid file type',
          details: {
            field: 'file',
            issue: 'File must have .md or .markdown extension',
            provided: fileExtension,
            expected: ['.md', '.markdown'],
            example: 'article.md'
          }
        };
      }

      // 读取文件内容
      const fileContent = await file.text();

      // 验证内容不为空
      if (!fileContent.trim()) {
        set.status = 400;
        return {
          success: false,
          error: 'File content is empty',
          details: {
            field: 'file',
            issue: 'Uploaded file is empty',
            example: 'File must contain markdown content'
          }
        };
      }

      // 自动提取标题（如果未提供）
      let postTitle = title;
      if (!postTitle) {
        postTitle = extractTitleFromMarkdown(fileContent);
      }
      if (!postTitle) {
        postTitle = 'Untitled Post';
      }

      // 内容类型自动检测或使用指定值
      let contentTypeValue = contentType || 'auto';
      if (contentTypeValue === 'auto') {
        // 简单的启发式检测：如果包含 HTML 标签，则认为是 HTML
        contentTypeValue = fileContent.trimStart().startsWith('<') ? 'html' : 'markdown';
      }

      // 内容处理
      const effectiveTheme = theme || channel.theme || CONFIG.content.defaultTheme;
      const html = contentTypeValue === 'html'
        ? fileContent
        : markdownToHtml(fileContent, effectiveTheme);

      const summary = description || generateSummary(html, CONFIG.content.defaultSummaryLength);

      // 生成文章 ID
      const postId = generateId();

      // 自动生成链接（如果未提供）
      const postLinkValue = link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

      // 处理标签（支持字符串或数组）
      let tagsArray: string[] | undefined = undefined;
      if (tags) {
        if (Array.isArray(tags)) {
          tagsArray = tags;
        } else if (typeof tags === 'string') {
          tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
        }
      }

      // 创建新文章
      const newPost = {
        id: postId,
        title: postTitle,
        link: postLinkValue,
        content: html,
        contentMarkdown: fileContent,
        summary,
        tags: tagsArray,
        author,
        pubDate: new Date(),
        channel: channelId,
        idempotencyKey,
      };

      // 保存到指定频道（支持幂等性）
      const result = await addPost(newPost, channelId);

      return {
        success: true,
        message: result.isNew
          ? `Post created successfully in channel "${channelId}" from uploaded file "${fileName}"`
          : `Post already exists (idempotency key matched)`,
        post: {
          id: result.id,
          title: newPost.title,
          channel: channelId,
          pubDate: newPost.pubDate
        },
        isNew: result.isNew
      };
    } catch (error) {
      console.error('File upload error:', error);

      if (error instanceof TypeError && error.message.includes('form data')) {
        set.status = 400;
        return {
          success: false,
          error: 'Invalid multipart form data',
          details: {
            issue: 'Could not parse multipart form data',
            expected: 'Correct multipart/form-data format with file field',
            example: 'curl -X POST ... -F "file=@article.md"'
          }
        };
      }

      set.status = 500;
      return {
        success: false,
        error: 'Server error processing file upload',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }, {
    params: t.Object({
      channelId: t.String({
        description: '频道 ID',
        examples: ['8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece']
      })
    }),
    body: t.Object({
      file: t.Any(), // Raw file object from multipart
      title: t.Optional(t.String()),
      link: t.Optional(t.String()),
      contentType: t.Optional(t.Union([
        t.Literal('auto'),
        t.Literal('markdown'),
        t.Literal('html')
      ])),
      theme: t.Optional(t.String()),
      description: t.Optional(t.String()),
      author: t.Optional(t.String()),
      tags: t.Optional(t.String()),
      idempotencyKey: t.Optional(t.String())
    }),
    type: 'multipart/form-data',
    response: {
      200: t.Object({
        success: t.Boolean({ examples: [true] }),
        message: t.String({ examples: ['Post created successfully in channel "xxx" from uploaded file "article.md"'] }),
        post: t.Object({
          id: t.String(),
          title: t.String(),
          channel: t.String(),
          pubDate: t.Date()
        }),
        isNew: t.Boolean({
          description: '是否为新创建的文章。false 表示已存在（幂等性键匹配）',
          examples: [true]
        })
      }),
      400: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Missing required field: file'] }),
        details: t.Object({
          field: t.String(),
          issue: t.String(),
          expected: t.Any(),
          example: t.Any()
        })
      }),
      401: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Unauthorized'] }),
        details: t.Object({
          expected: t.String(),
          help: t.String()
        })
      }),
      404: t.Object({
        success: t.Boolean({ examples: [false] }),
        error: t.String({ examples: ['Channel "xxx" not found'] }),
        details: t.Object({
          channelId: t.String(),
          help: t.String()
        })
      })
    },
    detail: {
      summary: '通过文件上传创建文章',
      description: '通过上传 Markdown 文件向指定频道添加新文章。自动提取标题、生成链接和摘要。支持 Markdown 和 HTML 格式。需要在请求头中提供该频道的 token (Authorization: Bearer) 进行鉴权。上传的文件必须以 .md 或 .markdown 结尾。',
      tags: ['Posts']
    }
  });

  // ============================================================
  // ============================================================
  // 文本内容上传接口 - 最简单的推送方式（纯文本）
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
    const authHeader = headers['authorization'];
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
      description: '获取所有频道列表。超级管理员（使用 AUTH_TOKEN in Authorization header）可以看到所有频道的 token。',
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

    const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');
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
      const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');

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
        postsUrl: `${CONFIG.feed.url}/api/channels/${newChannel.id}/posts`,
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
            description: '频道密钥（用于发布文章和频道管理鉴权，请妥善保存）',
            examples: ['ch_4fd9cdce724ffb8d6ec69187b5438ae2']
          }),
          postsUrl: t.String({
            description: '发布文章的 API 地址（频道专属）',
            examples: ['https://your-domain.com/api/channels/8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece/posts']
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
    const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');
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
    const authHeader = headers['authorization'];
    const authToken = authHeader?.replace('Bearer ', '');
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
