// All four sides can be approached on foot, including the passages through the wings.
export const NORTH_HALL_SETBACK = 1.60;
export const NORTH_HALL_FRONT = -5.8 - NORTH_HALL_SETBACK;
export const HALL_STEPS = { halfWidth: 6.24, rear: -10.19 - NORTH_HALL_SETBACK, front: -5.21 - NORTH_HALL_SETBACK, tread: .36, riser: .16, count: 4 } as const;
export const NORTH_HALL_RISE = HALL_STEPS.riser * HALL_STEPS.count;
export const SUN_DAIS = { x:26, z:5, steps:[{radius:3.06,top:.370},{radius:2.77,top:.431},{radius:2.43,top:.481}] } as const;
export const EAST_BRIDGE = { landing: 12.94, start: 13.5, end: 24, z: SUN_DAIS.z, width: 3.12 } as const;
// Both pavilions open north onto the walk from the galleries. Their fittings share these centres.
export const PINE_PAVILIONS = { x:10.24, z:6, postCircle:2.30, eaves:2.84, paving:2.61, beamY:3.13 } as const;

// Centers of the paired eave columns and their four transverse beams.
// The stone court meets the inner gallery at the front corner of each wing.
export const GALLERY = {
  wall: 6.1, innerPost: 6.19, outerPost: 9.38, outerFloor: 9.64,
  north: -7.75, south: 1.65, bents: [-7.32, -4.55, -1.80, 1.24],
  door: { from: -5.62, to: -3.40, bottom: .30, top: 2.89 },
} as const;

export function hallRiseAt(x: number, z: number) {
  const { halfWidth, rear, front, tread, count } = HALL_STEPS;
  const outward = Math.max(Math.abs(x) - halfWidth, rear - z, z - front, 0);
  // The foot crosses each nosing in stride; the eye follows the pitch of the staircase.
  return NORTH_HALL_RISE * Math.max(0, 1 - outward / (count * tread));
}

export function walkRiseAt(x:number,z:number) {
  const distance=Math.hypot(x-SUN_DAIS.x,z-SUN_DAIS.z);
  if(distance>SUN_DAIS.steps[0].radius+.15) return hallRiseAt(x,z);
  let previous=.3,rise=0;
  for(const {radius,top} of SUN_DAIS.steps) {
    const fraction=Math.min(1,Math.max(0,(radius+.15-distance)/.3));
    rise+=(top-previous)*fraction; previous=top;
  }
  return rise;
}
