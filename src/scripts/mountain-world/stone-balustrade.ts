import * as THREE from 'three';

type PlanPoint = readonly [number, number];
type OwnGeometry = (geometry: THREE.BufferGeometry) => THREE.BufferGeometry;

/** A cross section swept through one two-metre bay. All dimensions are in metres. */
function moulding(profile: number[][]) {
  const shape = new THREE.Shape();
  profile.forEach(([y, halfDepth], i) => i ? shape.lineTo(halfDepth, y) : shape.moveTo(halfDepth, y));
  for (const [y, halfDepth] of [...profile].reverse()) shape.lineTo(-halfDepth, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
  return geometry.translate(0, 0, -1).rotateY(Math.PI / 2);
}

function carvedPanel() {
  const shape = new THREE.Shape();
  shape.moveTo(-1, .178); shape.lineTo(1, .178); shape.lineTo(1, .518);
  shape.lineTo(.90, .518); shape.lineTo(.86, .556); shape.lineTo(-.86, .556);
  shape.lineTo(-.90, .518); shape.lineTo(-1, .518); shape.closePath();
  // Paired ruyi-shaped openings are cut right through the stone.
  for (const sign of [-1, 1]) {
    const hole = new THREE.Path();
    hole.moveTo(sign * .42, .408);
    hole.bezierCurveTo(sign * .34, .450, sign * .44, .499, sign * .50, .464);
    hole.bezierCurveTo(sign * .54, .523, sign * .65, .506, sign * .66, .463);
    hole.bezierCurveTo(sign * .72, .489, sign * .81, .454, sign * .77, .424);
    hole.quadraticCurveTo(sign * .61, .430, sign * .52, .369);
    hole.quadraticCurveTo(sign * .56, .419, sign * .42, .408);
    hole.closePath(); shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .126, steps: 1, curveSegments: 5, bevelEnabled: true,
    bevelSize: .009, bevelThickness: .008, bevelSegments: 1,
  });
  return geometry.translate(0, 0, -.063);
}

/** Low rounded carving catches the sun separately on the two slopes of each chisel line. */
function cloudRelief() {
  const vertices: number[] = [], indices: number[] = [];
  function ridge(path: THREE.Path, sign: number, face: number, width: number) {
    const points = path.getPoints(6);
    for (const [i, p] of points.entries()) {
      const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const length = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      const dx = -(next.y - prev.y) * width / length, dy = (next.x - prev.x) * width / length;
      const k = vertices.length / 3;
      vertices.push(sign*(p.x+dx), p.y+dy, face*.071, sign*p.x, p.y, face*.085, sign*(p.x-dx), p.y-dy, face*.071);
      if (!i) continue;
      const triangles = [k-3,k,k-2, k,k+1,k-2, k-2,k+1,k-1, k+1,k+2,k-1];
      if (sign*face > 0) triangles.reverse();
      indices.push(...triangles);
    }
  }
  const cloud = new THREE.Path();
  cloud.moveTo(.012,.346); cloud.bezierCurveTo(.13,.339,.19,.277,.31,.284);
  cloud.bezierCurveTo(.44,.289,.42,.362,.352,.357);
  cloud.bezierCurveTo(.309,.354,.312,.321,.334,.321);
  const cloudTail = new THREE.Path();
  cloudTail.moveTo(.28,.275); cloudTail.bezierCurveTo(.47,.255,.55,.340,.77,.318);
  const border = new THREE.Path();
  border.moveTo(0,.224); border.lineTo(.78,.224); border.lineTo(.828,.254); border.lineTo(.895,.254);
  const upperBorder = new THREE.Path();
  upperBorder.moveTo(0,.485); upperBorder.lineTo(.161,.485); upperBorder.lineTo(.204,.458); upperBorder.lineTo(.277,.458);
  for (const face of [-1,1]) for (const sign of [-1,1]) {
    ridge(cloud, sign, face, .014); ridge(cloudTail, sign, face, .009);
    ridge(border, sign, face, .008); ridge(upperBorder, sign, face, .009);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); result.setIndex(indices);
  result.computeVertexNormals(); return result;
}

