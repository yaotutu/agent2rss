import { Database } from 'bun:sqlite';
import { generateChannelToken } from '../utils/index.js';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database | null = null;

/**
 * 获取数据库实例（单例模式）
 */
export function getDatabase(): Database {
  if (!db) {
    // 确保 data 目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'agent2rss.db');
    db = new Database(dbPath);

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

    // 初始化数据库
    initializeSchema();
    initializeDefaultChannel();
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
function initializeSchema() {
  if (!db) return;

  // 创建频道表
  db.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      theme TEXT DEFAULT 'spring',
      language TEXT DEFAULT 'zh-CN',
      max_posts INTEGER DEFAULT 100,
      token TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建文章表
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      content TEXT NOT NULL,
      content_markdown TEXT,
      summary TEXT,
      author TEXT,
      pub_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      channel_id TEXT NOT NULL,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    )
  `);

  // 创建标签表（多对多关系）
  db.run(`
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (post_id, tag),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // 创建索引优化查询性能
  db.run('CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_posts_pub_date ON posts(pub_date DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag)');
}

/**
 * 初始化默认频道
 */
function initializeDefaultChannel() {
  if (!db) return;

  // 检查是否已存在默认频道
  const existing = db.query('SELECT id FROM channels WHERE id = ?').get('default');

  if (!existing) {
    const token = generateChannelToken();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO channels (id, name, description, theme, language, max_posts, token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'default',
      'AI Briefing',
      'Daily news summaries powered by AI',
      'spring',
      'zh-CN',
      100,
      token,
      now,
      now
    ]);

    console.log('\n✅ 默认频道已创建');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📢 频道 ID: default`);
    console.log(`🔑 频道 Token: ${token}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  请妥善保存此 Token，用于 Webhook 鉴权\n');
  }
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
