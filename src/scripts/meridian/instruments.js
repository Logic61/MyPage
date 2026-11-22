import * as T from 'three';
import {box,cylinder,drawing,group,lathe,paintedSurface,part,ring,rod,TAU,timber} from './workshop.js';
import {telescopeAt} from './layout.js';

// The optical axis clears both faces of the centre arch and meets the ridge.
export const opticDirection = new T.Vector3(-.47,.146,-.875).normalize();
export const opticPosition = new T.Vector3(telescopeAt.x,2.04,telescopeAt.z).addScaledVector(opticDirection,1.57);

function graduatedDial() {
  return drawing(512,512,(c,w) => {
    const r=w/2; c.translate(r,r);
    c.fillStyle='#a78f5c'; c.fillRect(-r,-r,w,w);
    const sheen=c.createLinearGradient(-r,-r,r,r);
    sheen.addColorStop(0,'#5c513e');sheen.addColorStop(.37,'#d3bd85');sheen.addColorStop(.62,'#a08a59');sheen.addColorStop(1,'#71654a');
    c.fillStyle=sheen;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
    c.strokeStyle='#312e24'; c.fillStyle='#292b24';
    for(const rad of [.93,.73,.49]){c.lineWidth=2;c.beginPath();c.arc(0,0,r*rad,0,TAU);c.stroke();}
    for(let i=0;i<180;i++){
      c.save();c.rotate(i*TAU/180);c.lineWidth=i%5===0?3:1.5;c.beginPath();c.moveTo(0,-r*.91);
      c.lineTo(0,-r*(i%15===0?.74:i%5===0?.79:.85));c.stroke();
      if(i%15===0){c.font='24px Georgia';c.textAlign='center';c.fillText(String(i*2),0,-r*.6);}
      c.restore();
    }
    c.font='italic 21px Georgia';c.textAlign='center';c.fillText('Meridian',0,-20);
  });
}

function wheel(parent,m,x,y,z,r){
  const g=group(parent,x,y,z);
  ring(g,m.gold,0,0,0,r,.019,false,48);
  for(let i=0;i<5;i++){
    const a=i*TAU/5;
    rod(g,m.brass,[0,0,0],[r*Math.cos(a),r*Math.sin(a),0],.011);
  }
  rod(g,m.iron,[0,0,-.045],[0,0,.05],.032);
  rod(g,m.darkwood,[r,0,0],[r,0,.085],.018,.025);
}

