// Integrate relative motion in display frames. The filter consumes every
// accepted pixel; its response time is independent of mouse report rate.
export function makeLookInput() {
  let x=0,y=0,freshUntil=-1;
  return {
    reset(){x=0;y=0;freshUntil=-1;},
    acquired(time){x=0;y=0;freshUntil=time+90;},
    add(dx,dy,time,shortSide,locked=false){
      if(!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy))return;
      if(locked && time<=freshUntil) {
        freshUntil=-1;
        // Some Windows pointer-lock transitions report the cursor's warp
        // from its former screen position as the first relative packet.
        if(Math.max(Math.abs(dx),Math.abs(dy))>Math.max(250,Math.min(480,shortSide*.42)))return;
      }
      x+=dx;y+=dy;
    },
    take(dt){
      const alpha=-Math.expm1(-dt/.012);
      const dx=Math.abs(x)<.025?x:x*alpha,dy=Math.abs(y)<.025?y:y*alpha;
      x-=dx;y-=dy;
      return {dx,dy,remaining:Math.abs(x)+Math.abs(y)>.0001};
    }
  };
}

export function beginDrag(e) {
  return {id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};
}

export function moveDrag(drag,e) {
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  drag.distance+=Math.hypot(dx,dy);
  drag.x=e.clientX;drag.y=e.clientY;
  return [dx,dy];
}

export function angleDifference(from,to){
  return Math.atan2(Math.sin(from-to),Math.cos(from-to));
}

export function cameraOffset(camera,target,now,duration) {
  return {now,duration,x:camera.position.x-target.x,y:camera.position.y-target.y,z:camera.position.z-target.z,
    yaw:angleDifference(camera.rotation.y,target.yaw),pitch:camera.rotation.x-target.pitch,fov:camera.fov-target.fov};
}

export function offsetWeight(transition,now){
  const t=Math.min(1,Math.max(0,(now-transition.now)/transition.duration));
  return 1-t*t*(3-2*t);
}
