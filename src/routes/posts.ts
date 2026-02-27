import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { CONFIG } from '../config/index.js';
import { addPost } from '../services/storage.js';
import { generateId } from '../utils/index.js';
import { logger } from '../services/logger.js';
import type { Channel } from '../types/index.js';
import { extractToken, requireChannelAuth, type AppVariables } from './middleware.js';
import { processPostContent } from './helpers.js';

/**
 * 注册文章相关路由。
 *
 * 端点：
 * - POST /api/channels/:channelId/posts         JSON 方式发布文章
 * - POST /api/channels/:channelId/posts/upload  multipart/form-data 文件上传方式发布文章
 *
 * 鉴权：两个端点均通过 extractToken + requireChannelAuth 中间件保护。
 * 中间件执行顺序：extractToken → requireChannelAuth → 路由处理器
 * 中间件会将验证通过的频道对象注入 context，路由处理器通过 c.get('channel') 直接使用。
 */
export function registerPostRoutes(app: OpenAPIHono<{ Variables: AppVariables }>) {
  // 为两个端点分别注册中间件链（顺序不可颠倒）
  app.use('/api/channels/:channelId/posts', extractToken, requireChannelAuth);
  app.use('/api/channels/:channelId/posts/upload', extractToken, requireChannelAuth);

  // ============================================================
  // JSON 发布文章
  // ============================================================

  /**
   * OpenAPI 路由定义：POST /api/channels/{channelId}/posts
   *
   * 支持的请求字段：
   * - content（必填）：Markdown 或 HTML 格式的文章正文
   * - title（可选）：文章标题，未提供时从 content 第一个 # 标题自动提取
   * - link（可选）：文章原始链接，未提供时自动生成内部永久链接
   * - contentType（可选）：'markdown' | 'html' | 'auto'，默认 auto
   * - theme（可选）：覆盖频道默认主题
   * - description（可选）：文章摘要，未提供时自动截取
   * - author（可选）：作者名称
   * - tags（可选）：标签数组或逗号分隔字符串
   * - idempotencyKey（可选）：幂等性键，相同键的请求只创建一次文章
   */
  const createPostRoute = createRoute({
    method: 'post',
    path: '/api/channels/{channelId}/posts',
    tags: ['Posts'],
    summary: '创建文章（AI 友好）',
    description: '向指定频道添加新文章。自动提取标题、生成链接和摘要。支持 Markdown 和 HTML 格式。',
    request: {
      params: z.object({
        channelId: z.string().openapi({
          param: { name: 'channelId', in: 'path' },
          description: '频道 ID',
          example: '8cf83b0d-f856-4f7c-bd1c-4f6ca0338ece',
        }),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              content: z.string().openapi({
                description: '文章内容（Markdown 或 HTML）',
                example: '# 标题\n\n这是文章内容...',
              }),
              title: z.string().optional().openapi({
                description: '文章标题（可选，默认从内容提取第一个 # 标题）',
              }),
              link: z.string().optional().openapi({
                description: '文章链接（可选，默认自动生成内部链接）',
              }),
              contentType: z.enum(['auto', 'markdown', 'html']).optional().openapi({
                description: '内容类型（默认为 auto，自动检测）',
              }),
              theme: z.string().optional().openapi({
                description: '主题名称（可选，覆盖频道默认主题）',
              }),
              description: z.string().optional().openapi({
                description: '文章摘要（可选，默认从内容生成）',
              }),
              author: z.string().optional().openapi({
                description: '作者名称',
              }),
              tags: z.union([z.array(z.string()), z.string()]).optional().openapi({
                description: '标签（数组或逗号分隔的字符串）',
              }),
              idempotencyKey: z.string().max(255).optional().openapi({
                description: '幂等性键，防止重复发布',
                example: 'article-2024-01-01-001',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: '文章创建成功' },
      400: { description: '请求参数错误' },
      401: { description: '未授权' },
      404: { description: '频道不存在' },
    },
  });

  app.openapi(createPostRoute, async (c) => {
    const { channelId } = c.req.valid('param');
    // channel 由 requireChannelAuth 中间件注入，此处直接使用，无需重复查询数据库
    const channel = c.get('channel') as Channel;
    const body = c.req.valid('json');

    // content 是必填字段，Zod schema 已做类型约束，此处作运行时兜底检查
    if (!body.content) {
      return c.json({
        success: false,
        error: 'Missing required field: content',
        details: {
          field: 'content',
          issue: 'Required field missing',
          example: { content: '# My Article\n\nContent here...' },
        },
      }, 400);
    }

    const postId = generateId();

    // 统一处理内容：标题提取、内容类型检测、主题应用、摘要生成、标签解析
    const { title, html, summary, tags } = processPostContent(body.content, body, channel.theme);

    // 链接：优先使用请求中的 link，否则生成内部永久链接
    const postLink = body.link || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;

    const result = await addPost({
      id: postId,
      title,
      link: postLink,
      content: html,
      contentMarkdown: body.content,  // 保存原始 Markdown，便于后续重新渲染
      summary,
      tags,
      author: body.author,
      pubDate: new Date(),
      channel: channelId,
      idempotencyKey: body.idempotencyKey,
    }, channelId);

    return c.json({
      success: true,
      // isNew 区分新建和幂等性命中，调用方可据此判断是否真正创建了新文章
      message: result.isNew
        ? `Post created successfully in channel "${channelId}"`
        : `Post already exists (idempotency key matched)`,
      post: { id: result.id, title, channel: channelId, pubDate: new Date() },
      isNew: result.isNew,
    });
  });

  // ============================================================
  // 文件上传发布文章
  // ============================================================

  /**
   * POST /api/channels/:channelId/posts/upload
   *
   * 通过 multipart/form-data 上传 Markdown 文件创建文章。
   * 功能与 JSON 接口完全一致，适合直接上传 .md 文件的场景。
   *
   * 表单字段：
   * - file（必填）：.md 或 .markdown 文件，UTF-8 编码
   * - title、link、contentType、theme、description、author（可选）：同 JSON 接口
   * - tags（可选）：逗号分隔字符串，如 "技术,教程"
   * - idempotencyKey（可选）：幂等性键
   *
   * 注意：此路由使用 app.post 而非 app.openapi，因为 multipart 文件上传
   * 在 OpenAPI schema 中较难精确描述，暂不生成 Swagger 文档。
   */
  app.post('/api/channels/:channelId/posts/upload', async (c) => {
    const channelId = c.req.param('channelId');
    // channel 由 requireChannelAuth 中间件注入
    const channel = c.get('channel') as Channel;

    try {
      const formData = await c.req.parseBody();
      const file = formData['file'];

      // 验证 file 字段存在且为 File 对象（非字符串）
      if (!file || typeof file === 'string' || !(file instanceof File)) {
        return c.json({
          success: false,
          error: 'Missing required field: file',
          details: {
            field: 'file',
            issue: 'Required field missing or not a file',
            example: 'article.md',
          },
        }, 400);
      }

      const fileName = file.name;

      // 只接受 .md 和 .markdown 扩展名，拒绝其他文件类型
      if (!fileName.toLowerCase().endsWith('.md') && !fileName.toLowerCase().endsWith('.markdown')) {
        return c.json({
          success: false,
          error: 'Invalid file type',
          details: {
            field: 'file',
            issue: 'File must have .md or .markdown extension',
            expected: ['.md', '.markdown'],
          },
        }, 400);
      }

      const fileContent = await file.text();

      // 拒绝空文件
      if (!fileContent.trim()) {
        return c.json({
          success: false,
          error: 'File content is empty',
          details: { field: 'file', issue: 'Uploaded file is empty' },
        }, 400);
      }

      const postId = generateId();

      // 从表单字段中提取可选参数，与 JSON 接口保持相同的处理逻辑
      const { title, html, summary, tags } = processPostContent(fileContent, {
        title: formData['title'] as string | undefined,
        contentType: formData['contentType'] as string | undefined,
        theme: formData['theme'] as string | undefined,
        description: formData['description'] as string | undefined,
        tags: formData['tags'] as string | undefined,
      }, channel.theme);

      const postLink = (formData['link'] as string | undefined)
        || `${CONFIG.feed.url}/channels/${channelId}/posts/${postId}`;
      const idempotencyKey = formData['idempotencyKey'] as string | undefined;

      const result = await addPost({
        id: postId,
        title,
        link: postLink,
        content: html,
        contentMarkdown: fileContent,
        summary,
        tags,
        author: formData['author'] as string | undefined,
        pubDate: new Date(),
        channel: channelId,
        idempotencyKey,
      }, channelId);

      return c.json({
        success: true,
        message: result.isNew
          ? `Post created successfully in channel "${channelId}" from uploaded file "${fileName}"`
          : `Post already exists (idempotency key matched)`,
        post: { id: result.id, title, channel: channelId, pubDate: new Date() },
        isNew: result.isNew,
      });
    } catch (error) {
      // 捕获文件读取、解析等意外错误
      logger.error({ error }, 'File upload error');
      return c.json({
        success: false,
        error: 'Server error processing file upload',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      }, 500);
    }
  });
}
