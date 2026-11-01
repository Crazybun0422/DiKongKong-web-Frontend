import type {Drone,Flight} from './drone';
import {buildMesh,type MeshData,type V} from './mesh';
import {AIRCRAFT_RADIUS,courseHeight,courseX,courseHeading} from './courses';
import {visualHeading,VISUAL_TRAVEL_SCALE,projectRacePoint,type RaceCamera} from './race-camera';

export function crashRandom(seed:number){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
type Piece={mesh:MeshData;center:V;velocity:V;spin:V};
type Fracture={seed:number;pieces:Piece[];scale:number};
const fractures=new WeakMap<Drone,Fracture>();
export function crashFracture(d:Drone,seed:number,phase=0):Fracture{
 const known=fractures.get(d);if(known?.seed===seed)return known;
 const random=crashRandom(seed),original=buildMesh(d),vertices=original.vertices,centers:V[]=[];
 // Real motor/arm assemblies split from several randomly placed fuselage sections.
 for(const m of d.motors.filter((_,i)=>i%Math.max(1,Math.ceil(d.motors.length/8))===0))centers.push([m.x,m.y??.3,m.z]);
 const bodyCount=3+Math.floor(random()*4);
 for(let i=0;i<bodyCount;i++){const p=d.body[Math.floor(random()*d.body.length)];centers.push([p.x*(.22+random()*.45),-.06+random()*.26,p.y*(.22+random()*.5)]);}
 const groups=centers.map(()=>[] as number[]);
 const frozen=(offset:number)=>Array.from(vertices.slice(offset,offset+14));
 const midpoint=(a:number[],b:number[])=>a.map((n,i)=>(n+b[i])*.5);
 function assign(a:number[],b:number[],c:number[],depth=0){
  const edge=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]),Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2]));
  if(depth<2&&edge>original.extent*.4){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);assign(a,ab,ca,depth+1);assign(ab,b,bc,depth+1);assign(ca,bc,c,depth+1);assign(ab,bc,ca,depth+1);return;}
  const center=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];let index=0,min=Infinity;
  centers.forEach((p,i)=>{const distance=(p[0]-center[0])**2+(p[1]-center[1])**2*.55+(p[2]-center[2])**2;if(distance<min){min=distance;index=i;}});groups[index].push(...a,...b,...c);
 }
 for(let i=0;i<vertices.length;i+=42)assign(frozen(i),frozen(i+14),frozen(i+28));
 const pieces:Piece[]=groups.filter(g=>g.length).map(g=>{const center:V=[0,0,0];for(let i=0;i<g.length;i+=14)for(let j=0;j<3;j++)center[j]+=g[i+j]/(g.length/14);let extent=.01;for(let i=0;i<g.length;i+=14){for(let j=0;j<3;j++)g[i+j]-=center[j];const axis=Math.abs(g[i+11]);if(axis>.5){const [a,b]=axis<1.5?[0,2]:axis<2.5?[0,1]:[1,2];g[i+9]-=center[a];g[i+10]-=center[b];}extent=Math.max(extent,Math.hypot(g[i],g[i+1],g[i+2]));}const angle=Math.atan2(center[2],center[0])+(random()-.5)*1.3,speed=2+random()*4;return {center,mesh:{vertices:new Float32Array(g),extent},velocity:[Math.cos(angle)*speed,2+random()*4,-1-random()*4],spin:[(random()-.5)*8,(random()-.5)*11,(random()-.5)*9]};});
 const fracture={seed,pieces,scale:AIRCRAFT_RADIUS/original.extent};fractures.set(d,fracture);return fracture;
}
function rotate(p:V,yaw:number,pitch:number,roll:number):V{let [x,y,z]=p;[y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];[x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];return[x*Math.cos(yaw)-z*Math.sin(yaw),y,x*Math.sin(yaw)+z*Math.cos(yaw)];}
export function crashParts(d:Drone,s:Flight,phase=0){
 const seed=s.crashSeed??1,f=crashFracture(d,seed,phase),age=Math.min(4,s.crashAge??0),yaw=Math.PI-visualHeading(courseHeading(s.distance,s.courseId))-(s.yaw??0),pitch=s.pitch??0,roll=-(s.roll??0),alt=s.altitude??14,ground=courseHeight(s.distance,s.courseId)-8.65,strength=.8+Math.min(1.2,(s.impactSpeed??25)/48);
 return f.pieces.map((p,index)=>{const offset=rotate(p.center.map(x=>x*f.scale) as V,yaw,pitch,roll),vx=p.velocity[0]*strength,vy=p.velocity[1],vz=p.velocity[2]*strength,hit=(vy+Math.sqrt(vy*vy+22*Math.max(0,alt+offset[1]-ground)))/11,t=Math.min(age,hit),after=Math.max(0,age-hit),travel=t+Math.min(.6,after)*.22,py=age<=hit?alt+offset[1]+vy*age-5.5*age*age:ground+Math.max(0,(2.2*after-5.5*after*after))*.4,spinAge=Math.min(age,hit+.45),piecePitch=pitch+p.spin[1]*spinAge,pieceRoll=roll+p.spin[2]*spinAge;let bottom=Infinity;const sx=Math.sin(pieceRoll),sy=Math.cos(pieceRoll)*Math.cos(piecePitch),sz=-Math.cos(pieceRoll)*Math.sin(piecePitch),verts=p.mesh.vertices;const cp=Math.cos(phase),sp=Math.sin(phase);for(let i=0;i<verts.length;i+=14){let x=verts[i],y=verts[i+1],z=verts[i+2];const axis=Math.abs(verts[i+11]),sn=sp*Math.sign(verts[i+11]),a=verts[i+9],b=verts[i+10];if(axis>.5&&axis<1.5){const xx=x-a,zz=z-b;x=a+xx*cp-zz*sn;z=b+xx*sn+zz*cp;}else if(axis>1.5&&axis<2.5){const xx=x-a,yy=y-b;x=a+xx*cp-yy*sn;y=b+xx*sn+yy*cp;}else if(axis>2.5){const yy=y-a,zz=z-b;y=a+yy*cp-zz*sn;z=b+yy*sn+zz*cp;}bottom=Math.min(bottom,(x*sx+y*sy+z*sz)*f.scale);}return {mesh:p.mesh,key:`${seed}:${index}`,scale:f.scale,origin:[courseX(s.distance,s.courseId)+s.x*20+offset[0]+vx*travel,Math.max(py,ground-bottom+.02),s.distance+(offset[2]+vz*travel)/VISUAL_TRAVEL_SCALE] as V,yaw:yaw+p.spin[0]*spinAge,pitch:pitch+p.spin[1]*spinAge,roll:roll+p.spin[2]*spinAge};});
}
export function drawCrashSparks(ctx:CanvasRenderingContext2D,camera:RaceCamera,s:Flight,w:number,h:number){
 const age=s.crashAge??0;if(age>2.6)return;const random=crashRandom((s.crashSeed??1)^0x72af31),x=courseX(s.distance,s.courseId)+s.x*20,y=s.altitude??14,z=s.distance,displayZ=camera.travelOrigin+(z-camera.travelOrigin)*VISUAL_TRAVEL_SCALE,ground=courseHeight(z,s.courseId)-8.7;
 const project=(dx:number,dy:number,dz:number)=>projectRacePoint(camera,x+dx,Math.max(ground,y+dy),displayZ+dz,w,h);
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
 for(let i=0;i<96;i++){const a=random()*Math.PI*2,speed=3+random()*15,life=.24+random()*1.55,delay=i<66?0:random()*.27,t=age-delay,vx=Math.cos(a)*speed,vy=Math.sin(a)*speed*.65+3,vz=-1-random()*9;if(t<0||t>life)continue;const end=project(vx*t,vy*t-7*t*t,vz*t),before=Math.max(0,t-.025),start=project(vx*before,vy*before-7*before*before,vz*before);if(end.depth<.5)continue;ctx.globalAlpha=(1-t/life)**1.2;ctx.strokeStyle=i%3?'#ffb452':'#fff1b9';ctx.lineWidth=Math.min(2.5,Math.max(.65,end.k*.024));ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
 if(age<.18){const p=project(0,0,0),r=Math.max(1,p.k*(.7+age*5)),g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#fff5dbe8');g.addColorStop(.2,'#ffb258aa');g.addColorStop(1,'#ff983000');ctx.globalAlpha=1-age/.18;ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);}
 ctx.globalCompositeOperation='source-over';for(let i=0;i<7;i++){const a=age-.04*i;if(a<0||a>2.3)continue;const p=project((random()-.5)*a*3,a*.6,-a*.6),r=p.k*(.16+a*.48);ctx.globalAlpha=Math.max(0,.15*(1-a/2.3));const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#757b83');g.addColorStop(1,'#757b8300');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);}ctx.restore();
}
