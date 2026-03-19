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
 * 为 HTML 添加内联样式（优化版：使用单个正则表达式）
 */
export function addInlineStyles(html: string, themeName: string = CONFIG.content.defaultTheme): string {
  const theme = getTheme(themeName).styles;

  // 预先清理所有样式
  const styles = {
    pre: cleanStyle(theme.pre || ''),
    codeInline: cleanStyle(theme.codeInline || ''),
    table: cleanStyle(theme.table || ''),
    thead: cleanStyle(theme.thead || ''),
    th: cleanStyle(theme.th || ''),
    td: cleanStyle(theme.td || ''),
    tr: cleanStyle(theme.tr || ''),
    blockquote: cleanStyle(theme.blockquote || ''),
    h1: cleanStyle(theme.h1 || ''),
    h2: cleanStyle(theme.h2 || ''),
    h3: cleanStyle(theme.h3 || ''),
    h4: cleanStyle(theme.h4 || ''),
    h5: cleanStyle(theme.h5 || ''),
    h6: cleanStyle(theme.h6 || ''),
    p: cleanStyle(theme.p || ''),
    ul: cleanStyle(theme.ul || ''),
    ol: cleanStyle(theme.ol || ''),
    li: cleanStyle(theme.li || ''),
    a: cleanStyle(theme.a || ''),
    hr: cleanStyle(theme.hr || ''),
    mark: cleanStyle(theme.mark || ''),
    ins: cleanStyle(theme.ins || ''),
    del: cleanStyle(theme.del || ''),
    img: cleanStyle(theme.img || ''),
  };

  // 使用单个正则表达式替换所有标签
  const tagPattern = /<(pre|code|table|thead|th|td|tr|blockquote|h[1-6]|p|ul|ol|li|a|hr|mark|ins|del|img)(\s|>)/g;

  let result = html.replace(tagPattern, (match, tag, suffix) => {
    const style = styles[tag as keyof typeof styles];
    const additionalStyles: string[] = [];

    switch (tag) {
      case 'pre':
        additionalStyles.push('max-width:100%', 'overflow-x:auto');
        break;
      case 'code':
        if (suffix === ' class="language-') {
          // 代码块中的 code 标签
          return `<code style="font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:14px;line-height:1.5" class="language-`;
        }
        break;
      case 'table':
        additionalStyles.push('width:100%', 'max-width:100%', 'table-layout:fixed', 'border-collapse:collapse');
        break;
      case 'th':
      case 'td':
        additionalStyles.push('word-wrap:break-word', 'overflow-wrap:break-word');
        break;
      case 'blockquote':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'hr':
        additionalStyles.push('max-width:100%');
        break;
      case 'p':
        additionalStyles.push('max-width:100%', 'word-wrap:break-word');
        break;
      case 'img':
        additionalStyles.push('max-width:100%', 'height:auto');
        break;
    }

    const fullStyle = [style, ...additionalStyles].filter(Boolean).join(';');
    return `<${tag} style="${fullStyle}"${suffix}`;
  });

  // 处理外部链接
  result = result.replace(/<a ([^>]*)href="(https?:\/\/[^"]+)"([^>]*)>/g, '<a $1href="$2"$3 rel="noopener noreferrer" target="_blank">');

  return result;
}
