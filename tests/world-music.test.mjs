import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusic } from '../src/scripts/mountain-world/music.ts';

test('music resumes the same recording, draws a different successor and bounds failed requests', t => {
  const players = [];
  class AudioStub {
    constructor(url) { this.url = url; this.plays = 0; players.push(this); }
    play() { this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute() {}
  }
  t.mock.method(Math, 'random', () => 0);
  const previous = Object.getOwnPropertyDescriptor(globalThis,'Audio');
  Object.defineProperty(globalThis,'Audio',{ configurable:true, value:AudioStub });
  t.after(() => { if (previous) Object.defineProperty(globalThis,'Audio',previous); else delete globalThis.Audio; });
  let failures = 0;
  const music = createMusic('/MyPage', () => failures++);
  assert.equal(players.length,0);
  music.setAudible(true);
  assert.equal(players[0].url,'/MyPage/world/music/barcarolle.m4a');
  music.setAudible(false); music.setAudible(true);
  assert.equal(players.length,1); assert.equal(players[0].plays,2);
  players[0].onended();
  assert.equal(players[1].url,'/MyPage/world/music/pastoral.m4a');
  for (let i=0;i<5;i++) players.at(-1).onerror();
  assert.equal(failures,1);
  assert.equal(new Set(players.slice(1).map(audio => audio.url)).size,5);
  music.setAudible(true);
  const last = players.at(-1);
  music.dispose();
  assert.equal(last.paused,true); assert.equal(last.onended,null);
});
