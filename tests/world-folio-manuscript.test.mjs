import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from 'cheerio';
import { prepareManuscript } from '../src/utils/folio-manuscript.ts';

const article = new URL('https://example.org/MyPage/en/blog/notes/travel/');

test('formulae share glyphs across equations while retaining native SVG references and independent author artwork', () => {
  const equation = (id, label) => `<mjx-container><svg aria-label="${label}" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="${id}" d="M0 0L3 4"></path></defs><g><use xlink:href="#${id}"></use><use href="#${id}"></use></g></svg></mjx-container>`;
  const $ = load(prepareManuscript(equation('MJX-1-A', 'one') + equation('MJX-2-A', 'two') +
    '<svg><path id="artist" d="M0 0L3 4"></path></svg>', article));
  const source = $('svg[aria-hidden="true"] defs path');
  assert.equal(source.length, 1);
  assert.deepEqual($('mjx-container svg').map((_, el) => $(el).attr('aria-label')).get(), ['one', 'two']);
  assert.deepEqual($('mjx-container use').map((_, el) => $(el).attr('href')).get(), Array(4).fill('#' + source.attr('id')));
  assert.equal($('#artist').length, 1);
});

test('build-time preparation retains reading anchors, article-relative images, outside links and complete body text', () => {
  const $ = load(prepareManuscript('<h2 id="walk">A walk</h2><p>Entire paragraph <a href="#walk">reread</a></p>' +
    '<img src="photo.jpg" srcset="photo.jpg 1x, /large.jpg 2x" onerror="boom()">' +
    '<a target="_blank" href="../next/">Next</a><a href="javascript:bad()">bad</a><script>bad()</script>', article));
  assert.equal($('h2').attr('id'), 'walk');
  assert.equal($('p').text(), 'Entire paragraph reread');
  assert.equal($('a').first().attr('href'), '#walk');
  assert.equal($('img').attr('src'), article.pathname + 'photo.jpg');
  assert.equal($('img').attr('srcset'), article.pathname + 'photo.jpg 1x, /large.jpg 2x');
  assert.equal($('a[target]').attr('href'), '/MyPage/en/blog/notes/next/');
  assert.equal($('a[target]').attr('rel'), 'noopener noreferrer');
  assert.equal($('a').last().attr('href'), undefined);
  assert.equal($('script, [onerror]').length, 0);
});

test('long manuscripts retain all text and anchors in order across visible and offscreen passages', () => {
  const paragraphs = Array.from({length: 27}, (_, i) => `<p id="p${i}">${String(i).padEnd(5_000, '.')}</p>`);
  const $ = load(prepareManuscript(paragraphs.join(''), article));
  const passages = $('.folio-passage');
  assert.deepEqual(passages.map((_, el) => $(el).children('p').length).get(), [12, 12, 3]);
  assert.deepEqual(passages.find('p').map((_, el) => el.attribs.id).get(), paragraphs.map((_, i) => 'p' + i));
  assert.equal($('#p26').text().length, 5_000);
});