/** Faceted square shaft, with a recessed waist and projecting impost for the handrail. */
function carvedPost() {
  const shape = [[1,.78],[.78,1],[-.78,1],[-1,.78],[-1,-.78],[-.78,-1],[.78,-1],[1,-.78]];
  const sections = [[0,.169],[.055,.169],[.085,.151],[.131,.151],[.157,.121],
    [.198,.121],[.214,.143],[.247,.143],[.264,.126],[.643,.118],[.67,.141],
    [.704,.141],[.72,.126],[.752,.145],[.773,.161],[.811,.161],[.839,.135],[.858,.106],[.858,.076]];
  const positions: number[] = [], indices: number[] = [];
  sections.forEach(([y,r], row) => shape.forEach(([x,z], i) => {
    positions.push(x*r,y,z*r);
    if (row === 0) return;
    const a=(row-1)*8+i, b=(row-1)*8+(i+1)%8;
    indices.push(a,a+8,b, b,a+8,b+8);
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setIndex(indices);
  const flat = geo.toNonIndexed(); geo.dispose(); flat.computeVertexNormals(); return flat;
}

function lotusBud() {
  const vertices: number[] = [], indices: number[] = [];
  const profile = [[.83,.105],[.867,.116],[.888,.099],[.902,.086],[.937,.124],[.966,.130],[1.009,.110],[1.058,.060],[1.099,.016],[1.114,0]];
  const sides = 24;
  profile.forEach(([y,r], ring) => {
    for (let i=0; i<sides; i++) {
      const a=i*Math.PI*2/sides;
      const notch = i%3===0 && y>.9 ? .020 * Math.sin(Math.PI*(y-.90)/.214) : 0;
      vertices.push((r-notch)*Math.cos(a),y,(r-notch)*Math.sin(a));
      if (ring) {
        const k=(ring-1)*sides+i, q=(ring-1)*sides+(i+1)%sides;
        indices.push(k,k+sides,q,q,k+sides,q+sides);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function stoneBalustrade(parent: THREE.Group, stone: THREE.Material, shade: THREE.Material, own: OwnGeometry) {
  const base = own(moulding([[0,.139],[.052,.139],[.077,.114],[.121,.106],[.137,.125],[.170,.125],[.186,.095]]));
  const panel = own(carvedPanel()), relief = own(cloudRelief());
  const cap = own(moulding([[.606,.078],[.622,.095],[.647,.095],[.662,.113],[.705,.113],[.731,.088],[.741,.069]]));
  const bolster = own(new THREE.LatheGeometry([[.065,.544],[.074,.552],[.061,.571],[.051,.583],[.064,.598],[.064,.612]]
    .map(([r,y])=>new THREE.Vector2(r,y)),8));
  const post = own(carvedPost()), bud = own(lotusBud());
  function put(group: THREE.Group, g: THREE.BufferGeometry, m: THREE.Material, name: string, x=0) {
    const mesh = new THREE.Mesh(g,m);
    mesh.name=name; mesh.position.x=x; mesh.castShadow=mesh.receiveShadow=true; group.add(mesh);
    return mesh;
  }
  return (points: readonly PlanPoint[], height=1, floor=.296, omitFirst=false) => {
    points.forEach(([x,z], i) => {
      if (!omitFirst || i!==0) {
        const pier = new THREE.Group(); pier.position.set(x,floor,z); pier.scale.y=height; parent.add(pier);
        put(pier,post,stone,'Chamfered stone post and stepped foot'); put(pier,bud,stone,'Carved lotus-bud finial');
      }
      if (!i) return;
      const [ax,az]=points[i-1], len=Math.hypot(x-ax,z-az);
      const bay = new THREE.Group(); bay.position.set((ax+x)/2,floor,(az+z)/2);
      bay.rotation.y=Math.atan2(az-z,x-ax); bay.scale.set(len/2,height,1); parent.add(bay);
      put(bay,base,shade,'Balustrade stepped plinth'); put(bay,panel,stone,'Paired cloud openings in the stone panel');
      put(bay,relief,shade,'Cloud scrolls in shallow relief'); put(bay,cap,stone,'Bevelled handrail');
      for (const k of [-.63,0,.63]) put(bay,bolster,stone,'Carved handrail support',k);
    });
  };
}
