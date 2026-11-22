import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const up = new T.Vector3(0, 1, 0);
export const TAU = Math.PI * 2;

export function series(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function group(parent, x = 0, y = 0, z = 0) {
  const node = new T.Group();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

export function part(parent, geometry, material, x = 0, y = 0, z = 0, tint) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (tint !== undefined) mesh.userData.tint = tint;
  parent.add(mesh);
  return mesh;
}

export function box(parent, material, x, y, z, w, h, d, bevel = 0, tint) {
  const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel,w/3,h/3,d/3)) : new T.BoxGeometry(w,h,d);
  if (material.userData.tile) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    const tile = material.userData.tile;
    for (let i = 0; i < p.count; i++) {
      const u = Math.abs(n.getX(i)) > .65 ? p.getZ(i) : p.getX(i);
      const v = Math.abs(n.getY(i)) > .65 ? p.getZ(i) : p.getY(i);
      uv.setXY(i, u / tile + .137 * x, v / tile + .171 * z);
    }
  }
  return part(parent, geometry, material, x,y,z,tint);
}

export function cylinder(parent, material, x,y,z, top,bottom,height, segments = 32, tint) {
  return part(parent,new T.CylinderGeometry(top,bottom,height,segments),material,x,y,z,tint);
}

export function lathe(parent, material, profile, segments = 48) {
  return part(parent, new T.LatheGeometry(profile.map(([r,h]) => new T.Vector2(r,h)),segments),material);
}

export function rod(parent, material, a,b, radius, endRadius = radius, sides = 12) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b), delta = to.clone().sub(from);
  const obj = cylinder(parent,material,0,0,0,endRadius,radius,delta.length(),sides);
  obj.position.copy(from.add(to).multiplyScalar(.5));
  obj.quaternion.setFromUnitVectors(up,delta.normalize());
  return obj;
}

export function timber(parent, material, a,b, width,depth, bevel = .014) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b), delta = to.clone().sub(from);
  const obj = box(parent,material,0,0,0,width,delta.length(),depth,bevel);
  obj.position.copy(from.add(to).multiplyScalar(.5));
  obj.quaternion.setFromUnitVectors(up,delta.normalize());
  return obj;
}

export function ring(parent,material,x,y,z,r,tube, horizontal = true, segments = 64) {
  const mesh = part(parent,new T.TorusGeometry(r,tube,8,segments),material,x,y,z);
  if (horizontal) mesh.rotation.x = Math.PI/2;
  return mesh;
}

export function relief(parent,material,shape,depth,bevel = 0) {
  const geometry = new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:16});
  return part(parent,geometry,material);
}

export function paintedSurface(parent, canvas, x,y,z, width,height) {
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const mat = new T.MeshStandardMaterial({map:texture,roughness:.84,metalness:.02,side:T.DoubleSide});
  return part(parent,new T.PlaneGeometry(width,height),mat,x,y,z);
}

export function drawing(width,height,paint) {
  const canvas = document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  return canvas;
}

// Bake world transforms and tint into static meshes. All bindings and tiny
// brass graduations of the same material can then be rendered in one draw.
export function batch(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(obj => {
    if (!obj.isMesh) return;
    const src = obj.geometry;
    const geometry = src.index ? src.toNonIndexed() : src.clone();
    geometry.applyMatrix4(obj.matrixWorld);
    geometry.clearGroups();
    const count = geometry.attributes.position.count;
    const col = new T.Color(obj.userData.tint ?? 0xffffff);
    const colors = new Float32Array(count * 3);
    for (let i=0; i<count; i++) col.toArray(colors,i*3);
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    obj.material.vertexColors = true;
    if (!buckets.has(obj.material)) buckets.set(obj.material,[]);
    buckets.get(obj.material).push(geometry);
    src.dispose();
  });
  const result = new T.Group();
  for (const [material,geometries] of buckets) {
    const geometry = mergeGeometries(geometries);
    const mesh = new T.Mesh(geometry,material);
    mesh.castShadow = !material.transparent && !material.userData.noCast;
    mesh.receiveShadow = true;
    geometry.computeBoundingSphere();
    result.add(mesh);
    for (const item of geometries) item.dispose();
  }
  return result;
}

export async function materials(base, renderer) {
  const loader = new T.TextureLoader(), maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  async function scan(name) {
    const [map,normalMap,roughnessMap] = await Promise.all(['color','normal','rough'].map(async channel => {
      const tex = await loader.loadAsync(base + name + '-' + channel + '.webp');
      tex.wrapS=tex.wrapT=T.RepeatWrapping; tex.anisotropy=maxAnisotropy;
      if (channel==='color') tex.colorSpace=T.SRGBColorSpace;
      return tex;
    }));
    return {map,normalMap,roughnessMap};
  }
  const [stone,wood,plaster,enamel,paving,brassMap,brassRoughness,sky] = await Promise.all([
    scan('stone'),scan('timber'),scan('plaster'),scan('enamel'),scan('paving'),
    loader.loadAsync(base+'brass-color.webp'),loader.loadAsync(base+'brass-rough.webp'),loader.loadAsync(base+'sunrise.webp')
  ]);
  brassMap.colorSpace=T.SRGBColorSpace;
  for(const tex of [brassMap,brassRoughness]) {tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=maxAnisotropy;}
  sky.mapping=T.EquirectangularReflectionMapping; sky.colorSpace=T.SRGBColorSpace;
  function surface(color,roughness,metalness=0,extra={},tile=0) {
    const m = new T.MeshStandardMaterial({color,roughness,metalness,...extra});
    m.userData.tile=tile;
    return m;
  }
  const m = {
    stone:surface(0xa79b87,.96,0,stone,1.4), trim:surface(0xdbccb3,.96,0,stone,1.22),
    slab:surface(0x939c98,.98,.02,stone,1.7), paving:surface(0xb8c0ba,.94,0,paving,3.6),joints:surface(0x373b34,.93),
    plaster:surface(0xb6a481,.93,0,plaster,2.1), wood:surface(0x9e7a53,.77,.02,wood,1.2),
    darkwood:surface(0x765c43,.76,.01,wood,1.3), iron:surface(0x3c4541,.65,.68,{roughnessMap:enamel.roughnessMap}),
    brass:surface(0xffe5b5,.8,.76,{map:brassMap,roughnessMap:brassRoughness,envMapIntensity:1.22}),
    gold:surface(0xe7c588,.47,.76), bronze:surface(0xa48b68,.9,.64,{map:brassMap,roughnessMap:brassRoughness}),
    enamel:surface(0xe2e9df,.8,.38,enamel), roof:surface(0x526c67,.8,.35,enamel,2),
    lens:surface(0x294e56,.14,.73,{envMapIntensity:1.8}),
    leather:surface(0xffffff,.82,.02,{roughnessMap:wood.roughnessMap}),
    pages:surface(0xd6bd8f,.93), ink:surface(0x252e29,.8), fabric:surface(0x486052,.89),
    lamp:surface(0xffe1a5,.45,.05,{emissive:0xffb251,emissiveIntensity:3})
  };
  m.trim.normalScale.setScalar(.55); m.enamel.normalScale.setScalar(.35); m.wood.normalScale.setScalar(.55);
  return {m,sky};
}
