import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {load} from 'cheerio';

const dist=path.resolve('dist'),require=createRequire(import.meta.url);
const destination=path.resolve(process.argv[2]||'.astro/exports/meridian-observatory.html');
const site=new URL('https://logic61.github.io');
const data=async(file,mime)=>'data:'+mime+';base64,'+(await fs.readFile(file)).toString('base64');
const pack=value=>gzipSync(value,{level:9}).toString('base64');
const normalize=url=>decodeURIComponent(url.pathname).replace(/\/+$/,'');
const resolve=href=>new URL(href,site);
const files={},documents={},art={},glyphs=new Map(),mathStyles=new Set();

const homes=await Promise.all(['index.html','en/index.html'].map(async filename=>load(await fs.readFile(path.join(dist,filename),'utf8'))));
const base=homes[0]('#observatory').attr('data-assets').replace(/\/meridian\/$/,'');
function filename(key){
  if(!key.startsWith(base+'/'))throw new Error('Outside Astro base '+key);
  return path.join(dist,key.slice(base.length+1));
}
async function embedAsset(url){
  const key=normalize(url);
  if(files[key])return;
  const mime={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf'}[path.extname(key)];
  if(!mime)throw new Error('Unknown document asset '+key);
  files[key]=await data(filename(key),mime);
}
function compressMath(html){
  const local=new Map();
  html=html.replace(/<path id="(MJX-[^"]+)" d="([^"]*)"><\/path>/g,(_,id,d)=>{
    if(!glyphs.has(d))glyphs.set(d,'folio-g'+glyphs.size);
    local.set(id,glyphs.get(d));return '';
  });
  return html.replace(/<defs><\/defs>/g,'').replace(/xlink:href="#(MJX-[^"]+)"/g,(_,id)=>{
    if(!local.has(id))throw new Error('Unresolved formula glyph '+id);
    return 'xlink:href="#'+local.get(id)+'"';
  }).replace(/<style>(\s*mjx-container\[jax="SVG"\][\s\S]*?)<\/style>/g,(_,style)=>{mathStyles.add(style);return '';});
}
async function addDocument(href,selector){
  const url=resolve(href),key=normalize(url);
  if(documents[key])return;
  const $=load(await fs.readFile(path.join(filename(key),'index.html'),'utf8'));
  const fragment=$(selector).first();
  if(!fragment.length)throw new Error('No manuscript at '+href);
  for(const img of fragment.find('img[src]').toArray()){
    const src=new URL($(img).attr('src'),url);
    if(src.origin===site.origin)await embedAsset(src);
  }
  for(const link of fragment.find('a[download]').toArray())await embedAsset(new URL($(link).attr('href'),url));
  for(const use of fragment.find('svg[data-icon] use').toArray()){
    const id=$(use).attr('href')?.slice(1);
    if(id&&!fragment.find('[id]').toArray().some(el=>el.attribs.id===id)){
      const symbol=$('symbol').toArray().find(el=>el.attribs.id===id);
      if(symbol)$(use).before($(symbol).clone());
    }
  }
  documents[key]=pack(compressMath(fragment.html()));
}
const main=[];
for(const [i,$] of homes.entries()){
  for(const a of $('[data-article]').toArray())await addDocument($(a).attr('href'),'.article-body');
  const prefix=$('#folio').attr('data-prefix');
  await addDocument(prefix+'/cv/','.cv-document');await addDocument(prefix+'/projects/','.project-list');
  const home=$('#observatory');
  home.find('script').remove();home.find('#arrival-photo').removeAttr('src');
  // Preserve the canonical destination for modified clicks and for script-disabled links.
  home.find('a[href^="/"]').each((_,el)=>$(el).attr('href',resolve($(el).attr('href')).href));
  home.find('#language').attr('href','?lang='+(i?'zh':'en'));main.push($.html(home));
}
const textureDir=path.join(dist,'meridian');
for(const file of await fs.readdir(textureDir))if(file.endsWith('.webp'))art[file]=await data(path.join(textureDir,file),'image/webp');
const font=path.join(path.dirname(require.resolve('@fontsource-variable/eb-garamond')),'files/eb-garamond-latin-wght-normal.woff2');
const css=(await fs.readFile('src/styles/meridian.css','utf8')).replace(/^@import[^;]+;/,'@font-face{font-family:"EB Garamond Variable";font-weight:400 800;font-display:swap;src:url("'+await data(font,'font/woff2')+'") format("woff2")}')+
  await fs.readFile('src/styles/meridian-folio.css','utf8')+[...mathStyles].join('\n');
const bundle=await build({stdin:{contents:"import {DefaultLoadingManager} from 'three';DefaultLoadingManager.setURLModifier(url=>window.meridianArt[url.split('/').pop()]||url);import('./src/scripts/meridian/visit.js');",resolveDir:process.cwd()},bundle:true,format:'iife',minify:true,write:false,target:'es2022',legalComments:'inline'});
const defs='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute;pointer-events:none"><defs>'+
  [...glyphs].map(([d,id])=>'<path id="'+id+'" d="'+d+'"/>').join('')+'</defs></svg>';
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const boot='if(new URLSearchParams(location.search).get("lang")==="en"){document.documentElement.lang="en";document.title="Meridian Observatory · Shane Lorien";document.querySelector("main").replaceWith(document.querySelector("#english").content.cloneNode(true));}document.querySelector("#english").remove();window.meridianArt='+json(art)+';window.meridianArchive='+json({documents,assets:files})+';document.getElementById("arrival-photo").src=window.meridianArt["arrival.webp"];';
const legal=await fs.readFile(path.join(textureDir,'CREDITS.txt'),'utf8');
const output='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>子午观象台 · Shane Lorien</title><style>'+css+'</style></head><body>'+main[0]+'<template id="english">'+main[1]+'</template>'+defs+'<script>'+boot+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script><!-- '+legal+' --></body></html>';
await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,output);
console.log(destination,Buffer.byteLength(output)+' bytes;',Object.keys(documents).length+' manuscripts,',Object.keys(files).length+' document assets,',glyphs.size+' shared formula glyphs.');
