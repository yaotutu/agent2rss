import juice from 'juice';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 缓存 CSS 内容
let cachedCss: string | null = null;

/**
 * 加载基础 CSS
 */
function loadBaseCss(): string {
  if (cachedCss) {
    return cachedCss;
  }

  try {
    const cssPath = join(__dirname, '../styles/base.css');
    cachedCss = readFileSync(cssPath, 'utf-8');
    return cachedCss;
  } catch (error) {
    console.error('Failed to load base CSS:', error);
    return '';
  }
}

/**
 * 清除 CSS 缓存（用于测试或热重载）
 */
export function clearCssCache(): void {
  cachedCss = null;
}

/**
 * 为 HTML 添加内联样式（使用 juice）
 *
 * @param html - 原始 HTML 内容
 * @param _theme - 主题名称（保留参数，未来可支持多主题）
 * @returns 带内联样式的 HTML
 */
export function addInlineStyles(html: string, _theme: string = 'github'): string {
  const css = loadBaseCss();

  if (!css) {
    // 降级：如果 CSS 加载失败，返回原始 HTML
    console.warn('CSS not loaded, returning original HTML');
    return html;
  }

  try {
    // 使用 juice 内联 CSS
    const options: juice.Options = {
      extraCss: css,
      // 保留现有内联样式
      preserveImportant: true,
      // 应用于文档片段
      applyStyleTags: false,
      // 移除 style 标签（RSS 阅读器不支持）
      removeStyleTags: true,
      // 处理宽度属性
      preserveMediaQueries: false,
    };

    // 包装 HTML 为完整文档，因为 juice 需要一个容器
    const wrappedHtml = `<div id="juice-wrapper">${html}</div>`;
    const inlined = juice(wrappedHtml, options);

    // 提取内容（移除包装 div）
    const match = inlined.match(/<div id="juice-wrapper"[^>]*>([\s\S]*)<\/div>\s*$/);
    return match ? match[1] : inlined;
  } catch (error) {
    console.error('Juice inline error:', error);
    return html;
  }
}

/**
 * 主题系统（保留用于未来扩展）
 *
 * 当前只支持基础主题，未来可以：
 * 1. 加载不同的 CSS 文件作为主题
 * 2. 合并基础 CSS + 主题 CSS
 * 3. 支持用户自定义 CSS
 */

// 主题配置（保留兼容性）
export interface Theme {
  name: string;
  description: string;
  cssFile?: string;
}

// 可用主题列表
export const availableThemes: Record<string, Theme> = {
  github: {
    name: 'GitHub',
    description: 'GitHub 风格（默认）',
    cssFile: 'base.css',
  },
  // 未来可添加更多主题
  // dark: {
  //   name: 'Dark',
  //   description: '深色主题',
  //   cssFile: 'dark.css',
  // },
};

/**
 * 获取主题
 */
export function getTheme(themeName: string): Theme {
  return availableThemes[themeName] || availableThemes.github;
}

/**
 * 获取所有主题
 */
export function getAllThemes(): Record<string, Theme> {
  return availableThemes;
}

/**
 * 加载主题（兼容旧接口）
 * @deprecated 主题现在通过 CSS 文件管理，此函数保留用于兼容
 */
export async function loadThemes(): Promise<void> {
  // 预加载 CSS
  loadBaseCss();
  console.log('✅ 已加载基础样式');
}
