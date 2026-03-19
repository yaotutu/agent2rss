import juice from 'juice';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CSS 缓存
const cssCache: Map<string, string> = new Map();

// 可用主题列表
export const availableThemes: Record<string, ThemeMeta> = {
  github: { name: 'GitHub', description: 'GitHub 官方风格，适合技术文档' },
  dark: { name: 'Dark', description: '深色模式，适合夜间阅读' },
  minimal: { name: 'Minimal', description: '极简设计，适合长文阅读' },
  modern: { name: 'Modern', description: '现代扁平设计，鲜艳配色' },
  elegant: { name: 'Elegant', description: '优雅衬线字体，适合文章随笔' },
  clean: { name: 'Clean', description: '简洁干净，高可读性' },
  spring: { name: 'Spring', description: '清新绿色调，充满活力' },
};

export interface ThemeMeta {
  name: string;
  description: string;
}

/**
 * 加载 CSS 文件
 */
function loadCss(filename: string): string {
  if (cssCache.has(filename)) {
    return cssCache.get(filename)!;
  }

  try {
    const cssPath = join(__dirname, '../styles', filename);
    const css = readFileSync(cssPath, 'utf-8');
    cssCache.set(filename, css);
    return css;
  } catch (error) {
    console.error(`Failed to load CSS: ${filename}`, error);
    return '';
  }
}

/**
 * 获取主题的 CSS
 */
function getThemeCss(themeName: string): string {
  // 验证主题是否存在
  if (!availableThemes[themeName]) {
    themeName = 'github'; // 回退到默认主题
  }

  // 加载基础布局 CSS
  const baseCss = loadCss('base.css');

  // 加载主题颜色 CSS
  const themeCss = loadCss(`themes/${themeName}.css`);

  return baseCss + '\n' + themeCss;
}

/**
 * 清除 CSS 缓存（用于测试或热重载）
 */
export function clearCssCache(): void {
  cssCache.clear();
}

/**
 * 获取所有可用主题
 */
export function getAllThemes(): Record<string, ThemeMeta> {
  return availableThemes;
}

/**
 * 获取主题信息
 */
export function getTheme(themeName: string): ThemeMeta {
  return availableThemes[themeName] || availableThemes.github;
}

/**
 * 为 HTML 添加内联样式（使用 juice）
 *
 * @param html - 原始 HTML 内容
 * @param themeName - 主题名称
 * @returns 带内联样式的 HTML
 */
export function addInlineStyles(html: string, themeName: string = 'github'): string {
  const css = getThemeCss(themeName);

  if (!css) {
    console.warn('CSS not loaded, returning original HTML');
    return html;
  }

  try {
    // 使用 juice 内联 CSS
    const options: juice.Options = {
      extraCss: css,
      preserveImportant: true,
      applyStyleTags: false,
      removeStyleTags: true,
      preserveMediaQueries: false,
    };

    // 包装 HTML 为完整文档
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
 * 加载主题（兼容旧接口）
 */
export async function loadThemes(): Promise<void> {
  // 预加载基础 CSS
  loadCss('base.css');

  const themeNames = Object.keys(availableThemes);
  console.log(`✅ 已加载 ${themeNames.length} 个主题: ${themeNames.join(', ')}`);
}

// 兼容旧类型导出
export interface Theme {
  name: string;
  description: string;
}

export type Themes = Record<string, Theme>;
