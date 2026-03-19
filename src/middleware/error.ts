import type { Context } from 'hono';
import { ZodError } from 'zod';
import { logger } from '../services/logger.js';

/**
 * 全局错误处理中间件
 */
export async function errorHandler(err: Error, c: Context) {
  // Zod 验证错误
  if (err instanceof ZodError) {
    logger.error({
      error: err.message,
      issues: err.issues,
      timestamp: new Date().toISOString()
    }, 'Validation error');

    return c.json({
      success: false,
      error: '请求参数验证失败',
      details: err.issues
    }, 422);
  }

  // JSON 解析错误
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    logger.error({
      error: err.message,
      timestamp: new Date().toISOString()
    }, 'JSON parse error');

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
          '请求体为空'
        ],
        solutions: [
          '使用文件方式传递 JSON：curl -d @payload.json',
          '确保 Content-Type: application/json',
          '使用 JSON 验证工具检查格式：jq . payload.json',
          '考虑使用 CLI 工具：bun run cli push'
        ],
        example: 'curl -X POST "http://localhost:8765/api/channels/xxx/webhook" -H "Content-Type: application/json" -d @payload.json'
      }
    }, 400);
  }

  // 一般错误
  logger.error({
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  }, 'Server error');

  return c.json({
    success: false,
    error: '服务器内部错误'
  }, 500);
}

/**
 * 404 处理
 */
export function notFoundHandler(c: Context) {
  return c.json({
    success: false,
    error: '资源不存在'
  }, 404);
}
