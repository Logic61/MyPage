import {bookAt,deskAt,telescopeAt} from './layout.js';

const points={
  shelf:[bookAt.x+.34,2.25,bookAt.z-.01],
  desk:[deskAt.x-.16,1.61,deskAt.z],
  scope:[telescopeAt.x+.05,2.48,telescopeAt.z+.08]
};

// Edge bearings remain legible when an exhibit is beside or behind the player.
// Project just three anchors. No surface or triangle picking runs in this path.
export function makeSignposts(root) {
  const entries=[...root.querySelectorAll('[data-station]')].map((el,order)=>({el,order,id:el.dataset.station,p:points[el.dataset.station]}));
  let width=0,height=0;
  function resize(){width=root.clientWidth;height=root.clientHeight;}
  resize();
  return {
    resize,
    guide(id){for(const e of entries)e.el.classList.toggle('tracked',e.id===id);},
    update(cam,active){
      const compact=width<700,padX=compact?48:71, top=compact?107:93, bottom=height-(compact?133:94);
      const focal=(height/2)/Math.tan(cam.fov*Math.PI/360);
      const cy=Math.cos(cam.rotation.y),sy=Math.sin(cam.rotation.y),cp=Math.cos(cam.rotation.x),sp=Math.sin(cam.rotation.x);
      const used=[];
      for(const e of entries){
        const [x,y,z]=e.p,dx=x-cam.position.x,dy=y-cam.position.y,dz=z-cam.position.z;
        const side=cy*dx-sy*dz,flat=-sy*dx-cy*dz,depth=flat*cp+dy*sp;
        const xx=width/2+side*focal/Math.max(.01,depth),yy=height/2-(dy*cp-flat*sp)*focal/Math.max(.01,depth);
        const edge=depth<.2||xx<padX||xx>width-padX;
        let px=edge?(side<0?padX:width-padX):xx;
        let py=edge?top+(bottom-top)*([.18,.38,.61][e.order]):Math.max(top,Math.min(bottom,yy-22));
        for(const prev of used) {
          if(Math.abs(prev.x-px)<(compact?90:120)&&Math.abs(prev.y-py)<48)
            py=prev.y+54<=bottom?prev.y+54:prev.y-54;
        }
        used.push({x:px,y:py});
        const left=Math.round(px),yPx=Math.round(py);
        if(e.left!==left||e.top!==yPx){
          e.left=left;e.top=yPx;e.el.style.transform='translate3d('+left+'px,'+yPx+'px,0) translate(-50%,-50%)';
        }
        const dir=edge?(side<0?'left':'right'):'in';
        if(e.el.dataset.side!==dir)e.el.dataset.side=dir;
        e.el.classList.toggle('near',active===e.id);
      }
    }
  };
}
