import * as T from 'three';
import {box,cylinder,drawing,group,paintedSurface,part,ring,rod,series,TAU} from './workshop.js';
import {armillary} from './instruments.js';
import {bookAt,deskAt} from './layout.js';
import {bookSpread,printSpine} from './book-print.js';

const bindings=[0x623d31,0x314b46,0x735439,0x3f414d,0x7a6c46,0x543e37,0x3c4740,0x785245];
function bindingsAtlas(titles,editionCount,rows){
  const art=drawing(192*bindings.length,768*rows,(c)=>{
    c.scale(1.5,1.5);
    const noise=series(579);
    for(let n=0;n<editionCount;n++){
      const column=n%bindings.length;
      c.save();c.translate(column*128,Math.floor(n/bindings.length)*512);
      c.fillStyle='#'+bindings[column].toString(16).padStart(6,'0');c.fillRect(0,0,128,512);
      for(let j=0;j<4200;j++){c.fillStyle=noise()>.5?'#e4ddc816':'#17151121';c.fillRect(noise()*128,noise()*512,noise()*3+.6,1);}
      const shade=c.createLinearGradient(0,0,128,0);shade.addColorStop(0,'#09070473');shade.addColorStop(.15,'#fff0ba1a');shade.addColorStop(.74,'#00000000');shade.addColorStop(1,'#100e0a8c');
      c.fillStyle=shade;c.fillRect(0,0,128,512);
      c.strokeStyle='#b39b67';c.fillStyle='#d0bc88';c.lineWidth=2;
      for(const y of [32,39,91,416,471,478]){c.beginPath();c.moveTo(9,y);c.lineTo(119,y);c.stroke();}
      if(n%3===0){c.fillStyle='#c4ad83';c.fillRect(17,128,94,262);c.fillStyle='#4d4031';}
      printSpine(c,titles.length?titles[n%titles.length]:'');
      c.beginPath();c.arc(64,65,10,0,TAU);c.stroke();
      c.translate(64,445);c.rotate(Math.PI/4);c.strokeRect(-6,-6,12,12);
      c.restore();
    }
  });
  const map=new T.CanvasTexture(art);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  return new T.MeshStandardMaterial({map,roughness:.83});
}

function chart(blue, title) {
  return drawing(1024,680,(c,w,h)=>{
    const r=series(1847),color=blue?'#cfad72':'#68563c',minor=blue?'#748a78':'#aa9570';
    c.fillStyle=blue?'#243e40':'#ceb98f';c.fillRect(0,0,w,h);
    for(let i=0;i<16000;i++){c.fillStyle=r()>.48?'#fbf2ce0e':'#160e0a0c';c.fillRect(r()*w,r()*h,r()*2.5+.4,1);}
    c.strokeStyle=color;c.lineWidth=2;c.strokeRect(21,21,w-42,h-42);
    c.lineWidth=1;c.strokeRect(27,27,w-54,h-54);
    c.fillStyle=color;c.font='34px Georgia';c.fillText(title,53,81);
    c.font='15px Georgia';c.fillText('OBSERVATIONS  DU  MÉRIDIEN',54,110);
    const cx=390,cy=387,rad=228;
    c.strokeStyle=minor;c.lineWidth=1;
    for(let j=1;j<=6;j++){c.beginPath();c.arc(cx,cy,rad*j/6,0,TAU);c.stroke();}
    for(let i=0;i<48;i++){
      const a=TAU*i/48;c.beginPath();c.moveTo(cx+Math.cos(a)*(i%4?rad-8:0),cy+Math.sin(a)*(i%4?rad-8:0));
      c.lineTo(cx+Math.cos(a)*(rad+7),cy+Math.sin(a)*(rad+7));c.stroke();
    }
    for(let i=0;i<270;i++){
      const a=r()*TAU,dist=Math.sqrt(r())*rad,x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist;
      c.fillStyle=color;c.beginPath();c.arc(x,y,.8+r()*1.7,0,TAU);c.fill();
      if(i%21===0){c.strokeStyle=minor;c.beginPath();c.moveTo(x,y);c.lineTo(x+18,y-13);c.lineTo(x+38,y-8);c.stroke();}
    }
    c.strokeStyle=color;c.beginPath();c.ellipse(cx,cy,rad*1.09,rad*.29,-.5,0,TAU);c.stroke();
    c.fillStyle=color;c.font='20px Georgia';c.fillText('Ascensio recta',684,198);
    for(let i=0;i<11;i++){
      const y=233+i*26;c.strokeStyle=minor;c.beginPath();c.moveTo(684,y+7);c.lineTo(936,y+7);c.stroke();
      c.font='14px Georgia';c.fillText(['Lyra','Aquila','Cepheus','Cygnus','Draco','Cassiopeia','Ursa Major','Auriga','Perseus','Vega','Polaris'][i],685,y);
      c.fillText(String(10+Math.floor(r()*79))+'°   '+String(Math.floor(r()*59))+'′',855,y);
    }
    c.font='italic 17px Georgia';c.fillText('Tabula  borealis',685,566);
  });
}

