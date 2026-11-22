const selectors={blog:'.article-body',projects:'.project-list',cv:'.cv-document'};
const archive=window.meridianArchive;
const online=archive?'https://logic61.github.io':location.origin;
const pathKey=url=>decodeURIComponent(url.pathname).replace(/\/+$/,'');
const urlFor=path=>new URL(path,online);

async function inflate(encoded){
  const bytes=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

async function readContent(section,url,signal){
  if(archive){
    const packed=archive.documents[pathKey(url)];
    if(!packed)throw new Error('Missing folio');
    return inflate(packed);
  }
  const response=await fetch(url.href,{signal});
  if(!response.ok)throw new Error('Unavailable folio');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const fragment=doc.querySelector(selectors[section]);
  if(!fragment)throw new Error('Missing folio');
  for(const use of fragment.querySelectorAll('svg[data-icon] use[href^="#"]')){
    const symbol=doc.getElementById(use.getAttribute('href').slice(1));
    if(symbol&&!fragment.contains(symbol))use.before(symbol.cloneNode(true));
  }
  return fragment.innerHTML;
}

export function makeFolio(dialog,t,onLocation,onGuide){
  const $=s=>dialog.querySelector(s);
  const list=[...dialog.querySelectorAll('[data-article]')], byPath=new Map(list.map(a=>[pathKey(urlFor(a.getAttribute('href'))),a]));
  for(const a of list)if(a.dataset.alias)byPath.set(pathKey(urlFor(a.dataset.alias)),a);
  const prefix=dialog.dataset.prefix,reading=$('#folio-reading'),body=$('#folio-body'),manuscript=$('.manuscript');
  const sections={cv:t('个人履历','Curriculum vitae'),projects:t('项目手记','Project folio')};
  let selected=list[0],current=null,request=null,loaded=false;
  const positions=new Map();
  function catalogue(open){
    manuscript.dataset.catalogue=open?'open':'closed';
    $('#show-contents').setAttribute('aria-expanded',String(open));
    if(open)$('#find-writing').focus({preventScroll:true});
  }
  function filter(){
    const query=$('#find-writing').value.trim().toLocaleLowerCase(),cat=$('#category').value;
    let shown=0;
    for(const a of list){a.hidden=!!((cat&&a.dataset.category!==cat)||!a.textContent.toLocaleLowerCase().includes(query));if(!a.hidden)shown++;}
    $('#empty-catalogue').hidden=shown!==0;
  }
  $('#find-writing').addEventListener('input',filter);
  $('#category').addEventListener('change',filter);
  $('#show-contents').addEventListener('click',()=>catalogue(true));
  $('#hide-contents').addEventListener('click',()=>{catalogue(false);reading.focus({preventScroll:true});});

  function jump(hash){
    if(!hash)return;
    let id;try{id=decodeURIComponent(hash.replace(/^#/,''));}catch{return;}
    const entry=document.getElementById(id);
    if(entry&&body.contains(entry))reading.scrollTop+=entry.getBoundingClientRect().top-reading.getBoundingClientRect().top-20;
  }
  function links(url){
    for(const el of body.querySelectorAll('script,iframe,base'))el.remove();
    for(const img of body.querySelectorAll('img[src]')){
      const src=new URL(img.getAttribute('src'),url);
      img.src=archive?.assets[pathKey(src)]||src.href;
      if(archive)img.removeAttribute('srcset');
    }
    for(const a of body.querySelectorAll('a[href]')){
      const value=a.getAttribute('href');
      if(value.startsWith('#'))continue;
      const target=new URL(value,url);
      const asset=target.origin===online&&archive?.assets[pathKey(target)];
      if(asset){a.href=asset;if(a.hasAttribute('download'))a.download=target.pathname.split('/').pop();}
      else a.href=target.href;
    }
  }
  function adjacent(el,other,label){
    el.hidden=!other;
    if(other){el.textContent=label+' · '+other.textContent.trim();el.onclick=()=>{show('blog',other);reading.focus({preventScroll:true});};}
  }
  async function show(section,entry,hash=''){
    if(!['blog','projects','cv','map'].includes(section))section='map';
    if(typeof entry==='string')entry=list.find(a=>a.dataset.slug===entry);
    if(section==='blog'&&entry)selected=entry;
    if(section==='blog'&&!selected)section='map';
    const url=urlFor(section==='blog'?selected.getAttribute('href'):prefix+'/'+section+'/');
    const key=pathKey(url);
    catalogue(false);
    if(current===key&&loaded){
      if(hash)jump(hash);
      onLocation(section,section==='blog'?selected.dataset.slug:'');return;
    }
    if(current&&loaded)positions.set(current,reading.scrollTop);
    request?.abort();const controller=new AbortController();request=controller;current=key;loaded=false;
    dialog.dataset.tab=section;
    for(const tab of dialog.querySelectorAll('.folio-bar [data-section-link]')){
      if(tab.dataset.sectionLink===section)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
    }
    $('#folio-document').hidden=section==='map';$('#folio-map').hidden=section!=='map';
    $('#reading-neighbours').hidden=true;reading.scrollTop=0;body.replaceChildren();
    onLocation(section,section==='blog'?selected.dataset.slug:'');
    if(section==='map'){reading.removeAttribute('aria-busy');loaded=true;return;}
    const blog=section==='blog';
    $('#rubric').textContent=blog?(selected.dataset.category||t('藏书架','Writing')):section==='projects'?t('黄铜望远镜','The refractor'):t('手稿桌','The writing desk');
    $('#reading-title').textContent=blog?selected.textContent.trim():sections[section];
    $('#byline').textContent=blog?[selected.dataset.author,selected.dataset.date].filter(Boolean).join('  ·  '):'';
    if(blog){for(const a of list){if(a===selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
    reading.setAttribute('aria-busy','true');body.textContent=t('正在展开手稿…','Unrolling the manuscript…');
    try{
      const html=await readContent(section,url,controller.signal);
      if(controller.signal.aborted)return;
      body.innerHTML=html;links(url);
      if(blog){
        const i=list.indexOf(selected);
        adjacent($('#newer'),list[i-1],t('上一篇','Newer'));
        adjacent($('#older'),list[i+1],t('下一篇','Older'));$('#reading-neighbours').hidden=list.length<2;
      }
      reading.scrollTop=positions.get(key)||0;
      if(hash)jump(hash);
      loaded=true;
    }catch(err){
      if(controller.signal.aborted)return;
      const p=document.createElement('p'),retry=document.createElement('button'),link=document.createElement('a');
      p.textContent=t('这份手稿暂时没有载入。','This manuscript could not be loaded.');
      retry.textContent=t('重新展开','Try again');retry.onclick=()=>show(section,selected,hash);
      link.textContent=t('打开原页','Open the original');link.href=url.href;link.target='_blank';link.rel='noopener';
      body.replaceChildren(p,retry,document.createTextNode('  ·  '),link);
    }finally{if(request===controller)reading.removeAttribute('aria-busy');}
  }
  dialog.addEventListener('click',e=>{
    if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
    const el=e.target.closest('[data-guide],[data-section-link],a');
    if(!el)return;
    if(el.dataset.guide){e.preventDefault();onGuide(el.dataset.guide);return;}
    if(el.dataset.sectionLink||el.hasAttribute('data-article')){
      e.preventDefault();show(el.dataset.sectionLink||'blog',el.hasAttribute('data-article')?el:undefined);
      if(el.closest('.folio-catalogue'))reading.focus({preventScroll:true});return;
    }
    if(!body.contains(el)||el.hasAttribute('download')||el.target==='_blank')return;
    const href=el.getAttribute('href');if(!href)return;
    if(href.startsWith('#')){e.preventDefault();jump(href);return;}
    const target=urlFor(href);if(target.origin!==online)return;
    const key=pathKey(target),article=byPath.get(key);
    if(article){e.preventDefault();show('blog',article,target.hash);return;}
    for(const section of ['blog','cv','projects'])if(key===prefix+'/'+section){e.preventDefault();show(section,undefined,target.hash);break;}
  });
  return {show,close(){if(current&&loaded)positions.set(current,reading.scrollTop);request?.abort();catalogue(false);}};
}
