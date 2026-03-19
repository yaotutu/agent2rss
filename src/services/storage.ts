import { getDatabase } from './database.js';
import type { Post, Channel, DBChannel, DBChannelConfig } from '../types/index.js';
import { CONFIG } from '../config/index.js';

/** 带别名的文章查询结果 */
interface PostQueryResult {
  id: string;
  title: string;
  link: string;
  content: string;
  contentMarkdown: string | null;
  summary: string;
  author: string | null;
  pubDate: string;
  channel: string;
  tags: string | null;
}

/**
 * 按频道读取文章（优化版：使用 LEFT JOIN 避免 N+1 查询）
 */
export async function readPosts(channel: string): Promise<Post[]> {
  const db = getDatabase();

  // 使用 LEFT JOIN 一次性获取文章和标签
  const query = db.query(`
    SELECT
      p.id, p.title, p.link, p.content, p.content_markdown as contentMarkdown,
      p.summary, p.author, p.pub_date as pubDate, p.channel_id as channel,
      GROUP_CONCAT(pt.tag, ',') as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    WHERE p.channel_id = ?
    GROUP BY p.id
    ORDER BY p.pub_date DESC
  `);

  const rows = query.all(channel) as PostQueryResult[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    link: row.link,
    content: row.content,
    contentMarkdown: row.contentMarkdown ?? undefined,
    summary: row.summary,
    author: row.author ?? undefined,
    pubDate: new Date(row.pubDate),
    channel: row.channel,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : undefined,
  }));
}

/**
 * 读取所有文章（优化版：使用 LEFT JOIN 避免 N+1 查询）
 */
export async function readAllPosts(): Promise<Post[]> {
  const db = getDatabase();

  const query = db.query(`
    SELECT
      p.id, p.title, p.link, p.content, p.content_markdown as contentMarkdown,
      p.summary, p.author, p.pub_date as pubDate, p.channel_id as channel,
      GROUP_CONCAT(pt.tag, ',') as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    GROUP BY p.id
    ORDER BY p.pub_date DESC
  `);

  const rows = query.all() as PostQueryResult[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    link: row.link,
    content: row.content,
    contentMarkdown: row.contentMarkdown ?? undefined,
    summary: row.summary,
    author: row.author ?? undefined,
    pubDate: new Date(row.pubDate),
    channel: row.channel,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : undefined,
  }));
}

/**
 * 添加文章（必须指定频道）
 * 返回 { id: string, isNew: boolean }，支持幂等性
 */
export async function addPost(post: Post, channel: string): Promise<{ id: string; isNew: boolean }> {
  const db = getDatabase();

  // 检查频道是否存在
  const channelQuery = db.query<DBChannelConfig, [string]>('SELECT id, max_posts FROM channels WHERE id = ?');
  const channelConfig = channelQuery.get(channel);

  if (!channelConfig) {
    throw new Error(`Channel "${channel}" not found`);
  }

  // 幂等性检查：如果提供了 idempotencyKey，检查是否已存在
  if (post.idempotencyKey) {
    const existingQuery = db.query<{ id: string }, [string, string]>(`
      SELECT id FROM posts
      WHERE channel_id = ? AND idempotency_key = ?
    `);
    const existing = existingQuery.get(channel, post.idempotencyKey);

    if (existing) {
      return { id: existing.id, isNew: false };
    }
  }

  // 开始事务
  db.run('BEGIN TRANSACTION');

  try {
    // 插入文章（包含 idempotency_key）
    const insertPost = db.query(`
      INSERT INTO posts (id, title, link, content, content_markdown, summary, author, pub_date, channel_id, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPost.run(
      post.id,
      post.title,
      post.link,
      post.content,
      post.contentMarkdown || null,
      post.summary,
      post.author || null,
      post.pubDate.toISOString(),
      channel,
      post.idempotencyKey || null
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
    const countQuery = db.query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM posts WHERE channel_id = ?');
    const countResult = countQuery.get(channel);

    if (countResult && countResult.count > maxPosts) {
      // 获取需要删除的文章 ID
      const deleteQuery = db.query<{ id: string }, [string, number]>(`
        SELECT id FROM posts
        WHERE channel_id = ?
        ORDER BY pub_date DESC
        LIMIT -1 OFFSET ?
      `);
      const toDelete = deleteQuery.all(channel, maxPosts);

      if (toDelete.length > 0) {
        const deletePost = db.query('DELETE FROM posts WHERE id = ?');
        for (const row of toDelete) {
          deletePost.run(row.id);
        }
      }
    }

    db.run('COMMIT');

    return { id: post.id, isNew: true };
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * 读取频道配置
 */
export async function readChannel(channelId: string): Promise<Channel | null> {
  const db = getDatabase();

  const query = db.query<DBChannel, [string]>(`
    SELECT
      id, name, description, theme, language, max_posts,
      token, created_at, updated_at
    FROM channels
    WHERE id = ?
  `);

  const row = query.get(channelId);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    theme: row.theme ?? undefined,
    language: row.language ?? undefined,
    maxPosts: row.max_posts,
    token: row.token,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * 读取所有频道
 */
export async function readAllChannels(): Promise<Record<string, Channel>> {
  const db = getDatabase();

  const query = db.query<DBChannel, []>(`
    SELECT
      id, name, description, theme, language, max_posts,
      token, created_at, updated_at
    FROM channels
  `);

  const rows = query.all();

  const channels: Record<string, Channel> = {};
  for (const row of rows) {
    channels[row.id] = {
      id: row.id,
      name: row.name,
      description: row.description,
      theme: row.theme ?? undefined,
      language: row.language ?? undefined,
      maxPosts: row.max_posts,
      token: row.token,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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
  const existsQuery = db.query<{ id: string }, [string]>('SELECT id FROM channels WHERE id = ?');
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
    channel.theme || null,
    channel.language || null,
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
  const existsQuery = db.query<{ id: string }, [string]>('SELECT id FROM channels WHERE id = ?');
  const exists = existsQuery.get(channelId);

  if (!exists) {
    throw new Error(`Channel "${channelId}" not found`);
  }

  // 构建更新语句
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

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
  const existsQuery = db.query<{ id: string }, [string]>('SELECT id FROM channels WHERE id = ?');
  const exists = existsQuery.get(channelId);

  if (!exists) {
    throw new Error(`Channel "${channelId}" not found`);
  }

  // 删除频道（外键级联会自动删除相关文章和标签）
  const deleteQuery = db.query('DELETE FROM channels WHERE id = ?');
  deleteQuery.run(channelId);
}
