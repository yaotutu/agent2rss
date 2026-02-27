import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from '../services/logger.js';
import type { AppVariables } from './middleware.js';
import { registerSystemRoutes } from './system.js';
import { registerPostRoutes } from './posts.js';
import { registerChannelRoutes } from './channels.js';

/**
 * 创建并返回完整的 Hono 应用实例。
 *
 * 该函数是路由层的唯一入口，负责：
 * 1. 初始化 OpenAPIHono 实例（带类型安全的 context 变量）
 * 2. 注册全局中间件（请求日志）
 * 3. 注册全局错误处理器
 * 4. 按模块注册各子路由
 *
 * 路由注册顺序（顺序影响中间件匹配优先级）：
 * 1. 系统路由  — health、根路径、RSS Feed、Swagger
 * 2. 文章路由  — POST /api/channels/:channelId/posts[/upload]
 * 3. 频道路由  — CRUD /api/channels[/:id]
 *
 * 子模块文件：
 * - middleware.ts  中间件 + AppVariables 类型
 * - helpers.ts     文章内容处理工具函数
 * - system.ts      系统路由
 * - posts.ts       文章路由
 * - channels.ts    频道路由
 */
export function createRoutes() {
  const app = new OpenAPIHono<{ Variables: AppVariables }>();

  // ── 全局请求日志 ──────────────────────────────────────────
  // 记录每个请求的 method 和 url，便于调试和监控
  app.use('*', async (c, next) => {
    logger.info({ method: c.req.method, url: c.req.url }, '收到请求');
    await next();
  });

  // ── 全局错误处理 ──────────────────────────────────────────
  // 捕获路由处理器中未被捕获的异常，返回统一格式的错误响应
  app.onError((err, c) => {
    // SyntaxError 通常由 JSON.parse 失败触发（请求体格式错误）
    // 返回详细的诊断信息帮助调用方排查问题
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
            '请求体为空',
          ],
          solutions: [
            '使用文件方式传递 JSON：curl -d @payload.json',
            '确保 Content-Type: application/json',
            '使用 JSON 验证工具检查格式：jq . payload.json',
          ],
        },
      }, 400);
    }
    // 其他未预期的服务器错误，记录日志并返回通用 500
    logger.error({ error: err.message }, '请求处理失败');
    return c.json({ success: false, error: '服务器内部错误' }, 500);
  });

  // 404 兜底：所有未匹配路由返回统一格式
  app.notFound((c) => c.json({ success: false, error: '资源不存在' }, 404));

  // ── 注册各模块路由 ────────────────────────────────────────
  registerSystemRoutes(app);   // GET /health, GET /, GET /channels/:id/rss.xml, /swagger
  registerPostRoutes(app);     // POST /api/channels/:channelId/posts[/upload]
  registerChannelRoutes(app);  // GET|POST|PUT|DELETE /api/channels[/:id]

  return app;
}
