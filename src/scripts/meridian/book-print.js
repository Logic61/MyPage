import {drawing,series} from './workshop.js';

const typeface='Georgia, "Songti SC", SimSun, "Noto Serif CJK SC", serif';

// The drawing origin is the centre of the type area. Keep Latin words intact
// and allow Chinese characters to wrap at their natural line boundaries.
function printTitle(c,title,width,height,maxSize){
  if(!title)return;
  const tokens=title.match(/[\p{Script=Han}]|[^\s\p{Script=Han}]+|\s+/gu)||[];
  let lines=[],leading,widest;
  for(let size=maxSize;size>=12;size-=2){
    c.font=size+'px '+typeface;leading=size*1.2;
    lines=[];let line='';
    for(const token of tokens){
      if(line&&token.trim()&&c.measureText(line+token).width>width){
        lines.push(line.trimEnd());line='';
      }
      line=line?line+token:token.trimStart();
    }
    if(line)lines.push(line.trimEnd());
    widest=Math.max(1,...lines.map(text=>c.measureText(text).width));
    if(widest<=width&&lines.length*leading<=height)break;
  }
  c.save();c.scale(Math.min(1,width/widest),Math.min(1,height/(lines.length*leading)));
  c.textAlign='center';c.textBaseline='middle';
  lines.forEach((line,i)=>c.fillText(line,0,(i-(lines.length-1)/2)*leading));
  c.restore();
}

export function printSpine(c,title){
  if(!title)return;
  c.save();c.translate(64,258);
  if(/\p{Script=Han}/u.test(title)&&!/[A-Za-z]{2,}/.test(title)){
    const glyphs=Array.from(title);
    const columns=Math.min(3,Math.ceil(glyphs.length/8)),rows=Math.ceil(glyphs.length/columns);
    const step=Math.min(35,232/rows),size=Math.min(31,step*.90,83/columns);
    c.font=size+'px '+typeface;c.textAlign='center';c.textBaseline='middle';
    glyphs.forEach((glyph,i)=>{
      const column=Math.floor(i/rows),row=i%rows;
      c.fillText(glyph,((columns-1)/2-column)*(size+3),(row-(rows-1)/2)*step);
    });
  }else{
    c.rotate(Math.PI/2);
    printTitle(c,title,236,80,30);
  }
  c.restore();
}

function leaf(gutterAtRight,paint){
  return drawing(480,640,(c,w,h)=>{
    const grain=series(307);
    c.fillStyle='#dcc9a4';c.fillRect(0,0,w,h);
    for(let i=0;i<9200;i++){
      c.fillStyle=grain()>.4?'#f7edce30':'#6351381c';
      c.fillRect(grain()*w,grain()*h,1+grain()*2,.8);
    }
    c.strokeStyle='#997e58';c.lineWidth=1.3;c.strokeRect(29,31,w-58,h-62);
    c.save();paint(c);c.restore();
    const fold=c.createLinearGradient(gutterAtRight?w:0,0,gutterAtRight?w-40:40,0);
    fold.addColorStop(0,'#47371a56');fold.addColorStop(1,'#47371a00');
    c.fillStyle=fold;c.fillRect(0,0,w,h);
  });
}

export function bookSpread(title,engraving){
  // A detail of the observatory engraving faces the actual article's title
  // page. The wall chart's caption stays on the wall.
  const plate=leaf(true,c=>{
    c.drawImage(engraving,130,146,524,477,49,143,382,348);
    c.strokeStyle='#947953';c.strokeRect(48,142,384,350);
  });
  const titlePage=leaf(false,c=>{
    c.strokeStyle='#977244';c.fillStyle='#977244';
    for(const y of [162,461]){
      c.beginPath();c.moveTo(129,y);c.lineTo(219,y);c.moveTo(261,y);c.lineTo(351,y);c.stroke();
      c.save();c.translate(240,y);c.rotate(Math.PI/4);c.fillRect(-4,-4,8,8);c.restore();
    }
    c.translate(240,310);c.fillStyle='#49372a';
    printTitle(c,title,358,212,52);
  });
  return [plate,titlePage];
}
