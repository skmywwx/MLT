#!/usr/bin/env node
/**
 * Sync PRD.md (single source of truth) → PRD.html
 *
 * - Parses h2–h4 headings to build clickable TOC
 * - Auto-updates <!-- PRD_TOC_START --> … <!-- PRD_TOC_END --> in PRD.md
 * - Validates index.html version comment against PRD §7.6 revision table
 *
 * Usage: node scripts/sync-prd-html.mjs [theme-album]
 *        npm run sync-prd:theme-album
 * Workflow: edit PRD.md and/or index.html → update §7.6 if index changed → npm run sync-prd
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROJECT = process.argv[2] ?? 'theme-album';
const PROJECT_DIR = join(ROOT, 'docs', PROJECT);
const MD_PATH = join(PROJECT_DIR, 'PRD.md');
const HTML_PATH = join(PROJECT_DIR, 'PRD.html');
const INDEX_PATH = join(PROJECT_DIR, 'index.html');

const TOC_START = '<!-- PRD_TOC_START -->';
const TOC_END = '<!-- PRD_TOC_END -->';
const INDEX_REV_START = '<!-- INDEX_REV_START -->';
const INDEX_REV_END = '<!-- INDEX_REV_END -->';

/** @typedef {{ level: number, text: string, id: string }} TocItem */

/**
 * @param {string} text
 */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~【】]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {string} markdown
 * @returns {TocItem[]}
 */
