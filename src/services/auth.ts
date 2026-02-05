import { CONFIG } from '../config/index.js';
import { readChannel } from './storage.js';

export interface AuthResult {
  authorized: boolean;
  isSuperAdmin: boolean;
  channelId?: string;
  error?: string;
}

/**
 * 验证 token
 * @param token - 请求携带的 token
 * @param channelId - 要访问的频道 ID（可选）
 * @returns 鉴权结果
 */
export async function verifyToken(
  token: string | undefined,
  channelId?: string
): Promise<AuthResult> {
  // 1. 检查是否为超级管理员
  if (token === CONFIG.authToken && CONFIG.authToken !== '') {
    return {
      authorized: true,
      isSuperAdmin: true,
    };
  }

  // 2. 如果没有指定频道，拒绝访问
  if (!channelId) {
    return {
      authorized: false,
      isSuperAdmin: false,
      error: 'Channel ID required',
    };
  }

  // 3. 检查频道是否存在
  const channel = await readChannel(channelId);
  if (!channel) {
    return {
      authorized: false,
      isSuperAdmin: false,
      error: `Channel "${channelId}" not found`,
    };
  }

  // 4. 验证频道 token
  if (token === channel.token) {
    return {
      authorized: true,
      isSuperAdmin: false,
      channelId,
    };
  }

  // 5. 验证失败
  return {
    authorized: false,
    isSuperAdmin: false,
    error: 'Invalid token',
  };
}
