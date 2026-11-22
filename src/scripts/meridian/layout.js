export const archLine = -2.75;
export const columns = [-6.24,-2.08,2.08,6.24];
export const limit = {left:-5.94,right:5.94,back:5.72,front:-7.05};
export const telescopeAt = {x:1.1,z:0};
export const deskAt = {x:4.8,z:2.6};
export const bookAt = {x:-5.65,z:.65};

const playerRadius=.225;
const obstacles=[
  ...columns.map(x=>[x,archLine,.9,.96,0]),
  [bookAt.x,bookAt.z,.57,7.24,0],
  [-3.68,-.48,1.67,.91,.19],
  [deskAt.x,deskAt.z,2.62,1.12,-Math.PI/2],
  [1.3,5.82,2.24,.58,0]
];

export function canStand(x,z) {
  if(x<limit.left || x>limit.right || z<limit.front || z>limit.back) return false;
  if(Math.hypot(x-telescopeAt.x,z-telescopeAt.z)<1.03+playerRadius) return false;
  return obstacles.every(([cx,cz,w,d,angle])=>{
    const dx=x-cx,dz=z-cz,co=Math.cos(angle),si=Math.sin(angle);
    const ox=Math.max(0,Math.abs(co*dx-si*dz)-w/2);
    const oz=Math.max(0,Math.abs(si*dx+co*dz)-d/2);
    return ox*ox+oz*oz>=playerRadius*playerRadius;
  });
}

export function step(pose,side,forward,distance) {
  const mag=Math.max(1,Math.hypot(side,forward));
  const dx=(side*Math.cos(pose.yaw)-forward*Math.sin(pose.yaw))*distance/mag;
  const dz=(-side*Math.sin(pose.yaw)-forward*Math.cos(pose.yaw))*distance/mag;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){
    if(canStand(pose.x+dx/steps,pose.z)) pose.x+=dx/steps;
    if(canStand(pose.x,pose.z+dz/steps)) pose.z+=dz/steps;
  }
}

const targets=[
    ['scope',telescopeAt.x+.58,1.87,telescopeAt.z+.63],
    ['scope',telescopeAt.x-.3,2.15,telescopeAt.z-.28],
    ['desk',deskAt.x-.3,1.07,deskAt.z],['shelf',-3.68,1.02,-.48]
  ];
for(let z=bookAt.z-3.1;z<bookAt.z+3.5;z+=.55) targets.push(['shelf',bookAt.x+.28,1.55,z]);

export function focusedObject(pose) {
  const c=Math.cos(pose.pitch),fx=-Math.sin(pose.yaw)*c,fy=Math.sin(pose.pitch),fz=-Math.cos(pose.yaw)*c;
  let best,score=.82;
  for(const [id,x,y,z] of targets){
    const dx=x-pose.x,dy=y-1.63,dz=z-pose.z,d=Math.hypot(dx,dy,dz);
    if(d>2.54 || d<.05) continue;
    const dot=(fx*dx+fy*dy+fz*dz)/d;
    if(dot>score){score=dot;best=id;}
  }
  return best;
}
