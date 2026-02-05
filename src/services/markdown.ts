import MarkdownIt from 'markdown-it';
import MarkdownItAttrs from 'markdown-it-attrs';
import MarkdownItHighlight from 'markdown-it-highlightjs';
import MarkdownItMark from 'markdown-it-mark';
import MarkdownItSub from 'markdown-it-sub';
import MarkdownItSup from 'markdown-it-sup';
import MarkdownItIns from 'markdown-it-ins';
import MarkdownItAbbr from 'markdown-it-abbr';
import MarkdownItFootnote from 'markdown-it-footnote';
import MarkdownItDeflist from 'markdown-it-deflist';
import { full as markdownItEmoji } from 'markdown-it-emoji';
import { CONFIG } from '../config/index.js';
import { addInlineStyles } from './theme.js';

/**
 * Markdown 解析器实例
 */
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})
  .use(MarkdownItAttrs)
  .use(MarkdownItHighlight)
  .use(MarkdownItMark)
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItIns)
  .use(MarkdownItAbbr)
  .use(MarkdownItFootnote)
  .use(MarkdownItDeflist)
  .use(markdownItEmoji);

/**
 * Markdown 转 HTML
 */
export function markdownToHtml(
  markdown: string,
  theme: string = CONFIG.content.defaultTheme
): string {
  const html = md.render(markdown);
  return addInlineStyles(html, theme);
}

/**
 * 纯文本渲染（用于摘要生成）
 */
export function markdownToText(markdown: string): string {
  return md.render(markdown);
}
