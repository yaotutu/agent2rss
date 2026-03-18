import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { addPost, readChannel, readPosts } from '../../services/storage.js';
import { verifyToken } from '../../services/auth.js';
import { CONFIG } from '../../config/index.js';
import { markdownToHtml } from '../../services/markdown.js';
import { generateSummary, generateId, extractTitleFromMarkdown } from '../../utils/index.js';
import {
  ChannelIdParamSchema,
  CreatePostBodySchema,
  CreatePostSuccessSchema,
  ErrorSchema,
  UnauthorizedResponse,
  NotFoundResponse,
} from '../schemas/index.js';

// 创建文章路由
const createPostRoute = createRoute({
  method: 'post',
  path: '/api/channels/{channelId}/posts',
  tags: ['Posts'],
  summary: '创建文章（AI 友好）',
  description:
    '向指定频道添加新文章。自动提取标题、生成链接和摘要。支持 Markdown 和 HTML 格式。需要在请求头中提供该频道的 token (Authorization: Bearer) 进行鉴权。',
  request: {
    params: ChannelIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreatePostBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CreatePostSuccessSchema,
        },
      },
      description: '文章创建成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '请求参数错误',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponse,
        },
      },
      description: '未授权',
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

// 文件上传响应 Schema
const UploadSuccessSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z
    .string()
    .openapi({ example: 'Post created successfully in channel "xxx" from uploaded file "article.md"' }),
  post: z.object({
    id: z.string(),
    title: z.string(),
    channel: z.string(),
    pubDate: z.string().openapi({ description: 'ISO 8601 日期时间' }),
  }),
  isNew: z.boolean().openapi({
    description: '是否为新创建的文章。false 表示已存在（幂等性键匹配）',
    example: true,
  }),
});

// 文件上传路由
const uploadPostRoute = createRoute({
  method: 'post',
  path: '/api/channels/{channelId}/posts/upload',
  tags: ['Posts'],
  summary: '通过文件上传创建文章',
  description:
    '通过上传 Markdown 文件向指定频道添加新文章。自动提取标题、生成链接和摘要。需要在请求头中提供该频道的 token 进行鉴权。上传的文件必须以 .md 或 .markdown 结尾。',
  request: {
    params: ChannelIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UploadSuccessSchema,
        },
      },
      description: '文章创建成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '请求参数错误',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponse,
        },
      },
      description: '未授权',
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

// 从请求头提取 Bearer Token
function extractBearerToken(c: any): string | undefined {
  const authHeader = c.req.header('authorization');
  if (!authHeader) return undefined;
  return authHeader.replace('Bearer ', '');
}

