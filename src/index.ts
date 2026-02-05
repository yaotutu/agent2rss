import { CONFIG } from './config/index.js';
import { loadThemes } from './services/theme.js';
import { getLocalIP } from './utils/index.js';
import { createRoutes } from './routes/index.js';

// ============== 启动服务 ==============

// 加载主题
await loadThemes();

// 创建路由
const app = createRoutes();

// 启动服务
app.listen(CONFIG.port);

// ============== 输出服务信息 ==============

const localIP = getLocalIP();

console.log(`🚀 Agent2RSS is running on port ${CONFIG.port}`);
console.log(`\n📰 RSS Feed URLs:`);
console.log(`   Local:  http://localhost:${CONFIG.port}/rss.xml`);
if (localIP) {
  console.log(`   LAN:    http://${localIP}:${CONFIG.port}/rss.xml`);
}
console.log(`\n📡 Webhook endpoint:`);
console.log(`   POST http://localhost:${CONFIG.port}/api/webhook`);
