import { load } from 'cheerio';

// Each MathJax SVG carries its own font in static articles. A scroll needs
// just one definition per glyph, even when many equations use the same one.
function shareFormulaGlyphs(html: string) {
  const glyphs = new Map<string, string>();
  const result = html.replace(/<mjx-container\b[\s\S]*?<\/mjx-container>/g, formula => {
    const local = new Map<string, string>();
    return formula.replace(/<path id="(MJX-[^"]+)" d="([a-zA-Z0-9.,\s+\-]+)"><\/path>/g, (_, id: string, path: string) => {
      const shared = glyphs.get(path) ?? 'court-math-g' + glyphs.size;
      glyphs.set(path, shared);
      local.set(id, shared);
      return '';
    }).replace(/<defs><\/defs>/g, '').replace(/((?:xlink:)?href)="#(MJX-[^"]+)"/g, (original, attribute: string, id: string) =>
      local.has(id) ? `${attribute}="#${local.get(id)}"` : original);
  });
  if (!glyphs.size) return result;
  const paths = Array.from(glyphs, ([path, id]) => `<path id="${id}" d="${path}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" data-folio-glyphs width="0" height="0" aria-hidden="true" style="position:absolute;pointer-events:none"><defs>${paths}</defs></svg>` + result;
}

export function prepareManuscript(html: string, articleURL: URL) {
  const $ = load(shareFormulaGlyphs(html), {}, false);
  $('script,style,link,base,iframe,object,embed,form,.article-return-links,.mobile-toc,.study-prelude,.study-return,.project-index,.workbench-directory').remove();
  function resolve(value: string, attribute: string) {
    if (value.startsWith('#') || (attribute !== 'href' && value.startsWith('data:image/'))) return value;
    try {
      const url = new URL(value, articleURL);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null;
      return url.origin === articleURL.origin ? url.pathname + url.search + url.hash : url.href;
    } catch { return null; }
  }
  $('*').each((_, element) => {
    for (const [name, value] of Object.entries(element.attribs)) {
      if (/^on/i.test(name) || name === 'srcdoc') $(element).removeAttr(name);
      else if (['href', 'src', 'poster', 'xlink:href'].includes(name) && value) {
        const resolved = resolve(value, name);
        if (resolved === null) $(element).removeAttr(name);
        else if (resolved !== value) $(element).attr(name, resolved);
      } else if (name === 'srcset') {
        const sources = value.split(',').map(entry => {
          const [source, ...size] = entry.trim().split(/\s+/);
          const resolved = resolve(source, 'src');
          return resolved && [resolved, ...size].join(' ');
        }).filter(Boolean);
        $(element).attr('srcset', sources.join(', '));
      }
    }
    if (element.name === 'a' && element.attribs.target === '_blank') $(element).attr('rel', 'noopener noreferrer');
  });
  if (html.length > 120_000) {
    // Keep every heading and equation in the document for find, deep links
    // and assistive technology. The browser can lay out offscreen groups later.
    const nodes = $.root().contents().toArray();
    let group = $('<div class="folio-passage"></div>'), elements = 0;
    for (const node of nodes) {
      if (node.type === 'tag' && node.name === 'svg' && 'data-folio-glyphs' in node.attribs) continue;
      if (!group.parent().length) $(node).before(group);
      group.append(node);
      if (node.type === 'tag' && ++elements === 12) {
        group = $('<div class="folio-passage"></div>');
        elements = 0;
      }
    }
  }
  return $.html();
}
