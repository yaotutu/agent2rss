import { CONFIG } from './config/index.js';
import { loadThemes } from './services/theme.js';
import { getLocalIP } from './utils/index.js';
import { createRoutes } from './routes/index.js';
import { logger } from './services/logger.js';
import { getDatabase } from './services/database.js';

// ============== 初始化 ==============

// 初始化数据库
getDatabase();
logger.info('数据库初始化完成');

// 加载主题
await loadThemes();
logger.info('主题加载完成');

// 创建路由
const app = createRoutes();

// 添加日志装饰器
app.decorate('logger', logger);

// 添加请求日志中间件
app.onRequest(({ request }) => {
  logger.info({ method: request.method, url: request.url }, '收到请求');
});

// ============== 启动服务 ==============

app.listen(CONFIG.port);

// ============== 输出服务信息 ==============

const localIP = getLocalIP();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Agent2RSS 服务已启动');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📰 频道 RSS Feed:`);
console.log(`   http://localhost:${CONFIG.port}/channels/{channel-id}/rss.xml`);
if (localIP) {
  console.log(`   http://${localIP}:${CONFIG.port}/channels/{channel-id}/rss.xml`);
}
console.log(`\n📡 创建文章 API:`);
console.log(`   POST http://localhost:${CONFIG.port}/api/channels/{channel-id}/posts`);
console.log(`   鉴权: Authorization: Bearer <token>`);
console.log(`\n📚 API 文档:`);
console.log(`   http://localhost:${CONFIG.port}/swagger`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

logger.info({ port: CONFIG.port }, 'Agent2RSS 服务已启动');
