import {REAL_AIRCRAFT,type RealAircraft,type BrandId} from './real-aircraft';
import {createBrandedAirframe} from './branded-airframes';
import {recognizeSketch,type SketchMode} from './sketch-shape';
import {analyze,AirframeDetail,COLORS,Drone,DroneKind,Motor,Point,Stroke} from './drone';
type Family={id:string;name:string;prefix:string;kind:DroneKind;rotors:number;shell:AirframeDetail['shell'];description:string;mass:number;span:number;speed:number};
export const FAMILIES:Family[]=[
{id:'camera',name:'折叠航拍',prefix:'云瞳',kind:'quad',rotors:4,shell:'camera',description:'折叠铰链 · 三轴云台 · 双目避障',mass:.7,span:.38,speed:78},
{id:'racing',name:'FPV 穿越',prefix:'隼影',kind:'racer',rotors:4,shell:'carbon',description:'碳纤维双板 · 电池绑带 · FPV 相机',mass:.55,span:.25,speed:145},
{id:'cinewhoop',name:'涵道电影',prefix:'环视',kind:'ducted',rotors:4,shell:'carbon',description:'全包围涵道 · 减震相机座',mass:.48,span:.23,speed:72},
{id:'hframe',name:'H 架长航时',prefix:'远行',kind:'hquad',rotors:4,shell:'industrial',description:'双梁机架 · 双电池 · 巡检吊舱',mass:2.2,span:.65,speed:85},
{id:'tricopter',name:'三旋翼',prefix:'三叶',kind:'tri',rotors:3,shell:'carbon',description:'Y 形碳架 · 尾电机舵机座',mass:.65,span:.45,speed:105},
{id:'hexacopter',name:'工业六旋',prefix:'巡星',kind:'hex',rotors:6,shell:'industrial',description:'六根圆管臂 · 测绘云台 · 高脚架',mass:4.2,span:1.05,speed:75},
{id:'octocopter',name:'重型八旋',prefix:'擎空',kind:'octo',rotors:8,shell:'industrial',description:'八旋阵列 · 独立减震载荷',mass:7.8,span:1.4,speed:65},
{id:'coaxialx8',name:'共轴 X8',prefix:'叠峰',kind:'quad',rotors:8,shell:'industrial',description:'四臂上下共轴 · 双层反转桨',mass:5.2,span:.95,speed:84},
{id:'coaxialy6',name:'共轴 Y6',prefix:'叠翼',kind:'tri',rotors:6,shell:'industrial',description:'三臂上下共轴 · 紧凑重载',mass:3.4,span:.78,speed:89},
{id:'agricultural',name:'植保喷洒',prefix:'田野',kind:'hex',rotors:6,shell:'industrial',description:'药液箱 · 喷洒横杆 · 喷嘴阵列',mass:12,span:1.65,speed:52},
{id:'cargo',name:'货运吊舱',prefix:'驮云',kind:'octo',rotors:8,shell:'industrial',description:'货箱快拆架 · 重载着陆支架',mass:16,span:1.85,speed:70},
{id:'vtol',name:'复合翼垂起',prefix:'天际',kind:'vtol',rotors:5,shell:'airplane',description:'四点垂起 · 后置推桨 · 主翼尾翼',mass:3.6,span:1.8,speed:135},
{id:'fixedwing',name:'固定翼巡航',prefix:'游隼',kind:'fixedwing',rotors:1,shell:'airplane',description:'翼型主翼 · 推进桨 · 三点起落架',mass:2.1,span:1.5,speed:155},
{id:'helicopter',name:'单旋翼直升',prefix:'蜻蜓',kind:'helicopter',rotors:2,shell:'heli',description:'主旋翼桅杆 · 尾桨 · 双滑橇',mass:3.8,span:1.45,speed:118},
{id:'tandem',name:'纵列双旋',prefix:'双擎',kind:'tandem',rotors:2,shell:'heli',description:'前后旋翼塔 · 长机舱 · 重载滑橇',mass:6.2,span:1.6,speed:105},
{id:'bicopter',name:'双涵道倾转',prefix:'双环',kind:'twin',rotors:2,shell:'camera',description:'横向双涵道 · 倾转支架 · 相机',mass:1.2,span:.58,speed:95},
];
const VARIANTS=['轻量','标准','运动','长航','巡检','专业','重装','远征'];
export type Airframe={id:string;name:string;family:Family;variant:number;description:string;brand:BrandId;series:string;real?:RealAircraft};
const ORIGINAL_AIRFRAMES:Airframe[]=FAMILIES.flatMap(f=>VARIANTS.map((v,i)=>({id:`${f.id}-${i+1}`,name:`${f.prefix} ${String((i+1)*100)} · ${v}`,family:f,variant:i,description:f.description,brand:'original' as const,series:f.name}))).sort((a,b)=>a.variant-b.variant);
export const AIRFRAMES:Airframe[]=[...REAL_AIRCRAFT.map(real=>({id:real.id,name:real.name,family:FAMILIES.find(f=>f.id===real.family)??FAMILIES[0],variant:0,description:real.series,brand:real.brand,series:real.series,real})),...ORIGINAL_AIRFRAMES];
export const airframeColor=(id:string)=>getAirframe(id)?.real?.bodyColor??COLORS[0];
export const getAirframe=(id?:string)=>AIRFRAMES.find(a=>a.id===id);
function ellipse(rx:number,rz:number,n=32):Point[]{return Array.from({length:n},(_,i)=>({x:Math.cos(i/n*Math.PI*2)*rx,y:Math.sin(i/n*Math.PI*2)*rz}));}
export function createAirframe(id:string,color=airframeColor(id)):Drone{
 const a=getAirframe(id);if(!a)throw Error('机型不存在，请重新选择。');if(a.real)return createBrandedAirframe(a.real,color);const {family:f,variant:v}=a;
 const long=[.92,1,1.08,1.23,1.05,1.12,1.17,1.32][v],wide=[.9,1,1.05,.94,1.13,1.06,1.21,1.1][v];
 const span=1.26+(v%3)*.12,r=.52+(v%4)*.045,bodyW=(f.shell==='industrial'?.43:f.shell==='carbon'?.28:.4)*wide,bodyL=(f.shell==='heli'?.95:f.shell==='airplane'?1.55:.7)*long;
 let body=ellipse(bodyW,bodyL),motors:Motor[]=[],wing:Point[]|undefined;
 const coax=f.id.startsWith('coaxial'),n=coax?f.rotors/2:f.rotors;
 const baseY=f.shell==='industrial'?.4:f.shell==='carbon'?.22:.31;
 if(['quad','racer','hquad','ducted'].includes(f.kind)){
  const spread=f.kind==='racer'?1.17:1;motors=[[-span*spread,-span*.83],[span*spread,-span*.83],[-span*(f.kind==='racer'?.75:1),span*.88],[span*(f.kind==='racer'?.75:1),span*.88]].map(([x,z])=>({x:x*wide,z:z*long,r,y:baseY}));
  if(f.kind==='ducted')motors=motors.map(m=>({...m,x:m.x*.72,z:m.z*.76,r:.51+(v%3)*.028}));
 }else if(f.kind==='tri')motors=[{x:-span*wide,z:-span*.7,r,y:baseY},{x:span*wide,z:-span*.7,r,y:baseY},{x:0,z:span*1.18*long,r,y:baseY}];
 else if(f.kind==='hex'||f.kind==='octo')motors=Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2-Math.PI/2;return{x:Math.cos(t)*span*1.36*wide,z:Math.sin(t)*span*1.36*long,r:r*(n===8?.8:.95),y:baseY};});
 else if(f.kind==='twin')motors=[{x:-1.25*wide,z:0,r:.69,y:.35},{x:1.25*wide,z:0,r:.69,y:.35}];
 else if(f.kind==='tandem')motors=[{x:0,z:-1.42*long,r:.97,y:.55},{x:0,z:1.42*long,r:.97,y:.74}];
 else if(f.kind==='helicopter'){body=ellipse(bodyW,bodyL*.68);motors=[{x:0,z:-.16,r:1.78+v*.055,y:.65},{x:.12,z:2.12*long,r:.29+v*.015,y:.25,axis:'x'}];}
 else if(f.kind==='vtol'||f.kind==='fixedwing'){
  const half=2.3+v*.13;wing=[{x:-half,y:.18},{x:-half*.97,y:.54},{x:-.45,y:.38},{x:.45,y:.38},{x:half*.97,y:.54},{x:half,y:.18},{x:.35,y:-.28},{x:-.35,y:-.28}];
  if(f.kind==='vtol')motors=[{x:-1.15,z:-1.12*long,r:.48,y:.4},{x:1.15,z:-1.12*long,r:.48,y:.4},{x:-1.15,z:1.05*long,r:.48,y:.4},{x:1.15,z:1.05*long,r:.48,y:.4}];
  motors.push({x:0,z:bodyL+.1,r:.54+(v%3)*.05,y:.02,axis:'z'});
 }
 if(coax)motors=motors.flatMap(m=>[{...m,y:.46},{...m,y:-.4}]);
 const detail:AirframeDetail={family:f.id,variant:v,shell:f.shell,blades:f.shell==='carbon'?3:f.kind==='tandem'?3:f.kind==='helicopter'?2:v===6?3:2,coaxial:coax,camera:f.shell==='carbon'?'fpv':f.shell==='industrial'?'survey':f.shell==='heli'?'none':'gimbal',gear:f.shell==='industrial'?'tall':f.shell==='heli'?'skids':f.shell==='airplane'?'wheels':'feet',payload:f.id==='agricultural'?'tank':f.id==='cargo'?'box':'none',armWidth:(f.shell==='industrial'?.115:f.shell==='carbon'?.075:.11)*(1+v*.035),bodyHeight:f.shell==='carbon'?.14:f.shell==='industrial'?.36:f.shell==='heli'?.46:.28,battery:v>=5?2:1,mass:Math.round(f.mass*(.8+v*.14)*100)/100,span:Math.round(f.span*(.87+v*.065)*100)/100,prop:Math.round((f.span*1000/(f.kind==='helicopter'?1.1:2.2))/25.4*10)/10,maxKph:Math.round(f.speed*[.94,1,1.15,.94,.98,1.08,.89,1.04][v]),response:f.shell==='carbon'?1.3-v*.045:f.shell==='industrial'?.76-v*.025:1.05-v*.028,bodyColor:f.shell==='carbon'?'#253038':f.shell==='industrial'?(v%2?'#bac2c0':'#e1e5e2'):v%3===2?'#70838c':'#dce0de'};
 return {catalogId:id,detail,kind:f.kind,name:a.name,motors,body,wing,color,inferred:false,speed:Math.min(99,Math.round(detail.maxKph/1.7)),handling:Math.round(57+detail.response*27),energy:Math.min(99,65+v*4+(f.shell==='industrial'?6:0))};
}
export function airframeSketch(id:string):Stroke[]{
 const d=createAirframe(id),points=[...d.body,...d.motors.flatMap(m=>[{x:m.x-m.r,y:m.z-m.r},{x:m.x+m.r,y:m.z+m.r}]),...(d.wing??[])];const span=Math.max(...points.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))))*2.25,scale=440/span;
 const convert=(p:Point)=>({x:250+p.x*scale,y:250+p.y*scale});const close=(p:Point[])=>[...p,p[0]].map(convert);
 const unique=d.motors.filter((m,i,all)=>m.axis!=='x'&&m.axis!=='z'&&all.findIndex(n=>n.x===m.x&&n.z===m.z)===i);
 return [...unique.map(m=>[{x:250,y:250},convert({x:m.x,y:m.z})]),close(d.body),...(d.wing?[close(d.wing)]:[]),...unique.map(m=>close(ellipse(m.r,m.r,48).map(p=>({x:p.x+m.x,y:p.y+m.z})))),...(d.kind==='ducted'||d.kind==='twin'?unique.map(m=>close(ellipse(m.r+.085,m.r+.085,48).map(p=>({x:p.x+m.x,y:p.y+m.z})))):[])];
}
export function buildFromSketch(strokes:Stroke[],color:string,id?:string,mode:SketchMode='structure'):Drone{
 const a=getAirframe(id);if(!a||mode==='silhouette')return recognizeSketch(strokes,color,undefined,mode);
 const preset=createAirframe(a.id,color),baseline=airframeSketch(a.id);
 if(JSON.stringify(strokes)===JSON.stringify(baseline))return preset;
 const keys=new Set(baseline.map(s=>JSON.stringify(s)));
 // Only a completely intact reference can lend its mechanical equipment to additions.
 // A deleted or redrawn reference becomes a free-form design, never a forced family match.
 if(baseline.every(b=>strokes.some(s=>JSON.stringify(s)===JSON.stringify(b)))){
  const points=[...preset.body,...preset.motors.flatMap(m=>[{x:m.x-m.r,y:m.z-m.r},{x:m.x+m.r,y:m.z+m.r}]),...(preset.wing??[])];
  const scale=Math.max(...points.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))))*2.25/440;
  const originals=new Set(strokes.flatMap((s,i)=>keys.has(JSON.stringify(s))?[i]:[]));
  return recognizeSketch(strokes,color,{drone:preset,scale,originals});
 }
 return analyze(strokes,color);
}
