import * as T from 'three';

// Alpha in the full-sphere panorama marks open sky. A cloud can pass
// behind the crest without painting over rock or the focused summit plate.
export function alpineBackdrop(panorama,valleyFloor,weather,time){
  panorama.colorSpace=T.SRGBColorSpace;panorama.wrapS=T.RepeatWrapping;
  valleyFloor.colorSpace=T.SRGBColorSpace;
  weather.wrapS=weather.wrapT=T.RepeatWrapping;
  const material=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{panorama:{value:panorama},valleyFloor:{value:valleyFloor},weather:{value:weather},summit:{value:panorama},resolved:{value:0},layeredClouds:{value:1},weatherTime:time},
    vertexShader:`
      varying vec3 direction;
      void main(){
        direction=position;
        vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
        gl_Position=p.xyww;
      }`,
    fragmentShader:`
      uniform sampler2D panorama,valleyFloor,weather,summit;
      uniform float resolved,layeredClouds,weatherTime;
      varying vec3 direction;
      const float PI=3.14159265359;
      float azimuth(vec3 ray){
        return dot(ray.xz,ray.xz)>.00000001?atan(ray.x,-ray.z):0.;
      }
      vec4 landscape(vec3 ray){
        vec2 uv=vec2(.5+azimuth(ray)/(2.*PI),.5+asin(clamp(ray.y,-1.,1.))/PI);
        // Mip selection across due south uses the small step through the
        // wrap, not a change of one entire texture width.
        vec2 dx=dFdx(uv),dy=dFdy(uv);
        dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);
        return textureGrad(panorama,uv,dx,dy);
      }
      vec2 deck(vec3 ray,float height,float curvature){
        return ray.xz/(height+sqrt(height*height+curvature));
      }
      vec3 highClouds(vec3 color,vec3 ray,float clearSky,vec2 wind){
        float h=max(0.,ray.y);
        vec2 p=deck(ray,h,.20);
        vec2 field=vec2(.93*p.x+.36*p.y,-.36*p.x+.93*p.y);
        float strands=texture2D(weather,field*vec2(.62,.79)+vec2(.13,.37)+wind).r;
        vec3 veil=vec3(0.,.65,.45);
        if(layeredClouds>.5)veil=texture2D(weather,field*vec2(.28,.40)+vec2(.63,.16)+wind*.59).rgb;
        float filaments=strands*(.59+.41*veil.g);
        float thinVeil=veil.r*(.32+.68*veil.b);
        float heightFade=smoothstep(.018,.23,h);
        float sun=pow(max(0.,dot(ray,normalize(vec3(-.97,.18,-.13)))),3.);
        vec3 silver=mix(vec3(.51,.61,.72),vec3(.98,.68,.45),.18+.77*sun);
        color=mix(color,silver,clearSky*heightFade*filaments*(.35+.25*h));
        return mix(color,mix(silver,vec3(.37,.46,.58),.32),clearSky*heightFade*thinVeil*.11);
      }
      vec3 valleyMist(vec3 color,vec3 ray,vec2 wind){
        float depression=max(0.,-ray.y);
        vec2 p=deck(ray,depression,.12)+cameraPosition.xz*.00065;
        float rolling=texture2D(weather,p*vec2(.26,.43)+vec2(.29,.78)+wind*1.55).g;
        float wisps=rolling;
        if(layeredClouds>.5)wisps=texture2D(weather,p*vec2(.51,.83)+vec2(.80,.13)+wind*1.21).b;
        float density=smoothstep(.39,.76,.74*rolling+.26*wisps);
        float heightFade=smoothstep(.002,.15,depression)*(1.-.74*smoothstep(.30,.90,depression));
        float cool=smoothstep(-.025,.12,color.b-color.r);
        vec3 mist=mix(vec3(.36,.44,.53),vec3(.51,.54,.58),max(0.,-ray.x)*.65);
        return mix(color,mist,density*heightFade*(.18+.18*cool));
      }
      void main(){
        vec3 ray=normalize(direction);
        float parallax=smoothstep(.12,.70,-ray.y);
        vec3 groundRay=normalize(ray+vec3(cameraPosition.x,0.,cameraPosition.z)*(.0013*parallax));
        vec4 base=landscape(groundRay);
        vec3 c=base.rgb;
        // A square chart looking straight down keeps even the last few degrees
        // at the pole at native density. Its tree positions match the sphere.
        float floorWeight=smoothstep(.73,.93,-groundRay.y);
        if(floorWeight>0.){
          vec2 floorUV=.5+.49*vec2(groundRay.x,-groundRay.z);
          c=mix(c,texture2D(valleyFloor,floorUV).rgb,floorWeight);
        }
        float elevation=asin(clamp(ray.y,-1.,1.));
        vec2 plate=(vec2(.67+azimuth(ray)/3.45,.42+elevation/.99)-vec2(.420,.315))/vec2(.185,.440);
        if(resolved>.5 && all(greaterThan(plate,vec2(0.))) && all(lessThan(plate,vec2(1.)))){
          vec2 edge=smoothstep(vec2(0.),vec2(.016),min(plate,1.-plate));
          c=mix(c,texture2D(summit,plate).rgb,edge.x*edge.y*(1.-smoothstep(.24,.326,elevation)));
        }
        vec2 wind=vec2(-.0034,.0011)*weatherTime;
        if(base.a>.55 && ray.y>0.)c=highClouds(c,ray,smoothstep(.56,.97,base.a),wind);
        if(ray.y<0.)c=valleyMist(c,ray,wind);
        gl_FragColor=vec4(c*1.05,1.);
        #include <colorspace_fragment>
      }`
  });
  const sky=new T.Mesh(new T.SphereGeometry(50,48,28),material);
  sky.renderOrder=-10;sky.frustumCulled=false;sky.layers.enable(1);
  return sky;
}

// The batched geometry is in world coordinates. Branch tips move within the
// slower travelling gust, with the lower crown almost still.
export function pineWind(material,time){
  material.onBeforeCompile=shader=>{
    shader.uniforms.pineTime=time;
    shader.vertexShader='uniform float pineTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float crown=smoothstep(-4.1,1.75,position.y);
      float gust=sin(pineTime*1.07-position.x*.37-position.z*.16);
      float flutter=sin(pineTime*2.9+position.y*3.2+position.z);
      float bend=(.052*gust+.015*flutter)*crown*(.36+.64*uv.y);
      transformed.x+=bend;
      transformed.z-=bend*.34;
    `);
  };
}
