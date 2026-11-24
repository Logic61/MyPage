import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshPhysicalMaterial, ShaderLib } from 'three';
import { setPoolReflections } from '../src/scripts/mountain-world/water-court.ts';

test('pool contacts stay local, freeze on pause, and expire or clear when motion is reduced', () => {
  const material = new MeshPhysicalMaterial();
  const waves = setPoolReflections(material, -7.4);
  const shader = { ...ShaderLib.physical, uniforms: {} };
  material.onBeforeCompile(shader);
  const { poolContactCount: count, poolContacts: contacts } = shader.uniforms;
  assert.equal(waves.disturb(0, 7, .6), false);
  assert.equal(waves.disturb(0, 4, NaN), false);
  for (let i = 0; i < 8; i++) {
    waves.disturb(i / 10, 4, .65);
    waves.update(i * .1, .1, false);
  }
  assert.equal(count.value, 6);
  assert.ok(Math.abs(contacts.value[0] - .2) < .00001);
  const age = contacts.value[2];
  waves.update(.8, 0, false);
  assert.equal(contacts.value[2], age);
  waves.update(2.2, 1.4, false);
  assert.equal(count.value, 4);
  waves.update(3.2, 1, false);
  assert.equal(count.value, 0);
  waves.disturb(1, 3, 1);
  waves.update(3.2, 0, true);
  assert.equal(count.value, 0);
  material.dispose();
});
