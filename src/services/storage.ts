import { getDatabase } from './database.js';
import type { Post, Channel } from '../types/index.js';
import { CONFIG } from '../config/index.js';

/**
 * 按频道读取文章
 */
export async function readPosts(channel: string): Promise<Post[]> {
  const db = getDatabase();

  const query = db.query(`
    SELECT
      p.id, p.title, p.link, p.content, p.content_markdown as contentMarkdown,
      p.summary, p.author, p.pub_date as pubDate, p.channel_id as channel
    FROM posts p
    WHERE p.channel_id = ?
    ORDER BY p.pub_date DESC
  `);

  const rows = query.all(channel) as any[];

  // 为每篇文章加载标签
  const posts = rows.map(row => {
    const tags = getPostTags(row.id);
    return {
      ...row,
      pubDate: new Date(row.pubDate),
      tags: tags.length > 0 ? tags : undefined,
    };
  });

  return posts;
}

/**
 * 读取所有文章
 */
export async function readAllPosts(): Promise<Post[]> {
  const db = getDatabase();

  const query = db.query(`
    SELECT
      p.id, p.title, p.link, p.content, p.content_markdown as contentMarkdown,
      p.summary, p.author, p.pub_date as pubDate, p.channel_id as channel
    FROM posts p
    ORDER BY p.pub_date DESC
  `);

  const rows = query.all() as any[];

  // 为每篇文章加载标签
  const posts = rows.map(row => {
    const tags = getPostTags(row.id);
    return {
      ...row,
      pubDate: new Date(row.pubDate),
      tags: tags.length > 0 ? tags : undefined,
    };
  });

  return posts;
}

/**
 * 获取文章的标签
 */
function getPostTags(postId: string): string[] {
  const db = getDatabase();
  const query = db.query('SELECT tag FROM post_tags WHERE post_id = ?');
  const rows = query.all(postId) as any[];
  return rows.map(row => row.tag);
}

/**
 * 添加文章（必须指定频道）
 */
export async function addPost(post: Post, channel: string): Promise<void> {
  const db = getDatabase();

  // 检查频道是否存在
  const channelQuery = db.query('SELECT id, max_posts FROM channels WHERE id = ?');
  const channelConfig = channelQuery.get(channel) as any;

  if (!channelConfig) {
    throw new Error(`Channel "${channel}" not found`);
  }

  // 开始事务
  db.run('BEGIN TRANSACTION');

  try {
    // 插入文章
    const insertPost = db.query(`
      INSERT INTO posts (id, title, link, content, content_markdown, summary, author, pub_date, channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPost.run(
      post.id,
      post.title,
      post.link,
      post.content,
      post.contentMarkdown,
      post.summary,
      post.author || null,
      post.pubDate.toISOString(),
      channel
    );

    // 插入标签
    if (post.tags && post.tags.length > 0) {
      const insertTag = db.query('INSERT INTO post_tags (post_id, tag) VALUES (?, ?)');
      for (const tag of post.tags) {
        insertTag.run(post.id, tag);
      }
    }

    // 检查该频道的文章数量，删除超过限制的旧文章
    const maxPosts = channelConfig.max_posts || CONFIG.storage.maxPosts;
    const countQuery = db.query('SELECT COUNT(*) as count FROM posts WHERE channel_id = ?');
    const countResult = countQuery.get(channel) as any;

    if (countResult.count > maxPosts) {
      // 获取需要删除的文章 ID
      const deleteQuery = db.query(`
        SELECT id FROM posts
        WHERE channel_id = ?
        ORDER BY pub_date DESC
        LIMIT -1 OFFSET ?
      `);
      const toDelete = deleteQuery.all(channel, maxPosts) as any[];

      if (toDelete.length > 0) {
        const deletePost = db.query('DELETE FROM posts WHERE id = ?');
        for (const row of toDelete) {
          deletePost.run(row.id);
        }
      }
    }

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * 读取主题配置
 */
export async function readThemes(): Promise<Record<string, any>> {
  try {
    const file = Bun.file(CONFIG.storage.themesFile);
    const exists = await file.exists();
    if (!exists) return {};

    return await file.json();
  } catch (error) {
    console.error('Failed to read themes:', error);
    return {};
  }
}

/**
 * 读取频道配置
 */
export async function readChannel(channelId: string): Promise<Channel | null> {
  const db = getDatabase();

  const query = db.query(`
    SELECT
      id, name, description, theme, language, max_posts as maxPosts,
      token, created_at as createdAt, updated_at as updatedAt
    FROM channels
    WHERE id = ?
  `);

  const row = query.get(channelId) as any;

  if (!row) return null;

  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * 读取所有频道
 */
export async function readAllChannels(): Promise<Record<string, Channel>> {
  const db = getDatabase();

  const query = db.query(`
    SELECT
      id, name, description, theme, language, max_posts as maxPosts,
      token, created_at as createdAt, updated_at as updatedAt
    FROM channels
  `);

  const rows = query.all() as any[];

  const channels: Record<string, Channel> = {};
  for (const row of rows) {
    channels[row.id] = {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  return channels;
}

/**
 * 创建频道
 */
export async function createChannel(channel: Channel): Promise<void> {
  const db = getDatabase();

  // 检查频道是否已存在
  const existsQuery = db.query('SELECT id FROM channels WHERE id = ?');
  const exists = existsQuery.get(channel.id);

  if (exists) {
    throw new Error(`Channel "${channel.id}" already exists`);
  }

  const now = new Date().toISOString();

  const insertQuery = db.query(`
    INSERT INTO channels (id, name, description, theme, language, max_posts, token, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuery.run(
    channel.id,
    channel.name,
    channel.description,
    channel.theme || 'spring',
    channel.language || 'zh-CN',
    channel.maxPosts || 100,
    channel.token,
    now,
    now
  );
}

/**
 * 更新频道
 */
export async function updateChannel(channelId: string, updates: Partial<Channel>): Promise<void> {
  const db = getDatabase();

  // 检查频道是否存在
  const existsQuery = db.query('SELECT id FROM channels WHERE id = ?');
  const exists = existsQuery.get(channelId);

  if (!exists) {
    throw new Error(`Channel "${channelId}" not found`);
  }

  // 构建更新语句
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.theme !== undefined) {
    fields.push('theme = ?');
    values.push(updates.theme);
  }
  if (updates.language !== undefined) {
    fields.push('language = ?');
    values.push(updates.language);
  }
  if (updates.maxPosts !== undefined) {
    fields.push('max_posts = ?');
    values.push(updates.maxPosts);
  }
  if (updates.token !== undefined) {
    fields.push('token = ?');
    values.push(updates.token);
  }

  if (fields.length === 0) {
    return; // 没有需要更新的字段
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(channelId);

  const updateQuery = db.query(`
    UPDATE channels
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  updateQuery.run(...values);
}

/**
 * 删除频道
 */
export async function deleteChannel(channelId: string): Promise<void> {
  if (channelId === 'default') {
    throw new Error('Cannot delete default channel');
  }

  const db = getDatabase();

  // 检查频道是否存在
  const existsQuery = db.query('SELECT id FROM channels WHERE id = ?');
  const exists = existsQuery.get(channelId);

  if (!exists) {
    throw new Error(`Channel "${channelId}" not found`);
  }

  // 删除频道（外键级联会自动删除相关文章和标签）
  const deleteQuery = db.query('DELETE FROM channels WHERE id = ?');
  deleteQuery.run(channelId);
}
