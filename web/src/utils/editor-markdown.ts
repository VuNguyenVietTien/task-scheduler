/**
 * Utilities for converting between HTML (TipTap) and Markdown.
 * Used by RichTextEditor for dual-mode editing and copy operations.
 */
import { marked } from 'marked';
import TurndownService from 'turndown';

// Configure marked for GFM (tables, strikethrough, task lists)
marked.setOptions({ gfm: true, breaks: false });

// Configure turndown for fenced code blocks and common formatting
const turndownService = new TurndownService({
  codeBlockStyle: 'fenced',
  fence: '```',
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  strongDelimiter: '**',
  emDelimiter: '_',
});

// Custom rule: fenced code block (pre > code)
turndownService.addRule('fencedCodeBlock', {
  filter: (node) => {
    const el = node as HTMLElement;
    return el.nodeName === 'PRE' && !!el.querySelector('code');
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const codeEl = el.querySelector('code');
    const lang = (codeEl?.className || '').replace(/language-/, '').trim();
    const code = codeEl?.textContent || '';
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  },
});

// Custom rule: strikethrough
turndownService.addRule('strikethrough', {
  filter: ['s', 'del'] as any,
  replacement: (content) => `~~${content}~~`,
});

/** Convert HTML string → Markdown string */
export function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';
  return turndownService.turndown(html).trim();
}

/** Convert Markdown string → HTML string (synchronous via marked.parseInline workaround) */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '<p></p>';
  // marked.parse returns string in sync mode when no async extensions are used
  const result = marked.parse(markdown);
  return typeof result === 'string' ? result : '<p></p>';
}

/**
 * Heuristic: returns true if the text looks like Markdown.
 * Used to auto-convert pasted content in WYSIWYG mode.
 */
export function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|^\*\*[^*]|\*\*[^*].*\*\*|^```|^- |\* \w|^\d+\. |^>[ \t]|~~.+~~|\[.+\]\(.+\)/.test(text);
}
