import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseFragment } from 'parse5';
import { load as loadYaml } from 'js-yaml';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import type { BlogPostEntry } from './posts';

const assets = import.meta.glob<ImageMetadata>('/src/**/*.{png,jpg,jpeg,webp,avif,gif,svg,PNG,JPG,JPEG,WEBP,AVIF,GIF,SVG}', { import: 'default' });
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
type Candidate = { src: string; alt?: string; width?: number; height?: number };
type Node = { type?: string; value?: string; url?: string; alt?: string; identifier?: string; children?: Node[] };
type Html = { nodeName?: string; attrs?: { name: string; value: string }[]; childNodes?: Html[] };
function* walk(n: Node): Generator<Node> {
  yield n;
  for (const child of n.children ?? []) yield* walk(child);
}
function* htmlImages(n: Html): Generator<Candidate> {
  if (n.nodeName === 'img') {
    const a = Object.fromEntries((n.attrs ?? []).map(({name,value}) => [name,value]));
    if (a.src) yield { src:a.src, alt:a.alt, width:Number(a.width), height:Number(a.height) };
  }
  for (const child of n.childNodes ?? []) yield* htmlImages(child);
}

async function* candidates(post: BlogPostEntry, file: string): AsyncGenerator<Candidate> {
  const tree = fromMarkdown(post.body ?? '') as Node;
  const definitions = new Map<string, string>();
  for (const n of walk(tree)) if (n.type === 'definition' && n.identifier && n.url && !definitions.has(n.identifier)) definitions.set(n.identifier, n.url);
  for (const n of walk(tree)) {
    if (n.type === 'image' && n.url) yield { src:n.url, alt:n.alt };
    if (n.type === 'imageReference' && n.identifier && definitions.has(n.identifier)) yield {src:definitions.get(n.identifier)!,alt:n.alt};
    // Older local articles sometimes leave spaces unescaped in a Markdown destination.
    // CommonMark leaves that syntax as text; recover only image-looking local paths.
    if (n.type === 'text' && n.value) {
      for (const found of n.value.matchAll(/!\[([^\]\n]*)\]\(([^()\n]*\s+[^()\n]*)\)/g)) {
        const candidate = found[2].trim();
        if (!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(candidate) && extension.test(candidate)) {
          yield { src:candidate, alt:found[1] };
        }
      }
    }
    if (n.type === 'html' && n.value && /<img\b/i.test(n.value)) yield* htmlImages(parseFragment(n.value) as Html);
  }
  // Keep frontmatter support archive-only; no changes to the article schema.
  const raw = await readFile(resolve(file.slice(1)), 'utf8').catch(() => undefined);
  const head = raw?.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (head) {
    let data: Record<string, unknown> | undefined;
    try { data = loadYaml(head) as typeof data; } catch { return; }
    for (const key of ['cover', 'image', 'heroImage', 'thumbnail']) {
      const value = data?.[key];
      if (typeof value === 'string') yield {src:value};
      else if (value && typeof value === 'object' && 'src' in value && typeof value.src === 'string') yield {src:value.src};
    }
  }
}

const extension = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const skip = /(?:^|[/_. -])(?:favicon|sprite|badge|logo|icon|spinner|pixel|tracking|spacer|emoji|shields)(?:[/_. -]|$)/i;
const small = (w = 0, h = 0) => (w > 0 && w < 64) || (h > 0 && h < 48);
const encode = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const localExists = (p: string) => {
  try { return statSync(resolve('public', '.' + p)).isFile(); } catch { return false; }
};

const cache = new Map<string, Promise<string | undefined>>();
export function articleCardImage(post: BlogPostEntry) {
  const key = `${post.collection}:${post.id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const result = findImage(post);
  cache.set(key, result);
  return result;
}
async function findImage(post: BlogPostEntry): Promise<string | undefined> {
  const file = '/' + (post.filePath ?? '').replace(/\\/g, '/').replace(/^\.?\//, '');
  for await (const { src, alt, width, height } of candidates(post, file)) {
    const raw = src.trim();
    if (!raw || /[\u0000-\u001f\\]/.test(raw) || small(width,height) || skip.test(alt ?? '')) continue;
    if (/^(?:https?:)?\/\//i.test(raw)) {
      try {
        const url = new URL(raw.startsWith('//') ? 'https:' + raw : raw);
        if (!url.username && !url.password && !skip.test(url.pathname) && (extension.test(url.pathname) || !/\.[^/.]+$/.test(url.pathname))) return url.href;
      } catch { /* Ignore malformed links. */ }
      continue;
    }
    if (/^[a-z][\w+.-]*:/i.test(raw)) continue;
    let path: string;
    try { path = decodeURIComponent(raw.split(/[?#]/, 1)[0]); } catch { continue; }
    if (!extension.test(path) || skip.test(path) || /[\u0000-\u001f\\]/.test(path)) continue;
    if (path.startsWith('/')) {
      const publicPath = posix.normalize(base && path.startsWith(base + '/') ? path.slice(base.length) : path);
      if (localExists(publicPath)) return base + encode(publicPath);
    }
    const asset = assets[posix.resolve(posix.dirname(file), path)];
    if (!asset) continue;
    try {
      const image = await asset();
      if (small(image.width, image.height)) continue;
      if (image.format === 'svg' || image.format === 'gif') return image.src;
      return (await getImage({ src:image, width:Math.min(500,image.width), format:'webp' })).src;
    } catch { /* Skip a bad candidate and try the next. */ }
  }
}
