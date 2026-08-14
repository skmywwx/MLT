#!/usr/bin/env node
/**
 * Sync PRD.md (single source of truth) → PRD.html
 *
 * Usage: npm run sync-prd
 * After editing PRD.md, always run this command to regenerate PRD.html.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MD_PATH = join(ROOT, 'PRD.md');
const HTML_PATH = join(ROOT, 'PRD.html');

/** @typedef {{ level: number, text: string, id: string }} TocItem */

/**
 * @param {string} text
 */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {string} markdown
 * @returns {{ html: string, toc: TocItem[] }}
 */
function markdownToHtmlWithToc(markdown) {
  /** @type {TocItem[]} */
  const toc = [];
  const slugCounts = new Map();

  const renderer = new marked.Renderer();

  renderer.heading = function ({ text, depth }) {
    const plain = String(text).replace(/<[^>]+>/g, '');
    let id = slugify(plain);
    const count = slugCounts.get(id) ?? 0;
    slugCounts.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;

    if (depth >= 2) {
      toc.push({ level: depth, text: plain, id });
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

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  const html = marked.parse(markdown, { renderer });
  return { html, toc };
}

/**
 * @param {TocItem[]} toc
 */
function buildTocHtml(toc) {
  return toc
    .map((item) => {
      const indent = item.level === 2 ? '' : '  ';
      const cls = item.level === 2 ? 'toc-l2' : 'toc-l3';
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
      --sidebar-width: 280px;
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
      min-width: 220px;
      max-width: 320px;
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
      padding: 6px 8px;
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

    .toc-l3 a {
      padding-left: 20px;
      font-size: 12px;
      color: var(--muted);
    }

    .toc-l3 a.active { color: var(--accent); }

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
    }

    .content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-size: 17px;
      color: #333;
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

    .content hr {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 2em 0;
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
        max-height: 240px;
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

    const tocLinks = Array.from(document.querySelectorAll('.toc a'));
    const headings = tocLinks
      .map((link) => document.getElementById(link.dataset.target))
      .filter(Boolean);

    function setActive(id) {
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.target === id);
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
      { root: document.querySelector('.content'), rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.25, 0.5] }
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

function main() {
  const markdown = readFileSync(MD_PATH, 'utf8');
  const { html, toc } = markdownToHtmlWithToc(markdown);
  const tocHtml = buildTocHtml(toc);
  const page = buildPage(html, tocHtml);
  writeFileSync(HTML_PATH, page, 'utf8');
  console.log(`✓ Synced ${MD_PATH} → ${HTML_PATH}`);
  console.log(`  TOC entries: ${toc.length}`);
}

main();
