import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary } from './materials';
import { branchGeometry, mistTexture, naturalRock, roundedBlock, seeded } from './environment-geometry';
import { bambooWind, buildBamboo } from './bamboo';
import { cliffGarden, cliffSpurs, cragFace, mountainRunoff, plantingSoil } from './cliff-garden';
import { buildCliffCrossings } from './cliff-crossings';
import { branchWind, buildPines } from './pine-grove';
import { createStudyArchitecture } from './environment-design';
import { COURTYARD_POOL } from './water-court';
import type { Collider, Environment } from './types';

/** A bright, inhabited mountain courtyard on a continuous level walking plane. */
export function createEnvironment(scene: THREE.Scene, surfaces?: SurfaceLibrary, en = false): Environment {
  const library = surfaces ?? createSurfaceLibrary();
  const ownsLibrary = !surfaces;
  const root = new THREE.Group(); root.name = 'Cloud courtyard — first-person environment'; scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), localTextures = new Set<THREE.Texture>();
  const colliders: Collider[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const own = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const rng = seeded(23877);
  const stone = own(library.material('stone', { worldScale: .58, normalScale: .7 }));
  const darkStone = own(library.material('darkStone', { worldScale: .43, normalScale: .75 }));
  const cutStone = own(library.material('stone', { worldScale: .82, normalScale: .45, roughness: .88 }));
  const earth = own(library.material('ground', { worldScale: .55, normalScale: .55 }));
  const projectEarth = earth.onBeforeCompile;
  earth.onBeforeCompile = (shader, renderer) => {
    projectEarth.call(earth,shader,renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = vSurfaceWorldPosition.xz;
      float patches = .5 + .22*sin(.85*p.x + sin(.52*p.y)) + .18*cos(1.25*p.y-.54*p.x) + .10*sin(3.2*p.x+2.8*p.y);
      diffuseColor.rgb *= mix(vec3(.51,.67,.36),vec3(1.07,.94,.76),smoothstep(.16,.84,patches));
    `);
  };
  earth.customProgramCacheKey = () => 'courtyard-granite-and-turf';
  const wood = own(library.material('wood', { repeat: [1, 1.35], normalScale: .45 }));
  const bark = own(library.material('bark', { repeat: [1.7, 1], normalScale: .85 }));
  const moss = own(library.material('moss', { worldScale: 1.1, normalScale: .4 }));
  const fernMaterial = own(new THREE.MeshStandardMaterial({ color: '#596e4c', roughness: .95, side: THREE.DoubleSide }));
  const block = keep(roundedBlock()), cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const mossRock = keep(naturalRock(12));
  const smallRock = keep(naturalRock(31, 1));
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();

  interface Placed { x: number; y: number; z: number; sx: number; sy: number; sz: number; rx?: number; ry?: number; rz?: number; color?: THREE.Color; }
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = root) {
    const result = new THREE.Mesh(g, m); result.position.set(x, y, z); result.scale.set(sx, sy, sz);
    result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
  }
  function batch(g: THREE.BufferGeometry, m: THREE.Material, instances: Placed[], name: string, parent: THREE.Object3D = root) {
    const result = new THREE.InstancedMesh(g, m, instances.length); result.name = name;
    instances.forEach((item, i) => {
      quat.setFromEuler(new THREE.Euler(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0));
      matrix.compose(vector.set(item.x, item.y, item.z), quat, scale.set(item.sx, item.sy, item.sz)); result.setMatrixAt(i, matrix);
      if (item.color) result.setColorAt(i, item.color);
    });
    result.instanceMatrix.needsUpdate = true; if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.castShadow = true; result.receiveShadow = true; result.computeBoundingSphere(); parent.add(result); return result;
  }
  function obstacle(x: number, z: number, halfX: number, halfZ: number) { colliders.push({ x, z, halfX, halfZ }); }
  function branch(points: THREE.Vector3[], start: number, end: number, m: THREE.Material = bark) {
    return mesh(keep(branchGeometry(points, start, end, 12, 12)), m);
  }
  function timber(a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material = wood) {
    return branch([a, a.clone().lerp(b, .5), b], radius, radius * .93, m);
  }

  // The ledge grows into a mountainside below the mist, rather than tapering into a floating toy island.
  const outline = [[-14.5, -11.7], [-7.8, -14.2], [.2, -13.2], [8.7, -12.4], [13.7, -8.4], [15, -1.2], [14.1, 8.3], [10.7, 12], [5.5, 14.4], [3.6, 17.1], [-1.1, 17.9], [-5.1, 15.1], [-11.4, 12], [-14.9, 6.1], [-16, -.8]];
  const granite = own(library.material('stone', { worldScale: .28, normalScale: .63, roughness: .86 }));
  granite.vertexColors = true;
  for (const rock of [granite,darkStone]) {
    const projectStone = rock.onBeforeCompile;
    rock.onBeforeCompile = (shader,renderer) => {
      projectStone.call(rock,shader,renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
        #include <fog_fragment>
        float cloudDepth = -vSurfaceWorldPosition.y + 1.4*sin(vSurfaceWorldPosition.x*.51) + .8*cos(vSurfaceWorldPosition.z*.76);
        float veil = smoothstep(3.6,17.5,cloudDepth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(.84,.87,.87), veil*.92);
        float dither = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        if (smoothstep(13.,23.,cloudDepth) > dither) discard;
      `);
    };
    rock.customProgramCacheKey = () => 'courtyard-granite-in-cloud';
  }
  let disposed = false;
  const assetRoot = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '');
  const graniteFaces = [granite,darkStone];
  const graniteReady = new THREE.TextureLoader().loadAsync(assetRoot + '/world/cloud-pass-granite.webp').then(texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
    localTextures.add(texture);
    for (const face of graniteFaces) { face.map = texture; face.needsUpdate = true; }
  }).catch(() => { /* The procedural stone is already visible. */ });
  mesh(keep(cragFace(outline)), granite).castShadow = false;
  const ledges = cliffSpurs(outline);
  mesh(keep(ledges.rock), granite).castShadow = false;
  mesh(keep(plantingSoil()), moss).castShadow = false;
  const reeds = own(new THREE.MeshStandardMaterial({vertexColors: true, side: THREE.DoubleSide, roughness: .9}));
  mesh(keep(cliffGarden(ledges.spurs)), reeds).castShadow = false;
  const fall = mountainRunoff();
  const cascade = mesh(keep(fall.geometry), own(fall.material));
  cascade.castShadow = cascade.receiveShadow = false;
  cascade.userData.dynamic = cascade.userData.ignoreInteractionRay = cascade.userData.ignoreAmbientOcclusion = true;
  const groundShape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const {x0,x1,z0,z1}=COURTYARD_POOL, hole=new THREE.Path();
  hole.moveTo(x0-.015,-z0+.015); hole.lineTo(x1+.015,-z0+.015);
  hole.lineTo(x1+.015,-z1-.015); hole.lineTo(x0-.015,-z1-.015); hole.closePath();
  groundShape.holes.push(hole);
  const ground = mesh(keep(new THREE.ShapeGeometry(groundShape)), earth, 0, .284, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;

  // Small fractured stones, moss islands and grass sit at edges, not across the path.
  const rubble: Placed[] = [], growth: Placed[] = [];
  for (const [cx, cz, radius] of [[-13.7, 6.7, 1.4], [-13.6, -.7, 1.0], [-7.2, 10.8, 1.3], [11.9, 10, 1.2], [9.4, -10.2, .9]]) {
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * radius;
      rubble.push({ x: cx + Math.cos(a) * d, y: .29, z: cz + Math.sin(a) * d,
        sx: .055 + rng() * .14, sy: .035 + rng() * .09, sz: .065 + rng() * .14, ry: rng() * 6 });
    }
    for (let i = 0; i < 7; i++) growth.push({ x: cx + (rng() - .5) * radius, y: .285, z: cz + (rng() - .5) * radius,
      sx: .25 + rng() * .4, sy: .012, sz: .23 + rng() * .3, ry: rng() * 6 });
  }
  batch(smallRock, cutStone, rubble, 'Small fractured edge stones');
  batch(mossRock, moss, growth, 'Low moss islands').castShadow = false;

  // Timber veranda. Its outer carved-stone parapets meet the bridge railing at the pavilion gate.
  const architecture = createStudyArchitecture(root, library, en);
  graniteFaces.push(architecture.galleryStone);
  for (const side of [-1,1]) {
    mesh(cube, wood, side * 10.15, .111, .1, 5.65, .36, 16.4);
    architecture.floors.boards(root,{x0:side*10.15-2.79,x1:side*10.15+2.79,z0:-8.08,z1:8.29},true);
    architecture.floors.pavilion(root,side*10.18,4.92);
    for (const z of [-6.3, -.2, 6.4]) {
      timber(new THREE.Vector3(side * 9.8, -2.4, z), new THREE.Vector3(side * 12.62, -.12, z), .105);
      mesh(block, wood, side * 11, -.17, z, 4.1, .28, .22);
    }
  }

  buildCliffCrossings(root, library, { stone, darkStone }, colliders, keep, own, architecture.floors);

  const windTime = { value: 0 };
  const pines = buildPines(root, bark, colliders, windTime, keep, texture => localTextures.add(texture));
  own(pines.material);

  // Slender bamboo and small ferns occupy the western rock edge only.
  const bamboo = buildBamboo(rng);
  const culms = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .57 }));
  const blades = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .79, side: THREE.DoubleSide }));
  for (const [geometry, material, name] of [[bamboo.stems, culms, 'Jointed bamboo culms and twigs'], [bamboo.leaves, blades, 'Folded bamboo foliage']] as const) {
    bambooWind(material, windTime);
    const plant = mesh(keep(geometry), material);
    plant.name = name; plant.userData.dynamic = true;
  }
  obstacle(-13.7, -.75, .72, 1.38);
  const leafShape = keep(new THREE.BufferGeometry());
  leafShape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.07, .012, .24, 0, .025, .58, 0, 0, 0, 0, .025, .58, .055, -.006, .24], 3));
  leafShape.setAttribute('uv', new THREE.Float32BufferAttribute([.5, 0, 0, .45, .5, 1, .5, 0, .5, 1, 1, .45], 2)); leafShape.computeVertexNormals();
  branchWind(fernMaterial, windTime, 'y', .065);
  const ferns: Placed[] = [];
  for (const [x, z] of [[-13.6, 6.8], [-13.1, 6.2], [-13.4, -.1], [11.8, 9.4]]) for (let j = 0; j < 12; j++)
    ferns.push({ x, y: .3, z, sx: .6, sy: .7, sz: .7, ry: j * Math.PI / 6, rx: -.8 + (j % 3) * .1 });
  batch(leafShape, fernMaterial, ferns, 'Low edge ferns');

  // The distant mountains belong to the generated landscape backdrop, not opaque polygon rings.
  const mistMap = mistTexture(); localTextures.add(mistMap);
  const clouds = Array.from({ length: 20 }, (_, i) => {
    // Five isolated wisps pass in front of the distant ridges at a standing visitor's eye line.
    const distant = i >= 15, high = i % 3 === 0 || distant;
    const angle = distant ? (i-15)*Math.PI*.4 + .22*Math.sin(i) : i/15*Math.PI*2;
    const radius = distant ? 53 : 22;
    const x = Math.cos(angle) * (radius + rng()*6), z = Math.sin(angle) * (radius + rng()*5);
    const y = distant ? 6 + rng()*4.2 : high ? -.7 - rng()*1.25 : -3.6 - rng()*4.2;
    const width = (distant ? 22 : high ? 17 : 23) + rng()*8, height = (high ? 3.6 : 5.8) + rng()*1.8;
    const opacity = distant ? .40 : high ? .47 : .64;
    const material = own(new THREE.SpriteMaterial({ map: mistMap, color: high ? '#fffcf3' : '#dbe9ed',
      opacity, transparent: true, depthWrite: false, fog: true }));
    const sprite = new THREE.Sprite(material);
    sprite.name = high ? 'High cliff wisp' : 'Low valley mist'; sprite.userData.ignoreInteractionRay = true;
    sprite.userData.ignoreAmbientOcclusion = true;
    sprite.position.set(x, y, z); sprite.scale.set(width, height, 1); root.add(sprite);
    return { sprite, x, y, z, width, height, opacity, travel: distant ? 9 : high ? 4.5 : 8.6, phase: rng() * Math.PI * 2 };
  });
  const dustGeometry = keep(new THREE.BufferGeometry()), dust = new Float32Array(38 * 3), origins: number[] = [];
  // The outer landings stand beyond the main island's mist belt. Wisps cross their lower flanks.
  for (const [x,y,z,width,phase] of [
    [-4,-6.8,32,17,.8],[3,-10.4,38,21,3.7],[5,-4.9,33,11,5.1],
    [23,-5.5,9,16,2.8],[29,-8.3,3,18,1.5],[5,-8.5,17,20,4.1],
  ]) {
    const opacity=.54, height=width*.33;
    const material=own(new THREE.SpriteMaterial({map:mistMap,color:'#e9e9df',opacity,transparent:true,depthWrite:false}));
    const sprite=new THREE.Sprite(material); sprite.name='Mist on the granite shoulder';
    sprite.userData.ignoreInteractionRay=sprite.userData.ignoreAmbientOcclusion=true;
    sprite.position.set(x,y,z); sprite.scale.set(width,height,1); root.add(sprite);
    clouds.push({sprite,x,y,z,width,height,opacity,travel:3.4,phase});
  }
  for (let i = 0; i < 38; i++) { const x = (rng() - .5) * 5.7, y = .7 + rng() * 3.5, z = -5.5 + rng() * 6.5; dust.set([x, y, z], i * 3); origins.push(x, y, z, rng() * 6); }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustPoints = new THREE.Points(dustGeometry, own(new THREE.PointsMaterial({ size: .017, color: '#e8d4ad', transparent: true, opacity: .37, depthWrite: false }))); root.add(dustPoints);

  const walkAreas = architecture.walkAreas;
  architecture.geometries.forEach(geometry => geometries.add(geometry));
  architecture.materials.forEach(material => materials.add(material));
  colliders.push(...architecture.colliders);
  mergeStatic();
  // A shallow swept wing, shaped in plan, hinges on the long axis of the body.
  const feathers = keep(new THREE.BufferGeometry());
  feathers.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,.22,  .49,.09,.12,  .66,.055,-.14,
    0,0,.22,  .66,.055,-.14,  0,0,-.18,
    .49,.09,.12,  1.16,.035,-.32,  .66,.055,-.14,
  ],3));
  feathers.computeVertexNormals();
  const plumage = own(new THREE.MeshBasicMaterial({color:'#46575b',side:THREE.DoubleSide}));
  const breast = keep(new THREE.SphereGeometry(1,8,6));
  const flights = [
    { count: 3, phase: -.1, radius: 42, height: 13.5 },
    { count: 2, phase: 2.0, radius: 46, height: 15 },
    { count: 3, phase: 4.1, radius: 44, height: 14 },
  ];
  const birds = flights.flatMap(({count, phase, radius, height}, flightIndex) => Array.from({length:count}, (_,i) => {
    const bird=new THREE.Group(), body=new THREE.Mesh(breast,plumage);
    body.scale.set(.095,.085,.43); bird.add(body);
    const wings=[-1,1].map(side=>{
      const wing=new THREE.Mesh(feathers,plumage); wing.scale.x=side; bird.add(wing); return wing;
    });
    bird.scale.setScalar(.49+.045*((i+flightIndex)%3)); root.add(bird);
    return {bird, wings, phase: phase+i*.044, radius: radius+i*.85, height: height+i*.22, beat: i+flightIndex*2};
  }));
  return {
    root, colliders, overheads: architecture.overheads, walkAreas, outline, roofOccluders: [], assetsReady: Promise.all([architecture.ready,pines.ready,graniteReady]).then(() => {}),
    disturbWater: architecture.disturbWater,
    update(time, delta, _indoor, reducedMotion, eye) {
      birds.forEach(({bird,wings,phase,radius,height,beat})=>{
        const a=time*.091+phase;
        bird.position.set(Math.sin(a)*radius,height+.45*Math.sin(2*a+beat),-Math.cos(a)*radius);
        bird.rotation.set(0,Math.PI/2-a,.12*Math.sin(a+beat));
        const flap=.16+.48*Math.sin(time*5+beat)*Math.max(0,Math.sin(time*.68+beat*.9));
        wings[0].rotation.z=-flap; wings[1].rotation.z=flap;
      });
      architecture.update(time, delta, reducedMotion, eye);
      windTime.value = time;
      fall.time.value = time;
      for (const cloud of clouds) {
        const drift = Math.sin(time * .148 + cloud.phase), curl = Math.sin(time * .20 + cloud.phase * 2);
        cloud.sprite.position.set(cloud.x + drift * cloud.travel, cloud.y + curl * .54, cloud.z + drift * cloud.travel * .40);
        cloud.sprite.scale.set(cloud.width * (1 + .08 * curl), cloud.height * (1 - .12 * curl), 1);
        cloud.sprite.material.opacity = cloud.opacity * (.84 + .16 * Math.cos(time * .14 + cloud.phase));
      }
      for (let i = 0; i < 38; i++) { const j = i * 4; dust[i * 3] = origins[j] + Math.sin(time * .17 + origins[j + 3]) * .18; dust[i * 3 + 1] = origins[j + 1] + Math.sin(time * .25 + origins[j + 3]) * .13; }
      dustGeometry.attributes.position.needsUpdate = delta > 0;
    },
    dispose() {
      disposed = true;
      architecture.dispose(); pines.dispose();
      root.removeFromParent(); root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of localTextures) t.dispose();
      if (ownsLibrary) library.dispose(); root.clear();
    },
  };

  function mergeStatic() {
    root.updateWorldMatrix(true, true);
    type StaticMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const groups = new Map<string, StaticMesh[]>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
      for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
        if (ancestor.userData.dynamic) return;
      }
      // Keep the roof grids indexed. Adjacent tiles then reuse vertices in both the colour and the shadow pass.
      const key = [object.material.uuid, object.castShadow, object.receiveShadow, Boolean(object.geometry.index)].join(':');
      const list = groups.get(key);
      if (list) list.push(object);
      else groups.set(key, [object]);
    });

    function combine(sources: StaticMesh[]) {
      if (sources.length < 2) return;
      const { material, castShadow, receiveShadow } = sources[0];
      const copies = sources.map(source => {
        const copy = source.geometry.clone().applyMatrix4(source.matrixWorld);
        const count = copy.attributes.position.count;
        if (!copy.attributes.uv) copy.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
        if (material instanceof THREE.MeshStandardMaterial && material.vertexColors && !copy.attributes.color)
          copy.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
        for (const name of Object.keys(copy.attributes)) if (!['position', 'normal', 'uv', 'uv1', 'color'].includes(name)) copy.deleteAttribute(name);
        return copy;
      });
      const geometry = mergeGeometries(copies, false);
      copies.forEach(copy => copy.dispose());
      if (!geometry) return;
      sources.forEach(source => source.removeFromParent());
      const merged = mesh(keep(geometry), material);
      merged.name = `Static environment ${material.name || material.type}`;
      merged.castShadow = castShadow; merged.receiveShadow = receiveShadow;
    }

    const centre = new THREE.Vector3();
    for (const sources of groups.values()) {
      const triangles = sources.reduce((sum, {geometry}) => sum + (geometry.index?.count ?? geometry.attributes.position.count) / 3, 0);
      if (triangles < 36000 || sources.length < 2) {
        combine(sources);
        continue;
      }
      // Localise only triangle-heavy batches; small fittings still share a single draw.
      // Use the geometry centre because roof panels and pine limbs are modelled in site coordinates.
      const cells = new Map<string, StaticMesh[]>();
      for (const source of sources) {
        const geometry = source.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        centre.copy(geometry.boundingSphere!.center).applyMatrix4(source.matrixWorld);
        const key = `${Math.floor(centre.x / 10)},${Math.floor(centre.z / 10)}`;
        const cell = cells.get(key);
        if (cell) cell.push(source);
        else cells.set(key, [source]);
      }
      cells.forEach(combine);
    }
  }
}
