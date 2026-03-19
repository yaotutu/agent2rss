import { CONFIG } from '../config/index.js';
import { readChannel } from './storage.js';
import type { ErrorDetails } from '../types/index.js';

export interface AuthResult {
  authorized: boolean;
  isSuperAdmin: boolean;
  channelId?: string;
  error?: string;
  details?: ErrorDetails;
}

/**
 * 使用 timing-safe 比较两个字符串
 * 防止时序攻击
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // 如果长度不同，仍然进行比较以防止时序泄露
  if (a.length !== b.length) {
    // 创建一个假的比较来保持恒定时间
    const _ = a.length ^ b.length;
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 验证 token
 * @param token - 请求携带的 token（Bearer token 已去掉 'Bearer ' 前缀）
 * @param channelId - 要访问的频道 ID（可选）
 * @returns 鉴权结果
 */
export async function verifyToken(
  token: string | undefined,
  channelId?: string
): Promise<AuthResult> {
  // 1. 检查是否为超级管理员（使用 timing-safe 比较）
  if (token && CONFIG.authToken && timingSafeEqual(token, CONFIG.authToken)) {
    return {
      authorized: true,
      isSuperAdmin: true,
    };
  }

  // 2. Token 缺失
  if (!token) {
    return {
      authorized: false,
      isSuperAdmin: false,
      error: 'Authorization header missing or invalid',
      details: {
        expected: 'Authorization: Bearer <token>',
        help: 'Provide a channel token (ch_xxx) or admin AUTH_TOKEN in Authorization header'
      }
    };
  }

  // 3. 如果没有指定频道，拒绝访问
  if (!channelId) {
    return {
      authorized: false,
      isSuperAdmin: false,
      error: 'Channel ID required',
    };
  }

  // 4. 检查频道是否存在
  const channel = await readChannel(channelId);
  if (!channel) {
    return {
      authorized: false,
      isSuperAdmin: false,
      error: `Channel "${channelId}" not found`,
      details: {
        channelId,
        help: 'Use GET /api/channels to list all available channels (requires admin token)'
      }
    };
  }

  // 5. 验证频道 token（使用 timing-safe 比较）
  if (channel.token && timingSafeEqual(token, channel.token)) {
    return {
      authorized: true,
      isSuperAdmin: false,
      channelId,
    };
  }

  // 6. 验证失败
  return {
    authorized: false,
    isSuperAdmin: false,
    error: 'Invalid token',
    details: {
      channelId,
      provided: token.substring(0, 10) + '...',
      expectedFormat: 'Channel token starting with "ch_"',
      help: 'Check the channel token using GET /api/channels/:id with admin AUTH_TOKEN'
    }
  };
}
