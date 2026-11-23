// All four sides can be approached on foot, including the passages through the wings.
export const HALL_STEPS = { halfWidth: 6.24, rear: -10.19, front: -5.21, tread: .36, riser: .16, count: 4 } as const;
export const NORTH_HALL_RISE = HALL_STEPS.riser * HALL_STEPS.count;

export function hallRiseAt(x: number, z: number) {
  const { halfWidth, rear, front, tread, count } = HALL_STEPS;
  const outward = Math.max(Math.abs(x) - halfWidth, rear - z, z - front, 0);
  // The foot crosses each nosing in stride; the eye follows the pitch of the staircase.
  return NORTH_HALL_RISE * Math.max(0, 1 - outward / (count * tread));
}
