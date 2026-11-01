// DJI Mini 4 Pro visual study V02. Photograph-derived proportions, not engineering CAD.
// Design coordinates: millimetres, +Y up, +Z nose. Export root scales to metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { createDetailedGimbal } from './gimbal.js';
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
    const t=start+(end-start)*i/28,span=5+71.2*t,chord=(3.1+8*Math.sin(Math.PI*Math.pow(t,.66)))*(1-.38*t),sweep=4.3*t+2.8*Math.sin(Math.PI*t),twist=THREE.MathUtils.degToRad(19-12*t),ring=[];
    for(let j=0;j<=around;j++){const a=j/around*TAU,z=Math.cos(a)*chord*.5,y=Math.sin(a)*(.44*(1-t)+.13);ring.push(span,y*Math.cos(twist)-z*Math.sin(twist),sweep+z*Math.cos(twist)+y*Math.sin(twist));}rings.push(ring);
  }
  const g=geoFromRings(rings,around),idx=g.index.array;for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];g.computeVertexNormals();return g;
}

export function createDrone(){
  const root=new THREE.Group();root.name='DJI_Mini_4_Pro_Visual_Sample';root.scale.setScalar(.001);
  root.userData={version:'0.2',type:'visual-reconstruction',units:'metres',notEngineeringCAD:true,source:'Official DJI product photographs; parametric surface reconstruction'};
  const body=new THREE.Group();body.name='Fuselage';root.add(body);
  const upperSections=[
    [-76,20,72,10],[-73,26,72,14],[-62,26.5,73,15.5],[-40,24,74,16],[-18,23,74.4,16.5],
    [5,25.5,74.2,17],[27,29.5,73.4,17],[44,31,73,16],[51,29,76,12],[56,25.5,79,7],[59,22,80,4.5],[60,19,80,2]
  ];
  shell(body,'Continuous upper fuselage',upperSections,M.upper,{power:2.65});
  const sampledUpper=interpSections(upperSections,96);
  const topAt=(x,z)=>{
    let i=0;while(i<sampledUpper.length-2&&sampledUpper[i+1][0]<z)i++;
    const a=sampledUpper[i],b=sampledUpper[i+1],t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
    const w=THREE.MathUtils.lerp(a[1],b[1],t),cy=THREE.MathUtils.lerp(a[2],b[2],t),h=THREE.MathUtils.lerp(a[3],b[3],t);
    return cy+h*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/w,2.65)),1/2.65);
  };
  const topNormal=(x,z)=>V((topAt(x-.1,z)-topAt(x+.1,z))/.2,1,(topAt(x,z-.1)-topAt(x,z+.1))/.2).normalize();
  function topPatch(name,cx,cz,w,l,material,offset=.12,radius=1.8){
    const pos=[],uv=[],idx=[],nx=12,nz=24;
    for(let j=0;j<=nz;j++){
      const z=(j/nz-.5)*l,corner=Math.max(0,Math.abs(z)-(l/2-radius)),half=w/2-radius+Math.sqrt(Math.max(0,radius*radius-corner*corner));
      for(let i=0;i<=nx;i++){const x=(i/nx*2-1)*half;pos.push(cx+x,topAt(cx+x,cz+z)+offset,cz+z);uv.push(i/nx,j/nz);}
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(body,name,g,material);
  }
  shell(body,'Lower aerodynamic fairing',[
    [-76,18,61,5],[-69,24,61,8],[-48,23,60,9],[-24,22.3,59,9],[1,24.8,59.5,9],
    [25,29,60.2,9],[39,26.5,62,6],[44,20,64,3]
  ],M.belly,{power:2.75,steps:64});

  for(const s of [-1,1]){
    // The lens is recessed in the continuous nose surface, not on a protruding sphere.
    const shoulder=shell(body,'Sculpted front sensor shoulder '+s,[[33,11.5,74,13],[45,11,74,12.5],[55,9.4,74.2,10],[62,7.3,74.3,7.5],[65,6.2,74.3,6.5]],M.upper,{power:2.3,steps:42});shoulder.position.x=s*23;
    const normal=V(s*.1,.1,1).normalize();
    lens(body,'Forward binocular sensor '+s,[s*23.2,74.4,65.6],normal.toArray(),5.1);
    // Thin shaped guard around the gimbal bay, smoothly tapered towards its lower end.
    armLoft(body,'Sculpted gimbal cheek '+s,[[s*29,70,52],[s*27.2,62,56],[s*24.2,55,59],[s*22.1,52,62]],[[13,8.2],[13,8.8],[11.5,8.6],[9.5,7.2]],M.upper);
    const seamPoints=sampledUpper.filter((r,i)=>r[0]<43&&i%3===0).map(([z,w,cy,h])=>[s*(w*Math.pow(Math.cos(.4),2/2.65)+.06),cy-h*Math.pow(Math.sin(.4),2/2.65),z]);
    tube(body,'Lower body split line '+s,seamPoints,.11,M.seam);
    // Long, flush, sloped rear stereo windows sit within the shoulder surface.
    const rn=topNormal(s*24.6,21.5),rp=V(s*24.6,topAt(s*24.6,21.5),21.5).addScaledVector(rn,.15);
    const rear=lens(body,'Rear omnidirectional camera '+s,rp.toArray(),rn.toArray(),3.9);rear.scale.z=.55;
    topPatch('Rear upper recessed cooling vent '+s,s*19.7,-59,7.5,23,M.inner,.11,2.5);
    for(let k=0;k<3;k++){
      topPatch('Rear upper sloped cooling fin '+s+'-'+k,s*19.7,-66+k*6.3,6.7,1.2,M.metal,.3,.5);
    }
    box(body,'Battery release inset '+s,[.55,7.5,15.5],[s*26.4,68,-57],M.seam,.6);
    box(body,'Battery release latch '+s,[.7,6.7,14.4],[s*26.8,68,-57],M.shell,.8);
    for(let k=0;k<4;k++)box(body,'Battery grip rib '+s+'-'+k,[.25,4.2,.38],[s*27.2,68,-62+k*3.2],M.belly,.1);
    const ventBack=box(body,'Recessed side cooling channel '+s,[.28,5.6,19],[s*23.5,63.8,-13],M.dark,.8);
    for(let k=0;k<7;k++)box(body,'Moulded ventilation rib '+s+'-'+k,[.48,5.9,.9],[s*23.7,63.8,-22+k*3],M.shell,.28);
    screw(body,'Lower fuselage screw '+s,[s*23.3,52.2,-32],[0,-1,0],.72);
  }
  tube(body,'Battery top perimeter seam',[-25,-20,-10,0,10,20,25].map(x=>[x,topAt(x,-57)+.08,-57]),.1,M.seam);
  box(body,'Power button recess',[10,.2,5.2],[0,87.7,-69],M.seam,1.3);
  box(body,'Power button',[9.2,.3,4.5],[0,87.9,-69],M.shell,1.1);
  for(let i=0;i<4;i++){cylinder(body,'Battery LED inset '+i,.57,.18,[-3.6+i*2.4,88.75,-61],M.seam);cylinder(body,'Battery LED '+i,.36,.12,[-3.6+i*2.4,88.9,-61],M.led);}
  const logo=label(body,'Top manufacturer mark','dji',11.5,5.6,[0,0,0],[0,1,0],'#eceee7',800);
  const curvedLogo=topPatch('Printed manufacturer mark',0,-47,11.5,5.6,logo.material,.08,.1);body.remove(logo);logo.geometry.dispose();
  box(body,'Rear connector cavity',[22,5.3,.65],[0,68,-77],M.dark,1.4);
  box(body,'USB C outer sleeve',[7.5,3,.3],[-5.4,68,-77.5],M.silver,1.1);
  box(body,'USB C socket interior',[6.2,1.8,.3],[-5.4,68,-77.7],M.inner,.6);
  box(body,'USB C contact tongue',[4.9,.35,.16],[-5.4,68,-77.95],M.dark,.1);
  box(body,'Memory card slot',[8,1.05,.2],[6.5,68,-77.6],M.inner,.18);
  for(const s of [-1,1])screw(body,'Rear housing fastener '+s,[s*18,71,-76.9],[0,0,-1],.65);

  // Underside optics and a subtly recessed equipment cover.
  box(body,'Downward sensor surround',[32,.42,20],[0,50.55,17],M.dark,4);
  for(const s of [-1,1])lens(body,'Downward vision camera '+s,[s*10,50.2,17],[0,-1,0],3.5);
  box(body,'Infrared module bezel',[10.5,.5,7.8],[0,49.9,-2],M.blackMetal,1.4);
  box(body,'Infrared module glass',[8.2,.15,5.8],[0,49.58,-2],M.glass,1);
  cylinder(body,'Auxiliary ground light rim',3.7,.5,[0,49.9,-15],M.dark);
  cylinder(body,'Auxiliary ground light diffuser',2.8,.25,[0,49.5,-15],M.light);
  box(body,'Belly identification plate',[24,.25,26],[0,50.6,-43],M.shell,1.5);
  label(body,'Underside product engraving','MINI 4 PRO',18,2.8,[0,50.4,-40],[0,-1,0],'#58605a',600);
  label(body,'Underside equipment engraving','DJI · CAMERA DRONE',18,2.3,[0,50.38,-46],[0,-1,0],'#677068',400);
  for(const s of [-1,1]){
    armLoft(body,'Rear belly skid '+s,[[s*20,54,-49],[s*21,47,-54],[s*21,39,-58]],[[8,12],[7.5,10],[6,7]],M.belly);
    box(body,'Rear belly rubber pad '+s,[6,1.25,9],[s*21,37.6,-58],M.rubber,1.1);
  }

  const cavity=box(body,'Gimbal bay shadow lining',[28,22,1],[0,66.5,56.4],M.dark,5.5);
  for(let k=0;k<8;k++){
    const x=-10.5+k*3;
    tube(body,'Curved nose cooling fin '+k,[[x,77.1,57.1],[x,73.8,58],[x,68,57.6],[x,62,56.9]],.5,M.belly);
  }
  root.add(createDetailedGimbal(M));

  const motors=[['FL',-1,true,[-109,78,60]],['FR',1,true,[109,78,60]],['RL',-1,false,[-87,85,-79]],['RR',1,false,[87,85,-79]]];
  const blade=bladeGeometry(0,.92),tip=bladeGeometry(.92,1);
  motors.forEach(([id,s,front,end],index)=>{
    const arm=new THREE.Group();arm.name='Arm_'+id;root.add(arm);
    const start=front?[s*30.2,68,30]:[s*25,61,-44],bend=front?[s*51,70,38]:[s*42,69,-55];
    cylinder(arm,'Folding joint '+id,6.2,7,start,M.shell,front?[0,1,0]:[1,0,0]);
    if(front){cylinder(arm,'Top hinge bearing '+id,3.7,.4,[start[0],72,start[2]],M.dark);screw(arm,'Hinge locking screw '+id,[start[0],72.3,start[2]],[0,1,0],1.3);}
    else screw(arm,'Rear hinge screw '+id,[start[0]+s*3.8,start[1],start[2]],[s,0,0],1.25);
    armLoft(arm,'Continuous tapered arm '+id,[start,bend,[end[0]-s*10,end[1]-3,end[2]-(front?2:-2)],end],front?[[14,9.2],[12,8.5],[10.5,7.5],[11,8]]:[[12,8.5],[10.8,7.6],[9,6.4],[10,7]],M.upper);
    if(front){
      const print=label(arm,'Aircraft model arm print '+id,'MINI 4 PRO',27,3,[s*70,76.4,44],[0,1,0],'#737a73',600);
      const printX=V(s*.96,.1,.26).normalize(),printN=V(0,1,0),printY=new THREE.Vector3().crossVectors(printN,printX).normalize();printN.crossVectors(printX,printY).normalize();print.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(printX,printY,printN));
      armLoft(arm,'Swept landing fin '+id,[[end[0],end[1]-4,end[2]],[end[0]+s*1,64,end[2]+2],[end[0]+s*2.8,45,end[2]+5],[end[0]+s*3.4,38,end[2]+8]],[[11,8],[9,6.8],[7,4.8],[7,4.2]],M.shell);
      box(arm,'Front foot rubber '+id,[4,.45,5.8],[end[0]+s*3.4,37.2,end[2]+8],M.rubber,.8);
      box(arm,'Navigation light housing '+id,[4,.7,3],[end[0],end[1]-6.6,end[2]+6.1],M.dark,.7);
      box(arm,'Navigation light diffuser '+id,[3,.5,2.2],[end[0],end[1]-7,end[2]+6.1],M.led,.6);
    }
    cylinder(arm,'Integrated motor cup '+id,8,8.5,[end[0],end[1]-1,end[2]],M.shell,[0,1,0],6.8);
    cylinder(arm,'Recessed copper stator '+id,6.6,4,[end[0],end[1]+4.7,end[2]],M.copper);
    cylinder(arm,'Motor bell '+id,7.2,5.4,[end[0],end[1]+5.8,end[2]],M.motor);
    cylinder(arm,'Exposed upper copper windings '+id,6.25,.3,[end[0],end[1]+8.6,end[2]],M.copper);
    cylinder(arm,'Motor centre axle plate '+id,3.5,.3,[end[0],end[1]+8.8,end[2]],M.blackMetal);
    torus(arm,'Motor open upper silver rim '+id,6.8,.4,[end[0],end[1]+8.8,end[2]],M.motor,[0,1,0]);
    torus(arm,'Motor lower bright edge '+id,7.15,.12,[end[0],end[1]+3.4,end[2]],M.silver,[0,1,0]);
    for(let k=0;k<12;k++){
      const a=k/12*TAU;
      const slot=box(arm,'Motor bell cooling recess '+id+'-'+k,[.9,2.2,.4],[end[0]+Math.cos(a)*7.16,end[1]+5.8,end[2]+Math.sin(a)*7.16],M.inner,.32);slot.rotation.y=Math.PI/2-a;
      const top=box(arm,'Radial bell cooling inset '+id+'-'+k,[.7,.12,2.15],[end[0]+Math.cos(a)*4.9,end[1]+8.55,end[2]+Math.sin(a)*4.9],M.inner,.2);top.rotation.y=Math.PI/2-a;
    }
    cylinder(arm,'Motor bearing cap '+id,2.6,.7,[end[0],end[1]+8.9,end[2]],M.metal);
    const rotor=new THREE.Group();rotor.name='Rotor_'+id;rotor.position.set(end[0],end[1]+10.1,end[2]);rotor.rotation.y=[-.6,.6,.73,-.73][index];rotor.userData={rotationAxis:'local Y',direction:index===0||index===3?1:-1};root.add(rotor);
    cylinder(rotor,'Central propeller boss '+id,3.8,1.8,[0,0,0],M.dark);
    for(let side=0;side<2;side++){
      const half=new THREE.Group();half.name=`Blade_${id}_${side}`;half.rotation.y=side*Math.PI;rotor.add(half);
      mesh(half,'Twisted swept airfoil',blade,M.blade);mesh(half,'Painted orange blade tip',tip,M.tip);
      cylinder(half,'Blade folding pivot',2.8,1.3,[5,.12,0],M.blade);screw(half,'Propeller retention screw',[5,.9,0],[0,1,0],.95);
    }
  });
  root.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry,m=o.material;
    if(m.normalMap){
      if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
      g.computeTangents();
      const t=g.attributes.tangent,n=g.attributes.normal;
      for(let i=0;i<t.count;i++)if(!Number.isFinite(t.getX(i))||Math.hypot(t.getX(i),t.getY(i),t.getZ(i))<.1){
        const normal=V(n.getX(i),n.getY(i),n.getZ(i)),axis=Math.abs(normal.y)>.9?V(1,0,0):V(0,1,0),tangent=axis.cross(normal).normalize();t.setXYZW(i,tangent.x,tangent.y,tangent.z,1);
      }
    }else if(!m.map&&!m.roughnessMap)g.deleteAttribute('uv');
  });
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),centre=bounds.getCenter(new THREE.Vector3());root.position.set(-centre.x,-bounds.min.y,-centre.z);return root;
}
