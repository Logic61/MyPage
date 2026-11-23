import type { Point, Vault } from './navigation';

const GRAVITY = 15;
const LAUNCH_SPEED = 4.35;
export const STANDING_HEAD = 1.80;

function smooth(t: number) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}
interface Crossing {
  start: Point; landing: Point;
  takeoff: number; finish: number; crest: number;
  elapsed: number; duration: number;
}

/** Absolute foot height lets a jump meet a higher stair or continue past a cliff. */
export class AerialMotion {
  kind: 'grounded' | 'jump' | 'vault' = 'grounded';
  feet = 0;
  verticalSpeed = 0;
  eyeLowering = 0;
  private takeoff = 0;
  private crossing: Crossing | null = null;

  jump(floor: number) {
    if (this.kind !== 'grounded') return;
    this.kind = 'jump';
    this.feet = this.takeoff = floor;
    this.verticalSpeed = LAUNCH_SPEED;
  }

  advanceJump(dt: number, floor: number | null, ceiling: number) {
    if (this.kind !== 'jump') return false;
    const next = this.feet + this.verticalSpeed * dt - GRAVITY * dt * dt / 2;
    this.verticalSpeed -= GRAVITY * dt;
    this.feet = Math.min(next, ceiling - STANDING_HEAD);
    if (this.feet < next) this.verticalSpeed = Math.min(0, this.verticalSpeed);
    if (floor !== null && this.feet <= floor) {
      this.feet = floor;
      this.reset();
    }
    return floor === null && this.feet < this.takeoff - .12;
  }

  vault(start: Point, floor: number, opening: Vault, landingFloor: number) {
    if (this.kind !== 'grounded') return;
    this.kind = 'vault';
    this.feet = floor;
    const { landing, sillTop } = opening;
    this.crossing = { start: { x:start.x, z:start.z }, landing, takeoff:floor, finish:landingFloor,
      crest:Math.max(floor, landingFloor, sillTop + .085), elapsed:0,
      duration:.48 + .16 * Math.hypot(start.x - landing.x, start.z - landing.z) };
  }

  advanceVault(position: Point, dt: number) {
    const pass = this.crossing!;
    pass.elapsed += dt;
    const t = Math.min(1, pass.elapsed / pass.duration);
    // Plant hands, tuck and clear the sill, then set both feet down beyond the reveal.
    const lift = smooth(t / .27), cross = smooth((t - .24) / .51), land = smooth((t - .72) / .28);
    position.x = pass.start.x + (pass.landing.x - pass.start.x) * cross;
    position.z = pass.start.z + (pass.landing.z - pass.start.z) * cross;
    this.feet = pass.takeoff + (pass.crest - pass.takeoff) * lift + (pass.finish - pass.crest) * land;
    this.eyeLowering = .39 * lift * (1 - land);
    if (t === 1) this.reset();
  }

  reset() {
    this.kind = 'grounded';
    this.crossing = null;
    this.verticalSpeed = this.eyeLowering = 0;
  }
}
