import { CONFIG } from '../config/index.js';
import type { Theme, Themes, ThemeStyles } from '../types/index.js';
import { readThemes } from './storage.js';
import { cleanStyle } from '../utils/index.js';

/**
 * 默认主题（作为后备）
 */
function getDefaultTheme(): Theme {
  return {
    name: 'GitHub',
    description: 'GitHub 官方风格',
    styles: {
      pre: 'background:#f6f8fa;padding:16px;border-radius:6px;margin:16px 0',
      codeInline: 'background:#f6f8fa;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:14px;color:#e83e8c',
      table: 'border-collapse:collapse;margin:16px 0',
      thead: 'background:#f6f8fa',
      th: 'padding:12px;text-align:left;font-weight:600',
      td: 'padding:12px',
      tr: '',
      blockquote: 'border-left:4px solid #0969da;margin:16px 0;padding:8px 16px;color:#57606a',
      h1: 'font-size:32px;font-weight:700;margin:24px 0 16px;line-height:1.25;color:#1f2328',
      h2: 'font-size:24px;font-weight:600;margin:24px 0 16px;line-height:1.25;color:#1f2328',
      h3: 'font-size:20px;font-weight:600;margin:16px 0 12px;line-height:1.25;color:#1f2328',
      h4: 'font-size:16px;font-weight:600;margin:16px 0 12px;line-height:1.25;color:#1f2328',
      h5: 'font-size:14px;font-weight:600;margin:16px 0 12px;line-height:1.25;color:#1f2328',
      h6: 'font-size:13px;font-weight:600;margin:16px 0 12px;line-height:1.25;color:#57606a',
      p: 'margin:16px 0;line-height:1.6;color:#24292f',
      ul: 'margin:16px 0;padding-left:32px',
      ol: 'margin:16px 0;padding-left:32px',
      li: 'margin:4px 0;line-height:1.6',
      a: 'color:#0969da;text-decoration:none',
      hr: 'border:0;border-top:1px solid #d0d7de;margin:24px 0',
      mark: 'background:#fff8c5;padding:2px 4px',
      ins: 'text-decoration:underline;background:#d4f8d4',
      del: 'text-decoration:line-through;color:#82071e;background:#ffebe9',
      img: 'border-radius:6px;margin:16px 0'
    }
  };
}

// 全局主题缓存
let themes: Themes = {};

/**
 * 加载主题配置
 */
export async function loadThemes(): Promise<void> {
  try {
    const loadedThemes = await readThemes();
    themes = { ...loadedThemes };

    if (Object.keys(themes).length === 0) {
      console.warn('⚠️  未找到主题，使用默认主题');
      themes = { github: getDefaultTheme() };
    }

    console.log(`✅ 已加载 ${Object.keys(themes).length} 个主题:`, Object.keys(themes).join(', '));
  } catch (error) {
    console.error('❌ 加载主题失败:', error);
    themes = { github: getDefaultTheme() };
  }
}

/**
 * 获取主题
 */
export function getTheme(themeName: string): Theme {
  return themes[themeName] || themes.github || getDefaultTheme();
}

/**
 * 获取所有主题
 */
export function getAllThemes(): Themes {
  return themes;
}

/**
 * 为 HTML 添加内联样式
 */
export function addInlineStyles(html: string, themeName: string = CONFIG.content.defaultTheme): string {
  const theme = getTheme(themeName).styles;

  return html
    // 代码块
    .replace(/<pre>/g, `<pre style="${cleanStyle(theme.pre || '')};max-width:100%;overflow-x:auto">`)
    .replace(/<code class="language-/g, `<code style="font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:14px;line-height:1.5" class="language-`)
    .replace(/<code>/g, `<code style="${cleanStyle(theme.codeInline || '')}">`)

    // 表格
    .replace(/<table>/g, `<table style="${cleanStyle(theme.table || '')};width:100%;max-width:100%;table-layout:auto">`)
    .replace(/<thead>/g, `<thead style="${cleanStyle(theme.thead || '')}">`)
    .replace(/<th>/g, `<th style="${cleanStyle(theme.th || '')}">`)
    .replace(/<td>/g, `<td style="${cleanStyle(theme.td || '')}">`)
    .replace(/<tr>/g, `<tr style="${cleanStyle(theme.tr || '')}">`)

    // 引用块
    .replace(/<blockquote>/g, `<blockquote style="${cleanStyle(theme.blockquote || '')};max-width:100%">`)

    // 标题
    .replace(/<h1>/g, `<h1 style="${cleanStyle(theme.h1 || '')};max-width:100%">`)
    .replace(/<h2>/g, `<h2 style="${cleanStyle(theme.h2 || '')};max-width:100%">`)
    .replace(/<h3>/g, `<h3 style="${cleanStyle(theme.h3 || '')};max-width:100%">`)
    .replace(/<h4>/g, `<h4 style="${cleanStyle(theme.h4 || '')};max-width:100%">`)
    .replace(/<h5>/g, `<h5 style="${cleanStyle(theme.h5 || '')};max-width:100%">`)
    .replace(/<h6>/g, `<h6 style="${cleanStyle(theme.h6 || '')};max-width:100%">`)

    // 段落和列表
    .replace(/<p>/g, `<p style="${cleanStyle(theme.p || '')};max-width:100%;word-wrap:break-word">`)
    .replace(/<ul>/g, `<ul style="${cleanStyle(theme.ul || '')}">`)
    .replace(/<ol>/g, `<ol style="${cleanStyle(theme.ol || '')}">`)
    .replace(/<li>/g, `<li style="${cleanStyle(theme.li || '')}">`)

    // 其他元素
    .replace(/<a /g, `<a style="${cleanStyle(theme.a || '')}" `)
    .replace(/<hr>/g, `<hr style="${cleanStyle(theme.hr || '')};max-width:100%">`)
    .replace(/<mark>/g, `<mark style="${cleanStyle(theme.mark || '')}">`)
    .replace(/<ins>/g, `<ins style="${cleanStyle(theme.ins || '')}">`)
    .replace(/<del>/g, `<del style="${cleanStyle(theme.del || '')}">`)
    .replace(/<img /g, `<img style="${cleanStyle(theme.img || '')};max-width:100%;height:auto" `);
}
