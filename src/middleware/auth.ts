import type { Context } from 'hono';
import { verifyToken } from '../services/auth.js';
import { CONFIG } from '../config/index.js';

/**
 * 从请求头提取 Bearer Token
 */
export function extractBearerToken(c: Context): string | undefined {
  const authHeader = c.req.header('authorization');
  if (!authHeader) return undefined;
  return authHeader.replace('Bearer ', '');
}

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
