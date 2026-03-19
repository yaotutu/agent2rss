import { z } from 'zod';

/**
 * 环境变量 Schema 定义
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(8765),
  AUTH_TOKEN: z.string().min(1, 'AUTH_TOKEN 不能为空'),
  FEED_URL: z.string().url('FEED_URL 必须是有效的 URL'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  // 频道创建模式
  CHANNEL_CREATION_MODE: z.enum(['public', 'private']).default('public'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 验证环境变量
 * 如果验证失败，将打印错误并退出进程
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ 环境变量验证失败:');

    if (error instanceof z.ZodError) {
      // @ts-ignore - Zod 4 uses 'issues' instead of 'errors'
      const issues = error.issues || error.errors || [];
      issues.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(error);
    }
    console.error('\n请检查 .env 文件配置');
    process.exit(1);
  }
}
