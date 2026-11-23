import * as THREE from 'three';

/** Original lettering, paper fibres, and page edges, kept in a few shared atlases. */
export function createFurnishingInk(isEn: boolean) {
  const textures = new Set<THREE.Texture>();
  const cache = new Map<string, THREE.CanvasTexture>();
  let disposed = false;
  const font = '"Courtyard Lettering", "Noto Serif SC", "Songti SC", serif';
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
      ctx.fillText('Résumé',390,260,640);
      ctx.font='42px Georgia,serif'; ctx.fillText('Guanyu Chen',390,452);
      ctx.font='27px Georgia,serif'; ctx.fillText('Curriculum vitae',390,515);
    } else {
      const brush='KaiTi,STKaiti,"Kaiti SC",'+font;
      ctx.font='169px '+brush;
      [...'简历'].forEach((char,i)=>ctx.fillText(char,490,206+i*195));
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
    const { canvas: source, ctx } = canvas(kind === 'scroll' || kind==='schematic' ? 768 : 512, kind === 'scroll' ? 1024 : kind==='schematic'?552:704);
    const w = source.width;
    const h = source.height;
    paper(ctx, w, h,kind==='schematic'?'#dbc5a2':'#e8e3d1');
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
      const x=377,y=281,radius=218;
      ctx.strokeStyle='#967951';ctx.lineWidth=1.7;ctx.strokeRect(19,17,730,518);
      ctx.save(); ctx.translate(x,y); ctx.strokeStyle='#554733';
      for(const r of [41,76,114,154,196,radius]) {
        ctx.lineWidth=r===radius?3.3:1.65;
        ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
      }
      for(let i=0;i<96;i++) {
        const a=i*Math.PI/48,c=Math.cos(a),s=Math.sin(a),major=i%8===0;
        ctx.lineWidth=major?1.6:1.2;
        ctx.beginPath();ctx.moveTo(c*(major?29:radius-6),s*(major?29:radius-6));ctx.lineTo(c*radius,s*radius);ctx.stroke();
      }
      ctx.strokeStyle='#a16143';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(0,0,206,103,-.51,0,Math.PI*2);ctx.stroke();
      for(let cluster=0;cluster<23;cluster++) {
        const a=cluster*2.40,r=Math.sqrt((cluster+.63)/23)*172;
        const ox=Math.cos(a)*r,oy=Math.sin(a)*r;
        let lastX=ox,lastY=oy;
        for(let j=0;j<3+cluster%3;j++){
          const px=ox+Math.sin(cluster*2.8+j*3.71)*21+j*2,py=oy+Math.cos(cluster*4.7+j*2.1)*17;
          ctx.strokeStyle='#5b4a38';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(px,py);ctx.stroke();
          ctx.fillStyle=j%3?'#30281d':'#8e4f32';ctx.beginPath();ctx.arc(px,py,j%3?3.1:4.3,0,Math.PI*2);ctx.fill();lastX=px;lastY=py;
        }
      }
      ctx.font=isEn?'19px Georgia,serif':`19px ${font}`;
      for(let i=0;i<12;i++){const a=i*Math.PI/6-Math.PI/2;ctx.fillText(isEn?String(i*2):'子丑寅卯辰巳午未申酉戌亥'[i],Math.cos(a)*235,Math.sin(a)*235);}
      ctx.restore();ctx.fillStyle='#40392e';ctx.font=isEn?'italic 21px Georgia,serif':`32px ${font}`;
      if(isEn) {ctx.save();ctx.translate(65,279);ctx.rotate(-Math.PI/2);ctx.fillText('Celestial chart',0,0);ctx.restore();}
      else [...'浑天星图'].forEach((v,j)=>ctx.fillText(v,68,190+j*52));
      stamp(ctx,663,444,38,isEn?'L':'星');
    } else {
      ctx.font = `500 49px ${font}`;
      ctx.fillText(kind === 'notes' ? (isEn ? 'Recent writing' : '近作') : (isEn ? 'On reading poetry' : '读诗小记'), 256, 79, 430);
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

  // Underglaze bamboo, painted around a turned vessel before its clear glaze.
  const porcelain = canvas(768,384);
  const glaze = porcelain.ctx;
  glaze.fillStyle='#dddcc7'; glaze.fillRect(0,0,768,384);
  for (const height of [56,64,294,301]) {
    glaze.fillStyle='#456873'; glaze.fillRect(0,height,768,height===64||height===301?2:4);
  }
  function bambooLeaf(x: number,y: number,dx: number,dy: number) {
    glaze.beginPath(); glaze.moveTo(x,y);
    glaze.quadraticCurveTo(x+dx*.33-dy*.14,y+dy*.33+dx*.14,x+dx,y+dy);
    glaze.quadraticCurveTo(x+dx*.57+dy*.07,y+dy*.57-dx*.07,x,y); glaze.fill();
  }
  for (const [x,lean,h] of [[45,44,166],[126,-23,113],[294,51,191],[388,-25,123],[554,45,176],[675,-19,106]]) {
    glaze.strokeStyle='#385963'; glaze.fillStyle='#3e6571'; glaze.lineWidth=3;
    for (let j=0;j<5;j++) {
      const px=x+lean*j/5, py=291-h*j/5, sign=j%2?1:-1;
      glaze.beginPath(); glaze.moveTo(px,py); glaze.lineTo(px+lean/5,py-h/5+2); glaze.stroke();
      if (j<1) continue;
      glaze.beginPath(); glaze.moveTo(px,py); glaze.quadraticCurveTo(px+sign*12,py-17,px+sign*37,py-21); glaze.stroke();
      bambooLeaf(px+sign*14,py-13,sign*25,-29); bambooLeaf(px+sign*25,py-20,sign*23,14);
      bambooLeaf(px+sign*33,py-21,sign*31,-9);
    }
  }
  const brushGlaze = texture(porcelain.canvas);
  // A two-over, two-under reed mat. Shade the rounded strips and the knots where a strand dives.
  const mat = canvas(128,128), mc=mat.ctx;
  mc.fillStyle='#7e7246'; mc.fillRect(0,0,128,128);
  for(let j=0;j<8;j++) for(let i=0;i<8;i++) {
    const vertical=(i+j)%4<2, x=i*16, y=j*16;
    const shade=vertical?mc.createLinearGradient(x,y,x+16,y):mc.createLinearGradient(x,y,x,y+16);
    shade.addColorStop(0,'#8d8055'); shade.addColorStop(.18,'#b5aa79');
    shade.addColorStop(.52,vertical?'#d3c89a':'#b9aa79'); shade.addColorStop(.91,vertical?'#bcb484':'#a49765'); shade.addColorStop(1,'#857b51');
    mc.fillStyle=shade; mc.fillRect(x,y,16,16);
    mc.fillStyle='rgba(255,243,191,.20)';
    for(const k of [4,9,12]) {
      if(vertical) mc.fillRect(x+k,y,.8,16); else mc.fillRect(x,y+k,16,.8);
    }
  }
  const reedMat=texture(mat.canvas);
  reedMat.wrapS=reedMat.wrapT=THREE.RepeatWrapping; reedMat.repeat.set(14,9);
  return { titles, bookAtlas, pageEdges, page, portraitTexture, portraitReady, brushGlaze, reedMat,
    dispose: () => { disposed = true; for (const item of textures) item.dispose(); textures.clear(); } };
}
