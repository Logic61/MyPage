export type LookInput = 'locked' | 'drag' | 'touch';
type Position = { x: number; y: number; z: number };

const PITCH_LIMIT = 1.4;
const MOUSE_GAIN = 0.0021;
const TOUCH_GAIN = 0.0035;
const clampPitch = (value: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, value));

/** Owns the displayed angles. Events accumulate distance; only a frame moves the camera. */
export class LookController {
  yaw: number;
  pitch: number;
  private targetYaw: number;
  private targetPitch: number;
  private automatic = false;
  private source: LookInput | null = null;
  private startedAt = 0;
  private lastSampleAt = 0;
  private firstLockedSample = false;

  constructor(yaw = 0, pitch = -0.035) {
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = clampPitch(pitch);
  }

  snap(yaw: number, pitch: number) {
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = clampPitch(pitch);
    this.automatic = false;
  }

  begin(source: LookInput, now: number) {
    this.source = source;
    this.startedAt = this.lastSampleAt = now;
    this.firstLockedSample = source === 'locked';
    // A new input session must not inherit an unrendered flick from the previous one.
    if (!this.automatic) { this.targetYaw = this.yaw; this.targetPitch = this.pitch; }
  }

  end(source?: LookInput) {
    if (!source || source === this.source) this.source = null;
    // Keep a valid final delta when pointerup happens before the next animation frame.
  }

  suspend() {
    this.source = null;
    this.automatic = false;
    this.targetYaw = this.yaw; this.targetPitch = this.pitch;
  }

  cancelTurn() {
    if (this.automatic) { this.targetYaw = this.yaw; this.targetPitch = this.pitch; }
    this.automatic = false;
  }

  sample(source: LookInput, dx: number, dy: number, timestamp: number, now: number, sensitivity: number) {
    if (source !== this.source || ![dx, dy, timestamp, now, sensitivity].every(Number.isFinite)) return false;
    if (timestamp < this.startedAt - 1 || timestamp < this.lastSampleAt || now - timestamp > 120 || timestamp > now + 32) return false;
    if (!dx && !dy) return false;
    this.lastSampleAt = timestamp;
    const first = this.firstLockedSample; this.firstLockedSample = false;
    // Some platforms report a cursor recenter as the first locked delta. Scope this
    // guard to the handoff: ordinary fast turns are never clamped or shortened.
    if (first && timestamp - this.startedAt < 80 && Math.max(Math.abs(dx), Math.abs(dy)) > 160) return false;
    const gain = (source === 'touch' ? TOUCH_GAIN : MOUSE_GAIN) * sensitivity;
    this.rotate(-dx * gain, -dy * gain);
    return true;
  }

  rotate(yaw: number, pitch: number) {
    if ((!yaw && !pitch) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    this.cancelTurn();
    // Manual yaw is continuous, even for a sweep longer than half a revolution.
    this.targetYaw += yaw;
    this.targetPitch = clampPitch(this.targetPitch + pitch);
  }

  turnTo(yaw: number, pitch: number) {
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    this.targetYaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.targetPitch = clampPitch(pitch);
    this.automatic = true;
  }

  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (this.automatic) {
      const dt = Math.min(seconds, 0.05), alpha = 1 - Math.exp(-dt / 0.14);
      const limit = 2.6 * dt;
      this.yaw += Math.max(-limit, Math.min(limit, (this.targetYaw - this.yaw) * alpha));
      this.pitch += Math.max(-limit, Math.min(limit, (this.targetPitch - this.pitch) * alpha));
    } else {
      // 12 ms time constant: about 94% settled in 33 ms, with no overshoot.
      // Mouse distance is deliberately not multiplied by frame time.
      const alpha = 1 - Math.exp(-seconds / 0.012);
      this.yaw += (this.targetYaw - this.yaw) * alpha;
      this.pitch += (this.targetPitch - this.pitch) * alpha;
    }
  }
}

/** A tap is determined by the whole gesture, never by the size of one mouse event. */
export class DragLookGesture {
  moved = false;
  readonly id: number;
  readonly source: 'drag' | 'touch';
  private startX: number;
  private startY: number;
  private lastX: number;
  private lastY: number;

  constructor(id: number, startX: number, startY: number, source: 'drag' | 'touch') {
    this.id = id; this.source = source; this.startX = startX; this.startY = startY;
    this.lastX = startX; this.lastY = startY;
  }

  move(x: number, y: number) {
    const dx = x - this.lastX, dy = y - this.lastY;
    this.lastX = x; this.lastY = y;
    if (Math.hypot(x - this.startX, y - this.startY) >= 4) this.moved = true;
    return { dx, dy };
  }
}

/** Smooth only stance changes. Walking continues to follow collision-resolved position. */
export class StanceTransition {
  private offset = { x: 0, y: 0, z: 0 };
  private elapsed = Infinity;
  private duration: number;

  constructor(duration = 0.3) { this.duration = duration; }

  rebase(displayed: Position, target: Position) {
    this.offset.x = displayed.x - target.x;
    this.offset.y = displayed.y - target.y;
    this.offset.z = displayed.z - target.z;
    this.elapsed = 0;
  }

  reset() { this.elapsed = Infinity; }

  apply(target: Position, seconds: number): Position {
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, seconds));
    const t = this.elapsed / this.duration;
    const remaining = 1 - t * t * (3 - 2 * t);
    return {
      x: target.x + this.offset.x * remaining,
      y: target.y + this.offset.y * remaining,
      z: target.z + this.offset.z * remaining,
    };
  }
}
