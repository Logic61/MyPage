const presets={
  low:    {scale:.72, maxDpr:1,   pixels:960000,  opticScale:.90, opticDpr:1.25,opticPixels:1700000,shadow:512, particles:12,layeredClouds:false},
  medium: {scale:1,   maxDpr:1.5, pixels:2500000, opticScale:1.1, opticDpr:1.7, opticPixels:3600000,shadow:1024,particles:38,layeredClouds:true},
  high:   {scale:1.25,maxDpr:2,   pixels:4600000, opticScale:1.4, opticDpr:2.25,opticPixels:6400000,shadow:2048,particles:76,layeredClouds:true}
};

export function renderPreset(name){return Object.hasOwn(presets,name)?presets[name]:presets.medium;}

export function initialQuality(saved,memory,cores){
  if(Object.hasOwn(presets,saved))return saved;
  return (memory>0&&memory<=4)||(cores>0&&cores<=4)?'low':'medium';
}

export function pixelRatio(preset,width,height,dpr,optics){
  const scale=optics?preset.opticScale:preset.scale;
  const limit=optics?preset.opticDpr:preset.maxDpr;
  const budget=optics?preset.opticPixels:preset.pixels;
  return Math.min((dpr||1)*scale,limit,Math.sqrt(budget/(width*height)));
}