export function buildRefractor(root,m) {
  const mount=group(root,telescopeAt.x,0,telescopeAt.z);
  cylinder(mount,m.stone,0,.046,0,1.03,1.08,.084,64);
  ring(mount,m.bronze,0,.09,0,.947,.015);
  // A split hardwood tripod with metal shoes, clamps, and a triangular spreader.
  const feet=[];
  for(let i=0;i<3;i++){
    const a=i*TAU/3+.18, dx=Math.cos(a),dz=Math.sin(a);
    const at=(r,y,side=0)=>[dx*r-dz*side,y,dz*r+dx*side];
    feet.push(at(.54,.61));
    for(const s of [-1,1])timber(mount,m.wood,at(.84,.145,s*.045),at(.265,1.31,s*.075),.09,.109,.016);
    rod(mount,m.bronze,at(.85,.105),at(.805,.226),.065,.083,16);
    rod(mount,m.brass,at(.55,.681),at(.525,.74),.093,.088,16);
    rod(mount,m.iron,at(.268,1.22,-.125),at(.268,1.22,.125),.037,.037,16);
  }
  for(let i=0;i<3;i++)rod(mount,m.bronze,feet[i],feet[(i+1)%3],.016);
  lathe(mount,m.enamel,[[.13,1.15],[.25,1.2],[.32,1.25],[.32,1.31],[.23,1.35],[.21,1.48],[.28,1.5],[.27,1.55],[.15,1.59]]);
  for(const [y,r] of [[1.24,.31],[1.32,.279],[1.5,.263]])ring(mount,m.brass,0,y,0,r,.017);
  const fork=group(mount,0,1.52,0);
  fork.rotation.z=-.3;
  box(fork,m.enamel,0,.17,0,.35,.46,.32,.065);
  rod(fork,m.bronze,[0,.37,-.29],[0,.37,.32],.185,.185,48);
  const dial=group(fork,0,.37,.321);
  const dialTexture=new T.CanvasTexture(graduatedDial());dialTexture.colorSpace=T.SRGBColorSpace;
  const dialMat=new T.MeshStandardMaterial({map:dialTexture,roughness:.55,metalness:.48});
  part(dial,new T.CircleGeometry(.19,64),dialMat);
  ring(dial,m.gold,0,0,.007,.189,.012,false);
  rod(dial,m.iron,[0,0,.016],[-.085,.11,.018],.008,.003);
  wheel(fork,m,0,.37,.43,.112);
  rod(fork,m.gold,[.1,.32,0],[.76,-.12,.03],.032,.029,20);
  rod(fork,m.enamel,[.50,.05,.018],[.7,-.081,.028],.133,.133,36);
  const barrel=group(mount,0,2.04,0);
  barrel.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),opticDirection);
  lathe(barrel,m.enamel,[[.14,-1.02],[.17,-.95],[.18,-.57],[.205,.04],[.226,.66],[.239,1.03],[.235,1.19]],64);
  lathe(barrel,m.brass,[[.073,-1.48],[.086,-1.45],[.085,-1.3],[.12,-1.28],[.12,-1.14],[.145,-1.12],[.145,-.98],[.179,-.94]],48);
  lathe(barrel,m.ink,[[.076,-1.56],[.09,-1.55],[.095,-1.515],[.071,-1.48]],32);
  // The front dew shield has an actual open rim and recessed, convex glass.
  lathe(barrel,m.brass,[[.229,1.02],[.25,1.06],[.253,1.16],[.273,1.2],[.282,1.49],[.287,1.52],[.286,1.55],[.259,1.55],[.25,1.29]],64);
  cylinder(barrel,m.ink,0,1.295,0,.251,.246,.024,64);
  const lens=part(barrel,new T.SphereGeometry(.245,48,20),m.lens,0,1.31,0);
  lens.scale.y=.19;
  ring(barrel,m.bronze,0,1.346,0,.243,.008);
  for(const [h,r,w] of [[-.94,.17,.018],[-.78,.174,.01],[-.30,.197,.043],[.24,.217,.043],[.88,.235,.016],[1.1,.255,.01],[1.48,.282,.012]]){
    cylinder(barrel,m.brass,0,h,0,r+.009,r+.009,w*2,48);
    ring(barrel,m.gold,0,h+w,0,r+.008,.006);
  }
  for(const h of [-.29,.24])for(let i=0;i<8;i++){
    const a=TAU*i/8,r=h<0?.206:.224;
    rod(barrel,m.bronze,[Math.cos(a)*r,h,Math.sin(a)*r],[Math.cos(a)*(r+.014),h,Math.sin(a)*(r+.014)],.014,.014,6);
  }
  const finder=group(barrel,.0,-.19,.305);
  for(const h of [-.21,.27]){
    rod(finder,m.brass,[0,h,-.145],[0,h,0],.024);
    ring(finder,m.gold,0,h,0,.053,.011);
  }
  lathe(finder,m.enamel,[[.03,-.43],[.044,-.37],[.048,.28],[.062,.32],[.061,.43]],24);
  cylinder(finder,m.brass,0,.425,0,.064,.064,.047,24);
  cylinder(finder,m.lens,0,.45,0,.051,.051,.004,24);
  for(let i=0;i<12;i++)ring(barrel,m.bronze,0,-1.255+i*.009,0,.122,.0035,true,32);
  for(let i=0;i<72;i++){
    const a=i*TAU/72,r=.256;
    rod(barrel,m.bronze,[Math.cos(a)*r,1.10,Math.sin(a)*r],
      [Math.cos(a)*r,1.10+(i%6===0?.047:.021),Math.sin(a)*r],.002,.002,5);
  }
  // Orient the dedication plate tangentially to the barrel. Its lettering
  // stays readable when approached from the eyepiece side.
  const side=new T.Vector3(.12,.22,1);
  side.addScaledVector(opticDirection,-side.dot(opticDirection)).normalize();
  const along=opticDirection.clone().negate(),vertical=side.clone().cross(along).normalize();
  const plate=group(mount);
  plate.position.set(0,2.04,0).addScaledVector(opticDirection,.54).addScaledVector(side,.227);
  plate.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(along,vertical,side));
  box(plate,m.bronze,0,0,0,.49,.122,.015,.009);
  const inscription=drawing(768,180,(c,w,h)=>{
    c.fillStyle='#394640';c.fillRect(0,0,w,h);c.strokeStyle='#b79d6c';c.lineWidth=4;c.strokeRect(12,12,w-24,h-24);
    c.fillStyle='#e6ce9b';c.textAlign='center';c.font='56px Georgia';c.fillText('M É R I D I E N',w/2,86);
    c.font='22px Georgia';c.fillText('L U N E T T E   É Q U A T O R I A L E',w/2,130);
  });
  paintedSurface(plate,inscription,0,0,.009,.473,.11);
  for(const x of [-.222,.222])for(const y of [-.039,.039])rod(plate,m.gold,[x,y,.008],[x,y,.016],.009,.008,8);
}

export function armillary(parent,m,x,y,z,scale=1){
  const g=group(parent,x,y,z);g.scale.setScalar(scale);
  lathe(g,m.bronze,[[.18,0],[.19,.03],[.12,.055],[.082,.07],[.055,.14],[.077,.19],[.066,.23]]);
  const orb=group(g,0,.42,0);
  ring(orb,m.gold,0,0,0,.24,.014,false);
  for(const [tilt,spin,r] of [[.54,.5,.20],[.96,-.2,.215],[-.48,1.32,.196]]){
    const r1=ring(orb,m.brass,0,0,0,r,.01,false,56);r1.rotation.set(tilt,spin,.27);
  }
  part(orb,new T.SphereGeometry(.049,20,12),m.enamel);
  rod(orb,m.gold,[-.085,-.19,-.12],[.085,.19,.12],.008);
}
