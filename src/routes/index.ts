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
        '多频道 RSS 微服务 - 将任意内容转换为 RSS Feed\n\n## RSS Feed 访问\n\n获取频道 RSS Feed：`GET /channels/{channel-id}/rss.xml`\n\n示例：\n- http://localhost:8765/channels/default/rss.xml\n- http://localhost:8765/channels/tech/rss.xml\n\n## 认证说明\n\n大多数写操作需要 Bearer Token 认证：\n- **超级管理员 Token**: 环境变量 `AUTH_TOKEN`，拥有全局权限\n- **频道 Token**: 创建频道时生成的 `ch_xxx` 格式 Token，只能操作特定频道',
    },
    tags: [
      { name: 'System', description: '系统信息' },
      { name: 'Channels', description: '频道管理' },
      { name: 'Posts', description: '文章管理' },
      { name: 'RSS', description: 'RSS Feed 生成' },
      { name: 'Admin', description: '管理员接口（需要超级管理员权限）' },
    ],
  });

  // 手动添加 securitySchemes 到 OpenAPI spec
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: '使用频道 Token (ch_xxx) 或超级管理员 Token (AUTH_TOKEN)',
  });

  // Scalar API 文档 UI
  app.get(
    '/doc',
    apiReference({
      spec: {
        url: '/swagger.json',
      },
      authentication: {
        enabled: true,
        http: {
          bearer: true,
        },
      },
    } as any)
  );

  // 注册路由模块
  registerSystemRoutes(app);
  registerChannelRoutes(app);
  registerPostRoutes(app);
  registerFeedRoutes(app);

  return app;
}
