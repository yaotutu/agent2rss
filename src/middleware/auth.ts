import type { Context, MiddlewareHandler } from 'hono';
import { verifyToken } from '../services/auth.js';
import { readChannel } from '../services/storage.js';
import { CONFIG } from '../config/index.js';
import type { Channel } from '../types/index.js';

// 扩展 Hono 上下文类型
declare module 'hono' {
  interface ContextVariableMap {
    channel: Channel;
  }
}

/**
 * 从请求头提取 Bearer Token
 */
export function extractBearerToken(c: Context): string | undefined {
  const authHeader = c.req.header('authorization');
  if (!authHeader) return undefined;
  return authHeader.replace('Bearer ', '');
}

/**
 * 频道鉴权中间件
 * 验证请求是否携带有效的频道 Token 或超级管理员 Token
 */
export const channelAuth = (channelIdParam: string = 'channelId'): MiddlewareHandler => {
  return async (c, next) => {
    const authToken = extractBearerToken(c);
    const channelId = c.req.param(channelIdParam);

    if (!authToken) {
      return c.json({
        success: false,
        error: 'Authorization header missing or invalid',
        details: {
          expected: 'Authorization: Bearer <token>',
          help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN',
        },
      }, 401);
    }

    const authResult = await verifyToken(authToken, channelId);
    if (!authResult.authorized) {
      return c.json({
        success: false,
        error: authResult.error || 'Unauthorized',
        details: authResult.details,
      }, 401);
    }

    await next();
  };
};

/**
 * 频道存在性验证中间件
 * 验证频道是否存在，并将频道对象注入到上下文中
 */
export const requireChannel = (channelIdParam: string = 'channelId'): MiddlewareHandler => {
  return async (c, next) => {
    const channelId = c.req.param(channelIdParam);
    if (!channelId) {
      return c.json({
        success: false,
        error: 'Channel ID is required',
      }, 400);
    }
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

    c.set('channel', channel);
    await next();
  };
};

/**
 * 频道操作鉴权中间件（更新/删除）
 * 验证请求是否有权限操作指定频道
 */
export const channelOperationAuth = (channelIdParam: string = 'id'): MiddlewareHandler => {
  return async (c, next) => {
    const channelId = c.req.param(channelIdParam);
    const authToken = extractBearerToken(c);
    const authResult = await verifyToken(authToken, channelId);

    if (!authResult.authorized) {
      return c.json({
        success: false,
        error: 'Forbidden: Invalid token for this channel',
      }, 403);
    }

    await next();
  };
};

/**
 * 认证结果类型
 */
export interface AuthCheckResult {
  authorized: boolean;
  error?: string;
  details?: any;
  status?: number;
}

/**
 * 检查频道操作认证
 * 用于 POST/PUT/DELETE 等需要写权限的操作
 */
export async function checkChannelAuth(
  c: Context,
  channelId: string
): Promise<AuthCheckResult> {
  const authToken = extractBearerToken(c);

  if (!authToken) {
    return {
      authorized: false,
      error: 'Authorization header missing or invalid',
      details: {
        expected: 'Authorization: Bearer <token>',
        help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN'
      },
      status: 401
    };
  }

  const authResult = await verifyToken(authToken, channelId);

  if (!authResult.authorized) {
    return {
      authorized: false,
      error: authResult.error || 'Unauthorized',
      details: authResult.details,
      status: 401
    };
  }

  return { authorized: true };
}

/**
 * 检查是否为超级管理员
 */
export function isSuperAdmin(c: Context): boolean {
  const authToken = extractBearerToken(c);
  return authToken === CONFIG.authToken && CONFIG.authToken !== '';
}

/**
 * 检查私有模式下的频道创建权限
 */
export function checkChannelCreationAuth(c: Context): AuthCheckResult {
  if (CONFIG.channelCreationMode !== 'private') {
    return { authorized: true };
  }

  const authToken = extractBearerToken(c);

  if (!authToken || authToken !== CONFIG.authToken) {
    return {
      authorized: false,
      error: 'Forbidden: Admin token required to create channels',
      status: 403
    };
  }

  return { authorized: true };
}

/**
 * 验证频道访问权限并返回是否显示 token
 * 用于 GET /api/channels/:id
 */
export async function checkChannelReadAuth(
  c: Context,
  channelId: string
): Promise<{ showToken: boolean }> {
  const authToken = extractBearerToken(c);
  const authResult = await verifyToken(authToken, channelId);
  return { showToken: authResult.authorized };
}
