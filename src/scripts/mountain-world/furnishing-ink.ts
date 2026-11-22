import * as THREE from 'three';

/** Original lettering, paper fibres, and page edges, kept in a few shared atlases. */
export function createFurnishingInk(isEn: boolean) {
  const textures = new Set<THREE.Texture>();
  const cache = new Map<string, THREE.CanvasTexture>();
  let disposed = false;
  const font = '"Noto Serif SC", "Songti SC", serif';
  const titles = ['读诗小记', '数学随笔', '桃源', '读书札记', '自由的代价', '初中生活', '残灵', '光明',
    '算法导论', '计算机系统', '离散数学', '编译原理', '山中手记', '机器学习', '新年', '格物札记'];

  function canvas(width: number, height: number) {
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    return { canvas: result, ctx: result.getContext('2d')! };
  }

  function texture(source: HTMLCanvasElement) {
    const result = new THREE.CanvasTexture(source);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    textures.add(result);
    return result;
  }

  function paper(ctx: CanvasRenderingContext2D, width: number, height: number, tint = '#e8e3d1') {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(88,65,30,.035)' : 'rgba(255,255,237,.18)';
      ctx.fillRect((i * 71.31) % width, (i * 113.17) % height, 0.6 + i % 4, 0.5);
    }
    const shade = ctx.createLinearGradient(0, 0, width, 0);
    shade.addColorStop(0, 'rgba(91,62,25,.12)');
    shade.addColorStop(0.055, 'rgba(91,62,25,0)');
    shade.addColorStop(0.94, 'rgba(91,62,25,0)');
    shade.addColorStop(1, 'rgba(91,62,25,.08)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }

  function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, mark = '羽') {
    ctx.fillStyle = '#9b4838';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#ead8b6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
    ctx.fillStyle = '#ead8b6';
    ctx.font = `500 ${size * .64}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mark, x + size / 2, y + size / 2 + 1);
  }

  // Lay out the author's name as text independently of the landscape plate.
  const portrait = canvas(768, 1200);
  const portraitTexture = texture(portrait.canvas);
  function paintPortrait(landscape?: HTMLImageElement) {
    const {ctx} = portrait;
    paper(ctx,768,1200,'#ece0c6');
    if (landscape) {
      ctx.drawImage(landscape,0,0,landscape.width,landscape.height,0,665,768,535);
      const feather = ctx.createLinearGradient(0,665,0,720);
      feather.addColorStop(0,'#ece0c6'); feather.addColorStop(1,'rgba(236,224,198,0)');
      ctx.fillStyle=feather; ctx.fillRect(0,665,768,55);
    }
    ctx.fillStyle='#2c302a'; ctx.textBaseline='middle'; ctx.textAlign='center';
    if (isEn) {
      ctx.font='italic 112px "EB Garamond Variable",Georgia,serif';
      ctx.fillText('Preface',390,260,640);
      ctx.font='42px Georgia,serif'; ctx.fillText('Guanyu Chen',390,452);
      ctx.font='27px Georgia,serif'; ctx.fillText('Curriculum vitae',390,515);
    } else {
      const brush='KaiTi,STKaiti,"Kaiti SC","Noto Serif SC",serif';
      ctx.font='169px '+brush;
      [...'自序'].forEach((char,i)=>ctx.fillText(char,490,206+i*195));
      ctx.font='46px '+brush; [...'陈冠宇'].forEach((char,i)=>ctx.fillText(char,306,342+i*57));
      ctx.font='28px '+font; [...'个人履历'].forEach((char,i)=>ctx.fillText(char,221,245+i*39));
    }
    stamp(ctx,isEn?365:281,552,51,isEn ? 'C' : '陈');
    portraitTexture.needsUpdate=true;
  }
  paintPortrait();
  const portraitReady = new Promise<void>(resolve => {
    const image = new Image();
    image.onload = () => { if (!disposed) paintPortrait(image); resolve(); };
    image.onerror = () => resolve();
    image.src = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'')+'/world/folio-pines.webp';
  });

  const atlas = canvas(512, 2048);
  titles.forEach((title, index) => {
    const x = (index % 4) * 128;
    const y = Math.floor(index / 4) * 512;
    atlas.ctx.save();
    atlas.ctx.translate(x, y);
    paper(atlas.ctx, 128, 512, index % 3 === 0 ? '#e0d9c7' : '#eee9dc');
    atlas.ctx.strokeStyle = 'rgba(84,62,35,.48)';
    atlas.ctx.lineWidth = 1.5;
    atlas.ctx.strokeRect(13, 16, 102, 480);
    atlas.ctx.fillStyle = '#343831';
    atlas.ctx.textAlign = 'center';
    atlas.ctx.textBaseline = 'middle';
    atlas.ctx.font = `500 57px ${font}`;
    const step = Math.min(75, 352 / title.length);
    [...title].forEach((letter, n) => atlas.ctx.fillText(letter, 64, 61 + n * step));
    atlas.ctx.font = `24px ${font}`;
    atlas.ctx.fillStyle = '#786c51';
    atlas.ctx.fillText(['一', '二', '三', '四'][Math.floor(index / 4)], 64, 454);
    atlas.ctx.restore();
  });
  const bookAtlas = texture(atlas.canvas);

  const edge = canvas(512, 64);
  paper(edge.ctx, 512, 64, '#d9d4c3');
  for (let x = 1; x < 512; x += 3) {
    edge.ctx.strokeStyle = x % 9 === 1 ? 'rgba(102,83,48,.22)' : 'rgba(255,250,223,.40)';
    edge.ctx.lineWidth = x % 9 === 1 ? .6 : 1;
    edge.ctx.beginPath();
    edge.ctx.moveTo(x, 0);
    edge.ctx.lineTo(x + Math.sin(x) * .4, 64);
    edge.ctx.stroke();
  }
  const pageEdges = texture(edge.canvas);

  function page(kind: 'notes' | 'poem' | 'schematic' | 'scroll' | 'shelf' | 'bench' | 'lamp' | 'project') {
    const previous = cache.get(kind);
    if (previous) return previous;
    const { canvas: source, ctx } = canvas(kind === 'scroll' ? 768 : 512, kind === 'scroll' ? 1024 : 704);
    const w = source.width;
    const h = source.height;
    paper(ctx, w, h);
    ctx.fillStyle = '#32372f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (kind === 'scroll') {
      ctx.strokeStyle = 'rgba(113,85,43,.30)';
      ctx.strokeRect(43, 45, 682, 934);
      if (isEn) {
        ctx.font = 'italic 51px "EB Garamond", Georgia, serif';
        ['What power has', 'the light of night?', '', 'It dies.', 'How is it', 'born again?']
          .forEach((line, i) => ctx.fillText(line, 384, 225 + i * 88, 620));
      } else {
        ctx.font = `500 91px ${font}`;
        ['夜光何德？', '死则又育？'].forEach((column, i) => {
          [...column].forEach((character, j) => ctx.fillText(character, i ? 277 : 490, 234 + j * 126));
        });
      }
      stamp(ctx, 162, 856, 62);
    } else if (['shelf', 'bench', 'lamp', 'project'].includes(kind)) {
      const copy = { shelf: '藏书', bench: '坐听松风', lamp: '归', project: '观物求知' }[kind as 'shelf'];
      ctx.font = `500 ${kind === 'lamp' ? 290 : 118}px ${font}`;
      const letters = [...copy];
      const step = Math.min(142, 490 / letters.length);
      letters.forEach((letter, i) => ctx.fillText(letter, 256, (704 - (letters.length - 1) * step) / 2 + i * step));
    } else if (kind === 'schematic') {
      ctx.font = `500 49px ${font}`;
      ctx.fillText(isEn ? 'Celestial notes' : '格物札记', 256, 74);
      ctx.strokeStyle = '#646a57';
      ctx.lineWidth = 2;
      for (const r of [71, 105, 139]) {
        ctx.beginPath();
        ctx.ellipse(256, 299, r, r * .60, -.45, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(256, 299, 139, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(256, 140); ctx.lineTo(256, 460); ctx.moveTo(96, 299); ctx.lineTo(417, 299); ctx.stroke();
      ctx.font = 'italic 27px Georgia, serif';
      ['x² + y² + z² = r²', 'θ = ωt + φ', '23° 26′'].forEach((line, i) => ctx.fillText(line, 256, 506 + i * 45));
      stamp(ctx, 405, 601, 42);
    } else {
      ctx.font = `500 49px ${font}`;
      ctx.fillText(kind === 'notes' ? (isEn ? 'Mountain notes' : '山中手记') : (isEn ? 'On reading poetry' : '读诗小记'), 256, 79, 430);
      ctx.strokeStyle = 'rgba(120,90,50,.25)';
      ctx.beginPath(); ctx.moveTo(49, 125); ctx.lineTo(463, 125); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = isEn ? '24px "EB Garamond", Georgia, serif' : `26px ${font}`;
      const lines = isEn
        ? (kind === 'notes' ? ['A small room among the mountains.', '', 'Books, unfinished thoughts,', 'and a little time to look closely.', '', 'The light moves across the table.', 'There is always another page.']
          : ['At last, a little time for poetry.', '', 'A river through the southern lands;', 'the hills beyond a quiet window.', '', 'November 18, 2025'])
        : (kind === 'notes' ? ['近日久违地读了一些些诗词呢。', '', '初入校园时曾立志每日读一诗，', '将一本诗经放在枕旁。', '', '也许本来可以多写一点。', '遂暂时就此罢笔。']
          : ['千古风流八咏楼，', '江山留与后人愁。', '', '水通南国三千里，', '气压江城十四州。', '', '—— 李清照《题八咏楼》']);
      lines.forEach((line, i) => ctx.fillText(line, 51, 176 + i * 48, 410));
      ctx.textAlign = 'right';
      ctx.font = '21px Georgia, serif';
      ctx.fillStyle = '#766b56';
      ctx.fillText('2025 · 11 · 18', 451, 620);
      stamp(ctx, 55, 602, 42);
    }
    const result = texture(source);
    cache.set(kind, result);
    return result;
  }

  return { titles, bookAtlas, pageEdges, page, portraitTexture, portraitReady, dispose: () => { disposed = true; for (const item of textures) item.dispose(); textures.clear(); } };
}
