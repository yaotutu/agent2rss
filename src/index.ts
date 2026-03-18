import { serve } from 'bun';
import { CONFIG } from './config/index.js';
import { loadThemes } from './services/theme.js';
import { getLocalIP } from './utils/index.js';
import { createApp } from './routes/index.js';
import { logger } from './services/logger.js';
import { getDatabase } from './services/database.js';

// ============== 初始化 ==============

// 初始化数据库
getDatabase();
logger.info('数据库初始化完成');

// 加载主题
await loadThemes();
logger.info('主题加载完成');

// 创建 Hono 应用
const app = createApp();

// ============== 启动服务 ==============

serve({
  fetch: app.fetch,
  port: CONFIG.port,
});

// ============== 输出服务信息 ==============

const localIP = getLocalIP();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Agent2RSS 服务已启动 (Hono)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📰 频道 RSS Feed:`);
console.log(`   http://localhost:${CONFIG.port}/channels/{channel-id}/rss.xml`);
if (localIP) {
  console.log(`   http://${localIP}:${CONFIG.port}/channels/{channel-id}/rss.xml`);
}
console.log(`\n📡 创建文章 API:`);
console.log(`   POST http://localhost:${CONFIG.port}/api/channels/{channel-id}/posts`);
console.log(`   鉴权: Authorization: Bearer <token>`);
console.log(`\n📚 API 文档 (Scalar):`);
console.log(`   http://localhost:${CONFIG.port}/doc`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

logger.info({ port: CONFIG.port }, 'Agent2RSS 服务已启动');
