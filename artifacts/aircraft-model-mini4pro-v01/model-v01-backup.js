// Editable visual reconstruction. Millimetre design coordinates, metre GLB output.
// Camera faces +Z. Part proportions are estimated from official photographs, not CAD.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const V = (x,y,z) => new THREE.Vector3(x,y,z);
const mat = (name,color,roughness=.42,metalness=0,extra={}) => new THREE.MeshStandardMaterial({name,color,roughness,metalness,...extra});
const M = {
  shell:mat('Pearl grey polymer','#b9bdba',.36),
  upper:mat('Upper pearl shell','#c8cdc9',.34),
  belly:mat('Lower grey shell','#989e9b',.47),
  dark:mat('Graphite polymer','#272c2c',.42),
  rubber:mat('Soft black rubber','#161a1b',.68),
  metal:mat('Motor anodized aluminium','#5c6462',.29,.72),
  silver:mat('Machined screws','#9ea9aa',.24,.82),
  blade:mat('Graphite propellers','#373d3e',.46),
  tip:mat('Orange blade tips','#ef862c',.44),
  glass:mat('Coated optical glass','#122b31',.13,.7),
  inner:mat('Lens interior','#060c0e',.22,.3),
  seam:mat('Shell seams','#737b76',.58),
  led:mat('Green status LEDs','#79ba82',.25,0,{emissive:'#285f34',emissiveIntensity:.35}),
  light:mat('Auxiliary lamp','#e2e4c9',.24),
};

function mesh(parent,name,geo,material,pos=[0,0,0]) {
  const o=new THREE.Mesh(geo,material);o.name=name;o.position.set(...pos);
  parent.add(o);return o;
}
function box(parent,name,size,pos,material,radius=1.5) {
  return mesh(parent,name,new RoundedBoxGeometry(...size,2,Math.min(radius,...size.map(v=>v*.45))),material,pos);
}
function ball(parent,name,size,pos,material) {
  const o=mesh(parent,name,new THREE.SphereGeometry(1,24,16),material,pos);o.scale.set(...size);return o;
}
function cylinder(parent,name,radius,height,pos,material,axis=[0,1,0],radiusBottom=radius) {
  const o=mesh(parent,name,new THREE.CylinderGeometry(radius,radiusBottom,height,32,1),material,pos);
  o.quaternion.setFromUnitVectors(V(0,1,0),V(...axis).normalize());return o;
}
function tube(parent,name,points,radius,material) {
  const path=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
  return mesh(parent,name,new THREE.TubeGeometry(path,Math.max(12,points.length*6),radius,6,false),material);
}
function beam(parent,name,from,to,width,depth,material) {
  const a=V(...from),b=V(...to),d=b.clone().sub(a);
  const o=box(parent,name,[width,d.length(),depth],a.add(b).multiplyScalar(.5).toArray(),material,Math.min(width,depth)*.32);
  o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;
}
// Superellipse rings produce a rounded, tapered shell without a stack of primitives.
function shell(parent,name,rings,material,power=3.2) {
  const points=[],indices=[],n=40;
  const signed=(x)=>Math.sign(x)*Math.pow(Math.abs(x),2/power);
  rings.forEach(([z,w,cy,h])=>{
    for(let j=0;j<n;j++) {const a=j/n*Math.PI*2;points.push(w*signed(Math.cos(a)),cy+h*signed(Math.sin(a)),z);}
  });
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++) {
    const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+(j+1)%n,d=(i+1)*n+j;
    indices.push(a,b,c,a,c,d);
  }
  points.push(0,rings[0][2],rings[0][0],0,rings.at(-1)[2],rings.at(-1)[0]);
  const first=rings.length*n,last=first+1;
  for(let j=0;j<n;j++){indices.push(first,(j+1)%n,j);indices.push(last,(rings.length-1)*n+j,(rings.length-1)*n+(j+1)%n);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
  return mesh(parent,name,geo,material);
}
function screw(parent,name,pos,axis=[0,1,0],radius=1.05) {
  const g=new THREE.Group();g.name=name;g.position.set(...pos);g.quaternion.setFromUnitVectors(V(0,1,0),V(...axis).normalize());parent.add(g);
  cylinder(g,'Screw head',radius,.45,[0,0,0],M.silver);
  box(g,'Screw recess',[radius*1.2,.2,.28],[0,.27,0],M.dark,.08);return g;
}
function optical(parent,name,pos,normal,radius) {
  const g=new THREE.Group();g.name=name;g.position.set(...pos);g.quaternion.setFromUnitVectors(V(0,0,1),V(...normal).normalize());parent.add(g);
  cylinder(g,'Optical bezel',radius,1.9,[0,0,0],M.dark,[0,0,1]);
  cylinder(g,'Optical rim',radius*.82,.45,[0,0,1.05],M.metal,[0,0,1]);
  cylinder(g,'Coated lens',radius*.71,.5,[0,0,1.36],M.glass,[0,0,1]);
  cylinder(g,'Pupil',radius*.31,.2,[0,0,1.68],M.inner,[0,0,1]);
  ball(g,'Optical reflection',[radius*.14,radius*.07,.09],[-radius*.25,radius*.24,1.83],M.silver);
  return g;
}