function plaque(parent,m,x,y,z,label,w) {
  box(parent,m.brass,x,y,z,w,.142,.022,.008);
  const art=drawing(640,96,(c,cw,ch)=>{
    c.fillStyle='#303a33';c.fillRect(0,0,cw,ch);c.strokeStyle='#b39663';c.lineWidth=2;c.strokeRect(8,7,cw-16,ch-14);
    c.fillStyle='#e0c792';c.font='36px Georgia, "Microsoft YaHei", serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,cw/2,ch/2+2);
  });
  paintedSurface(parent,art,x,y,z+.012,w-.032,.118);
}

function volume(parent,m,x,y,z,w,h,d,edition,rows,lean=0){
  const column=edition%bindings.length,row=Math.floor(edition/bindings.length),tint=bindings[column];
  const book=group(parent,x,y,z);book.rotation.z=lean;
  box(book,m.pages,0,h/2,-.006,w*.89,h-.024,d-.027);
  for(const s of [-1,1])box(book,m.leather,s*w*.47,h/2,0,.018,h,d,0,tint);
  box(book,m.leather,0,h/2,d*.5-.013,w,h,.033,.009,tint);
  for(const v of [.14,.21,.76,.84]){
    box(book,m.bronze,0,h*v,d*.5+.005,w*.94,.008,.007);
  }
  const cover=new T.PlaneGeometry(w*.96,h*.98),uv=cover.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(column+.01+uv.getX(i)*.98)/bindings.length,(rows-1-row+.01+uv.getY(i)*.98)/rows);
  part(book,cover,m.bindings,0,h*.5,d*.5+.011);
}

function openAtlas(parent,m,x,y,z,angle,pages){
  const g=group(parent,x,y,z);g.rotation.y=angle;
  box(g,m.leather,0,.013,0,.77,.026,.49,.014,0x553d2b);
  for(const s of [-1,1]){
    const leaf=group(g,s*.181,.041,0);leaf.rotation.z=s*-.076;
    box(leaf,m.pages,0,0,0,.365,.047,.462,.008);
    const page=paintedSurface(leaf,pages[s<0?0:1],0,.0245,0,.347,.45);
    page.rotation.x=-Math.PI/2;
  }
  box(g,m.fabric,.075,.067,.222,.024,.004,.14);
}

function table(parent,m,width,depth,height){
  box(parent,m.wood,0,height-.046,0,width,.092,depth,.027);
  box(parent,m.bronze,0,height-.107,0,width-.04,.018,depth-.04,.005);
  box(parent,m.darkwood,0,height-.18,0,width-.09,.17,depth-.09,.013);
  for(const x of [-1,1])for(const z of [-1,1]){
    const leg=group(parent,x*(width/2-.155),0,z*(depth/2-.135));
    box(leg,m.wood,0,.43,0,.118,.79,.13,.016);
    for(const [y,r,h] of [[.066,.077,.084],[.25,.088,.05],[.66,.084,.05]])cylinder(leg,m.bronze,0,y,0,r,r,h,12);
  }
  for(const x of [-width*.234,width*.234]){
    box(parent,m.wood,x,height-.182,depth/2-.024,width*.435,.118,.05,.011);
    rod(parent,m.brass,[x,height-.18,depth/2],[x,height-.18,depth/2+.055],.022,.03);
  }
}

function bankLamp(parent,m,x,z){
  const g=group(parent,x,.96,z);
  cylinder(g,m.bronze,0,.028,0,.11,.153,.056,40);
  cylinder(g,m.brass,0,.074,0,.056,.109,.05,32);
  rod(g,m.brass,[0,.09,0],[0,.45,0],.023,.018);
  rod(g,m.gold,[0,.44,0],[0,.5,.14],.019);
  const shade=group(g,0,.49,.155);
  const shell=part(shade,new T.CylinderGeometry(.11,.11,.37,36,1,true,0,Math.PI*1.22),m.enamel);
  shell.rotation.set(0,0,Math.PI/2);shell.rotation.x=.24;
  const bulb=part(shade,new T.SphereGeometry(.095,24,12),m.lamp,0,-.033,0);bulb.scale.set(1.75,.52,.78);
  rod(g,m.bronze,[.14,.45,.14],[.14,.305,.14],.004,.004,6);
}

