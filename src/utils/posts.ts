import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPostEntry = CollectionEntry<'blog'> | CollectionEntry<'blogEn'>;

export function postSlug(post: BlogPostEntry): string {
  if (post.collection === 'blog') return post.id;
  const slug = (text: string) => text.normalize('NFKD').toLowerCase()
    .replace(/\p{Mark}/gu, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const section = post.id.includes('/') ? slug(post.data.category ?? '') : '';
  return [section, slug(post.data.title)].filter(Boolean).join('/');
}

export async function getBlogPosts(isEn = false): Promise<BlogPostEntry[]> {
  const originals = await getCollection('blog', ({ data }) => !data.draft);
  if (!isEn) return originals;

  const translations = new Map((await getCollection('blogEn', ({ data }) => !data.draft))
    .map(post => [post.id, post] as const));
  return originals.flatMap(original => {
    const translation = translations.get(original.id);
    return translation ? [translation] : [];
  });
}

export function postDescription(post: BlogPostEntry): string {
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