// Closed airfoil sections, including twist and swept tips. Real geometry on both sides.
function bladeGeometry(start,end) {
  const positions=[],indices=[],rings=18,around=16;
  for(let i=0;i<=rings;i++) {
    const t=start+(end-start)*i/rings,span=5+71.2*t;
    const chord=(3.7+7*Math.sin(Math.PI*Math.pow(t,.65)))*(1-.36*t);
    const sweep=2.7*Math.sin(Math.PI*t)+4*t;
    const twist=THREE.MathUtils.degToRad(18-11*t);
    for(let j=0;j<around;j++) {
      const a=j/around*Math.PI*2;
      const z=Math.cos(a)*chord*.5;
      const y=Math.sin(a)*(.5*(1-t)+.17);
      positions.push(span,y*Math.cos(twist)-z*Math.sin(twist),sweep+z*Math.cos(twist)+y*Math.sin(twist));
    }
  }
  for(let i=0;i<rings;i++)for(let j=0;j<around;j++) {
    const a=i*around+j,b=i*around+(j+1)%around,c=(i+1)*around+(j+1)%around,d=(i+1)*around+j;
    indices.push(a,c,b,a,d,c);
  }
  for(const [i,reverse] of [[0,true],[rings,false]])for(let j=1;j<around-1;j++) {
    const a=i*around,b=a+j,c=a+j+1;indices.push(a,reverse?c:b,reverse?b:c);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function createDrone() {
  const root=new THREE.Group();root.name='DJI_Mini_4_Pro_Visual_Sample';root.scale.setScalar(.001);
  root.userData={version:'0.1',type:'visual-reconstruction',units:'metres',source:'DJI official product photographs and specification',notEngineeringCAD:true};
  const body=new THREE.Group();body.name='Fuselage';root.add(body);
  shell(body,'Main upper shell',[
    [-77,20,70,10],[-74,25,71,15],[-65,27,72,17],[-47,29,73,18],[-24,30,74,18],
    [-3,31,74,18],[19,32,73,17],[37,32,73,16],[49,28,76,12],[60,20,79,7],[65,10,79,3]
  ],M.upper);
  shell(body,'Underside shell',[
    [-76,18,61,5],[-70,25,60,8],[-45,27,59,8],[-15,29,59,9],[15,29,59,8],[36,27,60,7],[43,20,64,3]
  ],M.belly);
  // Nose shoulders frame an open central gimbal bay.
  for(const s of [-1,1]) {
    const shoulder=ball(body,`Nose shoulder ${s}`,[9.5,12,15],[s*24,71,53],M.upper);
    shoulder.rotation.x=-.12;
    optical(body,`Front binocular sensor ${s}`,[s*25,74,69],[s*.27,.12,1],5.1);
    beam(body,`Camera side guard ${s}`,[s*24,62,55],[s*23,47,62],6,9,M.shell);
    tube(body,`Shell division ${s}`,[[s*22,61,-75],[s*27,59,-55],[s*29.5,59,-20],[s*31,60,20],[s*29,62,42]],.26,M.seam);
    // Backward/upward fisheye windows, recessed in the top shoulder.
    const window=box(body,`Rear optical window ${s}`,[8,13,1],[s*24,84.8,-48],M.dark,2.7);
    const normal=V(s*.37,.85,-.4).normalize();window.quaternion.setFromUnitVectors(V(0,0,1),normal);
    const rearOptic=optical(body,`Rear fisheye ${s}`,V(s*24,84.8,-48).addScaledVector(normal,.65).toArray(),normal.toArray(),2.6);
    rearOptic.scale.z=.24;
    box(body,`Battery latch ${s}`,[1.8,7,14],[s*27,68,-57],M.shell,.7);
    for(let i=0;i<3;i++)box(body,`Latch grip ${s}-${i}`,[.45,4,.6],[s*28.05,68,-61+i*3],M.seam,.15);
    // Vent openings below the upper shell. Kept as shallow dark insets.
    for(let i=0;i<7;i++) {
      const vent=box(body,`Side vent ${s}-${i}`,[.6,4.8,1.2],[s*29.2,64,-25+i*3.5],M.dark,.4);vent.rotation.z=s*.1;
    }
  }
  tube(body,'Battery top seam',[[-26,80,-62],[-24,83,-59],[0,89.8,-59],[24,83,-59],[26,80,-62]],.22,M.seam);
  const power=cylinder(body,'Power button',3.2,.5,[0,92.1,-43],M.shell);
  const powerRing=mesh(body,'Power ring',new THREE.TorusGeometry(1.4,.15,6,24,Math.PI*1.6),M.seam,[0,92.5,-43]);powerRing.rotation.x=-Math.PI/2;
  box(body,'Power mark',[.3,.15,1.3],[0,92.65,-41.8],M.seam,.08);
  for(let i=0;i<4;i++)box(body,'Battery LED '+i,[1.15,.3,1.5],[-4.2+i*2.8,92.4,-35],M.led,.3);
  box(body,'Rear port recess',[18,5,1.3],[0,67,-77.5],M.dark,1.1);
  box(body,'USB C socket rim',[7.7,3.3,.6],[-4.4,67,-78.4],M.metal,1.1);
  box(body,'USB C opening',[5.9,1.9,.7],[-4.4,67,-78.8],M.inner,.7);
  box(body,'MicroSD opening',[6.2,1.1,.8],[5.6,67,-78.5],M.inner,.2);
  // Flat underside sensors, with distinct lenses and infrared window.
  for(const s of [-1,1])optical(body,`Downward camera ${s}`,[s*11,49.6,16],[0,-1,0],3.5);
  box(body,'Infrared module',[9,1.2,7],[0,49.3,-1],M.dark,1);
  cylinder(body,'Auxiliary ground light',3.1,.8,[0,49,-16],M.light);
  box(body,'Belly rear panel',[35,1,31],[0,51,-45],M.shell,3);
  for(const s of [-1,1]) {
    box(body,`Rear belly landing pad ${s}`,[7,13,15],[s*20,44,-55],M.belly,2);
    box(body,`Rear rubber pad ${s}`,[6,1.5,10],[s*20,37.5,-56],M.rubber,1);
    screw(body,`Belly screw ${s}`,[s*22,50.5,-32],[0,-1,0],.8);
  }

  const gimbal=new THREE.Group();gimbal.name='Gimbal';gimbal.position.set(0,8,-2);root.add(gimbal);
  box(gimbal,'Dark gimbal recess',[29,20,17],[0,57,49],M.dark,5);
  cylinder(gimbal,'Yaw pivot',6.5,9,[0,49,52],M.metal);
  beam(gimbal,'Gimbal horizontal brace',[-15,44,60],[15,44,60],4.5,7,M.dark);
  for(const s of [-1,1]) {
    cylinder(gimbal,`Gimbal pitch motor ${s}`,5,4,[s*15,44,69],M.metal,[1,0,0]);
    beam(gimbal,`Gimbal side bracket ${s}`,[s*15,44,60],[s*15,44,70],3,4,M.dark);
  }
  const camera=new THREE.Group();camera.name='Camera';camera.position.set(0,43.5,70);gimbal.add(camera);
  box(camera,'Camera housing',[26,23,22],[0,0,0],M.dark,5);
  box(camera,'Camera front bezel',[23,20,2],[0,0,11],M.metal,4);
  optical(camera,'Main camera lens',[0,-.2,12],[0,0,1],8.2);
  // Raised focusing ring, preserving open space around the camera assembly.
  const ring=mesh(camera,'Lens edge ring',new THREE.TorusGeometry(7.8,.32,8,48),M.dark,[0,-.2,13.2]);
  for(let i=0;i<7;i++)box(gimbal,'Nose cooling slit '+i,[1.4,8,1],[-8.1+i*2.7,58,60.5],M.dark,.6);

  const motors=[
    ['FL',-1,true,[-109,78,60]],['FR',1,true,[109,78,60]],
    ['RL',-1,false,[-87,85,-79]],['RR',1,false,[87,85,-79]]
  ];
  const blade=bladeGeometry(0,.91),tip=bladeGeometry(.91,1);
  motors.forEach(([label,s,front,end],index)=>{
    const arm=new THREE.Group();arm.name='Arm_'+label;root.add(arm);
    const start=front?[s*29,64,32]:[s*24,61,-44];
    cylinder(arm,'Folding hinge '+label,6.3,7,start,M.shell,[0,0,1]);
    screw(arm,'Hinge fastener '+label,[start[0],start[1],start[2]+4],[0,0,1],1.55);
    const bend=front?[s*51,68,39]:[s*41,65,-54];
    beam(arm,'Inner arm '+label,start,bend,10,9,M.shell);
    beam(arm,'Outer arm '+label,bend,[end[0],end[1]-2,end[2]],front?8:7,front?10:8,M.upper);
    // A faint moulded line runs along the trailing edge of each arm.
    tube(arm,'Arm mould seam '+label,[[bend[0],bend[1]-3.4,bend[2]+3],[end[0],end[1]-5,end[2]+3]],.2,M.seam);
    cylinder(arm,'Motor socket '+label,8.2,10,[end[0],end[1]-1,end[2]],M.shell,[0,1,0],7.4);
    cylinder(arm,'Motor stator '+label,7.2,6.3,[end[0],end[1]+5.6,end[2]],M.metal);
    cylinder(arm,'Motor top cap '+label,6.7,1,[end[0],end[1]+9.1,end[2]],M.dark);
    for(let k=0;k<12;k++) {
      const a=k/12*Math.PI*2;
      const slot=box(arm,`Motor vent ${label}-${k}`,[.7,2.5,.8],[end[0]+Math.cos(a)*7.15,end[1]+5.7,end[2]+Math.sin(a)*7.15],M.dark,.2);slot.rotation.y=-a;
    }
    if(front) {
      beam(arm,'Front landing strut '+label,[end[0],end[1]-5,end[2]],[end[0]+s*3,40,end[2]+6],5.8,7.5,M.shell);
      beam(arm,'Front landing foot '+label,[end[0]+s*3,40,end[2]+6],[end[0]+s*4,37,end[2]+9],5.8,7.5,M.shell);
      box(arm,'Foot rubber '+label,[5.8,1.5,7.5],[end[0]+s*4,35.8,end[2]+9],M.rubber,1);
      box(arm,'Arm status lamp '+label,[3,1.4,4],[end[0],end[1]-7,end[2]+6.2],M.led,.5);
    }
    const rotor=new THREE.Group();rotor.name='Rotor_'+label;rotor.position.set(end[0],end[1]+10.7,end[2]);
    rotor.rotation.y=[-.6,.6,.73,-.73][index];root.add(rotor);
    rotor.userData={rotationAxis:'local Y',direction:index===0||index===3?1:-1};
    cylinder(rotor,'Rotor central hub '+label,3.9,2.4,[0,0,0],M.dark);
    for(let side=0;side<2;side++) {
      const half=new THREE.Group();half.name=`Blade_${label}_${side}`;half.rotation.y=side*Math.PI;rotor.add(half);
      mesh(half,'Blade airfoil',blade,M.blade);
      mesh(half,'Orange safety tip',tip,M.tip);
      cylinder(half,'Blade attachment',2.9,1.3,[5,.1,0],M.blade);
      screw(half,'Blade pivot screw',[5,1,0],[0,1,0],1.1);
    }
  });
  root.traverse(o=>{if(o.isMesh)o.geometry.deleteAttribute('uv');});
  root.updateMatrixWorld(true);
  // Use the photographed pose as the base, ground its feet and centre X/Z for interchange.
  const bounds=new THREE.Box3().setFromObject(root);const centre=bounds.getCenter(new THREE.Vector3());
  root.position.set(-centre.x,-bounds.min.y,-centre.z);
  return root;
}
