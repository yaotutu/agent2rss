import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import {
  registerSystemRoutes,
  registerChannelRoutes,
  registerPostRoutes,
  registerFeedRoutes,
} from './routes/index.js';

/**
 * 创建 OpenAPIHono 应用
 */
export function createApp() {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: '请求参数验证失败',
            details: result.error,
          },
          422
        );
      }
    },
  });

  // 全局错误处理
  app.onError((err, c) => {
    console.error('请求处理失败:', err);
    return c.json(
      {
        success: false,
        error: '服务器内部错误',
        details: err.message,
      },
      500
    );
  });

  // OpenAPI 文档
  app.doc('/swagger.json', {
    openapi: '3.0.0',
    info: {
      title: 'Agent2RSS API',
      version: '2.0.0',
      description:
        '多频道 RSS 微服务 - 将任意内容转换为 RSS Feed\n\n## RSS Feed 访问\n\n获取频道 RSS Feed：`GET /channels/{channel-id}/rss.xml`\n\n示例：\n- http://localhost:8765/channels/default/rss.xml\n- http://localhost:8765/channels/tech/rss.xml',
    },
    tags: [
      { name: 'System', description: '系统信息' },
      { name: 'Channels', description: '频道管理' },
      { name: 'Posts', description: '文章管理' },
      { name: 'RSS', description: 'RSS Feed 生成' },
    ],
  });

  // Scalar API 文档 UI
  app.get(
    '/doc',
    apiReference({
      spec: {
        url: '/swagger.json',
      },
    }) as any
  );

  // 注册路由模块
  registerSystemRoutes(app);
  registerChannelRoutes(app);
  registerPostRoutes(app);
  registerFeedRoutes(app);

  return app;
}
