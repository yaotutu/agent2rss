import { randomUUID } from 'crypto';
import { networkInterfaces } from 'os';

/**
 * 生成 UUID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * 获取本机局域网 IP
 */
export function getLocalIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;
    for (const net of netInfo) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

/**
 * 清理样式字符串，移除可能导致溢出的属性
 */
export function cleanStyle(style: string): string {
  return style
    .replace(/overflow:\s*hidden;?/gi, '')
    .replace(/position:\s*relative;?/gi, '')
    .replace(/transition:[^;]+;?/gi, '')
    .replace(/animation:[^;]+;?/gi, '')
    .replace(/-webkit-animation:[^;]+;?/gi, '');
}

/**
 * 生成纯文本摘要
 */
export function generateSummary(html: string, maxLength: number = 150): string {
  const text = html.replace(/<[^>]*>/g, '');
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength) + '...';
}
