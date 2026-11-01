// DJI Inspire 3 / Zenmuse X9-8K Air visual reconstruction from official product photographs.
// Millimetres, +Y up, +Z forward. A parent group converts to metres; this is not engineering CAD.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const TAU=Math.PI*2, V=(...p)=>new THREE.Vector3(...p);
const material=(name,color,roughness=.4,metalness=0,extra={})=>new THREE.MeshPhysicalMaterial({name,color,roughness,metalness,...extra});
function mesh(p,name,g,m,pos=[0,0,0]){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(...pos);p.add(o);return o;}
function box(p,n,s,pos,m,r=1){return mesh(p,n,new RoundedBoxGeometry(...s,Math.min(...s)<2?1:2,Math.min(r,...s.map(v=>v*.43))),m,pos);}
function cyl(p,n,r,h,pos,m,axis=[0,0,1],rb=r,segments=48){const o=mesh(p,n,new THREE.CylinderGeometry(r,rb,h,segments,1),m,pos);o.quaternion.setFromUnitVectors(V(0,1,0),V(...axis).normalize());return o;}
function torus(p,n,r,t,pos,m,axis=[0,0,1],segments=64){const o=mesh(p,n,new THREE.TorusGeometry(r,t,6,segments),m,pos);o.quaternion.setFromUnitVectors(V(0,0,1),V(...axis).normalize());return o;}
function beam(p,n,a,b,w,d,m){const pa=V(...a),delta=V(...b).sub(pa),o=box(p,n,[w,delta.length(),d],pa.addScaledVector(delta,.5).toArray(),m,Math.min(w,d)*.25);o.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return o;}
function extrude(p,n,points,depth,pos,m,bevel=1.2){const shape=new THREE.Shape(points.map(pt=>new THREE.Vector2(...pt)));shape.closePath();return mesh(p,n,new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:12}),m,pos);}
function ring(p,n,ro,ri,z,m){return mesh(p,n,new THREE.RingGeometry(ri,ro,64),m,[0,0,z]);}
function screw(p,n,pos,normal,M,r=1.15){const g=new THREE.Group();g.name=n;g.position.set(...pos);g.quaternion.setFromUnitVectors(V(0,0,1),V(...normal).normalize());p.add(g);cyl(g,'Countersunk recess',r*1.42,.24,[0,0,-.04],M.inner,[0,0,1],r*1.5,20);cyl(g,'Machined dark screw',r,.2,[0,0,.09],M.metal,[0,0,1],r,20);for(let i=0;i<3;i++){const o=box(g,'Hexalobular drive slot',[r*1.25,r*.22,.035],[0,0,.199],M.inner,.025);o.rotation.z=i*Math.PI/3;}return g;}

