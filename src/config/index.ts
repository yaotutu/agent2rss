import { join } from 'path';
import { validateEnv } from './env.js';

// 验证并获取环境变量
const env = validateEnv();

// 服务配置
export const CONFIG = {
  // 端口配置
  port: env.PORT,

  // 鉴权配置
  authToken: env.AUTH_TOKEN,

  // 频道创建模式
  channelCreationMode: env.CHANNEL_CREATION_MODE,

  // RSS Feed 配置
  feed: {
    url: env.FEED_URL,
    language: 'zh-CN',
  },

  // 数据存储配置
  storage: {
    dataDir: join(process.cwd(), 'data'),
    themesFile: join(process.cwd(), 'themes.json'),
    maxPosts: 100,
  },

  // 内容配置
  content: {
    defaultTheme: 'spring',
    defaultSummaryLength: 150,
  },

  // Channel 配置
  channels: {
    defaultChannel: 'default',
  },
} as const;
