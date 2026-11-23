import type { Collider, Overhead, WalkArea } from './types';

export interface Point { x: number; z: number; }
export interface Vault { landing: Point; sillTop: number; }

/** Small static floor navigation. The rendered world remains fully three-dimensional. */
export function createNavigation(areas: WalkArea[], obstacles: Collider[], radius = 0.32, outline: number[][] = [], overheads: Overhead[] = []) {
  const windows = obstacles.filter(sill => sill.window);
  function inside(x: number, z: number) {
    if (areas.some(a => {
      const dx = Math.abs(x - a.x), dz = Math.abs(z - a.z);
      if (dx > a.halfX || dz > a.halfZ) return false;
      return a.shape !== 'ellipse' || (dx / a.halfX) ** 2 + (dz / a.halfZ) ** 2 <= 1;
    })) return true;
    let enclosed = false;
    for (let i=0, j=outline.length-1; i<outline.length; j=i++) {
      const [ax,az] = outline[i], [bx,bz] = outline[j];
      if ((az>z) !== (bz>z) && x < ax+(z-az)*(bx-ax)/(bz-az)) enclosed = !enclosed;
    }
    return enclosed;
  }
  function canWalk(x: number, z: number) {
    if (!Number.isFinite(x + z) || !inside(x, z)) return false;
    for (let a = 0; a < 8; a++) {
      const angle = a * Math.PI / 4;
      if (!inside(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)) return false;
    }
    return clearOfSolids(x,z);
  }
  function clearOfSolids(x: number,z: number) {
    return !obstacles.some(o => {
      const dx = Math.max(Math.abs(x - o.x) - o.halfX, 0);
      const dz = Math.max(Math.abs(z - o.z) - o.halfZ, 0);
      return dx * dx + dz * dz < radius * radius;
    });
  }
  /** Test a straight, body-width crossing through the open centre of the visible joinery. */
  function findVault(start: Point, yaw: number): Vault | null {
    for (const sill of windows) {
      const opening = sill.window!, along = opening.axis;
      if (start[along] < opening.from + radius || start[along] > opening.to - radius) continue;
      const normal = along === 'x' ? 'z' : 'x';
      const half = normal === 'x' ? 'halfX' : 'halfZ';
      const side = Math.sign(start[normal] - sill[normal]);
      const facing = normal === 'x' ? -Math.sin(yaw) : -Math.cos(yaw);
      if (side * facing > -.60) continue;
      let low = sill[normal] - sill[half], high = sill[normal] + sill[half];
      if (opening.seat) {
        low = Math.min(low, opening.seat[normal] - opening.seat[half]);
        high = Math.max(high, opening.seat[normal] + opening.seat[half]);
      }
      const gap = side > 0 ? start[normal] - high : low - start[normal];
      if (gap < radius - .001 || gap > radius + .55) continue;
      const end = side > 0 ? low - radius - .19 : high + radius + .19;
      const target = { x: start.x, z: start.z };
      target[normal] = end;
      if (!canWalk(target.x, target.z)) continue;
      const near = Math.min(start[normal], end), far = Math.max(start[normal], end);
      const blocked = obstacles.some(o => {
        if (o === sill || o === opening.seat) return false;
        const across = Math.max(0, Math.abs(start[along] - o[along]) - o[along === 'x' ? 'halfX' : 'halfZ']);
        const forward = Math.max(0, near - (o[normal] + o[half]), o[normal] - o[half] - far);
        return across * across + forward * forward < radius * radius;
      });
      if (!blocked) return { landing: target, sillTop: opening.sillTop };
    }
    return null;
  }
  function ceilingAt(x: number, z: number) {
    let ceiling = Infinity;
    for (const beam of overheads) {
      if (Math.abs(x - beam.x) < beam.halfX + .16 && Math.abs(z - beam.z) < beam.halfZ + .16)
        ceiling = Math.min(ceiling, beam.bottom);
    }
    return ceiling;
  }
  function move(p: Point, dx: number, dz: number, allowDrop = false, crown = -Infinity): Point {
    const onPlan = allowDrop ? clearOfSolids : canWalk;
    const permitted = (x: number, z: number) => onPlan(x,z) && (crown === -Infinity || crown <= ceilingAt(x,z) + .0001);
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
    let x = p.x, z = p.z;
    for (let i = 0; i < count; i++) {
      const sx = dx / count, sz = dz / count;
      if (permitted(x + sx, z + sz)) { x += sx; z += sz; }
      else {
        if (permitted(x + sx, z)) x += sx;
        if (permitted(x, z + sz)) z += sz;
      }
    }
    return { x, z };
  }
  const step = 0.45;
  const minX = Math.floor(Math.min(...areas.map(a => a.x - a.halfX), ...outline.map(p=>p[0])) / step) * step;
  const minZ = Math.floor(Math.min(...areas.map(a => a.z - a.halfZ), ...outline.map(p=>p[1])) / step) * step;
  const width = Math.ceil((Math.max(...areas.map(a => a.x + a.halfX), ...outline.map(p=>p[0])) - minX) / step) + 1;
  const height = Math.ceil((Math.max(...areas.map(a => a.z + a.halfZ), ...outline.map(p=>p[1])) - minZ) / step) + 1;
  const allowed = new Uint8Array(width * height);
  const point = (id: number): Point => ({ x: minX + (id % width) * step, z: minZ + Math.floor(id / width) * step });
  for (let id = 0; id < allowed.length; id++) { const p = point(id); allowed[id] = +canWalk(p.x, p.z); }
  function nearest(p: Point, maxDistance = 2): Point | null {
    if (canWalk(p.x, p.z)) return { x: p.x, z: p.z };
    let best: Point | null = null, distance = maxDistance * maxDistance;
    for (let id = 0; id < allowed.length; id++) {
      if (!allowed[id]) continue;
      const q = point(id), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < distance) { distance = d; best = q; }
    }
    return best;
  }
  function nearestId(p: Point) {
    let best = -1, distance = Infinity;
    for (let id = 0; id < allowed.length; id++) {
      if (!allowed[id]) continue;
      const q = point(id), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < distance && clearLine(p, q)) { best = id; distance = d; }
    }
    return best;
  }
  function clearLine(a: Point, b: Point) {
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.14));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      if (!canWalk(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
  function findPath(start: Point, destination: Point): Point[] {
    const end = nearest(destination);
    if (!end) return [];
    if (clearLine(start, end)) return [end];
    const first = nearestId(start), last = nearestId(end);
    if (first < 0 || last < 0) return [];
    const previous = new Int32Array(allowed.length).fill(-1);
    const cost = new Float32Array(allowed.length).fill(Infinity);
    const closed = new Uint8Array(allowed.length);
    const open = new Set<number>([first]);
    cost[first] = 0;
    const goal = point(last);
    const heuristic = (id: number) => { const p = point(id); return Math.hypot(p.x - goal.x, p.z - goal.z) / step; };
    let reached = false;
    while (open.size) {
      let current = -1, lowest = Infinity;
      for (const id of open) { const f = cost[id] + heuristic(id); if (f < lowest) { lowest = f; current = id; } }
      if (current === last) { reached = true; break; }
      open.delete(current); closed[current] = 1;
      const x = current % width, z = Math.floor(current / width);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || x + dx < 0 || x + dx >= width || z + dz < 0 || z + dz >= height) continue;
        const id = current + dx + dz * width;
        if (!allowed[id] || closed[id] || !clearLine(point(current), point(id))) continue;
        const next = cost[current] + Math.hypot(dx, dz);
        if (next < cost[id]) { previous[id] = current; cost[id] = next; open.add(id); }
      }
    }
    if (!reached) return [];
    const path: Point[] = [end];
    let current = last;
    while (current !== first && current >= 0) { path.push(point(current)); current = previous[current]; }
    path.push(point(first)); path.reverse();
    const smooth: Point[] = [];
    let anchor = start, index = 0;
    while (index < path.length) {
      let furthest = index;
      while (furthest + 1 < path.length && clearLine(anchor, path[furthest + 1])) furthest++;
      smooth.push(path[furthest]); anchor = path[furthest]; index = furthest + 1;
    }
    return smooth;
  }
  return { hasFloor: inside, canWalk, move, nearest, findPath, clearLine, findVault, ceilingAt };
}