export function registerPostRoutes(app: OpenAPIHono) {
  // 创建文章
  app.openapi(createPostRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const { channelId } = c.req.valid('param');
    const body = c.req.valid('json');
    const authToken = extractBearerToken(c);

    // 鉴权检查
    if (!authToken) {
      return c.json(
        {
          success: false,
          error: 'Authorization header missing or invalid',
          details: {
            expected: 'Authorization: Bearer <token>',
            help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN',
          },
        },
        401
      );
    }

    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      return c.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized',
          details: authResult.details,
        },
        401
      );
    }

    // 验证频道是否存在
    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json(
        {
          success: false,
          error: `Channel "${channelId}" not found`,
          details: {
            channelId,
            help: 'Use GET /api/channels to list all available channels',
          },
        },
        404
      );
    }

    // 自动提取标题
    let title = body.title ?? extractTitleFromMarkdown(body.content) ?? 'Untitled Post';

    // 内容类型自动检测
    let contentType = body.contentType || 'auto';
    if (contentType === 'auto') {
      contentType = body.content.trimStart().startsWith('<') ? 'html' : 'markdown';
    }

    // 内容处理
    const theme = body.theme || channel.theme || CONFIG.content.defaultTheme;
    const html = contentType === 'html' ? body.content : markdownToHtml(body.content, theme);
    const summary = body.description || generateSummary(html, CONFIG.content.defaultSummaryLength);

    // 生成文章 ID 和链接
    const postId = generateId();
    const postLink = body.link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

    // 处理标签
    let tags: string[] | undefined;
    if (body.tags) {
      if (Array.isArray(body.tags)) {
        tags = body.tags;
      } else if (typeof body.tags === 'string') {
        tags = body.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);
      }
    }

    // 创建文章
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

    const result = await addPost(newPost, channelId);

    return c.json(
      {
        success: true,
        message: result.isNew
          ? `Post created successfully in channel "${channelId}"`
          : `Post already exists (idempotency key matched)`,
        post: {
          id: result.id,
          title: newPost.title,
          channel: channelId,
          pubDate: newPost.pubDate.toISOString(),
        },
        isNew: result.isNew,
      },
      200
    );
  });

  // 文件上传
  app.openapi(uploadPostRoute, async (c) => {
    // @ts-expect-error OpenAPIHono strict type checking
    const { channelId } = c.req.valid('param');
    const authToken = extractBearerToken(c);

    // 鉴权检查
    if (!authToken) {
      return c.json(
        {
          success: false,
          error: 'Authorization header missing or invalid',
          details: {
            expected: 'Authorization: Bearer <token>',
            help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN',
          },
        },
        401
      );
    }

    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      return c.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized',
          details: authResult.details,
        },
        401
      );
    }

    // 验证频道是否存在
    const channel = await readChannel(channelId);
    if (!channel) {
      return c.json(
        {
          success: false,
          error: `Channel "${channelId}" not found`,
          details: {
            channelId,
            help: 'Use GET /api/channels to list all available channels',
          },
        },
        404
      );
    }

    try {
      // 解析 multipart form data
      const formData = await c.req.formData();
      const file = formData.get('file');
      const title = formData.get('title')?.toString() || undefined;
      const link = formData.get('link')?.toString() || undefined;
      const contentType = formData.get('contentType')?.toString() || 'auto';
      const theme = formData.get('theme')?.toString() || undefined;
      const description = formData.get('description')?.toString() || undefined;
      const author = formData.get('author')?.toString() || undefined;
      const tagsStr = formData.get('tags')?.toString() || undefined;
      const idempotencyKey = formData.get('idempotencyKey')?.toString() || undefined;

      // 检查文件
      if (!file || !(file instanceof File)) {
        return c.json(
          {
            success: false,
            error: 'Missing required field: file',
            details: {
              field: 'file',
              issue: 'Required field missing or not a file',
              expected: { file: 'markdown file' },
              example: { file: 'article.md' },
            },
          },
          400
        );
      }

      // 验证文件类型
      const fileName = file.name;
      if (!fileName.toLowerCase().endsWith('.md') && !fileName.toLowerCase().endsWith('.markdown')) {
        return c.json(
          {
            success: false,
            error: 'Invalid file type',
            details: {
              field: 'file',
              issue: 'File must have .md or .markdown extension',
              provided: fileName.split('.').pop(),
              expected: ['.md', '.markdown'],
              example: 'article.md',
            },
          },
          400
        );
      }

      // 读取文件内容
      const fileContent = await file.text();
      if (!fileContent.trim()) {
        return c.json(
          {
            success: false,
            error: 'File content is empty',
            details: {
              field: 'file',
              issue: 'Uploaded file is empty',
              example: 'File must contain markdown content',
            },
          },
          400
        );
      }

      // 自动提取标题
      let postTitle = title ?? extractTitleFromMarkdown(fileContent) ?? 'Untitled Post';

      // 内容类型自动检测
      let contentTypeValue = contentType;
      if (contentTypeValue === 'auto') {
        contentTypeValue = fileContent.trimStart().startsWith('<') ? 'html' : 'markdown';
      }

      // 内容处理
      const effectiveTheme = theme || channel.theme || CONFIG.content.defaultTheme;
      const html =
        contentTypeValue === 'html' ? fileContent : markdownToHtml(fileContent, effectiveTheme);
      const summary =
        description || generateSummary(html, CONFIG.content.defaultSummaryLength);

      // 生成文章 ID 和链接
      const postId = generateId();
      const postLinkValue = link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

      // 处理标签
      let tags: string[] | undefined;
      if (tagsStr) {
        tags = tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);
      }

      // 创建文章
      const newPost = {
        id: postId,
        title: postTitle,
        link: postLinkValue,
        content: html,
        contentMarkdown: fileContent,
        summary,
        tags,
        author,
        pubDate: new Date(),
        channel: channelId,
        idempotencyKey,
      };

      const result = await addPost(newPost, channelId);

      return c.json(
        {
          success: true,
          message: result.isNew
            ? `Post created successfully in channel "${channelId}" from uploaded file "${fileName}"`
            : `Post already exists (idempotency key matched)`,
          post: {
            id: result.id,
            title: newPost.title,
            channel: channelId,
            pubDate: newPost.pubDate.toISOString(),
          },
          isNew: result.isNew,
        },
        200
      );
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('form data')) {
        return c.json(
          {
            success: false,
            error: 'Invalid multipart form data',
            details: {
              issue: 'Could not parse multipart form data',
              expected: 'Correct multipart/form-data format with file field',
              example: 'curl -X POST ... -F "file=@article.md"',
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: 'Server error processing file upload',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        500
      );
    }
  });
}
