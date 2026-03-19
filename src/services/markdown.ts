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
import { bare as markdownItEmoji } from 'markdown-it-emoji';
import { CONFIG } from '../config/index.js';
import { addInlineStyles } from './theme.js';
import DOMPurify from 'isomorphic-dompurify';

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
 * Markdown 转 HTML（带 XSS 防护）
 */
export function markdownToHtml(
  markdown: string,
  theme: string = CONFIG.content.defaultTheme
): string {
  // 1. 渲染成 HTML
  const html = md.render(markdown);

  // 2. 消毒 HTML，移除危险标签和属性
  const cleanHtml = DOMPurify.sanitize(html, {
    // 禁止可执行代码的标签
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'],
    // 禁止事件属性（防止 onclick 等）
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onmousedown', 'onmouseup'],
  });

  // 3. 应用主题样式
  return addInlineStyles(cleanHtml, theme);
}
