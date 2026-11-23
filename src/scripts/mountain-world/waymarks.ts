import { Vector3, type PerspectiveCamera } from 'three';
import type { Interaction, InteractionKind } from './types';

const lifts: Record<InteractionKind, number> = { books: .67, projects: .61, about: 1.14, lantern: .41, bench: .66 };
const bearings: Partial<Record<InteractionKind, number>> = { books: .29, about: .49, projects: .69 };
const labelShifts = [0, -44, 44, -88, 88, -132, 132];

/** Project each sign above its object. When a main room leaves the frame, point along the screen edge. */
export function createWaymarks(root: HTMLElement) {
  const marks = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-world-mark]'), el => ({
    el, kind: el.dataset.worldMark as InteractionKind, primary: el.hasAttribute('data-primary'),
    left: NaN, top: NaN, side: '',
  }));
  const view = new Vector3();
  const occupied: { x: number; y: number; half: number }[] = [];
  let centred: Interaction | undefined;

  function update(camera: PerspectiveCamera, items: Interaction[], aimed?: string) {
    const w = root.clientWidth, h = root.clientHeight, compact = w < 680;
    const minY = compact ? 96 : 92;
    const maxY = Math.max(minY + 64, h - (compact ? 156 : 116));
    const focal = h * .5 / Math.tan(camera.fov * Math.PI / 360);
    const english = root.dataset.language === 'en';
    const half = compact ? (english ? 46 : 36) : (english ? 61 : 48);
    centred = undefined;
    occupied.length = 0;

    for (const mark of marks) {
      // A single lamp sign follows the nearer pond when crossing the forecourt.
      let item: Interaction | undefined, nearest = Infinity;
      for (const candidate of items) {
        if (candidate.kind !== mark.kind) continue;
        const distance = camera.position.distanceToSquared(candidate.position);
        if (distance < nearest) { nearest = distance; item = candidate; }
      }
      const el = mark.el;
      if (!item || item.id === aimed) { if (!el.hidden) el.hidden = true; continue; }

      view.copy(item.position);
      view.y += lifts[mark.kind];
      view.applyMatrix4(camera.matrixWorldInverse);
      const depth = -view.z;
      const px = w / 2 + view.x * focal / Math.max(.01, depth);
      const py = h / 2 - view.y * focal / Math.max(.01, depth) - 16;
      const edge = depth < .18 || px < half + 9 || px > w - half - 9;
      if (!mark.primary && (edge || nearest > 35 || py < minY || py > maxY)) {
        if (!el.hidden) el.hidden = true;
        continue;
      }

      const side = edge ? (view.x < 0 ? 'left' : 'right') : 'in';
      const reach = edge && compact ? 22 : half;
      const offset = reach + (compact ? 7 : 19);
      const x = Math.round(edge ? (side === 'left' ? offset : w - offset) : px);
      const desired = edge ? minY + (maxY - minY) * (bearings[mark.kind] ?? .5) : py;
      let y: number | undefined;
      for (const shift of labelShifts) {
        const candidate = Math.round(Math.min(maxY, Math.max(minY, desired + shift)));
        if (occupied.every(p => Math.abs(x - p.x) >= reach + p.half + 5 || Math.abs(candidate - p.y) >= 40)) {
          y = candidate;
          break;
        }
      }
      if (y === undefined) { if (!el.hidden) el.hidden = true; continue; }

      occupied.push({ x, y, half: reach });
      if (el.dataset.destinationId !== item.id) el.dataset.destinationId = item.id;
      if (el.hidden) el.hidden = false;
      if (mark.left !== x || mark.top !== y) {
        el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
        mark.left = x; mark.top = y;
      }
      if (mark.side !== side) { el.dataset.side = side; mark.side = side; }
      const underReticle = !edge && Math.abs(w / 2 - x) < reach && Math.abs(h / 2 - y) < 17;
      if (underReticle) centred = item;
      el.toggleAttribute('data-centred', underReticle);
    }
  }
  return { update, atCentre: () => centred };
}
