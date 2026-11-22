import {canStand,focusedObject,step} from './layout.js';
import {beginDrag,moveDrag,makeLookInput,cameraOffset,offsetWeight} from './look.js';
import {makeSignposts} from './signposts.js';
import {makeFolio} from './folio.js';
import {initialQuality} from './quality.js';

const root=document.getElementById('observatory');
const $=id=>document.getElementById(id);
const canvas=$('world'),enter=$('enter'),interact=$('interact'),dialog=$('folio'),optics=$('optics'),joy=$('joystick');
const settings=$('render-settings'),qualityKey='meridian-render-quality';
let savedQuality;
try{savedQuality=localStorage.getItem(qualityKey);}catch{}
let quality=initialQuality(savedQuality,navigator.deviceMemory,navigator.hardwareConcurrency);
let explicitQuality=savedQuality===quality,settingsCaptured=false,settingsTransition=false;
const qualityInputs=Array.from(settings.querySelectorAll('input[name="render-quality"]'));
const en=root.dataset.lang==='en',t=(zh,english)=>en?english:zh;
const coarse=matchMedia('(pointer:coarse)').matches,motionPreference=matchMedia('(prefers-reduced-motion:reduce)');
let reduced=motionPreference.matches;
const names={shelf:t('翻阅博客','Read the blog'),desk:t('展开简历','Unroll the CV'),scope:t('使用望远镜','Use the telescope')};
const pose={x:-1.78,z:4.05,yaw:innerWidth<650?-.50:-.235,pitch:.055},returnKey='meridian-pose:'+root.dataset.assets;
const input=makeLookInput(),signs=makeSignposts(root),keys=new Set();
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let world,mode='arrival',under='arrival',opener,lastObject,lastBearing=-1,pendingWalk=false,failed=false,visited=false;
let frame=0,idleTimer=0,last=0,clock=0,phase=0,bob=0,slowFrames=0,transition=null;
let drag=null,stick=null,stickX=0,stickY=0,opticYaw=0,opticPitch=0,power=3;
let locked=false,wantsLock=false,lockTicket=0,locking=false,rawMouse=true,foreground=true,returnURL=location.pathname+location.search;
let fromHistory=false,resumeTransition=false;
let opticUi='aim',nativeLensEscape=-Infinity;
const vellum=window.meridianArt?.['vellum.webp']||root.dataset.assets+'vellum.webp';
dialog.style.setProperty('--vellum','url("'+vellum+'")');

