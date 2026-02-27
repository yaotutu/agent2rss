import type { Context, Next } from 'hono';
import type { Channel } from '../types/index.js';
import { verifyToken } from '../services/auth.js';
import { readChannel } from '../services/storage.js';

// ============================================================
// Context 变量类型
// ============================================================

/**
 * Hono context 中注入的自定义变量类型。
 *
 * 通过 `c.set(key, value)` 写入、`c.get(key)` 读取。
 * 在 OpenAPIHono 泛型参数中声明后，TypeScript 可以对
 * c.get/c.set 的键名和值类型进行静态检查。
 *
 * 写入时机：
 *   - authToken  → extractToken 中间件
 *   - channel    → requireChannelAuth 中间件
 */
export type AppVariables = {
  /** 从 `Authorization: Bearer <token>` 中提取的原始 token 字符串 */
  authToken: string;
  /** requireChannelAuth 验证通过后，从数据库读取并注入的完整频道对象 */
  channel: Channel;
};

// ============================================================
// 中间件
// ============================================================

/**
 * 中间件：提取 Bearer Token
 *
 * 职责：从请求头解析 token，存入 context，供后续中间件和路由使用。
 *
 * 处理逻辑：
 * 1. 读取 `Authorization` 请求头（大小写不敏感）
 * 2. 去掉 `Bearer ` 前缀，得到原始 token
 * 3. token 为空时立即返回 401，不继续执行后续处理器
 * 4. token 有效时写入 `c.set('authToken', token)` 并调用 `next()`
 *
 * 注意：此中间件只做提取，不做验证。
 * 实际的 token 合法性由 requireChannelAuth 或路由处理器负责。
 *
 * 使用示例：
 * ```ts
 * app.use('/api/channels/:channelId/posts', extractToken, requireChannelAuth);
 * ```
 */
export async function extractToken(
  c: Context<{ Variables: AppVariables }>,
  next: Next
) {
  const authHeader = c.req.header('authorization');
  // 去掉 "Bearer " 前缀；若 header 不存在则为 undefined
  const authToken = authHeader?.replace('Bearer ', '');

  if (!authToken) {
    // 未提供 token，直接拒绝，不进入后续路由
    return c.json({
      success: false,
      error: 'Authorization header missing or invalid',
      details: {
        expected: 'Authorization: Bearer <token>',
        help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN',
      },
    }, 401);
  }

  // 将 token 存入 context，供 requireChannelAuth 和路由处理器读取
  c.set('authToken', authToken);
  await next();
}

/**
 * 中间件：频道鉴权 + 存在性验证
 *
 * 职责：验证请求方是否有权操作目标频道，并将频道对象注入 context。
 *
 * 前置依赖：必须在 extractToken 之后运行，因为需要从 context 读取 authToken。
 *
 * 处理逻辑：
 * 1. 从路径参数读取 channelId（`:channelId` 段）
 * 2. 从 context 读取 extractToken 写入的 authToken
 * 3. 调用 verifyToken 验证 token 是否对该频道有效
 *    - 超级管理员 token（AUTH_TOKEN）对所有频道有效
 *    - 频道 token（ch_xxx）只对对应频道有效
 * 4. 鉴权失败时返回 401
 * 5. 鉴权通过后查询频道是否存在，不存在返回 404
 * 6. 频道存在时将其写入 `c.set('channel', channel)`，供路由处理器直接使用
 *
 * 使用示例：
 * ```ts
 * app.use('/api/channels/:channelId/posts', extractToken, requireChannelAuth);
 * // 路由处理器中直接取用，无需重复查询数据库
 * const channel = c.get('channel');
 * ```
 */
export async function requireChannelAuth(
  c: Context<{ Variables: AppVariables }>,
  next: Next
) {
  // 从路径参数获取目标频道 ID
  const channelId = c.req.param('channelId');
  // 读取 extractToken 已写入的 token（此时一定存在）
  const authToken = c.get('authToken') as string;

  // 验证 token 是否对该频道有效
  const authResult = await verifyToken(authToken, channelId);
  if (!authResult.authorized) {
    return c.json({
      success: false,
      error: authResult.error || 'Unauthorized',
      details: (authResult as any).details,
    }, 401);
  }

  // 鉴权通过后确认频道存在（token 合法但频道可能已被删除）
  const channel = await readChannel(channelId);
  if (!channel) {
    return c.json({
      success: false,
      error: `Channel "${channelId}" not found`,
      details: {
        channelId,
        help: 'Use GET /api/channels to list all available channels',
      },
    }, 404);
  }

  // 将频道对象注入 context，避免路由处理器重复查询数据库
  c.set('channel', channel);
  await next();
}
