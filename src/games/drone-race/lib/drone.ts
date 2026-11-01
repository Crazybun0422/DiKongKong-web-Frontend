import {recognizeSketch, type SketchGeometry} from './sketch-shape';
import {flightImpact} from './race-collision';
import {CourseId,COURSE_LENGTH,courseX,courseHeight,courseHeading,gateX,obstacleX,fitsGate,AIRCRAFT_RADIUS,FIRST_OBSTACLE,OBSTACLE_SPACING} from './courses';
export {COURSE_LENGTH,courseX,courseHeight,courseHeading,gateX,obstacleX} from './courses';
export type Point = { x: number; y: number };
export type Stroke = Point[];
export type Motor = { x: number; z: number; r: number; y?:number; axis?:'y'|'z'|'x'; duct?:boolean; inverted?:boolean };
export type DroneKind = 'quad'|'tri'|'hquad'|'racer'|'hex'|'octo'|'ducted'|'twin'|'tandem'|'vtol'|'fixedwing'|'helicopter';
export type AirframeDetail={family:string;variant:number;shell:'camera'|'carbon'|'industrial'|'airplane'|'heli';blades:number;coaxial?:boolean;camera:'gimbal'|'fpv'|'survey'|'none';gear:'feet'|'skids'|'tall'|'wheels';payload:'none'|'tank'|'box';armWidth:number;bodyHeight:number;battery:number;mass:number;span:number;prop:number;maxKph:number;response:number;bodyColor:string;visualProfile?:string;cameraCount?:number;branded?:boolean;frontSensors?:boolean};
export type Drone = { motors: Motor[]; body: Point[]; color: string; speed: number; handling: number; energy: number; name: string; inferred: boolean; kind?:DroneKind; wing?:Point[]; adjusted?:boolean;catalogId?:string;detail?:AirframeDetail;sketch?:SketchGeometry };
export const COLORS = ['#d0ff4b', '#6ee7ff', '#ff8e62', '#c4a0ff'];
export const CATALOG: {kind:DroneKind;name:string;description:string}[] = [
 {kind:'quad',name:'经典四旋',description:'X 形机臂 · 均衡灵活'},
 {kind:'tri',name:'三叶疾风',description:'Y 形三臂 · 轻巧敏捷'},
 {kind:'hquad',name:'双梁游侠',description:'H 形双梁 · 宽体座舱'},
 {kind:'racer',name:'猎隼竞速',description:'宽前窄后 · 流线机身'},
 {kind:'hex',name:'六旋重载',description:'六臂结构 · 腹部货舱'},
 {kind:'octo',name:'八旋巨擎',description:'八旋阵列 · 重型起落架'},
 {kind:'ducted',name:'涵道精灵',description:'封闭护圈 · 紧凑机身'},
 {kind:'twin',name:'双环飞梭',description:'双涵道 · 横向布局'},
 {kind:'tandem',name:'纵列双旋',description:'前后双桨 · 长舱滑橇'},
 {kind:'vtol',name:'复合翼巡航',description:'主翼尾翼 · 四点垂起'},
];
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function loop(cx:number,cy:number,r:number,ry=r):Stroke{return Array.from({length:49},(_,i)=>{const t=i/48*Math.PI*2;return {x:cx+Math.cos(t)*r+Math.sin(t*7)*.6,y:cy+Math.sin(t)*ry+Math.cos(t*5)*.6};});}
const stroke=(p:number[][]):Stroke=>p.map(([x,y])=>({x,y}));
export function template(index=0):Stroke[]{
 const kind=CATALOG[index]?.kind??'quad';let rotors:number[][]=[];let body:number[][]=[[222,200],[250,173],[278,200],[280,294],[250,316],[220,294],[222,200]];
 let radius=34;const extras:Stroke[]=[];
 if(kind==='quad')rotors=[[122,125],[378,125],[122,375],[378,375]];
 if(kind==='tri')rotors=[[120,130],[380,130],[250,390]];
 if(kind==='hquad'){rotors=[[115,130],[385,130],[115,370],[385,370]];body=[[191,215],[250,197],[309,215],[309,281],[250,300],[191,281],[191,215]];extras.push(stroke([[115,130],[115,250],[115,370]]),stroke([[385,130],[385,250],[385,370]]));}
 if(kind==='racer'){rotors=[[93,120],[407,120],[160,385],[340,385]];radius=29;body=[[250,155],[274,215],[270,325],[250,350],[230,325],[226,215],[250,155]];}
 if(kind==='hex'||kind==='octo'){const n=kind==='hex'?6:8;radius=n===6?32:27;rotors=Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2-Math.PI/2;return [250+Math.cos(a)*167,250+Math.sin(a)*167];});body=[[213,199],[287,199],[303,250],[287,301],[213,301],[197,250],[213,199]];}
 if(kind==='ducted'){rotors=[[148,148],[352,148],[148,352],[352,352]];radius=52;body=[[220,215],[250,199],[280,215],[291,250],[280,285],[250,301],[220,285],[209,250],[220,215]];for(const [x,y] of rotors)extras.push(loop(x,y,radius+12));}
 if(kind==='twin'){rotors=[[105,250],[395,250]];radius=59;body=[[227,191],[273,191],[290,250],[273,309],[227,309],[210,250],[227,191]];for(const [x,y] of rotors)extras.push(loop(x,y,radius+13));}
 if(kind==='tandem'){rotors=[[250,103],[250,397]];radius=62;body=[[227,163],[250,152],[273,163],[283,328],[263,349],[237,349],[217,328],[227,163]];}
 if(kind==='vtol'){rotors=[[123,138],[377,138],[123,357],[377,357]];radius=31;body=[[250,115],[275,206],[269,354],[250,379],[231,354],[225,206],[250,115]];extras.push(stroke([[55,275],[210,219],[250,210],[290,219],[445,275],[418,302],[286,282],[250,287],[214,282],[82,302],[55,275]]));}
 const arms=rotors.map(([x,y])=>stroke([[250,250],[x,y]]));
 return [...arms,stroke(body),...extras,...rotors.map(([x,y])=>loop(x,y,radius))];
}
export function polygonArea(p:Point[]){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2;}
export function hull(points:Point[]):Point[]{
 const p=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);if(p.length<3)return p;
 const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const low:Point[]=[],high:Point[]=[];
 for(const q of p){while(low.length>1&&cross(low[low.length-2],low[low.length-1],q)<=0)low.pop();low.push(q);}
 for(const q of p.reverse()){while(high.length>1&&cross(high[high.length-2],high[high.length-1],q)<=0)high.pop();high.push(q);}
 return low.slice(0,-1).concat(high.slice(0,-1));
}
export function pointInside(p:Point[],x:number,z:number){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function polygonDistance(p:Point[],x:number,z:number){if(pointInside(p,x,z))return 0;let min=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.y-a.y,t=clamp(((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1),0,1);min=Math.min(min,Math.hypot(x-a.x-t*dx,z-a.y-t*dz));}return min;}
// The envelope includes the entire propeller sweep and any duct, not just the hub.
export function rotorEnvelope(d:Drone,m:Motor){return m.r+((m.duct??(d.kind==='ducted'||d.kind==='twin'))?.13:.035);}
export function ensureClearance(drone:Drone):Drone{
 const d={...drone,motors:drone.motors.map(m=>({...m}))};let changed=false;const gap=.13;
 for(let pass=0;pass<70;pass++){let conflicts=0;
  for(let i=0;i<d.motors.length;i++){const m=d.motors[i],r=rotorEnvelope(d,m);const footprints=[d.body,...(d.wing?[d.wing]:[])];
   for(const footprint of footprints){let dist=polygonDistance(footprint,m.x,m.z),tries=0;while(dist<r+gap&&tries++<50){let x=m.x,z=m.z,len=Math.hypot(x,z);if(len<.01){x=Math.cos(i*2.399);z=Math.sin(i*2.399);len=1;}const step=Math.max(.035,Math.min(.13,r+gap-dist));m.x+=x/len*step;m.z+=z/len*step;dist=polygonDistance(footprint,m.x,m.z);changed=true;conflicts++;}}
  }
  for(let i=0;i<d.motors.length;i++)for(let j=i+1;j<d.motors.length;j++){const a=d.motors[i],b=d.motors[j],dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz),need=rotorEnvelope(d,a)+rotorEnvelope(d,b)+gap;if(dist<need){const angle=(i+j)*2.399,ux=dist>.0001?dx/dist:Math.cos(angle),uz=dist>.0001?dz/dist:Math.sin(angle),push=(need-dist)/2+.002;a.x-=ux*push;a.z-=uz*push;b.x+=ux*push;b.z+=uz*push;changed=true;conflicts++;}}
  if(!conflicts)break;
 }
 d.adjusted=changed;return d;
}
export function analyze(strokes:Stroke[],color=COLORS[0]):Drone{
 return recognizeSketch(strokes,color);
}

