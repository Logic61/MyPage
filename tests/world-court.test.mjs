import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import * as shapes from '../src/scripts/mountain-world/environment-geometry.ts';
import { createNavigation } from '../src/scripts/mountain-world/navigation.ts';

// Exercise the production geometry without a GPU. Only lettering and optional images need a DOM.
function loadModule(file, imports) {
  const source = fs.readFileSync(new URL('../src/scripts/mountain-world/'+file+'.ts',import.meta.url),'utf8')
    .replaceAll('import.meta.env?.BASE_URL', "'/MyPage/'");
  const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}, ink = new Proxy({}, { get:()=>()=>{} });
  vm.runInNewContext(code,{
    exports,require:id=>{ assert.ok(id in imports,id); return imports[id]; },
    document:{ createElement:()=>({getContext:()=>ink}) },
    Image:class { set src(_url) { this.onerror(); } },
  });
  return exports;
}
const three = {...THREE,TextureLoader:class { async loadAsync(){return new THREE.Texture();} }};
const roof = loadModule('tiled-roof',{three,'./environment-geometry':shapes});
const halls = loadModule('timber-halls',{three,'./tiled-roof':roof});
const { createStudyArchitecture } = loadModule('environment-design',{three,'./environment-geometry':shapes,'./timber-halls':halls});
const origin = {x:0,z:17.65};

test('entrance, hall and mirror-paired roofs share the built courtyard axis',async () => {
  const root=new THREE.Group(), site=createStudyArchitecture(root,{material:()=>new THREE.MeshStandardMaterial()},false);
  await site.ready;
  try {
    root.updateMatrixWorld(true);
    function bounds(name) {
      return root.getObjectsByProperty('name',name).map(group=>{
        const box=new THREE.Box3();
        for(const tile of group.getObjectsByProperty('name','Glazed pan and cover tiles'))
          box.expandByObject(tile,true);
        return box;
      });
    }
    for (const name of ['Southern mountain gate','North hall lower eaves','North hall upper roof']) {
      const [box]=bounds(name);
      assert.ok(Math.abs(box.min.x+box.max.x)<1e-4,name);
    }
    const pairs=[...['Covered hillside gallery','Six-sided cloud pavilion'].map(name=>bounds(name)),
      [...bounds('Library roof'),...bounds('Instrument hall roof')]];
    for (const pair of pairs) {
      assert.equal(pair.length,2);
      const [west,east]=pair.sort((a,b)=>a.min.x-b.min.x);
      assert.ok(Math.abs(west.max.x+east.min.x)<1e-4 && Math.abs(west.min.x+east.max.x)<1e-4);
      for (const axis of ['z','y']) for(const bound of ['min','max']) assert.ok(Math.abs(west[bound][axis]-east[bound][axis])<1e-4);
    }
    const nav=createNavigation(site.walkAreas,site.colliders);
    for(let z=origin.z;z>=-5.75;z-=.125) assert.ok(nav.canWalk(0,z),'Open axis at '+z);
    for(const side of [-1,1]) {
      assert.equal(nav.canWalk(side*1.72,-2),false,'Pool basin blocks walking');
      assert.ok(nav.clearLine({x:side*3.2,z:6.65},{x:side*8.7,z:6.65}),'A clear side gate beyond the planter');
      for(const end of [{x:side*10.18,z:3.10},{x:side*4.65,z:-3.2}]) {
        assert.ok(nav.canWalk(end.x,end.z));
        const path=nav.findPath(origin,end);
        assert.ok(path.length && Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<.01);
      }
    }
  } finally {
    site.dispose(); site.geometries.forEach(g=>g.dispose()); site.materials.forEach(m=>m.dispose());
    root.traverse(node=>{if(node.isInstancedMesh)node.dispose()});
  }
});
