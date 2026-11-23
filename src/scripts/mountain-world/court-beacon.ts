import * as THREE from 'three';

type Palette = { stone: THREE.Material; shadeStone: THREE.Material; bronze: THREE.Material; gilt: THREE.Material; silk: THREE.Material };

/** The same bronze palace lantern is cast for the bridge and the corners of the reflecting pool. */
export function createStoneBeacon(keep: <T extends THREE.BufferGeometry>(geometry: T) => T) {
  const cube = keep(new THREE.BoxGeometry(1,1,1));
  function turning(profile: number[][], sides: number) {
    return keep(new THREE.LatheGeometry(profile.map(([r,h]) => new THREE.Vector2(r,h)),sides));
  }
  const foot = turning([[.23,0],[.25,.018],[.25,.040],[.21,.054],[.176,.095],[.19,.125],[.222,.14],[.222,.16]],8);
  const finial = turning([[.075,0],[.093,.015],[.08,.039],[.045,.052],[.071,.068],[.086,.117],[.073,.157],[.04,.178],[.026,.184],[0,.223]],20);
  const outline = new THREE.Shape();
  outline.moveTo(-.174,-.213);outline.lineTo(.174,-.213);outline.lineTo(.174,.213);outline.lineTo(-.174,.213);outline.closePath();
  for (const side of [-1,1]) for(const end of [-1,1]) {
    const hole = new THREE.Path();
    hole.moveTo(side*.025,end*.025);
    hole.bezierCurveTo(side*.022,end*.100,side*.061,end*.164,side*.139,end*.182);
    hole.bezierCurveTo(side*.153,end*.091,side*.110,end*.038,side*.025,end*.025);
    hole.closePath(); outline.holes.push(hole);
  }
  for(let i=0;i<4;i++){
    const hole=new THREE.Path(),scale=i%2?.155:.192;
    const to=(x:number,y:number)=>new THREE.Vector2(x,y).rotateAround(new THREE.Vector2(),i*Math.PI/2);
    const start=to(0,.043);hole.moveTo(start.x,start.y);
    for(const [x,y] of [[.030,.107],[0,scale],[-.030,.107]]){const p=to(x,y);hole.lineTo(p.x,p.y);}
    hole.closePath();outline.holes.push(hole);
  }
  const grille = keep(new THREE.ExtrudeGeometry(outline,{depth:.013,curveSegments:8,bevelEnabled:false}));
  const roofVertices: number[] = [], roofFaces: number[] = [];
  for(let row=0;row<=7;row++) for(let col=0;col<=12;col++) {
    const v=row/7,u=col/6-1,r=.086+.253*v;
    roofVertices.push(u*r,.208*(1-v)**2+.047*Math.abs(u)**4*v**2,r);
    if(row&&col) {
      const b=row*13+col;
      roofFaces.push(b-14,b-1,b-13,b-13,b-1,b);
    }
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3)); skin.setIndex(roofFaces);
  skin.computeVertexNormals();const roof = keep(skin);
  const rib = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(.086,.209,.086),new THREE.Vector3(.149,.127,.149),new THREE.Vector3(.208,.067,.208),
    new THREE.Vector3(.274,.041,.274),new THREE.Vector3(.34,.048,.34),new THREE.Vector3(.357,.072,.357),
  ]),12,.011,5,false));
  const lip = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-1,-.66,0,.66,1].map(u=>new THREE.Vector3(u*.339,.047*Math.abs(u)**4,.339))),12,.012,6,false));

  return function build(parent: THREE.Group, palette: Palette) {
    const place=(host: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,x:number,y:number,z:number,w=1,h=1,d=1)=>{
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
      mesh.castShadow=mesh.receiveShadow=true;host.add(mesh);return mesh;
    };
    const {stone,shadeStone,bronze,gilt,silk}=palette;
    place(parent,cube,shadeStone,0,.075,0,.63,.15,.63);
    place(parent,cube,stone,0,.288,0,.54,.29,.54);
    place(parent,cube,shadeStone,0,.441,0,.57,.037,.57);
    place(parent,cube,stone,0,.493,0,.635,.086,.635);
    const lantern=new THREE.Group();lantern.name='Pierced bronze lantern';parent.add(lantern);
    place(lantern,foot,bronze,0,.536,0);
    place(lantern,cube,gilt,0,.695,0,.409,.018,.409);
    place(lantern,cube,silk,0,.923,0,.325,.424,.325);
    place(lantern,cube,bronze,0,1.152,0,.422,.049,.422);
    place(lantern,cube,gilt,0,1.183,0,.432,.012,.432);
    place(lantern,cube,bronze,0,1.41,0,.182,.042,.182);
    place(lantern,finial,gilt,0,1.414,0);
    for(let face=0;face<4;face++){
      const wing=new THREE.Group();wing.rotation.y=face*Math.PI/2;lantern.add(wing);
      place(wing,grille,bronze,0,.923,.168);
      place(wing,cube,gilt,0,.923,.185,.043,.043,.014).rotation.z=Math.PI/4;
      place(wing,cube,gilt,.177,.924,.177,.019,.448,.019);
      place(wing,roof,bronze,0,1.205,0);
      place(wing,rib,gilt,0,1.205,0);
      place(wing,lip,gilt,0,1.205,0);
      // The recessed stone tablet is bounded by two stepped quirk mouldings.
      place(wing,cube,shadeStone,0,.286,.270,.255,.195,.006);
      for(const side of [-1,1]){
        place(wing,cube,stone,side*.141,.286,.275,.014,.196,.012);
        place(wing,cube,stone,0,.286+side*.109,.275,.273,.012,.012);
      }
    }
    return lantern;
  };
}
