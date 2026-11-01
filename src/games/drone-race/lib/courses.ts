export type CourseId='valley'|'canyon'|'coast'|'snow'|'city'|'alien';
export type Course={id:CourseId;name:string;english:string;description:string;difficulty:string;sky:[string,string];fog:string;ground:string;road:string;glow:string;curve:number;height:number;seed:number};
export const COURSES:Course[]=[
{id:'valley',name:'翡翠山谷',english:'ALPINE VALLEY',description:'松林、山脊与起伏弯道',difficulty:'均衡',sky:['#538aaa','#c4dedb'],fog:'#b4d2cf',ground:'#557c49',road:'#52605e',glow:'#b3ff72',curve:1,height:1,seed:17},
{id:'canyon',name:'赤岩峡谷',english:'RED ROCK CANYON',description:'砂岩峭壁间的连续急弯',difficulty:'急弯',sky:['#507fa3','#efd1a5'],fog:'#d4b294',ground:'#b3774c',road:'#9c856d',glow:'#7deaff',curve:1.35,height:1.25,seed:31},
{id:'coast',name:'蔚蓝海岸',english:'COASTAL RUN',description:'跨海栈桥、灯塔与海岛',difficulty:'高速',sky:['#428fb7','#d4edf0'],fog:'#a7d8df',ground:'#3293aa',road:'#94a3a1',glow:'#c8ff96',curve:.7,height:.45,seed:47},
{id:'snow',name:'极光雪岭',english:'FROZEN RIDGE',description:'雪松、冰壁与高差航线',difficulty:'爬升',sky:['#526d9d','#dce4f2'],fog:'#c9d8e7',ground:'#cadde0',road:'#809daa',glow:'#ffb9f4',curve:.85,height:1.65,seed:59},
{id:'city',name:'霓虹夜城',english:'NEON SKYLINE',description:'楼群、屋顶赛道与霓虹灯带',difficulty:'技术',sky:['#070d22','#273655'],fog:'#172840',ground:'#1d2c40',road:'#28384b',glow:'#5febff',curve:1.12,height:.75,seed:73},
{id:'alien',name:'黑洞荒原',english:'EVENT HORIZON',description:'黑洞吸积盘下的玄武岩航线',difficulty:'异星',sky:['#060914','#353341'],fog:'#393748',ground:'#484651',road:'#35414c',glow:'#9be4ed',curve:1.08,height:1.1,seed:89}
];
export const course=(id?:string):Course=>COURSES.find(c=>c.id===id)??COURSES[0];
export const validCourse=(id:unknown):id is CourseId=>typeof id==='string'&&COURSES.some(c=>c.id===id);
export const COURSE_LENGTH=2400;
export const LANE_HALF_WIDTH=20;
export const WORLD_DEPTH_SCALE=2.6;
export const GATE_TUBE=.32;
export const AIRCRAFT_RADIUS=2.2;
export const FIRST_GATE=160,GATE_SPACING=180;
export const FIRST_OBSTACLE=250,OBSTACLE_SPACING=180;
export const courseX=(d:number,id?:string)=>{const c=course(id);return (Math.sin(d*.0035)*38+Math.sin(d*.008)*10)*c.curve;};
export const courseHeading=(d:number,id?:string)=>Math.atan((.133*Math.cos(d*.0035)+.08*Math.cos(d*.008))*course(id).curve);
export const courseHeight=(d:number,id?:string)=>14+(Math.sin(d*.005)*5+Math.sin(d*.011)*2)*course(id).height;
export const gateX=(d:number,id?:string)=>Math.sin(d*.0087+((course(id).seed-17)*.03))*.64;
export const obstacleX=(d:number,id?:string)=>Math.sin(d*.016+2+((course(id).seed-17)*.02))*.72;
export type SolidBox={x:number;y:number;hx:number;hy:number;hz:number};
const RADII=[8.4,6.6,5.4,7.4];
const HEIGHTS=[1,9,3,13,6,0,10,4,14,7,2,11,5];
export function gateSpec(distance:number,id?:string){
 const index=Math.max(0,Math.round((distance-FIRST_GATE)/GATE_SPACING));
 const radius=RADII[(index+(id==='canyon'?1:id==='city'?2:0))%RADII.length],offset=HEIGHTS[index%HEIGHTS.length];
 return {radius,offset,x:gateX(distance,id)*LANE_HALF_WIDTH,altitude:courseHeight(distance,id)+offset};
}
export function gateSupports(distance:number,id?:string):SolidBox[]{const g=gateSpec(distance,id),x=g.radius*.72,bottom=-9-g.offset,top=-Math.sqrt((g.radius+GATE_TUBE)**2-x*x);return [-1,1].flatMap(side=>[{x:side*x,y:(bottom+top)/2,hx:.20,hy:(top-bottom)/2,hz:.20},{x:side*x,y:bottom+.28,hx:.95,hy:.28,hz:1.2}]);}
export function fitsGate(x:number,altitude:number,distance:number,id?:string){const g=gateSpec(distance,id),dx=x*LANE_HALF_WIDTH-g.x,dy=altitude-g.altitude;return dx*dx+dy*dy<=(g.radius-AIRCRAFT_RADIUS)**2;}
// All obstacle pieces use these same solid dimensions in both renderers and physics.
export function obstacleSpec(distance:number,id?:string){
 const index=Math.max(0,Math.round((distance-FIRST_OBSTACLE)/OBSTACLE_SPACING)),kind=index%6,side=(index+course(id).seed)%2?1:-1;
 const boxes:SolidBox[]=[],add=(left:number,right:number,bottom:number,top:number)=>{if(right>left&&top>bottom)boxes.push({x:(left+right)/2,y:(bottom+top)/2,hx:(right-left)/2,hy:(top-bottom)/2,hz:.85});};
 let label='',opening={x:0,y:12};
 if(kind===0){label='挡土墙 · 向上越过';add(-25,25,-9,6);}
 else if(kind===1){label='设备廊桥 · 降低高度';add(-25,25,7,29);opening={x:0,y:0};}
 else if(kind===2||kind===4){label=(kind===2?'通风机房':'货场闸门')+(side>0?' · 靠右通过':' · 靠左通过');const center=side*9;add(-25,center-6,-9,29);add(center+6,25,-9,29);opening={x:center,y:6};}
 else {const center=side*5,cy=kind===3?11:1,half=kind===3?5.4:4.6;label=kind===3?'检修高窗 · 爬升穿过':'卷帘门口 · 俯冲穿过';add(-25,center-7,-9,29);add(center+7,25,-9,29);add(center-7,center+7,-9,cy-half);add(center-7,center+7,cy+half,29);opening={x:center,y:cy};}
 return {label,boxes,opening};
}
export const noise=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