export type FlightControlMode = 'fpv' | 'stabilized';
export type Flight={controlMode?:FlightControlMode;brakeInput?:boolean;braking?:boolean;crashed?:boolean;crashReason?:'gate'|'obstacle'|'ground';crashAge?:number;crashSeed?:number;impactSpeed?:number;altitudeOffset?:number;liftVelocity?:number;liftInput?:number;boosting?:boolean;boostHeat?:number;courseId?:CourseId;missed?:number;lastGate?:{distance:number;success:boolean;elapsed:number};distance:number;x:number;speed:number;battery:number;gates:number;hits:number;nextGate:number;nextObstacle:number;finished:boolean;elapsed:number;vx?:number;altitude?:number;vy?:number;roll?:number;pitch?:number;yaw?:number};
// One physical speed feeds simulation, HUD and optical flow.
export const cruiseKph=(drone:Drone)=>(drone.detail?.maxKph??(110+drone.speed*.65));
export const BOOST_MULTIPLIER=1.72;
export const initialFlight=(courseId:CourseId='valley',crashSeed=Math.floor(Math.random()*4294967296),controlMode:FlightControlMode='fpv'):Flight=>({controlMode,courseId,crashSeed,distance:0,x:0,speed:0,battery:100,gates:0,missed:0,hits:0,nextGate:160,nextObstacle:FIRST_OBSTACLE,altitudeOffset:0,liftVelocity:0,liftInput:0,crashed:false,finished:false,elapsed:0,vx:0,altitude:courseHeight(0,courseId),vy:0,roll:0,pitch:0,yaw:0});
export function stepFlight(state:Flight,drone:Drone,input:number,boost:boolean,dt:number,lift=0,brake=false,controlMode:FlightControlMode=state.controlMode??'fpv'):Flight{
 const s={...initialFlight(state.courseId,state.crashSeed??0),...state,controlMode};if(s.finished||s.crashed)return s;const delta=clamp(dt,0,1.5),steps=Math.ceil(delta/.012);if(!steps)return s;const h=delta/steps;
 const stabilized=controlMode==='stabilized';
 const response=drone.detail?.response??1,wing=drone.kind==='fixedwing'||drone.kind==='vtol';
 for(let i=0;i<steps;i++){
  const oldDistance=s.distance,oldX=s.x,oldAltitude=s.altitude??courseHeight(s.distance,s.courseId);s.elapsed+=h;const oldV=s.vx??0;
  // FPV inputs command attitude rates. Centering the stick stops rotation, not bank or climb.
  if(!stabilized){s.roll=clamp((s.roll??0)-clamp(input,-1,1)*1.15*response*h,-1.1,1.1);s.pitch=clamp((s.pitch??0)+clamp(lift,-1,1)*.8*response*h,-.75,.75);}
  const targetV=(stabilized?clamp(input,-1,1):-Math.sin(s.roll??0))*(1.05+drone.handling/170);
  s.vx=oldV+(targetV-oldV)*(1-Math.exp(-h*(input?4.2:5.5)*response));
  s.x=clamp(s.x+s.vx*h,-1.12,1.12);if(Math.abs(s.x)>=1.12)s.vx*=.65;
  const braking=brake===true;s.brakeInput=braking;s.braking=braking;const boosting=boost&&!braking&&s.battery>1;s.boosting=boosting;s.boostHeat=(s.boostHeat??0)+((boosting?1:0)-(s.boostHeat??0))*Math.min(1,h*(boosting?12:4));s.battery=clamp(s.battery+h*(boosting?-31+drone.energy*.1:9),0,100);
  const cruise=cruiseKph(drone)/3.6;
  const target=cruise*(braking?.40:boosting?BOOST_MULTIPLIER:1)*(Math.abs(s.x)>1?.64:1)*(1-Math.abs(s.roll??0)*.07);
  const acceleration=(target-s.speed)*(braking?4.8:boosting?4.2:1.4+response*.6);s.speed+=acceleration*h;s.distance+=s.speed*h;
  const height=courseHeight(s.distance,s.courseId);
  const oldOffset=oldAltitude-courseHeight(oldDistance,s.courseId);
  const desiredLift=(stabilized?clamp(lift,-1,1):Math.sin(s.pitch??0))*(10+drone.handling*.025);
  s.liftVelocity=(s.liftVelocity??0)+(desiredLift-(s.liftVelocity??0))*(1-Math.exp(-h*6*response));
  s.altitudeOffset=Math.min(22,(stabilized?oldOffset:oldAltitude-height)+s.liftVelocity*h);
  if(s.altitudeOffset>=22&&s.liftVelocity>0)s.liftVelocity=0;
  s.altitude=height+s.altitudeOffset;s.vy=(s.altitude-oldAltitude)/h;
  const impact=flightImpact({distance:oldDistance,x:oldX,altitude:oldAltitude},{distance:s.distance,x:s.x,altitude:s.altitude},s.nextGate,s.nextObstacle,s.courseId);
  if(impact){const q=impact.fraction;s.distance=oldDistance+(s.distance-oldDistance)*q;s.x=oldX+(s.x-oldX)*q;s.altitude=oldAltitude+(s.altitude-oldAltitude)*q;s.elapsed-=h*(1-q);s.crashed=true;s.crashReason=impact.reason;s.impactSpeed=s.speed;s.hits=1;s.speed=0;s.vx=0;s.vy=0;s.liftVelocity=0;s.boosting=false;s.boostHeat=0;s.braking=false;break;}
  const curvature=(courseHeading(s.distance+5,s.courseId)-courseHeading(s.distance-5,s.courseId))/10;
  const bank=clamp(-s.vx*.26-(s.vx-oldV)/h*.035-curvature*s.speed*.85,-.68,.68);
  const pitch=clamp((wing?.025:-.04)-acceleration*.006+(s.vy??0)*.035,-.28,.34);
  const smooth=1-Math.exp(-h*5);if(stabilized){s.roll=(s.roll??0)+(bank-(s.roll??0))*smooth;s.pitch=(s.pitch??0)+(pitch-(s.pitch??0))*smooth;}
  s.yaw=(s.yaw??0)+(clamp(s.vx*.11+curvature*s.speed*.3,-.23,.23)-(s.yaw??0))*smooth;
  if(s.distance>=s.nextGate){const ratio=clamp((s.nextGate-oldDistance)/(s.distance-oldDistance||1),0,1),crossX=oldX+(s.x-oldX)*ratio,crossAltitude=oldAltitude+((s.altitude??height)-oldAltitude)*ratio,success=fitsGate(crossX,crossAltitude,s.nextGate,s.courseId);if(success){s.gates++;s.battery=Math.min(100,s.battery+18);}else s.missed=(s.missed??0)+1;s.lastGate={distance:s.nextGate,success,elapsed:s.elapsed};s.nextGate+=180;}
  if(s.distance>s.nextObstacle+1.4)s.nextObstacle+=OBSTACLE_SPACING;
  if(s.distance>=COURSE_LENGTH){s.finished=true;s.distance=COURSE_LENGTH;break;}
 }
 return s;
}
