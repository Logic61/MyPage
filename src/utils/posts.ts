import type { CollectionEntry } from 'astro:content';

export function postDescription(post: CollectionEntry<'blog'>): string {
  const clean = (text: string) => text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$\n]*\$/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*\[(?:Eng|中|Notes)\]\s*/i, '')
    .replace(/[—–]/g, '-')
    .trim();
  const hasMarkup = (text: string) => /\/images\/|\\[a-zA-Z]+|<!|!\s*\(|§\d|\b(?:frac|iint|int|sum|dots|begin|mathbb|forall|lambda|cdot)\b|[a-zA-Z]_[a-zA-Z0-9{]/.test(text);
  const description = post.data.description || '';
  if (description && !hasMarkup(description)) return clean(description);
  const paragraph = (post.body || '').split(/\r?\n\s*\r?\n/)
    .find(text => !/^\s*(?:#|!|\$|```|---|<)/.test(text) && clean(text).length > 20 && !hasMarkup(clean(text)));
  return paragraph ? clean(paragraph).slice(0, 160) : '';
}

export function postDate(date: Date, isEn = false): string {
  return new Intl.DateTimeFormat(isEn ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: isEn ? 'short' : 'long', day: 'numeric', timeZone: 'UTC',
  }).format(date);
}
