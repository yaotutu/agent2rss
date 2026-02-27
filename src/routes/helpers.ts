import { CONFIG } from '../config/index.js';
import { markdownToHtml } from '../services/markdown.js';
import { generateSummary, extractTitleFromMarkdown } from '../utils/index.js';

// ============================================================
// 类型定义
// ============================================================

/**
 * processPostContent 的输入选项。
 *
 * 对应 JSON 请求体或 multipart/form-data 表单字段中的可选参数，
 * 两种接口共用同一套选项结构，保持行为一致。
 */
export interface PostContentOptions {
  /** 显式指定的文章标题；未提供时从 Markdown 内容自动提取 */
  title?: string;
  /** 内容类型：'markdown' | 'html' | 'auto'（默认）；auto 时自动检测 */
  contentType?: string;
  /** 覆盖频道默认主题的主题名称 */
  theme?: string;
  /** 显式指定的摘要；未提供时从 HTML 内容自动截取 */
  description?: string;
  /** 标签：支持字符串数组或逗号分隔的单个字符串（如 "技术,教程"） */
  tags?: string[] | string;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 统一处理文章内容，供 JSON 接口和文件上传接口共用。
 *
 * 将原始内容（Markdown 或 HTML）转换为存储所需的结构化数据，
 * 包括标题、HTML 正文、摘要和标签。
 *
 * 处理流程（优先级从高到低）：
 *
 * **标题**
 *   1. 使用 options.title（显式传入）
 *   2. 从 Markdown 第一个 `# 标题` 行提取
 *   3. 兜底为 `'Untitled Post'`
 *
 * **内容类型检测**（contentType = 'auto' 时）
 *   - 内容以 `<` 开头 → 视为 HTML，直接存储
 *   - 否则 → 视为 Markdown，经 markdownToHtml 转换
 *
 * **主题优先级**
 *   1. options.theme（请求级覆盖）
 *   2. channelTheme（频道默认主题）
 *   3. CONFIG.content.defaultTheme（全局默认主题）
 *
 * **摘要**
 *   1. options.description（显式传入）
 *   2. 从 HTML 内容自动截取前 N 个字符（去除标签）
 *
 * **标签**
 *   - 数组格式：直接使用
 *   - 字符串格式：按逗号分割，去除首尾空格，过滤空字符串
 *
 * @param content      原始文章内容（Markdown 或 HTML 字符串）
 * @param options      可选参数（标题、内容类型、主题、摘要、标签）
 * @param channelTheme 频道默认主题名称（可能为 undefined）
 * @returns            处理后的 { title, html, summary, tags }
 */
export function processPostContent(
  content: string,
  options: PostContentOptions,
  channelTheme: string | undefined
) {
  // ── 标题解析 ──────────────────────────────────────────────
  const title = options.title
    || extractTitleFromMarkdown(content)  // 从 # 标题行提取
    || 'Untitled Post';                   // 兜底值

  // ── 内容类型检测 ──────────────────────────────────────────
  let contentType = options.contentType || 'auto';
  if (contentType === 'auto') {
    // 以 '<' 开头的内容视为 HTML（如 <p>、<div> 等），否则视为 Markdown
    contentType = content.trimStart().startsWith('<') ? 'html' : 'markdown';
  }

  // ── 主题选择 ──────────────────────────────────────────────
  // 优先级：请求级 > 频道级 > 全局默认
  const theme = options.theme || channelTheme || CONFIG.content.defaultTheme;

  // ── 内容转换 ──────────────────────────────────────────────
  // HTML 内容直接使用；Markdown 经过 markdownToHtml 转换并注入主题内联样式
  const html = contentType === 'html' ? content : markdownToHtml(content, theme);

  // ── 摘要生成 ──────────────────────────────────────────────
  // 优先使用显式传入的描述，否则从 HTML 自动截取（generateSummary 会去除 HTML 标签）
  const summary = options.description
    || generateSummary(html, CONFIG.content.defaultSummaryLength);

  // ── 标签处理 ──────────────────────────────────────────────
  let tags: string[] | undefined;
  if (options.tags) {
    tags = Array.isArray(options.tags)
      ? options.tags
      // 字符串格式：按逗号分割，去除首尾空格，过滤空字符串
      : options.tags.split(',').map((t) => t.trim()).filter((t) => t);
  }

  return { title, html, summary, tags };
}
