import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createWaymarks } from '../src/scripts/mountain-world/waymarks.ts';

const kinds = ['books', 'about', 'projects', 'latest', 'lantern', 'bench'];
function setup(width, height) {
  const buttons = kinds.map((kind, i) => {
    const attributes = new Set(i < 3 ? ['data-primary'] : []);
    return {
      dataset: { worldMark: kind }, hidden: true, style: {},
      hasAttribute: key => attributes.has(key),
      toggleAttribute(key, on) { if (on) attributes.add(key); else attributes.delete(key); },
    };
  });
  const root = { dataset: { language: 'en' }, clientWidth: width, clientHeight: height, querySelectorAll: () => buttons };
  const camera = new PerspectiveCamera(60, width / height, .05, 230);
  camera.position.set(0, 1.98, 0);
  camera.updateMatrixWorld();
  return { buttons, camera, hud: createWaymarks(root) };
}
const target = (kind, x, y, z, id = kind) => ({ id, kind, position: new Vector3(x, y, z) });
const centre = el => el.style.transform.match(/translate3d\((-?\d+)px,(-?\d+)px/).slice(1).map(Number);

test('hiding guide labels clears a centred shortcut and restores projection when enabled again', () => {
  const { buttons, camera, hud } = setup(1200, 800);
  const focal = 400 / Math.tan(Math.PI / 6);
  const book = target('books', 0, 1.98 - .67 - 16 * 5 / focal, -5);
  hud.update(camera, [book]);
  assert.equal(hud.atCentre(), book);
  hud.setVisible(false);
  assert.equal(hud.atCentre(), undefined);
  hud.update(camera, [book]);
  assert.ok(buttons.every(el => el.hidden && !el.hasAttribute('data-centred')));
  hud.setVisible(true);
  hud.update(camera, [book]);
  assert.equal(buttons[0].hidden, false);
  assert.equal(hud.atCentre(), book);
});

test('collocated main signs remain legible on a short phone and become directional bearings when turning away', () => {
  const { buttons, camera, hud } = setup(390, 667);
  const items = [target('books', -.1, 1.5, -14), target('about', .12, 1.5, -15), target('projects', .18, 1.5, -14), target('bench', 0, 1, -15)];
  hud.update(camera, items);
  const main = buttons.slice(0, 3);
  assert.ok(main.every(el => !el.hidden && el.dataset.side === 'in'));
  const ys = main.map(el => centre(el)[1]).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 40 && ys[2] - ys[1] >= 40);
  assert.ok(buttons.find(el => el.dataset.worldMark === 'bench').hidden);
  camera.rotation.y = Math.PI;
  camera.updateMatrixWorld();
  hud.update(camera, items);
  for (const el of main) {
    assert.ok(!el.hidden && ['left', 'right'].includes(el.dataset.side));
    const [x, y] = centre(el);
    assert.ok(x >= 22 && x <= 368 && y >= 96 && y <= 511);
  }
  assert.equal(hud.atCentre(), undefined);
  hud.update(camera, items, 'about');
  assert.ok(main[1].hidden);
});

test('a physical aim supersedes the reticle shortcut, and the local lantern sign follows the nearer pool', () => {
  const { buttons, camera, hud } = setup(1200, 800);
  const focal = 400 / Math.tan(Math.PI / 6);
  const book = target('books', 0, 1.98 - .67 - 16 * 5 / focal, -5);
  hud.update(camera, [book]);
  assert.equal(hud.atCentre(), book);
  hud.update(camera, [book], book.id);
  assert.ok(buttons[0].hidden);
  assert.equal(hud.atCentre(), undefined);
  const lights = [target('lantern', -3, 1.8, -4), target('lantern', 3, 1.8, -4, 'east-lantern')];
  const lamp = buttons.find(el => el.dataset.worldMark === 'lantern');
  for (const light of lights) {
    camera.position.x = light.position.x;
    camera.updateMatrixWorld();
    hud.update(camera, lights);
    assert.ok(!lamp.hidden);
    assert.equal(lamp.dataset.destinationId, light.id);
  }
});