function extractHeadings(markdown) {
  /** @type {TocItem[]} */
  const toc = [];
  const slugCounts = new Map();
  const lines = markdown.split('\n');
  let inTocBlock = false;

  for (const line of lines) {
    if (line.includes(TOC_START)) {
      inTocBlock = true;
      continue;
    }
    if (line.includes(TOC_END)) {
      inTocBlock = false;
      continue;
    }
    if (inTocBlock) continue;

    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (!match) continue;

    const depth = match[1].length;
    const plain = match[2].replace(/[`*_~]/g, '').trim();
    if (!plain || plain === '目录') continue;

    let id = slugify(plain);
    const count = slugCounts.get(id) ?? 0;
    slugCounts.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;

    toc.push({ level: depth, text: plain, id });
  }

  return toc;
}

/**
 * @param {TocItem[]} toc
 */
function buildMarkdownToc(toc) {
  const lines = [
    TOC_START,
    '## 目录',
    '',
    '> 由 `npm run sync-prd` 根据下文标题自动生成，支持点击快速定位。',
    '',
  ];

  for (const item of toc) {
    const indent = '  '.repeat(Math.max(0, item.level - 2));
    lines.push(`${indent}- [${item.text}](#${item.id})`);
  }

  lines.push('', TOC_END);
  return lines.join('\n');
}

/**
 * @param {string} markdown
 * @param {string} tocBlock
 */
function injectMarkdownToc(markdown, tocBlock) {
  const pattern = new RegExp(
    `${TOC_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${TOC_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );

  if (pattern.test(markdown)) {
    return markdown.replace(pattern, tocBlock);
  }

  const anchor = '## 文档信息';
  if (markdown.includes(anchor)) {
    return markdown.replace(anchor, `${tocBlock}\n\n${anchor}`);
  }

  const fallback = '## 1. 一句话价值主张';
  if (markdown.includes(fallback)) {
    return markdown.replace(fallback, `${tocBlock}\n\n${fallback}`);
  }

  return `${tocBlock}\n\n${markdown}`;
}

/**
 * @param {string} markdown
 * @param {TocItem[]} toc
 * @returns {{ html: string, toc: TocItem[] }}
 */
function markdownToHtmlWithToc(markdown, toc) {
  const slugCounts = new Map();
  const idByTextLevel = new Map(toc.map((item) => [`${item.level}:${item.text}`, item.id]));

  const renderer = new marked.Renderer();

  renderer.heading = function ({ text, depth }) {
    const plain = String(text).replace(/<[^>]+>/g, '');
    const mapped = idByTextLevel.get(`${depth}:${plain}`);
    let id = mapped ?? slugify(plain);
    if (!mapped) {
      const count = slugCounts.get(id) ?? 0;
      slugCounts.set(id, count + 1);
      if (count > 0) id = `${id}-${count}`;
    }

    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  renderer.code = function ({ text, lang }) {
    if (lang === 'mermaid') {
      return `<pre class="mermaid">${text}</pre>\n`;
    }
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${escaped}</code></pre>\n`;
  };

  marked.setOptions({ gfm: true, breaks: false });

  const html = marked.parse(markdown, { renderer });
  return { html, toc };
}

/**
 * @param {TocItem[]} toc
 */
function buildTocHtml(toc) {
  return toc
    .map((item) => {
      const indent = '  '.repeat(Math.max(0, item.level - 2));
      const cls = `toc-l${item.level}`;
      return `${indent}<li class="${cls}"><a href="#${item.id}" data-target="${item.id}">${item.text}</a></li>`;
    })
    .join('\n');
}

/**
 * @param {string} contentHtml
 * @param {string} tocHtml
 */
function buildPage(contentHtml, tocHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>主题相册产品 PRD</title>
  <style>
    :root {
      --bg: #e8e8e8;
      --panel: #ffffff;
      --border: #d0d0d0;
      --text: #1a1a1a;
      --muted: #666;
      --accent: #2563eb;
      --accent-soft: #eff6ff;
      --sidebar-width: 300px;
      --gap: 16px;
      --radius: 4px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: var(--bg);
    }

    .layout {
      display: flex;
      gap: var(--gap);
      height: 100vh;
      padding: var(--gap);
    }

    .sidebar,
    .content {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow-y: scroll;
      overflow-x: hidden;
    }

    .sidebar {
      flex: 0 0 var(--sidebar-width);
      min-width: 240px;
      max-width: 360px;
      padding: 20px 16px;
    }

    .content {
      flex: 1 1 auto;
      padding: 32px 40px 48px;
      min-width: 0;
    }

    .sidebar-title {
      margin: 0 0 16px;
      font-size: 14px;
      font-weight: 700;
      color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .toc {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .toc li { margin: 0; }

    .toc a {
      display: block;
      padding: 5px 8px;
      border-radius: 4px;
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
      line-height: 1.45;
      transition: background 0.15s, color 0.15s;
    }

    .toc a:hover {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .toc a.active {
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
    }

    .toc-l2 a { font-weight: 600; font-size: 13px; }
    .toc-l3 a { padding-left: 16px; font-size: 12px; color: #444; }
    .toc-l4 a { padding-left: 28px; font-size: 11px; color: var(--muted); }
    .toc-l3 a.active,
    .toc-l4 a.active { color: var(--accent); }

    .content h1 {
      margin-top: 0;
      font-size: 28px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
    }

    .content h2 {
      margin-top: 2em;
      margin-bottom: 0.75em;
      font-size: 22px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
      scroll-margin-top: 12px;
    }

    .content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-size: 17px;
      color: #333;
      scroll-margin-top: 12px;
    }

    .content h4 {
      margin-top: 1.25em;
      margin-bottom: 0.4em;
      font-size: 15px;
      color: #444;
      scroll-margin-top: 12px;
    }

    .content p,
    .content li {
      line-height: 1.7;
      font-size: 15px;
    }

    .content blockquote {
      margin: 1em 0;
      padding: 12px 16px;
      border-left: 4px solid var(--accent);
      background: #f8fafc;
      color: #334155;
    }

    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0 1.5em;
      font-size: 14px;
    }

    .content th,
    .content td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
      vertical-align: top;
    }

    .content th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .content tr:nth-child(even) td {
      background: #fafafa;
    }

    .content pre {
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
    }

    .content pre.mermaid {
      background: #fff;
      text-align: center;
    }

    .content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.9em;
    }

    .content em {
      color: var(--muted);
    }

    @media (max-width: 900px) {
      .layout {
        flex-direction: column;
        height: auto;
        min-height: 100vh;
      }

      .sidebar {
        flex: 0 0 auto;
        max-width: none;
        max-height: 280px;
      }

      .content {
        min-height: 60vh;
      }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar" aria-label="文档目录">
      <p class="sidebar-title">目录</p>
      <ul class="toc">
${tocHtml}
      </ul>
    </aside>
    <main class="content" id="main-content">
${contentHtml}
    </main>
  </div>

  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });

    const contentEl = document.querySelector('.content');
    const tocLinks = Array.from(document.querySelectorAll('.toc a'));
    const headings = tocLinks
      .map((link) => document.getElementById(link.dataset.target))
      .filter(Boolean);

    function setActive(id) {
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.target === id);
        if (link.dataset.target === id) {
          link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    }

    tocLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(link.dataset.target);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActive(link.dataset.target);
          history.replaceState(null, '', '#' + link.dataset.target);
        }
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { root: contentEl, rootMargin: '-8% 0px -75% 0px', threshold: [0, 0.1, 0.25] }
    );

    headings.forEach((h) => observer.observe(h));

    const hash = location.hash.slice(1);
    if (hash) {
      setActive(hash);
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView();
    } else if (headings.length) {
      setActive(headings[0].id);
    }
  </script>
</body>
</html>
`;
}

/**
 * @param {string} markdown
 */
function getLatestIndexVersion(markdown) {
  const pattern = new RegExp(
    `${INDEX_REV_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${INDEX_REV_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );
  const block = markdown.match(pattern)?.[0] ?? '';
  const versions = [...block.matchAll(/\|\s*(UI-V[\d.]+)\s*\|/g)].map((m) => m[1]);
  return versions.at(-1) ?? null;
}

function verifyIndexRevision(markdown) {
  if (!existsSync(INDEX_PATH)) {
    console.log('  index.html: not found (skip revision check)');
    return;
  }
  const latest = getLatestIndexVersion(markdown);
  const indexHtml = readFileSync(INDEX_PATH, 'utf8');
  const commentMatch = indexHtml.match(/原型版本：(UI-V[\d.]+)/);
  const fileVersion = commentMatch?.[1] ?? null;

  if (!latest) {
    console.warn('  ⚠ index.html: no revision rows in PRD §7.6');
    return;
  }
  if (!fileVersion) {
    console.warn(`  ⚠ index.html: missing header comment "原型版本：${latest}"`);
    return;
  }
  if (fileVersion !== latest) {
    console.warn(`  ⚠ index.html version (${fileVersion}) ≠ PRD §7.6 latest (${latest})`);
    return;
  }
  console.log(`  index.html revision OK: ${fileVersion}`);
}

function main() {
  let markdown = readFileSync(MD_PATH, 'utf8');
  const toc = extractHeadings(markdown);
  const tocBlock = buildMarkdownToc(toc);
  markdown = injectMarkdownToc(markdown, tocBlock);
  writeFileSync(MD_PATH, markdown, 'utf8');

  const { html } = markdownToHtmlWithToc(markdown, toc);
  const tocHtml = buildTocHtml(toc);
  const page = buildPage(html, tocHtml);
  writeFileSync(HTML_PATH, page, 'utf8');

  console.log(`✓ Updated TOC in ${MD_PATH}`);
  console.log(`✓ Synced ${MD_PATH} → ${HTML_PATH}`);
  console.log(`  Project: ${PROJECT}`);
  console.log(`  TOC entries: ${toc.length} (h2–h4)`);
  verifyIndexRevision(markdown);
}

main();