function remember(){
  if(visited)try{sessionStorage.setItem(returnKey,JSON.stringify(pose));}catch{}
}
function restore(){
  try{
    const p=JSON.parse(sessionStorage.getItem(returnKey));
    if(p&&[p.x,p.z,p.yaw,p.pitch].every(Number.isFinite)&&canStand(p.x,p.z)&&Math.abs(p.pitch)<=1.35){
      Object.assign(pose,{x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch});visited=true;
      enter.querySelector('span').textContent=t('继续步入','Resume walking');
    }
  }catch{}
}
if(location.hash==='#study'||history.state?.meridian||performance.getEntriesByType('navigation')[0]?.type==='back_forward')restore();
signs.update({fov:63,position:{x:pose.x,y:1.63,z:pose.z},rotation:{x:pose.pitch,y:pose.yaw}});
function clearInput(){
  keys.clear();input.reset();drag=null;stick=null;stickX=0;stickY=0;joy.firstElementChild.style.transform='';
}
function releaseLock(){
  ++lockTicket;wantsLock=false;locking=false;locked=false;delete root.dataset.locked;
  if(document.pointerLockElement===canvas)document.exitPointerLock();
}
function aiming(){return !settings.open&&(mode==='walk'||(mode==='optics'&&opticUi==='aim'));}
function lock(){
  if(coarse||locking||!canvas.requestPointerLock||!aiming()||document.pointerLockElement===canvas)return;
  const ticket=++lockTicket;locking=true;wantsLock=true;
  const valid=()=>ticket===lockTicket&&aiming()&&foreground&&!document.hidden;
  async function request(){
    try{
      if(rawMouse)await canvas.requestPointerLock({unadjustedMovement:true});
      else await canvas.requestPointerLock();
    }
    catch(error){
      if(rawMouse&&(error.name==='NotSupportedError'||error.name==='TypeError')){
        rawMouse=false;
        if(!valid())return;
        try{await canvas.requestPointerLock();}catch{if(valid())wantsLock=false;}
      }else if(valid())wantsLock=false;
    }finally{if(ticket===lockTicket)locking=false;}
  }
  request();
}
function lensVisible(){return mode==='optics'||(mode==='panel'&&under==='optics');}
function change(next){
  mode=next;root.dataset.mode=next;clearInput();interact.hidden=true;optics.hidden=!lensVisible();
  if(lensVisible())root.dataset.opticUi=opticUi;else delete root.dataset.opticUi;
  if(!aiming())releaseLock();
  last=0;
  world?.resize(lensVisible());schedule();
}
function targetPose(){
  if(lensVisible()){
    const p=world.opticPosition,v=world.opticDirection;
    return {x:p.x,y:p.y,z:p.z,yaw:Math.atan2(-v.x,-v.z)+opticYaw,pitch:Math.asin(v.y)+opticPitch,
      fov:2*Math.atan(Math.tan(63*Math.PI/360)/power)*180/Math.PI};
  }
  return {x:pose.x,y:1.63+bob,z:pose.z,yaw:pose.yaw,pitch:pose.pitch,fov:63};
}
function ease(duration){transition=reduced?null:cameraOffset(world.camera,targetPose(),performance.now(),duration);schedule();}
function pause(){
  if(mode!=='walk'&&mode!=='optics')return;
  const wasLens=lensVisible();pendingWalk=false;remember();change('arrival');
  if(wasLens)ease(240);
  enter.querySelector('span').textContent=t('继续步入','Resume walking');enter.focus({preventScroll:true});
}
function walk(requestLock){
  if(failed){openPanel('map');return;}
  if(!world){pendingWalk=true;$('load-status').textContent=t('正在布置观象台…','Preparing the observatory…');return;}
  const wasLens=lensVisible();
  pendingWalk=false;visited=true;change('walk');$('load-status').textContent='';canvas.focus({preventScroll:true});
  if(wasLens)ease(270);
  if(requestLock)lock();
}
function updateLocation(section,slug){
  if(fromHistory||!dialog.open)return;
  const next='#folio/'+section+(slug?'/'+encodeURIComponent(slug):'');
  try{if(location.hash!==next)history.replaceState({...history.state,meridianFolio:true},'',next);}catch{}
}
const folio=makeFolio(dialog,t,updateLocation,id=>{
  signs.guide(id);closePanel(false);if(world)walk(true);
});
function openPanel(section,entry,trigger){
  if(settings.open)closeSettings(false);
  if(mode!=='panel'){
    pendingWalk=false;under=mode;opener=trigger||document.activeElement;
    resumeTransition=!!transition;transition=null;change('panel');dialog.showModal();
    if(!fromHistory){
      returnURL=location.pathname+location.search+location.hash;
      try{history.pushState({...history.state,meridianFolio:true,meridianEntry:true},'','#folio/'+section);}catch{}
    }
    const deg=-pose.yaw*180/Math.PI;
    $('map-player').setAttribute('transform','translate('+(130+pose.x*13)+' '+(104+pose.z*10)+') rotate('+deg+')');
  }
  folio.show(section,entry);$('close').focus({preventScroll:true});
}
function closePanel(requestLock=true){
  if(!dialog.open)return;
  folio.close();dialog.close();change(under);
  if(resumeTransition&&world)ease(180);
  resumeTransition=false;
  if(under==='walk'){
    canvas.focus({preventScroll:true});if(requestLock)lock();
  }else if(under==='optics'){
    if(opticUi==='aim'){canvas.focus({preventScroll:true});if(requestLock)lock();}
    else $('resume-optic').focus({preventScroll:true});
  }
  else (opener instanceof HTMLElement&&opener!==document.body?opener:enter).focus({preventScroll:true});
  if(location.hash.startsWith('#folio/')&&!fromHistory){
    if(history.state?.meridianEntry)history.back();
    else try{history.replaceState(null,'',returnURL);}catch{}
  }
}
function readLocation(){
  const match=location.hash.match(/^#folio\/(blog|projects|cv|map)(?:\/(.*))?$/);
  fromHistory=true;
  try{
    if(match){let slug;try{slug=decodeURIComponent(match[2]||'');}catch{}openPanel(match[1],slug);}
    else if(dialog.open)closePanel(false);
  }finally{fromHistory=false;}
}
window.addEventListener('popstate',readLocation);

function use(){
  if(mode!=='walk')return;
  const item=focusedObject(pose);if(!item)return;
  if(item==='scope'){
    opticUi='aim';opticYaw=0;opticPitch=-.021;setPower(3,false);change('optics');ease(270);
    world.loadSummit().then(schedule).catch(()=>{});canvas.focus({preventScroll:true});lock();
  }else openPanel(item==='shelf'?'blog':'cv');
}
function opticControls(open){
  if(mode!=='optics')return;
  opticUi=open?'controls':'aim';root.dataset.opticUi=opticUi;clearInput();
  if(open){releaseLock();$('resume-optic').focus({preventScroll:true});}
  else{canvas.focus({preventScroll:true});lock();}
}
function leaveSightUnlocked(){
  releaseLock();walk(false);
}
function applyQuality(level,save=false){
  quality=level;root.dataset.quality=level;slowFrames=0;
  for(const option of qualityInputs)option.checked=option.value===level;
  if(save){explicitQuality=true;try{localStorage.setItem(qualityKey,level);}catch{}}
  if(world){
    world.setQuality(level,lensVisible());
    if(settings.open)world.render(clock);else schedule();
  }
}
function openSettings(){
  if(settings.open||dialog.open)return;
  settingsCaptured=document.pointerLockElement===canvas||wantsLock;
  settingsTransition=!!transition;transition=null;pendingWalk=false;
  clearInput();stopFrames();settings.showModal();releaseLock();
  settings.querySelector(':checked')?.focus({preventScroll:true});
}
function closeSettings(recapture=true){
  if(!settings.open)return;
  settings.close();clearInput();last=0;
  if(settingsTransition&&world)ease(180);
  if(aiming()){
    canvas.focus({preventScroll:true});if(recapture&&settingsCaptured)lock();
  }else if(mode==='optics')$('resume-optic').focus({preventScroll:true});
  else $('open-settings').focus({preventScroll:true});
  schedule();
}
applyQuality(quality);
function setPower(n,animate=true){
  const changed=power!==n;power=n;
  for(const button of optics.querySelectorAll('[data-power]'))button.setAttribute('aria-pressed',String(Number(button.dataset.power)===n));
  if(changed&&animate)ease(140);
}
function look(dx,dy,isLocked=false){
  if(!foreground||document.hidden||!aiming())return;
  input.add(dx,dy,performance.now(),Math.min(innerHeight,innerWidth),isLocked);schedule();
}
function walkFrame(dt){
  const side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stickX;
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))+stickY;
  pose.yaw+=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*1.58*dt;
  pose.pitch=clamp(pose.pitch+(Number(keys.has('PageUp'))-Number(keys.has('PageDown')))*dt,-1.28,1.33);
  const ox=pose.x,oz=pose.z;
  if(side||forward)step(pose,side,forward,dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.25:1.94));
  const travelled=Math.hypot(pose.x-ox,pose.z-oz);phase+=travelled*8;
  const bobTarget=(!reduced&&travelled>.001)?Math.sin(phase)*.012:0;
  bob+=(bobTarget-bob)*(-Math.expm1(-dt*14));
  const obj=focusedObject(pose);
  if(obj!==lastObject||interact.hidden!==!obj){
    lastObject=obj;interact.hidden=!obj;if(obj)interact.querySelector('span').textContent=names[obj];
    if(obj==='scope')world.loadSummit().then(schedule).catch(()=>{});
  }
  const deg=Math.round((-pose.yaw*180/Math.PI%360+360)%360)%360;
  if(deg!==lastBearing){
    lastBearing=deg;$('bearing-label').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];
    $('bearing-number').textContent=String(deg).padStart(3,'0')+'°';
  }
}
function draw(dt,now){
  const cam=world.camera;
  // A folio is laid over the last rendered frame, including a partially seated eyepiece.
  if(mode==='panel'&&root.dataset.ready)return false;
  const motion=input.take(dt);
  if(mode==='walk'){
    pose.yaw-=motion.dx*.0023;pose.pitch=clamp(pose.pitch-motion.dy*.0023,-1.28,1.33);walkFrame(dt);
  }else if(mode==='optics'){
    const gain=.0023/power;
    opticYaw=clamp(opticYaw-motion.dx*gain,-.15,.15);opticPitch=clamp(opticPitch-motion.dy*gain,-.085,.09);
  }
  const target=targetPose();
  const weight=transition?offsetWeight(transition,now):0;
  if(weight){
    for(const prop of ['x','y','z','yaw','pitch','fov'])target[prop]+=transition[prop]*weight;
  }else transition=null;
  cam.position.set(target.x,target.y,target.z);cam.rotation.set(target.pitch,target.yaw,0,'YXZ');
  if(Math.abs(cam.fov-target.fov)>.00001){cam.fov=target.fov;cam.updateProjectionMatrix();}
  cam.layers.set(lensVisible()&&(!transition||weight<.45)?1:0);
  if(mode==='walk'||mode==='arrival')signs.update(cam,mode==='walk'?lastObject:null);
  world.render(clock);
  return !!transition||motion.remaining;
}
function tick(now){
  frame=0;if(document.hidden||!world||!foreground||mode==='panel'||settings.open){last=0;return;}
  const elapsed=last?Math.max(0,(now-last)/1000):0;last=now;
  const raw=elapsed||1/60;
  if(!reduced)clock+=Math.min(.25,elapsed);
  if(!explicitQuality&&quality==='medium'&&mode==='walk'){
    slowFrames=raw>.055&&raw<1?slowFrames+1:Math.max(0,slowFrames-1);
    if(slowFrames>=45)applyQuality('low');
  }
  const moving=draw(Math.min(.05,raw),now);
  if(mode==='walk'||moving)schedule();
  else if(!reduced)idleTimer=setTimeout(schedule,mode==='optics'?48:85);
  else last=0;
}
function schedule(){
  clearTimeout(idleTimer);idleTimer=0;
  if(!frame&&!document.hidden&&foreground&&world&&mode!=='panel'&&!settings.open)frame=requestAnimationFrame(tick);
}
function stopFrames(){clearTimeout(idleTimer);if(frame)cancelAnimationFrame(frame);frame=0;idleTimer=0;last=0;}

