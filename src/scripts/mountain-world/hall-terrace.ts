// All four sides can be approached on foot, including the passages through the wings.
export const HALL_STEPS = { halfWidth: 6.24, rear: -10.19, front: -5.21, tread: .36, riser: .16, count: 4 } as const;
export const NORTH_HALL_RISE = HALL_STEPS.riser * HALL_STEPS.count;
export const SUN_DAIS = { x:26, z:5, steps:[{radius:3.06,top:.370},{radius:2.77,top:.431},{radius:2.43,top:.481}] } as const;

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
