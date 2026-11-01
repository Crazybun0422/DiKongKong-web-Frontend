import type {Drone, DroneKind, Motor, Point, Stroke} from './drone';

export const MAX_SKETCH_STROKES = 192;
export const MAX_SKETCH_POINTS = 64000;
export const MAX_SKETCH_ROTORS = 24;
export type SketchMode = 'structure'|'silhouette';
export type SketchPart = {outline:Point[];role:'shell'|'wing'|'panel';low:number;high:number};
export type SketchPath = {points:Point[];height:number;motor?:number};
export type SketchGeometry = {
  parts:SketchPart[];paths:SketchPath[];overlay?:boolean;
  report:{strokes:number;joined:number;surfaces:number;curves:number;details:number;addedRotors:number;stacked:boolean};
};
type Chain = {points:Point[];sources:number[]};
type Loop = Chain & {area:number;center:Point;radius:number;round:boolean};
export type SketchReference = {drone:Drone;scale:number;originals:Set<number>};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(p:Point[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2;
const box=(p:Point[])=>p.reduce((b,q)=>({x0:Math.min(b.x0,q.x),x1:Math.max(b.x1,q.x),y0:Math.min(b.y0,q.y),y1:Math.max(b.y1,q.y)}),{x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity});
function inside(p:Point[],q:Point){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>q.y)!==(b.y>q.y)&&q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
const segmentDistance=(p:Point,a:Point,b:Point)=>{const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return dist(p,{x:a.x+t*x,y:a.y+t*y});};
function simplify(p:Point[],epsilon:number,limit:number):Point[]{
  // Iterative RDP keeps corners and concavities; dense pen sampling never becomes a convex hull.
  const reduce=(e:number)=>{const keep=new Set([0,p.length-1]),stack=[[0,p.length-1]];while(stack.length){const [a,b]=stack.pop()!;let far=e,index=-1;for(let i=a+1;i<b;i++){const d=segmentDistance(p[i],p[a],p[b]);if(d>far){far=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}return [...keep].sort((a,b)=>a-b).map(i=>p[i]);};
  let out=reduce(epsilon);while(out.length>limit){epsilon*=1.4;out=reduce(epsilon);}return out;
}
function length(p:Point[]){return p.reduce((n,q,i)=>n+(i?dist(q,p[i-1]):0),0);}
function closed(p:Point[],span:number){return p.length>=4&&dist(p[0],p.at(-1)!)<Math.max(3,Math.min(span*.032,length(p)*.055));}
function joinStrokes(input:Chain[],span:number){
  const chains=input.map(c=>({...c,points:[...c.points]}));let joined=0;
  for(let pass=0;pass<input.length;pass++){
    let found=false;
    for(let i=0;i<chains.length&&!found;i++){
      const a=chains[i];if(closed(a.points,span))continue;
      for(const side of [0,1]){
        const end=side?a.points.at(-1)!:a.points[0],matches:{j:number;reverse:boolean}[]=[];
        for(let j=0;j<chains.length;j++){if(j===i||closed(chains[j].points,span))continue;const b=chains[j].points;if(dist(end,b[0])<span*.023)matches.push({j,reverse:false});if(dist(end,b.at(-1)!)<span*.023)matches.push({j,reverse:true});}
        // Do not stitch the four branches meeting at a motor/body junction together.
        if(matches.length!==1)continue;const {j,reverse}=matches[0],b=chains[j];
        const left=side?a.points:[...a.points].reverse(),right=reverse?[...b.points].reverse():b.points;
        a.points=[...left,...right];a.sources.push(...b.sources);chains.splice(j,1);joined++;found=true;break;
      }
    }
    if(!found)break;
  }
  return {chains,joined};
}
function splitCrossings(p:Point[],depth=0):Point[][]{
  if(depth>12)return [p];
  for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
    if(i===0&&j===p.length-1)continue;const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
    const u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y},den=u.x*v.y-u.y*v.x;if(Math.abs(den)<1e-8)continue;
    const t=((c.x-a.x)*v.y-(c.y-a.y)*v.x)/den,s=((c.x-a.x)*u.y-(c.y-a.y)*u.x)/den;
    if(t>1e-5&&t<1-1e-5&&s>1e-5&&s<1-1e-5){const q={x:a.x+t*u.x,y:a.y+t*u.y};return [...splitCrossings([q,...p.slice(i+1,j+1)],depth+1),...splitCrossings([q,...p.slice(j+1),...p.slice(0,i+1)],depth+1)];}
  }
  return [p];
}
function loopInfo(chain:Chain):Loop{
  const p=chain.points,b=box(p),center={x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2},a=Math.abs(area(p));
  // Arc-length samples make the result independent of pen speed and pauses.
  const ring=[...p,p[0]],total=length(ring),samples:Point[]=[];let edge=1,walked=0;
  for(let i=0;i<48;i++){const target=i/48*total;while(edge<ring.length-1&&walked+dist(ring[edge-1],ring[edge])<target){walked+=dist(ring[edge-1],ring[edge]);edge++;}const lo=ring[edge-1],hi=ring[edge],t=(target-walked)/(dist(lo,hi)||1);samples.push({x:lo.x+(hi.x-lo.x)*t,y:lo.y+(hi.y-lo.y)*t});}
  const ds=samples.map(q=>dist(q,center)),radius=ds.reduce((n,r)=>n+r,0)/48,variation=Math.sqrt(ds.reduce((n,r)=>n+(r-radius)**2,0)/48)/(radius||1);
  const circularity=4*Math.PI*a/(total*total||1);
  return {...chain,area:a,center,radius,round:p.length>=8&&variation<.16&&circularity>.85&&radius>6};
}

export function recognizeSketch(strokes:Stroke[],color:string,reference?:SketchReference,mode:SketchMode='structure'):Drone{
  const total=strokes.reduce((n,s)=>n+s.length,0);
  if(total<4)throw Error('画一个轮廓或几条连接线，就可以生成。');
  if(strokes.length>MAX_SKETCH_STROKES||total>MAX_SKETCH_POINTS)throw Error(`画布支持 ${MAX_SKETCH_STROKES} 笔、${MAX_SKETCH_POINTS} 个采样点，请撤销部分重复描线。`);
  const all=strokes.flat();if(all.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('画稿坐标不正确。');
  const bounds=box(all),span=Math.max(bounds.x1-bounds.x0,bounds.y1-bounds.y0);if(span<30)throw Error('画得再大一点，才能看清你的设计。');
  const center=reference?{x:250,y:250}:{x:(bounds.x0+bounds.x1)/2,y:(bounds.y0+bounds.y1)/2},scale=reference?.scale??4.3/span;
  const convert=(p:Point):Point=>({x:(p.x-center.x)*scale,y:(p.y-center.y)*scale});
  const source=strokes.map((p,i)=>({points:simplify(p,span*.0012,Math.max(28,Math.min(128,Math.floor(5000/strokes.length)))) ,sources:[i]})).filter(c=>c.points.length>1);
  const {chains,joined}=joinStrokes(source,span),loops:Loop[]=[],open:Chain[]=[];
  for(const c of chains){if(closed(c.points,span)){
    let p=c.points;if(dist(p[0],p.at(-1)!)<span*.032)p=p.slice(0,-1);
    for(let q of splitCrossings(p)){if(Math.abs(area(q))<span*span*.00015)continue;if(area(q)<0)q=[...q].reverse();loops.push(loopInfo({...c,points:q}));}
  }else open.push(c);}
  const nonRound=loops.filter(l=>!l.round);
  const central=loops.filter(l=>dist(l.center,center)<span*.13);
  const roundCore=central.length?[...central].sort((a,b)=>a.area-b.area)[0]:undefined;
  const candidates=nonRound.length?nonRound:roundCore?[roundCore]:loops.length===1&&!open.length?loops:[];
  const core=[...candidates].sort((a,b)=>{
    const score=(l:Loop)=>l.area*(inside(l.points,center)?2:1)/(1+dist(l.center,center)/span*3);
    return score(b)-score(a);
  })[0];
  const isOriginal=(c:Chain)=>!!reference&&c.sources.every(i=>reference.originals.has(i));
  const circular=loops.filter(l=>mode==='structure'&&l.round&&l!==core&&(!core||!inside(core.points,l.center)||l.radius>Math.sqrt(core.area/Math.PI)*.9));
  // A large central rotor enclosing an independently drawn fuselage is intentional.
  const groups:{loop:Loop;duct:boolean}[]=[];
  for(const l of circular){const same=groups.find(g=>dist(g.loop.center,l.center)<Math.max(3,Math.min(g.loop.radius,l.radius)*.22));if(same){if(Math.max(same.loop.radius,l.radius)/Math.min(same.loop.radius,l.radius)>1.13)same.duct=true;if(l.radius<same.loop.radius)same.loop=l;}else groups.push({loop:l,duct:false});}
  const rotorLoops=new Set(circular);
  let motors:Motor[]=reference?reference.drone.motors.map(m=>({...m})):[];
  for(const g of groups){if(isOriginal(g.loop)){if(g.duct){const q=convert(g.loop.center);for(const m of motors)if(Math.hypot(m.x-q.x,m.z-q.y)<.06)m.duct=true;}continue;}const p=convert(g.loop.center);motors.push({x:p.x,z:p.y,r:Math.max(.075,g.loop.radius*scale),y:.52,duct:g.duct});}
  if(motors.length>MAX_SKETCH_ROTORS)throw Error(`目前支持最多 ${MAX_SKETCH_ROTORS} 个旋翼；其他封闭形状仍可作为机身和翼面。`);
  const fallback=[{x:-.24,y:-.42},{x:.24,y:-.42},{x:.29,y:.3},{x:0,y:.43},{x:-.29,y:.3}];
  const body=reference?.drone.body??(core&&!rotorLoops.has(core)?core.points.map(convert):fallback);
  const parts:SketchPart[]=[];
  for(const l of loops){if(rotorLoops.has(l)||isOriginal(l))continue;
    const outline=l.points.map(convert),b=box(outline),contained=l!==core&&!!core&&l.points.every(p=>inside(core.points,p));
    const role=l===core?'shell':contained?'panel':'wing';const panelBase=reference?(reference.drone.detail?.bodyHeight??.3)*.7+.012:.18;const high=role==='shell'?.18:role==='panel'?panelBase+.035:.04;
    parts.push({outline,role,low:role==='shell'?-.17:role==='panel'?panelBase:-.07,high});
  }
  if(!reference&&!parts.some(p=>p.role==='shell'))parts.unshift({outline:body,role:'shell',low:-.17,high:.18});
  const inferred=motors.length===0;
  if(inferred){
    // Missing propulsion is the only automatically added large structure.
    // Use drawn branch tips first, otherwise attach compact lift motors above the silhouette.
    const tips=open.flatMap(c=>[c.points[0],c.points.at(-1)!]).filter(p=>dist(p,center)>span*.25);
    const unique=tips.filter((p,i)=>tips.findIndex(q=>dist(p,q)<span*.1)===i).slice(0,8);
    const locations=unique.length>=2?unique.map(convert):[{x:-.88,y:-.8},{x:.88,y:-.8},{x:-.88,y:.8},{x:.88,y:.8}].map(p=>({x:p.x*(bounds.x1-bounds.x0)*scale*.4,y:p.y*(bounds.y1-bounds.y0)*scale*.4}));
    motors=locations.map(p=>({x:p.x,z:p.y,r:Math.min(.29,span*scale*.072),y:.54}));
  }
  // Keep the sketch's XY layout: overlapping rotors get separate vertical planes.
  // Bodies, wings and their panel lines stay below the complete propeller sweep.
  let stacked=false;
  motors.forEach((m,i)=>{if(reference&&i<reference.drone.motors.length)return;for(let pass=0;pass<motors.length;pass++){const conflict=motors.slice(0,i).some(n=>(!n.axis||n.axis==='y')&&Math.hypot(m.x-n.x,m.z-n.z)<m.r+n.r+.12&&Math.abs((m.y??.52)-(n.y??.31))<.29);if(!conflict)break;m.y=(m.y??.52)+.32;stacked=true;}});
  const paths:SketchPath[]=[];let details=0,curves=0;
  for(const c of open){if(isOriginal(c))continue;const p=c.points.map(convert);if(length(p)<.025)continue;
    let motor=-1,reverse=false,best=.22;
    motors.forEach((m,i)=>{for(const end of [0,1]){const q=end?p.at(-1)!:p[0],d=dist(q,{x:m.x,y:m.z});if(d<best){best=d;motor=i;reverse=!end;}}});
    if(motor>=0){if(reverse)p.reverse();p[p.length-1]={x:motors[motor].x,y:motors[motor].z};paths.push({points:p,height:-.045,motor});curves++;}
    else {const surface=parts.filter(part=>p.every(q=>inside(part.outline,q))).sort((a,b)=>b.high-a.high)[0];const contained=surface||p.every(q=>inside(body,q));paths.push({points:p,height:surface?surface.high+.013:contained?(reference?(reference.drone.detail?.bodyHeight??.3)*.7+.065:.23):-.055});if(contained)details++;else curves++;}
  }
  const kind:DroneKind=reference?.drone.kind??(motors.length===1?'helicopter':motors.length===2?'twin':motors.length===3?'tri':motors.length>6?'octo':motors.length>4?'hex':'quad');
  const surfaces=parts.filter(p=>p.role!=='panel').length;
  const sketch:SketchGeometry={parts,paths,overlay:!!reference,report:{strokes:strokes.length,joined,surfaces,curves,details:details+parts.filter(p=>p.role==='panel').length,addedRotors:inferred?motors.length:0,stacked}};
  const name=reference?`改装 · ${reference.drone.name}`:surfaces>1?'自由构型 · 多翼':`自由构型 · ${motors.length} 旋翼`;
  return {...reference?.drone,body,motors,color,kind,name,inferred,adjusted:stacked,sketch,speed:reference?.drone.speed??Math.max(63,86-motors.length),handling:reference?.drone.handling??Math.max(62,88-motors.length),energy:reference?.drone.energy??Math.min(96,73+motors.length)};
}
