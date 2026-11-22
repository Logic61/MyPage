import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeLookInput,beginDrag,moveDrag,angleDifference,cameraOffset,offsetWeight} from '../src/scripts/meridian/look.js';

test('a lock warp is ignored without clipping ordinary fast movement',()=>{
  const look=makeLookInput();look.acquired(100);
  look.add(1200,-620,103,750,true);look.add(150,5,104,750,true);look.add(450,0,116,750,true);
  assert.deepEqual(look.take(1),{dx:600,dy:5,remaining:false});
  look.acquired(200);look.add(150,0,201,750,true);assert.equal(look.take(1).dx,150);
});
test('reset and reacquisition discard input pending from the previous mode',()=>{
  const look=makeLookInput();look.add(100,20,1,720,true);look.take(.003);look.reset();
  assert.deepEqual(look.take(.016),{dx:0,dy:0,remaining:false});
  look.add(-30,40,5,720);look.acquired(10);assert.equal(look.take(1).dy,0);
});
test('filtered rotation integrates the same signed displacement at 30, 60 and 144 Hz',()=>{
  for(const hz of [30,60,144]){
    const look=makeLookInput();let x=0,y=0,pending=false;
    for(let frame=0;frame<hz;frame++){
      if(frame<3){look.add(22,-10,0,900);look.add(-6,4,0,900);}
      const move=look.take(1/hz);x+=move.dx;y+=move.dy;pending=move.remaining;
    }
    assert.ok(Math.abs(x-48)<1e-7&&Math.abs(y+18)<1e-7);assert.equal(pending,false);
  }
});
test('a slow drag returning to the starting pixel is still a drag',()=>{
  const drag=beginDrag({pointerId:7,clientX:80,clientY:20});
  for(const x of [81,82,83,84,83,82,81,80])moveDrag(drag,{clientX:x,clientY:20});
  assert.equal(drag.x,80);assert.equal(drag.distance,8);
});
test('eyepiece transition takes the short arc across the yaw seam',()=>{
  const camera={position:{x:1,y:2,z:3},rotation:{x:.1,y:Math.PI-.04},fov:63};
  const goal={x:2,y:3,z:4,pitch:.2,yaw:-Math.PI+.03,fov:20};
  const offset=cameraOffset(camera,goal,0,240);
  assert.ok(Math.abs(offset.yaw+.07)<1e-9);assert.ok(Math.abs(angleDifference(goal.yaw+offset.yaw,camera.rotation.y))<1e-9);
  assert.equal(offsetWeight(offset,0),1);assert.equal(offsetWeight(offset,120),.5);assert.equal(offsetWeight(offset,240),0);
});