export function furnish(root,m,en,bookTitles) {
  const blue=chart(true,'ATLAS CŒLESTIS'),paper=chart(false,'Carte du ciel');
  const editionCount=Math.max(bindings.length,bookTitles.length),rows=Math.ceil(editionCount/bindings.length);
  const rand=series(428),copies=Array(bindings.length).fill(0);
  function stock(){
    const color=Math.floor(rand()*bindings.length);
    const editions=Math.ceil((editionCount-color)/bindings.length);
    return color+bindings.length*(copies[color]++%editions);
  }
  m.bindings=bindingsAtlas(bookTitles,editionCount,rows);
  const library=group(root,bookAt.x,0,bookAt.z);library.rotation.y=Math.PI/2;
  for(let section=-1;section<2;section++){
    const g=group(library,section*2.4,0,0);
    box(g,m.darkwood,0,1.53,-.22,2.34,3.06,.12,.016);
    for(const s of [-1,1]){
      box(g,m.wood,s*1.14,1.55,0,.11,3.1,.51,.018);
      box(g,m.brass,s*1.14,1.51,.264,.022,2.75,.015);
    }
    for(const [y,h,w] of [[.13,.26,2.4],[.32,.09,2.39],[2.94,.12,2.42],[3.05,.11,2.52]])box(g,m.wood,0,y,0,w,h,.58,.017);
    for(let row=0;row<4;row++){
      const y=.385+row*.626;
      box(g,m.wood,0,y,0,2.21,.055,.49,.013);
      box(g,m.bronze,0,y+.012,.253,2.19,.012,.012);
      let left=-1.035;
      while(left<.99){
        const w=.095+rand()*.11,h=.344+rand()*.199;
        if(left+w>1.055) break;
        if(rand()<.115){left+=.075;continue;}
        const lean=rand()<.16?-.10-rand()*.07:0;
        volume(g,m,left+w/2,y+.032,rand()*.071-.025,w,h,.25+rand()*.09,stock(),rows,lean);
        left+=w+.011+Math.abs(lean)*h;
      }
    }
    if(section===0)plaque(g,m,0,2.944,.301,en?'FIELD LIBRARY':'藏 书  ·  LIBRARY',.99);
  }

  const reader=group(root,-3.68,0,-.48);reader.rotation.y=.19;
  table(reader,m,1.67,.91,.85);openAtlas(reader,m,.10,.852,.05,-.14,bookSpread(bookTitles[0],paper));
  armillary(reader,m,-.53,.85,-.12,.85);
  for(let i=0;i<2;i++){
    const closed=group(reader,.58,.88+i*.06,-.17);closed.rotation.y=.12*i;
    box(closed,m.leather,0,0,0,.33,.065,.25,.009,bindings[2+i]);
    box(closed,m.pages,0,0,.122,.305,.046,.008);
  }

  const desk=group(root,deskAt.x,0,deskAt.z);desk.rotation.y=-Math.PI/2;
  table(desk,m,2.62,1.12,.96);
  box(desk,m.fabric,0,.965,.037,1.33,.012,.75,.016);openAtlas(desk,m,-.05,.973,.10,.12,bookSpread(bookTitles[2]||bookTitles[1]||bookTitles[0],paper));
  bankLamp(desk,m,-.91,-.23);armillary(desk,m,.91,.96,-.24,.83);
  const inkwell=group(desk,.53,.96,.21);
  cylinder(inkwell,m.lens,0,.065,0,.055,.076,.12,8);
  ring(inkwell,m.brass,0,.13,0,.047,.009);
  rod(inkwell,m.darkwood,[.12,.014,.08],[.38,.022,-.13],.012,.009);
  rod(inkwell,m.gold,[.38,.022,-.13],[.42,.018,-.162],.011,.001);
  for(let i=0;i<3;i++){
    const roll=group(desk,-.56+i*.095,1.004,-.29);roll.rotation.z=Math.PI/2;roll.rotation.x=.14;
    cylinder(roll,m.pages,0,0,0,.047,.047,.41,24);ring(roll,m.fabric,0,.02,0,.049,.008);
  }
  plaque(desk,m,0,.782,.579,en?'CORRESPONDENCE':'手 稿  ·  CORRESPONDENCE',.96);

  function framed(parent,x,y,z,angle,width,height,print){
    const g=group(parent,x,y,z);g.rotation.y=angle;
    box(g,m.darkwood,0,0,0,width+.14,height+.14,.1,.024);
    box(g,m.brass,0,0,.059,width+.032,height+.032,.026,.008);
    paintedSurface(g,print,0,0,.075,width,height);
    for(const dx of [-1,1])for(const dy of [-1,1]) {
      const pin=cylinder(g,m.gold,dx*(width/2+.043),dy*(height/2+.043),.063,.018,.018,.023,8);pin.rotation.x=Math.PI/2;
    }
  }
  framed(root,6.08,2.32,2.59,-Math.PI/2,2.12,1.41,blue);
  framed(root,-2.91,2.51,5.86,Math.PI,2.63,1.75,paper);
  // Paneled entrance, viewed when the visitor turns back from the loggia.
  const door=group(root,1.30,0,5.70);door.rotation.y=Math.PI;
  box(door,m.darkwood,0,1.58,0,2.12,3.16,.24,.027);
  for(const side of [-1,1]){
    const x=side*.485;box(door,m.wood,x,1.52,.14,.93,2.96,.11,.019);
    for(const y of [.72,2.13])box(door,m.darkwood,x,y,.206,.68,1.07,.035,.018);
    rod(door,m.brass,[side*.13,1.11,.25],[side*.13,1.39,.25],.022);
  }
  for(const x of [-1.1,1.1])box(door,m.trim,x,1.65,.02,.18,3.3,.32,.024);
  box(door,m.trim,0,3.32,0,2.48,.19,.33,.025);
}