enter.addEventListener('click',()=>walk(true));
$('open-settings').addEventListener('click',openSettings);
$('close-settings').addEventListener('click',()=>closeSettings());
settings.addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
for(const option of qualityInputs){
  const choose=()=>{if(!explicitQuality||quality!==option.value)applyQuality(option.value,true);};
  option.addEventListener('change',choose);
  option.addEventListener('click',choose);
}
$('index').addEventListener('click',e=>openPanel('map',undefined,e.currentTarget));
root.addEventListener('click',e=>{
  const link=e.target.closest('[data-open-folio]');
  if(link&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openPanel(link.dataset.openFolio,undefined,link);}
});
$('close').addEventListener('click',()=>closePanel());
dialog.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
dialog.addEventListener('click',e=>{
  if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}
});
interact.addEventListener('click',use);
$('leave-optic').addEventListener('click',()=>walk(true));$('pause-touch').addEventListener('click',pause);
$('optic-menu').addEventListener('click',()=>opticControls(true));
$('resume-optic').addEventListener('click',()=>opticControls(false));
for(const button of optics.querySelectorAll('[data-power]'))button.addEventListener('click',()=>setPower(Number(button.dataset.power)));
canvas.addEventListener('wheel',e=>{
  if(mode==='optics'&&e.deltaY){e.preventDefault();setPower(e.deltaY<0?5:3);}
},{passive:false});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){
    if(!aiming()||!foreground||!wantsLock){releaseLock();return;}
    locked=true;root.dataset.locked='';drag=null;input.acquired(performance.now());
  }else{
    const lost=locked&&aiming();locked=false;delete root.dataset.locked;input.reset();
    if(lost&&mode==='optics'){nativeLensEscape=performance.now();leaveSightUnlocked();}
    else if(lost)pause();
  }
});
document.addEventListener('mousemove',e=>{
  if(locked&&document.pointerLockElement===canvas)look(e.movementX,e.movementY,true);
});
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||drag)return;
  if(mode==='arrival'){walk(e.pointerType==='mouse');return;}
  if(mode!=='walk'&&mode!=='optics')return;
  if(mode==='optics'&&opticUi==='controls'){opticControls(false);return;}
  if(locked&&document.pointerLockElement===canvas){if(mode==='walk')use();return;}
  drag=beginDrag(e);canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id||document.pointerLockElement===canvas)return;
  const [dx,dy]=moveDrag(drag,e);look(dx,dy);
});
canvas.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const [dx,dy]=moveDrag(drag,e);look(dx,dy);
  const tap=drag.distance<(e.pointerType==='touch'?8:5);drag=null;
  if(mode==='walk'&&tap){if(focusedObject(pose))use();else if(e.pointerType==='mouse')lock();}
  else if(mode==='optics'&&tap&&e.pointerType==='mouse')lock();
});
function cancelDrag(e){if(drag?.id===e.pointerId)drag=null;}
canvas.addEventListener('pointercancel',cancelDrag);canvas.addEventListener('lostpointercapture',cancelDrag);
function stickMove(e){
  if(e.pointerId!==stick)return;
  const r=joy.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
  const radius=Math.max(r.width*.36,Math.hypot(x,y));stickX=x/radius;stickY=-y/radius;
  joy.firstElementChild.style.transform='translate('+stickX*23+'px,'+-stickY*23+'px)';
}
joy.addEventListener('pointerdown',e=>{if(stick!==null)return;stick=e.pointerId;joy.setPointerCapture(stick);stickMove(e);});
joy.addEventListener('pointermove',stickMove);
function releaseStick(e){if(stick===e.pointerId){stick=null;stickX=0;stickY=0;joy.firstElementChild.style.transform='';}}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(ev,releaseStick);
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||mode==='panel')return;
  if(e.code==='KeyG'&&!e.repeat){e.preventDefault();if(settings.open)closeSettings();else openSettings();return;}
  if(settings.open)return;
  if(e.code==='KeyM'&&!e.repeat){e.preventDefault();openPanel('map');return;}
  if(mode==='arrival')return;
  if(e.code==='Escape'){
    e.preventDefault();if(e.repeat)return;
    if(mode==='optics')leaveSightUnlocked();
    else if(performance.now()-nativeLensEscape>160)pause();
    return;
  }
  if(mode==='optics'){
    if(e.code==='Tab'&&opticUi==='aim'){e.preventDefault();opticControls(true);return;}
    if(e.code==='KeyP'&&!e.repeat){e.preventDefault();openPanel('projects');return;}
    if(e.code==='KeyE'&&!e.repeat){e.preventDefault();walk(true);}
    if(['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(e.code)){e.preventDefault();setPower(['Equal','NumpadAdd'].includes(e.code)?5:3);}
    if(e.code.startsWith('Arrow')){e.preventDefault();look((Number(e.code==='ArrowRight')-Number(e.code==='ArrowLeft'))*30,(Number(e.code==='ArrowDown')-Number(e.code==='ArrowUp'))*30);}
    return;
  }
  if(e.code==='Tab'&&locked){e.preventDefault();openPanel('map');return;}
  if(['KeyE','Enter','Space'].includes(e.code)&&!e.repeat&&(e.target===canvas||e.target===document.body)){e.preventDefault();use();return;}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowDown','ArrowUp','PageUp','PageDown','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{foreground=false;clearInput();stopFrames();});
window.addEventListener('focus',()=>{foreground=true;clearInput();last=0;if(locked)input.acquired(performance.now());schedule();});
window.addEventListener('pagehide',remember);
document.addEventListener('visibilitychange',()=>{
  clearInput();last=0;if(document.hidden){remember();stopFrames();}
  else {if(locked)input.acquired(performance.now());schedule();}
});
motionPreference.addEventListener('change',e=>{reduced=e.matches;transition=null;last=0;schedule();});
window.addEventListener('resize',()=>{signs.resize();world?.resize(lensVisible());if(world&&(mode==='panel'||settings.open))world.render(clock);else schedule();});
function fallback(){
  failed=true;pendingWalk=false;delete root.dataset.ready;clearInput();
  if(mode!=='panel')change('arrival');
  enter.querySelector('span').textContent=t('打开站点目录','Open the site index');
  $('load-status').textContent=t('可通过目录阅读全部内容。','All sections are available through the index.');
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();world=null;fallback();});
async function start(){
  try{
    const {makeWorld}=await import('./world.js');
    const bookTitles=Array.from(dialog.querySelectorAll('[data-bound]'),link=>link.textContent);
    world=await makeWorld(canvas,root.dataset.assets,en,bookTitles,quality);world.setQuality(quality,lensVisible());
    draw(0,performance.now());root.dataset.ready='true';
    if(pendingWalk)walk(false);else schedule();
  }catch(error){console.error('Observatory could not open',error);world=null;fallback();}
}
readLocation();requestAnimationFrame(start);
