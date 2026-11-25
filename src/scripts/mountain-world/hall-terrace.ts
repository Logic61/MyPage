export const NORTH_HALL_SETBACK = 2.54;
export const NORTH_HALL_FRONT = -5.8 - NORTH_HALL_SETBACK;
// The deep porch has one axial flight in front and short side flights beside the window seats.
export const HALL_STEPS = { halfWidth: 6.48, stairHalf: 2.28, cheek: .20, rear: -10.19 - NORTH_HALL_SETBACK, front: -6.52, tread: .36, riser: .16, count: 4 } as const;
export const NORTH_HALL_RISE = HALL_STEPS.riser * HALL_STEPS.count;
export const SUN_DAIS = { x:26, z:5, steps:[{radius:3.06,top:.370},{radius:2.77,top:.431},{radius:2.43,top:.481}] } as const;
export const EAST_BRIDGE = { landing: 12.94, start: 13.5, end: 24, z: SUN_DAIS.z, width: 3.12 } as const;
// The solid south wall returns beside the cabinet. Its inner bay opens towards the pond walk.
export const LIBRARY_ENTRY = { west: -6.1, jamb: -5.43, east: -3.2, front: .60, returnEnd: .05 } as const;
// A full bay faces the west gallery. The two hexagonal stone treads raise the chess setting.
export const CHESS_PAVILION = {
  x:-10.67, z:6.02, orientation:Math.PI/6, posts:2.20, eaves:2.71,
  paving:2.58, step:2.78, rise:.134, beamY:3.09, boardX:-10.90, boardZ:6.13,
} as const;
// The long ridge follows the bench. The northern eave ends south of the full bridge approach.
export const TEA_PAVILION = {
  x:10.73, z:8.91, postHalfX:1.38, postHalfZ:1.49, eaveHalfX:1.86, eaveHalfZ:1.99,
  beamY:3.08, apron:{x0:8.85,x1:12.76,z0:6.76,z1:10.82},
  benchX:10.14, benchZ:8.86, benchYaw:-1.33,
} as const;

export function chessRiseAt(x:number,z:number) {
  const p=CHESS_PAVILION, dx=Math.abs(x-p.x), dz=Math.abs(z-p.z);
  const distance=Math.max(dx,.5*dx+Math.sqrt(3)/2*dz), apothem=Math.sqrt(3)/2;
  // The eye follows the two nosings through the length of a stride.
  const tread=(radius:number)=>Math.min(1,Math.max(0,(radius*apothem+.095-distance)/.19));
  return .060*tread(p.step)+(p.rise-.060)*tread(p.paving);
}

// Centers of the paired eave columns and their four transverse beams.
// The stone court meets the inner gallery at the front corner of each wing.
export const GALLERY = {
  wall: 6.1, innerPost: 6.19, outerPost: 9.38, outerFloor: 9.64,
  north: -7.75, south: 1.65, bents: [-7.32, -4.55, -1.80, 1.24],
  door: { from: -5.62, to: -3.40, bottom: .30, top: 2.89 },
} as const;

export function hallRiseAt(x: number, z: number) {
  const { halfWidth, stairHalf, cheek, rear, front, tread, riser, count } = HALL_STEPS;
  const across = Math.abs(x);
  if (z < rear || (z > front && across > stairHalf + cheek)) return 0;
  const outward = across <= stairHalf + cheek ? z - front : across - halfWidth;
  // Interpolate through the tread centres. Beyond the toe, the wing doors stay level.
  return Math.max(0, Math.min(NORTH_HALL_RISE, (count - .5 - outward / tread) * riser));
}

export function walkRiseAt(x:number,z:number) {
  const distance=Math.hypot(x-SUN_DAIS.x,z-SUN_DAIS.z);
  if(distance>SUN_DAIS.steps[0].radius+.15) return Math.max(hallRiseAt(x,z),chessRiseAt(x,z));
  let previous=.3,rise=0;
  for(const {radius,top} of SUN_DAIS.steps) {
    const fraction=Math.min(1,Math.max(0,(radius+.15-distance)/.3));
    rise+=(top-previous)*fraction; previous=top;
  }
  return rise;
}