// Closed turned profile, preserving real stepped lens recesses rather than stacked solid discs.
function turned(p,n,profile,m,pos=[0,0,0],segments=72){const g=new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),segments);g.rotateX(Math.PI/2);return mesh(p,n,g,m,pos);}
function lensSurface(radius,sag){const segments=64,rings=14,positions=[0,0,sag],uv=[.5,.5],indices=[];for(let j=1;j<=rings;j++){const f=j/rings;for(let i=0;i<=segments;i++){const a=i/segments*TAU;positions.push(radius*f*Math.cos(a),radius*f*Math.sin(a),sag*(1-f*f));uv.push(.5+f*Math.cos(a)/2,.5+f*Math.sin(a)/2);}}for(let i=0;i<segments;i++)indices.push(0,i+1,i+2);for(let j=0;j<rings-1;j++)for(let i=0;i<segments;i++){const a=1+j*(segments+1)+i,b=a+segments+1;indices.push(a,b,b+1,a,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
function ribbon(p,n,points,width,m){const curve=new THREE.CatmullRomCurve3(points.map(v=>V(...v))),positions=[],uv=[],indices=[];for(let i=0;i<=32;i++){const t=i/32,c=curve.getPoint(t),tangent=curve.getTangent(t),across=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize();for(const s of [-1,1])positions.push(...c.clone().addScaledVector(across,s*width/2).toArray());uv.push(0,t,1,t);if(i<32){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(p,n,g,m);}
function label(p,n,text,w,h,pos,normal=[0,0,1],color='#b4b8b8',angle=0){if(typeof document==='undefined')return;const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.font='500 142px Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,133,985);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.name=n+' embedded ink';const m=material(n+' print','#ffffff',.6,0,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const o=mesh(p,n,new THREE.PlaneGeometry(w,h),m,pos);o.quaternion.setFromUnitVectors(V(0,0,1),V(...normal).normalize());o.rotateZ(angle);return o;}

export function createCamera(M={}){
  const P={
    cast:material('X9 satin graphite magnesium casting','#24292b',.43,.67),
    bevel:material('X9 clean machined casting edges','#3a4143',.31,.78),
    barrel:material('DL black anodised aluminium','#141b1e',.3,.86),
    rubber:M.rubber||material('Fine lens grip elastomer','#111618',.7),
    metal:M.metal||material('Gimbal dark alloy','#343c40',.31,.8),
    silver:M.silver||material('Bright machined steel','#9ba2a4',.25,.93),
    inner:M.inner||material('Unlit optical cavity','#020508',.47),
    glass:material('X9 multilayer anti-reflection optical coating','#324c69',.045,.18,{transparent:true,opacity:.26,depthWrite:false,clearcoat:1,clearcoatRoughness:.02,ior:1.52,envMapIntensity:1.6,iridescence:.68,iridescenceIOR:1.33,iridescenceThicknessRange:[170,340]}),
    rearGlass:material('X9 inner lens purple coating','#182132',.12,.25,{clearcoat:1,clearcoatRoughness:.06}),
    contact:material('Lens bayonet contact gold','#796239',.34,.92),
    cable:material('Gimbal flexible circuit sheath','#0d1214',.68,0,{side:THREE.DoubleSide}),
    mark:material('Lens mount red alignment dot','#a72c20',.5),
  };
  const root=new THREE.Group();root.name='Gimbal';root.userData={camera:'Zenmuse X9-8K Air visual reconstruction',units:'millimetres',source:'Official DJI Inspire 3 product photography',cameraCenter:[0,126,145],precision:'visual approximation'};

  // Compact rubber-isolated mount under the nose; the yaw spindle follows the sloping airframe.
  const mount=box(root,'Low profile camera vibration isolation plate',[63,6,52],[0,243,101],P.cast,4);mount.rotation.x=-.25;
  for(const x of [-24,24])for(const z of [84,118]){
    cyl(root,'Elastomer suspension damper',5.2,8,[x,247,z],P.rubber,[0,1,0],4.8,32);
    screw(root,'Suspension plate fastener',[x,239,z],[0,-1,0],P,1.25);
  }
  const yaw=new THREE.Group();yaw.name='Yaw_joint';yaw.position.set(0,217,110);yaw.rotation.x=-.25;root.add(yaw);
  cyl(yaw,'Yaw motor upper shouldered casting',22.5,13,[0,13,0],P.cast,[0,1,0],24);
  cyl(yaw,'Yaw motor enclosed bell',24,27,[0,-6,0],P.barrel,[0,1,0],21.5);
  cyl(yaw,'Yaw bottom bearing cap',20.3,3,[0,-21,0],P.bevel,[0,1,0]);
  for(const y of [-14,-9,-4,9])torus(yaw,'Yaw motor circumferential groove',y>0?22.6:23.2,.32,[0,y,0],P.inner,[0,1,0],48);
  for(const x of [-17,17])screw(yaw,'Yaw motor cover screw',[x,17,8],[0,1,0],P,.9);
  box(yaw,'Yaw motor wiring cover',[13,14,2],[0,8,23.5],P.cast,1.8);
  cyl(yaw,'Small red mount witness mark',1.05,.18,[-9,0,23.5],P.mark);

  // Offset bent C-fork is a continuous extrusion. It leaves an open gap around the camera.
  const forkShape=[[-10,198],[9,194],[36,171],[44,159],[44,126],[32,117],[24,128],[25,155],[18,166],[-15,183]];
  // Shape axes are local X=Z, Y=height, extrusion along X after rotation.
  const fork=extrude(root,'Continuous offset yaw to roll C-fork',forkShape,12,[-39,0,119],P.cast,2.1);fork.rotation.y=-Math.PI/2;
  const reinforcement=extrude(root,'C-fork inset reinforcing face',[[-4,187],[5,185],[26,165],[29,157],[29,135],[33,130],[36,135],[36,159],[29,172],[7,191]],1.05,[-40.2,0,119],P.bevel,.45);reinforcement.rotation.y=-Math.PI/2;
  beam(root,'Yaw spindle to offset fork crosshead',[0,195,116],[-42,195,116],12,17,P.cast);
  // Rear roll-axis motor, running parallel to the lens axis.
  cyl(root,'Roll motor housing',19,17,[0,139,108],P.barrel,[0,0,1],18);
  cyl(root,'Roll motor back bearing cover',16.9,1.5,[0,139,98.7],P.cast);
  torus(root,'Roll motor sealed circular seam',17.1,.35,[0,139,98],P.inner);
  for(let i=0;i<4;i++){const a=(i+.5)*TAU/4;screw(root,'Roll motor service screw',[Math.cos(a)*12.4,139+Math.sin(a)*12.4,97.7],[0,0,-1],P,.95);}
  beam(root,'Roll fork horizontal bridge',[-35,139,113],[0,139,113],14,13,P.cast);

  const camera=new THREE.Group();camera.name='Camera';camera.position.set(0,126,145);root.add(camera);
  // Clipped-corner die casting; its chamfers distinguish it from a rounded consumer camera cube.
  const outline=[[-26,-39],[26,-39],[39,-26],[39,23],[23,39],[-23,39],[-39,23],[-39,-26]];
  extrude(camera,'Octagonal X9 magnesium sensor housing',outline,44,[0,0,-33],P.cast,2.3);
  const rearOutline=outline.map(([x,y])=>[x*.91,y*.91]);
  extrude(camera,'Recessed rear service panel',rearOutline,1.2,[0,0,-35.5],P.barrel,.8);
  const frontOutline=outline.map(([x,y])=>[x*.92,y*.92]);
  extrude(camera,'Bevelled lens mounting shoulder',frontOutline,5.5,[0,0,10.8],P.bevel,1.3);
  ring(camera,'Black sensor mount surround',35.1,28.1,18.1,P.barrel);
  for(const x of [-29,29])for(const y of [-27,27])screw(camera,'Sensor casting face screw',[x,y,17.7],[0,0,1],P,1.1);
  for(const x of [-27,27])for(const y of [-26,26])screw(camera,'Rear service plate screw',[x,y,-36.8],[0,0,-1],P,.85);

  // Side pitch actuators are intentionally asymmetric, as on the photographic assembly.
  for(const side of [-1,1]){
    const r=side<0?14:17;
    cyl(camera,'Pitch bearing outer '+side,r,13,[side*47,0,0],P.cast,[side,0,0],r-.6);
    cyl(camera,'Pitch bearing end cover '+side,r-2,1.5,[side*54.1,0,0],P.barrel,[side,0,0]);
    torus(camera,'Pitch bearing turned seam '+side,r-1.1,.3,[side*54.8,0,0],P.bevel,[side,0,0],48);
    box(camera,'Swept pitch support block '+side,[7,12,28],[side*42,-1,-11],P.cast,2);
    for(let i=0;i<3;i++){const a=i*TAU/3;screw(camera,'Pitch cover screw '+side,[side*55,Math.sin(a)*(r-5),Math.cos(a)*(r-5)],[side,0,0],P,.8);}
  }
  // Open lower U cradle follows the camera corners without obstructing the lens.
  const cradle=[[-47,3],[-47,-28],[-35,-44],[-24,-49],[24,-49],[35,-44],[47,-28],[47,3],[42,3],[42,-25],[31,-39],[22,-43],[-22,-43],[-31,-39],[-42,-25],[-42,3]];
  extrude(camera,'Continuous lower pitch cradle',cradle,5.5,[0,0,-8],P.cast,1.15);
  for(const side of [-1,1]){
    box(camera,'Camera side grip inset '+side,[.6,26,24],[side*41.2,-1,-11],P.rubber,.2);
    for(let i=0;i<6;i++)box(camera,'Camera side cooling slot '+side+' '+i,[.3,1.7,13],[side*41.6,-12+i*4,-14],P.inner,.25);
  }
  label(camera,'X9 model mark','X9',18,7,[0,41.48,-3],[0,1,0],'#bbc0c0');
  label(camera,'Zenmuse camera marking','ZENMUSE',25,4.5,[0,31.4,18.5]);
  label(camera,'X9 rear identification','X9-8K AIR',35,5.8,[0,10,-36.91],[0,0,-1],'#7d8589');
  box(camera,'Camera tiny status diffuser',[3.5,1.5,.6],[-15,32.2,18.3],P.mark,.3);

  // Four discrete bayonet layers, retaining shoulders and a recessed annular front opening.
  turned(camera,'Steel DL bayonet lock ring',[[28,15],[30,15],[30.4,16.2],[30.4,19],[29.5,20],[28,20],[28,15]],P.silver);
  turned(camera,'Lens mount rear cylindrical body',[[0,18],[27.8,18],[29.2,21],[29.2,26],[30,28],[30,40],[28.8,42],[0,42]],P.barrel);
  turned(camera,'Interchangeable lens stepped aluminium barrel',[[0,40],[29,40],[30.1,41.5],[30.1,46],[30.6,47],[30.6,62],[29.9,63],[29.9,75],[31.6,77],[31.6,87],[30.6,89],[24.7,89],[24.7,83],[0,83]],P.barrel);
  for(const z of [23,29,44,47,63,75,78,85])torus(camera,'Lens turned concentric edge '+z,z>=77?31.4:30.1,.16,[0,0,z],z===44?P.bevel:P.inner);
  // Fine longitudinal grip fluting is geometry and survives GLB export and grazing light.
  for(let i=0;i<84;i++){
    const a=i/84*TAU,o=box(camera,'Fine lens grip flute '+i,[.5,1.1,12.4],[Math.cos(a)*30.65,Math.sin(a)*30.65,55],P.rubber,.12);o.rotation.z=a-Math.PI/2;
  }
  torus(camera,'Lens polished fine front rim',30.5,.22,[0,0,89.05],P.bevel);
  turned(camera,'Front element deeply recessed metal bevel',[[24.8,89],[25,88.5],[24.3,86],[22.3,83.3],[21.7,83.3],[22.8,85.8],[24.8,89]],P.inner);
  ring(camera,'Lens front engraved ring',30.45,24.6,89.17,P.barrel);
  for(let i=0;i<5;i++)torus(camera,'Optical baffle fine groove '+i,22.1+i*.43,.12,[0,0,84.1+i*.65],P.bevel);
  cyl(camera,'Deep black iris well',21.7,.4,[0,0,82.4],P.inner);
  mesh(camera,'Rear concave optical element',lensSurface(20.8,1.5),P.rearGlass,[0,0,81.7]);
  // A real polygonal iris and layered curved glass give the close-up optical depth.
  cyl(camera,'Stopped down iris aperture',7.7,.06,[0,0,84.05],P.inner,[0,0,1],7.7,9);
  torus(camera,'Iris inner bevel',8.1,.12,[0,0,84.15],P.bevel,[0,0,1],36);
  mesh(camera,'Convex multicoated front optical element',lensSurface(21.2,4.6),P.glass,[0,0,84.3]);
  label(camera,'Lens front DJI mark','DJI',8.5,3.2,[0,27,89.24]);
  label(camera,'Lens front DL mark','DL',6,2.5,[0,-27.1,89.24]);
  cyl(camera,'Red lens mount alignment marker',1,.25,[0,30.1,21.5],P.mark,[0,1,0]);
  for(let i=0;i<9;i++){const a=(i-4)*.14+.85;cyl(camera,'Recessed bayonet contact '+i,.55,.08,[Math.cos(a)*28.7,Math.sin(a)*28.7,19.65],P.contact,[0,0,1],.55,12);}

  ribbon(root,'Flexible yaw to camera ribbon',[[-14,208,116],[-14,189,117],[-17,175,108],[-17,154,105],[-15,144,109]],7,P.cable);
  ribbon(camera,'Pitch axis flexible cable',[[-31,17,-28],[-39,14,-30],[-44,4,-25],[-45,-8,-19],[-39,-16,-13]],4.5,P.cable);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return root;
}
