import * as T from 'three';
import {box,cylinder,group,part,relief,ring,rod,series,timber,TAU} from './workshop.js';

import {archLine,columns} from './layout.js';

export function buildHall(root,m) {
  const rand=series(1911);
  const gray = () => new T.Color().setScalar(.72+rand()*.27);
  const roofHeight=4.76;
  box(root,m.stone,0,-.42,-.7,13.35,.79,14.42,.06);
  box(root,m.joints,0,-.052,-.7,12.85,.09,13.98);
  box(root,m.paving,0,-.043,-5.32,12.89,.093,4.65);
  // Offset the tile bond every row. Give each stone a slightly different cut
  // and value; the seams stay at a real-world scale right up to the eyepiece.
  for(let row=0;row<16;row++){
    const z=-7.62+(row+.5)*.86;
    if(z < -2.9) continue;
    for(let x=-6.45-(row%2)*.67;x<6.45;x+=1.34){
      const left=Math.max(-6.45,x),right=Math.min(6.45,x+1.34);
      if(right-left>.08) box(root,m.slab,(left+right)/2,-.036,z,right-left-.016,.078,.846,0,gray());
    }
  }
  for(const x of [-.055,.055])box(root,m.brass,x,.008,-.55,.016,.008,13.12);
  for(const z of [-6.97,-2.28,5.45])box(root,m.bronze,0,.008,z,12.2,.009,.027);

  function pier(x,z){
    for(let j=0;j<6;j++)box(root,m.stone,x,.21+j*.43,z,.592,.428,.655,.012,gray());
    for(const [y,w,h,d] of [[.115,.88,.22,.92],[.27,.76,.1,.81],[.37,.68,.09,.74],[2.21,.68,.1,.75],[2.34,.81,.13,.85],[2.45,.91,.1,.96]]) {
      box(root,m.trim,x,y,z,w,h,d,.017,gray());
    }
    for(const s of [-1,1]){
      box(root,m.trim,x,1.27,z+s*.33,.39,1.7,.035,.012);
      for(const offset of [-.174,.174])box(root,m.stone,x+offset,1.27,z+s*.353,.024,1.62,.02,.006);
    }
  }
  for(const x of columns)pier(x,archLine);
  const spring=2.43,inner=1.72,outer=2.026;
  function arcade(center){
    const face=group(root,center,spring,archLine-.31);
    const fill=new T.Shape();
    fill.moveTo(-2.08,0);fill.lineTo(-2.08,roofHeight-spring);fill.lineTo(2.08,roofHeight-spring);
    fill.lineTo(2.08,0);fill.lineTo(outer,0);fill.absarc(0,0,outer,0,Math.PI,false);fill.closePath();
    relief(face,m.plaster,fill,.62);
    for(let i=0;i<17;i++){
      const a=i*Math.PI/17+.002,b=(i+1)*Math.PI/17-.002;
      const arch=new T.Shape(),r=outer+(i===8?.095:0);
      arch.absarc(0,0,r,a,b,false);arch.lineTo(inner*Math.cos(b),inner*Math.sin(b));
      arch.absarc(0,0,inner,b,a,true);arch.closePath();
      const block=relief(face,m.trim,arch,.74,.009);
      block.position.z=-.06;block.userData.tint=gray();
    }
    for(const [radius,deep] of [[2.014,.023],[1.755,.017]]){
      const bead=new T.Shape();
      bead.absarc(0,0,radius+deep,0,Math.PI,false);bead.absarc(0,0,radius-deep,Math.PI,0,true);bead.closePath();
      for(const z of [-.076,.678]){
        const edge=relief(face,m.trim,bead,.023,.005);edge.position.z=z;
      }
    }
  }
  for(const c of [-4.16,0,4.16])arcade(c);
  for(const z of [archLine-.41,archLine+.4]) {
    box(root,m.stone,0,4.59,z,12.9,.11,.18,.016);
    box(root,m.trim,0,4.73,z,13.22,.16,.31,.02);
  }
  // Deep side walls, walnut dado with raised panels, and timber roof trusses.
  box(root,m.plaster,0,2.38,6.1,12.8,4.76,.46);
  for(const sx of [-1,1]) {
    const x=sx*6.32;
    box(root,m.plaster,x,2.38,1.66,.39,4.76,8.89);
    box(root,m.darkwood,x-sx*.22,.61,1.65,.11,1.22,8.8);
    for(let j=0;j<8;j++) {
      const z=-2.13+j*1.08;
      box(root,m.wood,x-sx*.285,.61,z,.05,.84,.85,.018);
      box(root,m.darkwood,x-sx*.315,.62,z,.02,.68,.69,.009);
    }
    for(const y of [.13,1.18,1.27,4.42,4.56])box(root,m.wood,x-sx*.22,y,1.66,.23,.085,8.96,.012);
  }
  for(const y of [.15,1.23,4.5])box(root,m.darkwood,0,y,5.82,12.4,.14,.16,.016);
  for(const x of [-4.85,-3.24,-1.62,0,1.62,3.24,4.85]) {
    box(root,m.darkwood,x,.67,5.84,1.52,1.22,.13,.012);
    box(root,m.wood,x,.66,5.755,1.28,.91,.052,.018);
  }
  for(const sx of [-1,1]){
    const slope=box(root,m.darkwood,sx*3.26,5.24,1.67,6.73,.16,9.63);
    slope.rotation.z=-sx*.171;
    const skin=box(root,m.roof,sx*3.29,5.37,1.67,6.86,.14,9.8);
    skin.rotation.z=-sx*.171;
    for(let i=0;i<8;i++){
      const xx=sx*(.35+i*.85);
      box(root,m.wood,xx,5.73-Math.abs(xx)*.173,1.64,.11,.13,9.25,.009);
    }
  }
  for(const z of [-2.49,.23,3.03,5.76]){
    box(root,m.darkwood,0,4.49,z,12.65,.23,.22,.018);
    for(const sx of [-1,1]){
      timber(root,m.wood,[sx*6.13,4.42,z],[0,5.65,z],.21,.22);
      timber(root,m.wood,[sx*5.93,3.45,z],[sx*4.78,4.47,z],.16,.23);
      timber(root,m.wood,[sx*2.2,4.48,z],[0,5.59,z],.12,.19);
    }
    box(root,m.wood,0,5.05,z,.16,1.1,.21);
  }
  const gable=new T.Shape();
  gable.moveTo(-6.38,4.75);gable.lineTo(0,5.88);gable.lineTo(6.38,4.75);gable.closePath();
  for(const z of [archLine-.31,5.88])relief(group(root,0,0,z),m.plaster,gable,.22);
  // Balcony rail: turned iron spindles between limestone piers leave the
  // horizon visible, even at the normal standing eye height.
  function rail(a,b){
    const [ax,az]=a,[bx,bz]=b, len=Math.hypot(bx-ax,bz-az);
    const frame=group(root,(ax+bx)/2,0,(az+bz)/2);
    frame.rotation.y=-Math.atan2(bz-az,bx-ax);
    box(frame,m.stone,0,.125,0,len,.25,.28,.025);
    box(frame,m.iron,0,.36,0,len,.045,.055);
    box(frame,m.bronze,0,.88,0,len,.072,.084,.014);
    const spans=Math.round(len/.31);
    for(let j=1;j<spans;j++){
      const x=(j/spans-.5)*len;
      cylinder(frame,m.iron,x,.592,0,.014,.018,.54,8);
      cylinder(frame,m.bronze,x,.63,0,.034,.024,.067,8);
    }
  }
  function terminal(x,z){
    box(root,m.stone,x,.45,z,.43,.9,.43,.035);
    box(root,m.trim,x,.89,z,.54,.1,.54,.022);
    box(root,m.trim,x,.98,z,.48,.09,.48,.018);
  }
  const chain=[[-6.28,-2.9],[-6.28,-5.1],[-6.28,-7.43],[-3.14,-7.43],[0,-7.43],[3.14,-7.43],[6.28,-7.43],[6.28,-5.1],[6.28,-2.9]];
  chain.forEach(([x,z],i)=>{terminal(x,z);if(i)rail(chain[i-1],chain[i]);});

  // A compass rose set into the outer flags.
  const rose=group(root,0,.016,-5.3);
  ring(rose,m.bronze,0,0,0,.92,.012);ring(rose,m.brass,0,0,0,.81,.012);
  for(let i=0;i<32;i++){
    const tick=group(rose);tick.rotation.y=i*TAU/32;
    box(tick,m.gold,0,.003,.864,i%4===0?.023:.012,.008,i%4===0?.08:.042);
    if(i%4!==0)continue;
    const long=i%8===0?.74:.45;
    for(const side of [-1,1]){
      const s=new T.Shape();s.moveTo(0,0);s.lineTo(side*.081,.14);s.lineTo(0,long);s.closePath();
      const blade=part(tick,new T.ShapeGeometry(s),side>0?m.bronze:m.brass,0,.006,0);
      blade.rotation.x=-Math.PI/2; blade.material.side=T.DoubleSide;
    }
  }
}

export function sconce(root,m,x,y,z,angle=0){
  const g=group(root,x,y,z);g.rotation.y=angle;
  box(g,m.bronze,0,0,0,.21,.46,.075,.029);
  rod(g,m.iron,[0,-.13,.02],[0,-.04,.32],.027);
  const lamp=group(g,0,0,.32);
  cylinder(lamp,m.bronze,0,-.045,0,.16,.1,.1,20);
  cylinder(lamp,m.lamp,0,.14,0,.115,.085,.29,20);
  for(let i=0;i<6;i++){
    const a=TAU*i/6;
    rod(lamp,m.bronze,[.1*Math.cos(a),0,.1*Math.sin(a)],[.13*Math.cos(a),.31,.13*Math.sin(a)],.009,.009,6);
  }
  cylinder(lamp,m.bronze,0,.324,0,.085,.163,.08,20);
  cylinder(lamp,m.gold,0,.38,0,.015,.059,.045,16);
  return lamp;
}
