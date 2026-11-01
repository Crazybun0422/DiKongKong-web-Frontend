// DJI Inspire 3 visual study V02. Photograph-derived proportions, not engineering CAD.
// Design coordinates: millimetres, +Y up, +Z nose. Export root scales to metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { createCamera } from './camera.js';
const V=(...p)=>new THREE.Vector3(...p), TAU=Math.PI*2;
const phys=(name,color,roughness,metalness=0,extra={})=>new THREE.MeshPhysicalMaterial({name,color,roughness,metalness,...extra});

// Small, deterministic moulded-polymer grain. Embedded in the GLB, no remote textures.
function surfaceMaps() {
  const size=256, normal=document.createElement('canvas'),rough=document.createElement('canvas');
  normal.width=normal.height=rough.width=rough.height=size;
  const nc=normal.getContext('2d'),rc=rough.getContext('2d'),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  let seed=41791;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const noise=Array.from({length:size*size},()=>rand());
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,j=i*4,a=noise[i];
    ni.data.set([128+Math.round((a-noise[y*size+(x+1)%size])*34),128+Math.round((a-noise[((y+1)%size)*size+x])*34),254,255],j);
    const r=Math.round(225+a*25);ri.data.set([r,r,r,255],j);
  }
  nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  const normalMap=new THREE.CanvasTexture(normal),roughnessMap=new THREE.CanvasTexture(rough);
  for(const t of [normalMap,roughnessMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3.5,3.5);t.anisotropy=8;}
  normalMap.name='Moulded polymer micro-normal';roughnessMap.name='Moulded polymer micro-roughness';
  return {normalMap,roughnessMap,normalScale:new THREE.Vector2(.6,.6)};
}
const grain=surfaceMaps();
const M={
  upper:phys('Warm pearl grey upper polymer','#b8b9b3',.43,.015,{...grain,clearcoat:.08,clearcoatRoughness:.5}),
  shell:phys('Satin grey structural polymer','#a9aba5',.48,.015,{...grain}),
  belly:phys('Fine textured lower polymer','#92958f',.53,0,{...grain}),
  dark:phys('Graphite injection moulding','#252827',.46),
  rubber:phys('Landing pad elastomer','#171a18',.82),
  metal:phys('Bead blasted anodised aluminium','#414846',.32,.82),
  silver:phys('Satin steel fasteners','#989f9c',.27,.94),
  motor:phys('Brushed silver motor bell','#8f968f',.34,.78),
  blackMetal:phys('Black anodised optical barrel','#171e1f',.29,.82),
  copper:phys('Recessed motor copper windings','#66472c',.5,.8),
  blade:phys('Fine graphite composite propellers','#303735',.37,.12,{...grain,clearcoat:.22,clearcoatRoughness:.32}),
  tip:phys('Orange propeller safety paint','#e86d24',.43,.03),
  glass:phys('Optical coating blue violet','#101d27',.095,.18,{clearcoat:1,clearcoatRoughness:.035,ior:1.52,iridescence:.7,iridescenceIOR:1.35,iridescenceThicknessRange:[160,310]}),
  inner:phys('Deep optical barrel','#03070a',.32,.12),
  seam:phys('Recessed panel joint','#4f5651',.65),
  led:phys('Battery status diffuser','#5c9e64',.38,0,{emissive:'#153d19',emissiveIntensity:.25}),
  light:phys('Ground lamp diffuser','#dbddd2',.28),
};
// A fine two-over/two-under twill weave, with separate reflectance and normal detail.
// The weave is embedded in the asset rather than fetched by the preview page.
function carbonMaps(){
  const size=512,c=document.createElement('canvas'),n=document.createElement('canvas'),r=document.createElement('canvas');
  for(const e of [c,n,r])e.width=e.height=size;
  const cc=c.getContext('2d'),nc=n.getContext('2d'),rc=r.getContext('2d');
  const ci=cc.createImageData(size,size),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  const height=(x,y)=>{const ix=Math.floor(x/32),iy=Math.floor(y/32),over=((ix+iy)%4+4)%4<2,u=over?y:x;return Math.sin((u%32)/32*Math.PI)*.7+Math.sin(u*Math.PI*.5)*.04;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,over=(Math.floor(x/32)+Math.floor(y/32))%4<2;
    const strand=Math.sin((over?y:x)*Math.PI*.5)*2,h=height(x,y),v=27+h*15+(over?5:0)+strand;
    ci.data.set([v*.95,v,v*1.04,255],i);
    ni.data.set([128+(height(x,y)-height((x+1)%size,y))*100,128+(height(x,y)-height(x,(y+1)%size))*100,254,255],i);
    const rv=190+(over?8:0)+h*10;ri.data.set([rv,rv,rv,255],i);
  }
  cc.putImageData(ci,0,0);nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  const map=new THREE.CanvasTexture(c),normalMap=new THREE.CanvasTexture(n),roughnessMap=new THREE.CanvasTexture(r);
  map.colorSpace=THREE.SRGBColorSpace;
  for(const t of [map,normalMap,roughnessMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.1,4);t.anisotropy=16;}
  map.name='Carbon twill albedo';normalMap.name='Carbon twill relief';roughnessMap.name='Carbon twill roughness';
  return {map,normalMap,roughnessMap,normalScale:new THREE.Vector2(.2,.2)};
}
M.body=phys('Inspire 3 satin titanium-grey fairing','#95969a',.43,.08,{...grain,clearcoat:.12,clearcoatRoughness:.35});
M.shell=M.body;
M.dark=phys('Graphite structural polymer','#24272b',.41,.06,{...grain});
M.carbon=phys('Twill carbon fibre reinforced tubes','#ffffff',.4,.32,{...carbonMaps(),clearcoat:.38,clearcoatRoughness:.25});
M.blade=phys('Carbon composite propeller','#292c30',.4,.18,{...grain,clearcoat:.16});
M.seam=phys('Recessed gasket','#0c1013',.7);
M.rubber=phys('Soft black rubber pads','#101316',.83);
M.motor=phys('Black anodised motor bell','#303236',.32,.82);
M.ledRed=phys('Red port navigation light','#b62520',.28,0,{emissive:'#ec190b',emissiveIntensity:.3});
M.ledGreen=phys('Green starboard navigation light','#23885e',.28,0,{emissive:'#12c36a',emissiveIntensity:.3});
function mesh(p,n,g,m,pos=[0,0,0]){const o=new THREE.Mesh(g,m);o.name=n;o.position.set(...pos);p.add(o);return o;}
function box(p,n,size,pos,m,r=1.2){return mesh(p,n,new RoundedBoxGeometry(...size,r<.4?1:2,Math.min(r,...size.map(v=>v*.45))),m,pos);}
function cylinder(p,n,r,h,pos,m,axis=[0,1,0],rb=r,segments=48){const o=mesh(p,n,new THREE.CylinderGeometry(r,rb,h,segments),m,pos);o.quaternion.setFromUnitVectors(V(0,1,0),V(...axis).normalize());return o;}
function torus(p,n,r,t,pos,m,axis=[0,0,1]){const o=mesh(p,n,new THREE.TorusGeometry(r,t,8,64),m,pos);o.quaternion.setFromUnitVectors(V(0,0,1),V(...axis).normalize());return o;}
function tube(p,n,points,r,m){return mesh(p,n,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(x=>V(...x))),Math.max(24,points.length*8),r,6,false),m);}
function beam(p,n,a,b,w,d,m){const from=V(...a),delta=V(...b).sub(from),o=box(p,n,[w,delta.length(),d],from.addScaledVector(delta,.5).toArray(),m,Math.min(w,d)*.3);o.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return o;}
function geoFromRings(rings,around){
  const positions=rings.flat(),idx=[],uv=[];
  for(let i=0;i<rings.length;i++)for(let j=0;j<=around;j++)uv.push(j/around,i/(rings.length-1));
  const stride=around+1;
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<around;j++){const a=i*stride+j,b=a+1,c=b+stride,d=a+stride;idx.push(a,b,c,a,c,d);}
  for(const end of [0,rings.length-1]){
    const start=end*stride,centre=V();for(let j=0;j<around;j++)centre.add(V(...positions.slice((start+j)*3,(start+j)*3+3)));centre.multiplyScalar(1/around);
    const ci=positions.length/3;positions.push(...centre.toArray());uv.push(.5,end===0?0:1);
    for(let j=0;j<around;j++)idx.push(ci,start+(end===0?j+1:j),start+(end===0?j:j+1));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const signed=(v,p)=>Math.sign(v)*Math.pow(Math.abs(v),2/p);
function interpSections(sections,steps=100){
  // Catmull-Rom interpolation for each column removes the old faceted section joins.
  const result=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps*(sections.length-1),k=Math.min(Math.floor(t),sections.length-2),f=t-k,row=[];
    for(let c=0;c<sections[0].length;c++){
      const p0=sections[Math.max(0,k-1)][c],p1=sections[k][c],p2=sections[k+1][c],p3=sections[Math.min(sections.length-1,k+2)][c];
      row.push(.5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f));
    }result.push(row);
  }return result;
}
function shell(p,n,sections,m,{power=2.8,nose=false,steps=96}={}){
  const rows=interpSections(sections,steps),around=64,rings=[];
  for(const [z,w,cy,h]of rows){const ring=[];for(let j=0;j<=around;j++){
    const a=j/around*TAU,x=w*signed(Math.cos(a),power);let y=cy+h*signed(Math.sin(a),power),zz=z;
    if(nose){const f=THREE.MathUtils.smoothstep(z,32,64),mid=Math.pow(1-Math.abs(x)/Math.max(w,.001),2);zz-=12*f*mid;if(Math.sin(a)<0)y+=9*f*mid;}
    ring.push(x,y,zz);
  }rings.push(ring);}return mesh(p,n,geoFromRings(rings,around),m);
}
function armLoft(p,n,pts,sections,m){
  const curve=new THREE.CatmullRomCurve3(pts.map(x=>V(...x))),rings=[],around=24;
  for(let i=0;i<=40;i++){
    const t=i/40,c=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
    const side=new THREE.Vector3().crossVectors(V(0,1,0),tangent).normalize(),up=new THREE.Vector3().crossVectors(tangent,side).normalize();
    const k=Math.min(Math.floor(t*(sections.length-1)),sections.length-2),f=t*(sections.length-1)-k;
    const w=THREE.MathUtils.lerp(sections[k][0],sections[k+1][0],f),h=THREE.MathUtils.lerp(sections[k][1],sections[k+1][1],f),ring=[];
    for(let j=0;j<=around;j++){const a=j/around*TAU,q=c.clone().addScaledVector(side,signed(Math.cos(a),2.8)*w/2).addScaledVector(up,signed(Math.sin(a),2.8)*h/2);ring.push(...q.toArray());}
    rings.push(ring);
  }
  return mesh(p,n,geoFromRings(rings,around),m);
}
function screw(p,n,pos,axis=[0,1,0],r=.85){
  const g=new THREE.Group();g.name=n;g.position.set(...pos);g.quaternion.setFromUnitVectors(V(0,1,0),V(...axis).normalize());p.add(g);
  cylinder(g,'Recess counterbore',r*1.3,.22,[0,-.05,0],M.seam);
  cylinder(g,'Steel screw head',r,.19,[0,.08,0],M.silver);
  for(const a of [0,Math.PI/2]){const o=box(g,'Cross driver recess',[r*1.25,.035,r*.28],[0,.195,0],M.inner,.04);o.rotation.y=a;}return g;
}
function label(p,n,text,w,h,pos,axis=[0,1,0],color='#666e69',weight=500){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,1024,256);ctx.fillStyle=color;ctx.font=`${weight} 140px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,132,980);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.name=n+' print';
  const m=phys(n+' ink','#ffffff',.65,0,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const o=mesh(p,n,new THREE.PlaneGeometry(w,h),m,pos);o.quaternion.setFromUnitVectors(V(0,0,1),V(...axis).normalize());return o;
}
function lens(p,n,pos,normal,r,{camera=false}={}){
  const g=new THREE.Group();g.name=n;g.position.set(...pos);g.quaternion.setFromUnitVectors(V(0,0,1),V(...normal).normalize());p.add(g);
  cylinder(g,'Recessed optical bezel',r,.65,[0,0,-.15],M.dark,[0,0,1]);
  cylinder(g,'Anodised optical barrel',r*.9,.5,[0,0,.23],M.blackMetal,[0,0,1]);
  torus(g,'Machined lens rim',r*.83,r*.026,[0,0,.57],M.metal);
  for(let i=0;i<3;i++)torus(g,'Fine concentric lens groove '+i,r*(.76+i*.025),r*.007,[0,0,.57],M.inner);
  cylinder(g,'Dark recessed aperture',r*.75,.1,[0,0,.39],M.inner,[0,0,1]);
  // Curved front element gives real environment reflections rather than a painted bright dot.
  const glass=mesh(g,'Aspherical coated front element',new THREE.SphereGeometry(1,48,24),M.glass,[0,0,.64]);glass.scale.set(r*.72,r*.72,.38);
  const pupil=mesh(g,'Inner glass aperture',new THREE.SphereGeometry(1,32,16),M.inner,[0,0,1.015]);pupil.scale.set(r*.24,r*.24,.045);
  torus(g,'Coated inner optical rim',r*.39,.08,[0,0,.97],M.metal);
  if(camera){
    torus(g,'Lens front accent',r*.94,.13,[0,0,.42],M.silver);
    for(let i=0;i<36;i++){
      const a=i/36*TAU,o=box(g,'Barrel edge knurl '+i,[.12,.42,.18],[Math.cos(a)*r*.93,Math.sin(a)*r*.93,.3],M.blackMetal,.04);o.rotation.z=a;
    }
  }return g;
}
function bladeGeometry(start,end){
  const rings=[],around=16;
  for(let i=0;i<=28;i++){
    const t=start+(end-start)*i/28,span=15+188.2*t,chord=(15+26*Math.sin(Math.PI*Math.pow(t,.72)))*(1-.54*t),sweep=7*t+9*Math.sin(Math.PI*t),twist=THREE.MathUtils.degToRad(19-12*t),ring=[];
    for(let j=0;j<=around;j++){const a=j/around*TAU,z=Math.cos(a)*chord*.5,y=Math.sin(a)*(1.15*(1-t)+.27);ring.push(span,y*Math.cos(twist)-z*Math.sin(twist),sweep+z*Math.cos(twist)+y*Math.sin(twist));}rings.push(ring);
  }
  const g=geoFromRings(rings,around),idx=g.index.array;for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];g.computeVertexNormals();return g;
}

function rod(p,n,a,b,r,m,rb=r){const delta=V(...b).sub(V(...a));return cylinder(p,n,r,delta.length(),V(...a).addScaledVector(delta,.5).toArray(),m,delta.toArray(),rb,48);}
function collar(p,n,a,b,r,m){return rod(p,n,a,b,r,m);}
const fairingBulge=(y,z)=>9*Math.exp(-(((z-62)/87)**2+((y-274)/56)**2))+3*Math.exp(-(((z+100)/63)**2+((y-178)/32)**2))-2.5*Math.max(0,(z-110)/32);
const fairingX=(y,z)=>43.3+fairingBulge(y,z);
const fairingNormal=(side,y,z)=>V(side,-(fairingBulge(y+.1,z)-fairingBulge(y-.1,z))/.2,-(fairingBulge(y,z+.1)-fairingBulge(y,z-.1))/.2).normalize();

function fairingPrint(parent,side){
  const print=label(parent,'Model name '+side,'INSPIRE 3',56,8,[0,0,0],[0,0,1],'#51555c',600);
  print.geometry.dispose();print.geometry=new THREE.PlaneGeometry(56,8,24,6);
  const p=print.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const y=278+p.getY(i),z=62-side*p.getX(i);p.setXYZ(i,side*(fairingX(y,z)+.21),y,z);}
  print.geometry.computeVertexNormals();return print;
}

function contourFairing(input){
  // Subdivide the planar cap before shaping it; a simple extruded silhouette would
  // have an implausibly flat sheet-metal side, instead of a moulded compound curve.
  const original=input.index?input.toNonIndexed():input,src=original.attributes.position;
  const points=[],indices=[],cache=new Map();
  function add(v){
    const [x,y,z]=v;
    const bulge=fairingBulge(y,z);
    const q=[x+bulge,y,z],key=q.map(a=>a.toFixed(5)).join(',');
    let k=cache.get(key);if(k===undefined){k=points.length/3;points.push(...q);cache.set(key,k);}return k;
  }
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
  function subdivide(a,b,c,depth){
    if(depth<5&&Math.max(distance(a,b),distance(b,c),distance(c,a))>13){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);subdivide(a,ab,ca,depth+1);subdivide(ab,b,bc,depth+1);subdivide(ca,bc,c,depth+1);subdivide(ab,bc,ca,depth+1);}
    else indices.push(add(a),add(b),add(c));
  }
  for(let i=0;i<src.count;i+=3)subdivide([src.getX(i),src.getY(i),src.getZ(i)],[src.getX(i+1),src.getY(i+1),src.getZ(i+1)],[src.getX(i+2),src.getY(i+2),src.getZ(i+2)],0);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);
  const uv=[];for(let i=0;i<points.length;i+=3)uv.push(points[i+2]/110,points[i+1]/110);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  input.dispose();return g;
}

// The side fairing is a real open frame. No black decal is used for its aperture.
function sideFairing(parent,side){
  const sh=new THREE.Shape();
  sh.moveTo(151,153);
  sh.bezierCurveTo(165,158,170,184,158,222);
  sh.bezierCurveTo(134,251,48,294,-8,317);
  sh.bezierCurveTo(-45,334,-85,340,-115,330);
  sh.bezierCurveTo(-137,324,-142,309,-140,281);
  sh.bezierCurveTo(-140,259,-126,248,-109,240);
  sh.bezierCurveTo(-66,217,-38,190,10,169);
  sh.bezierCurveTo(56,149,120,141,151,153);
  const h=new THREE.Path();h.moveTo(123,177);
  h.bezierCurveTo(93,165,54,177,16,195);
  h.bezierCurveTo(-5,209,-24,234,-27,256);
  h.bezierCurveTo(-30,280,-25,293,-10,293);
  h.bezierCurveTo(34,282,101,253,128,225);
  h.bezierCurveTo(137,209,135,186,123,177);sh.holes.push(h);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:5.5,steps:1,bevelEnabled:true,bevelThickness:2.8,bevelSize:2.8,bevelSegments:5,curveSegments:28});
  geo.rotateY(Math.PI/2);
  const o=mesh(parent,'Open sculpted side fairing '+(side<0?'L':'R'),contourFairing(geo),M.body,[side*35,0,0]);o.scale.x=side;
  return o;
}

export function createDrone(){
  const root=new THREE.Group();root.name='DJI_Inspire_3_Visual_Study_V02';root.scale.setScalar(.001);
  root.userData={version:'0.2',aircraft:'DJI Inspire 3',units:'metres',type:'visual-reconstruction',notEngineeringCAD:true,source:'Official DJI product photographs',pose:'Landing gear lowered'};
  const body=new THREE.Group();body.name='Fuselage';root.add(body);
  for(const side of [-1,1])sideFairing(body,side);
  shell(body,'Continuous arched top fairing',[
    [-157,31,220,3.8],[-141,35,240,4.5],[-98,38.5,267,5],[-43,40,293,5],
    [7,41,315,5],[51,41,331,5],[91,38,332,5],[117,32,323,4.7]
  ],M.body,{power:3,steps:100});
  shell(body,'Curved narrow nose',[[100,33,285,36],[117,34,288,35],[131,28,291,31],[138,20,293,24],[140,11,294,16]],M.body,{power:3.1,steps:50});
  shell(body,'Lower chassis keel',[
    [-155,32,153,3],[-122,34,150,4],[-66,34,157,4.5],[-11,34,179,4.5],[45,32,213,5],[97,30,242,4],[117,26,251,3.5]
  ],M.dark,{power:3.2,steps:80});

  // The raised FPV module and its two visible pivots sit at the tip of the nose.
  box(body,'FPV recessed surround',[40,40,7],[0,315,136],M.dark,8);
  box(body,'FPV camera inner housing',[29,29,14],[0,315,140],M.blackMetal,7);
  lens(body,'FPV Camera',[0,315,149],[0,0,1],10.4,{camera:true});
  for(const s of [-1,1]){
    cylinder(body,'FPV pitch pivot '+s,12,4,[s*20.5,315,138],M.dark,[1,0,0]);
    torus(body,'FPV pivot trim '+s,10.4,.5,[s*22.6,315,138],M.metal,[1,0,0]);
    tube(body,'Upper fairing seam '+s,[[s*34,244,-135],[s*39,276,-82],[s*40.5,309,-7],[s*39,332,62],[s*31,323,115]],.3,M.seam);
    // Fore and aft service screws and subtle raised shell details.
    screw(body,'Front fairing screw '+s,[s*(fairingX(302,15)+.15),302,15],fairingNormal(s,302,15).toArray(),2);
    screw(body,'Rear fairing screw '+s,[s*(fairingX(174,-139)+.15),174,-139],fairingNormal(s,174,-139).toArray(),1.6);
    screw(body,'Lower fairing screw '+s,[s*(fairingX(184,-29)+.15),184,-29],fairingNormal(s,184,-29).toArray(),1.5);
    fairingPrint(body,s);
  }
  // Flush roof service hatch and antenna strips.
  const hatch=box(body,'Top antenna service panel',[43,1.4,36],[0,320,7],M.shell,5);hatch.rotation.x=-.36;
  const hatchBorder=box(body,'Roof hatch gasket',[45,.6,38],[0,319.4,7],M.seam,5.5);hatchBorder.rotation.x=-.36;
  for(const x of [-10,10]){const o=box(body,'Roof antenna slit '+x,[2,.25,17],[x,328.7,35],M.dark,.6);o.rotation.x=-.2;}
  const logo=label(body,'DJI roof emblem','dji',21,10,[0,337.2,73],[0,1,0],'#d8d9dc',800);logo.rotation.x=-Math.PI/2;

  // Central aluminium lifting mechanism is visible through the large side apertures.
  box(body,'Central lift gearbox',[59,45,65],[0,245,-16],M.dark,11);
  cylinder(body,'Lift shaft',19,104,[0,251,-16],M.metal,[1,0,0]);
  box(body,'Lower flight controller chassis',[51,20,90],[0,178,-37],M.metal,5);
  for(let i=0;i<13;i++)box(body,'Controller heat sink fin '+i,[46,2,1.2],[0,165,-78+i*6.5],M.dark,.25);
  for(const s of [-1,1]){
    cylinder(body,'Lift hub end plate '+s,23,7,[s*46,251,-16],M.dark,[1,0,0]);
    cylinder(body,'Lift hub bearing '+s,15,1.7,[s*50,251,-16],M.metal,[1,0,0]);
    screw(body,'Lift axle cap '+s,[s*51.2,251,-16],[s,0,0],6);
    for(let i=0;i<6;i++){const a=i/6*TAU;screw(body,'Lift hub screw '+s+'-'+i,[s*50.2,251+19*Math.cos(a),-16+19*Math.sin(a)],[s,0,0],1.3);}
    rod(body,'Internal lift actuator '+s,[s*23,174,-35],[s*33,234,-18],7,M.metal,9);
    rod(body,'Actuator polished ram '+s,[s*33,234,-18],[s*36,252,-15],3.7,M.silver);
    tube(body,'Exposed braided signal harness '+s,[[s*31,195,-75],[s*34,211,-37],[s*28,231,-16],[s*21,255,3]],2,M.rubber);
    tube(body,'Flexible motor harness '+s,[[s*28,264,-5],[s*51,270,-4],[s*64,253,-14]],2.2,M.dark);
    for(let i=0;i<4;i++)box(body,'Inner connector '+s+'-'+i,[9,5,7],[s*25,187+i*7,-62],M.dark,1);
  }

  // The two independent TB51 battery packs have grips, release catches and status LEDs.
  for(const s of [-1,1]){
    const b=new THREE.Group();b.name='TB51_Battery_'+(s<0?'L':'R');b.position.set(s*19.2,207,-114);b.rotation.x=-.36;body.add(b);
    box(b,'TB51 dark polymer shell',[35.8,70,104],[0,0,0],M.dark,4);
    box(b,'Battery top cap',[35.5,8,103],[0,32,0],M.motor,3.4);
    box(b,'Battery cap gasket',[36.1,.6,98],[0,27.9,0],M.seam,2.8);
    box(b,'Battery rear recessed panel',[27,54,1],[0,0,-52.1],M.rubber,3);
    label(b,'Battery identification','TB51',22,6,[0,5,-52.8],[0,0,-1],'#9c9fa3',600);
    label(b,'Battery manufacturer','DJI',17,5,[0,-8,-52.9],[0,0,-1],'#686c73',600);
    box(b,'Battery release button',[22,5,16],[0,38,29],M.dark,2.4);
    for(let j=0;j<4;j++)box(b,'Battery catch grip '+j,[14,.6,.8],[0,40.8,24+j*3],M.metal,.2);
    for(let j=0;j<4;j++)box(b,'Battery indicator '+j,[1.6,.45,3],[(-1.5+j)*4,36.4,-24],M.led,.4);
    cylinder(b,'Battery power button bezel',4,.7,[0,36.4,-35],M.seam);
    cylinder(b,'Battery power button',3.3,.75,[0,36.8,-35],M.dark);
    for(let j=0;j<5;j++){
      const rib=box(b,'Battery side diagonal grip '+j,[.8,45,2],[s*18.3,0,-33+j*14],M.motor,.4);rib.rotation.x=-.35;
    }
    box(b,'Battery lower latch',[27,5,15],[0,-37,29],M.dark,2);
  }
  // Bottom service panel, stereo windows, ports and recessed small fasteners.
  const bottom=new THREE.Group();bottom.name='Lower service bay';bottom.position.set(0,164,-65);bottom.rotation.x=-.32;body.add(bottom);
  box(bottom,'Recessed lower equipment plate',[53,1.2,55],[0,0,0],M.dark,4);
  for(const s of [-1,1]){lens(bottom,'Downward vision sensor '+s,[s*15,-1,-9],[0,-1,0],5.2);screw(bottom,'Bottom plate screw '+s,[s*21,-.8,18],[0,-1,0],1.1);}
  box(bottom,'Infrared glass window',[14,.5,9],[0,-1.4,11],M.glass,2);
  label(bottom,'Product identification','INSPIRE 3',28,4,[0,-1.6,-22],[0,-1,0],'#7a8088',500);
  const service=new THREE.Group();service.name='Rear connectors';service.position.set(0,172,-166);service.rotation.x=-.36;body.add(service);
  box(service,'Rear service recess',[52,12,2],[0,0,0],M.rubber,2.6);
  box(service,'USB C socket metal',[12,4,1],[-13,0,-1.6],M.metal,1.8);
  box(service,'USB C socket aperture',[10,2.7,1],[-13,0,-2.1],M.inner,1.2);
  box(service,'Recording media slot',[22,2.5,1],[11,0,-2],M.inner,.7);

  root.add(createCamera(M));

  // Quick-start top view: the longitudinal rails splay outward toward the nose.
  // Grid ratios are photograph-derived, normalised to the published 685 mm diagonal.
  const motorZ=220,railCentre=Math.sqrt(685**2-(2*motorZ)**2)/2,railSlope=39/motorZ,motorX=railCentre-16*railSlope,motorY=123;
  root.userData.motorDiagonalMillimetres=685;
  root.userData.propellerDiameterMillimetres=406.4;
  const propGeo=bladeGeometry(0,.977),tipGeo=bladeGeometry(.977,1);
  for(const s of [-1,1]){
    const arm=new THREE.Group();arm.name='Lift_Assembly_'+(s<0?'L':'R');root.add(arm);
    const pivot=[s*52,251,-16],joint=[s*motorX,108,-16];
    rod(arm,'Main lifting carbon boom '+s,[s*65,243,-16],[s*(motorX-21),123,-16],17,M.carbon,18);
    rod(arm,'Sculpted root coupler '+s,pivot,[s*85,231,-16],21,M.dark,24);
    collar(arm,'Root clamp collar '+s,[s*81,233,-16],[s*89,227,-16],19.2,M.motor);
    rod(arm,'Outer lift coupler '+s,[s*(motorX-28),128,-16],joint,21,M.dark,19);
    // One continuous fore-aft tube per side, the characteristic H frame.
    rod(arm,'Longitudinal carbon rail '+s,[s*(railCentre+(-motorZ+14)*railSlope),108,-motorZ+14],[s*(railCentre+(motorZ-14)*railSlope),108,motorZ-14],12.7,M.carbon);
    cylinder(arm,'T joint rail sleeve '+s,17.3,58,joint,M.dark,[s*railSlope,0,1]);
    for(const dz of [-32,32]){
      cylinder(arm,'Rail clamp rim '+s+'-'+dz,14.1,4,[s*(motorX+dz*railSlope),108,-16+dz],M.motor,[s*railSlope,0,1]);
      screw(arm,'T joint clamp screw '+s+'-'+dz,[s*(motorX+17.7),108,-16+dz*.55],[s,0,0],1.8);
    }
    const lowerA=[s*41,187,-16],lowerB=[s*motorX,76,-16];
    rod(arm,'Parallel lift link '+s,lowerA,lowerB,3.2,M.carbon);
    rod(arm,'Polished adjustment sleeve '+s,[s*75,169,-16],[s*99,156,-16],4.4,M.silver);
    for(const [id,pos]of [['inner',lowerA],['outer',lowerB]]){
      box(arm,'Link fork '+s+'-'+id,[11,16,10],pos,M.dark,2);
      cylinder(arm,'Link pivot pin '+s+'-'+id,4.7,13,pos,M.metal,[0,0,1]);
      screw(arm,'Link pivot screw '+s+'-'+id,[pos[0],pos[1],pos[2]+7],[0,0,1],2.5);
    }
    beam(arm,'Outer link bracket '+s,[s*motorX,103,-16],lowerB,12,12,M.dark);
    for(const front of [true,false]){
      const id=(front?'F':'R')+(s<0?'L':'R'),z=(front?1:-1)*motorZ;
      const mount=new THREE.Group();mount.name='Motor_mount_'+id;mount.position.set(s*(railCentre+z*railSlope),motorY,z);arm.add(mount);
      rod(mount,'Rail terminal shroud',[s*(front?-40:40)*railSlope,-15,front?-40:40],[0,-15,0],17,M.dark);
      cylinder(mount,'Motor mounting shoe',23,15,[0,-14,0],M.dark);
      torus(mount,'Motor shoe joint',21,.65,[0,-6,0],M.seam,[0,1,0]);
      const rotor=new THREE.Group();rotor.name='Rotor_'+id;rotor.position.set(0,12,0);mount.add(rotor);
      cylinder(rotor,'Anodised motor bell',20.5,30,[0,0,0],M.motor);
      cylinder(rotor,'Motor top plate',19.8,2,[0,16,0],M.dark);
      cylinder(rotor,'Motor lower rim',20.8,2,[0,-15,0],M.blackMetal);
      for(let j=0;j<5;j++)torus(rotor,'Motor machined cooling groove '+j,20.55,.35,[0,5+j*2.05,0],M.inner,[0,1,0]);
      for(let j=0;j<12;j++){
        const a=j/12*TAU;
        const vent=box(rotor,'Motor lower cooling window '+j,[4.2,3,.45],[Math.cos(a)*20.5,-10,Math.sin(a)*20.5],M.inner,.5);vent.rotation.y=Math.PI/2-a;
        const winding=box(rotor,'Copper winding inside vent '+j,[2,1.4,.45],[Math.cos(a)*20.8,-10,Math.sin(a)*20.8],M.copper,.3);winding.rotation.y=Math.PI/2-a;
        if(j%2===0){const radial=box(rotor,'Motor top vent '+j,[3.5,.5,7],[Math.cos(a)*13,17.1,Math.sin(a)*13],M.inner,.7);radial.rotation.y=Math.PI/2-a;}
      }
      for(let j=0;j<3;j++){const a=j/3*TAU+.3;screw(rotor,'Motor end screw '+j,[Math.cos(a)*13,17.2,Math.sin(a)*13],[0,1,0],1.3);}
      cylinder(rotor,'Quick release spindle',4.6,13,[0,23,0],M.silver);
      cylinder(rotor,'Quick release locking plate',10,2.6,[0,21,0],M.motor);
      const prop=new THREE.Group();prop.name='Propeller_'+id;prop.position.y=29;prop.rotation.y=(front?.3:-.4)+(s<0?0:Math.PI/2);rotor.add(prop);
      box(prop,'Propeller central hub',[31,7,17],[0,0,0],M.dark,4);
      for(const d of [-1,1]){
        const blade=mesh(prop,'Twisted airfoil '+id+'-'+d,propGeo,M.blade,[0,1.7,0]);blade.rotation.y=d<0?Math.PI:0;
        const tip=mesh(prop,'Small orange propeller tip '+id+'-'+d,tipGeo,M.tip,[0,1.7,0]);tip.rotation.y=blade.rotation.y;
        screw(prop,'Propeller locking screw '+d,[d*11,4.1,0],[0,1,0],2.3);
      }
      label(prop,'Propeller safety text '+id,'DJI 1671',39,4,[55,3.1,7],[0,1,0],'#b7b9bb',500);
      // Four tapered, slightly swept landing legs, each integrated into a motor foot.
      armLoft(mount,'Tapered landing leg '+id,[[0,-20,0],[0,-45,front?2:-2],[1,-85,front?7:-7],[1,-118,front?10:-10]],[[26,26],[22,21],[15,13],[12,11]],M.dark);
      box(mount,'Rubber landing toe '+id,[12,5,12],[1,-120,front?10:-10],M.rubber,2.2);
      const led=box(mount,'Navigation diffuser '+id,[20,5,1.8],[0,-23,front?18:-18],s<0?M.ledRed:M.ledGreen,1.7);
      lens(mount,'Arm obstacle camera '+id,[0,-42,front?13:-13],[0,0,front?1:-1],5);
      const legStripe=box(mount,'Landing leg silver indicator '+id,[2.5,35,.55],[.5,-91,front?12:-12],M.silver,.7);legStripe.rotation.x=front?.1:-.1;
      for(const d of [-1,1])screw(mount,'Motor shoe fastener '+d,[d*15,-23,front?10:-10],[0,-1,0],1.3);
      if(front){const t=label(mount,'Arm side marking '+id,'INSPIRE 3',43,5,[s*13,-4,-37],[s,0,0],'#93979b',500);t.rotation.y=s*Math.PI/2;}
    }
  }

  // Supply explicit tangents for normal-mapped parts, including degenerate UV caps.
  root.traverse(o=>{
    if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
    const g=o.geometry,materials=Array.isArray(o.material)?o.material:[o.material];
    if(materials.some(m=>m.normalMap)){
      if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
      g.computeTangents();const t=g.attributes.tangent,n=g.attributes.normal;
      for(let i=0;i<t.count;i++){
        const v=V(t.getX(i),t.getY(i),t.getZ(i));
        if(!Number.isFinite(v.lengthSq())||v.lengthSq()<.1){const normal=V().fromBufferAttribute(n,i).normalize(),axis=Math.abs(normal.y)>.9?V(1,0,0):V(0,1,0);v.crossVectors(axis,normal).normalize();t.setXYZW(i,v.x,v.y,v.z,1);}
      }
    }else if(materials.every(m=>!m.map&&!m.roughnessMap))g.deleteAttribute('uv');
  });
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),centre=bounds.getCenter(V());
  root.position.set(-centre.x,-bounds.min.y,-centre.z);
  return root;
}

