import {AIRCRAFT_RADIUS,GATE_TUBE,WORLD_DEPTH_SCALE,courseX,courseHeight,gateSpec,gateSupports,obstacleSpec} from './courses';
type Position={distance:number;x:number;altitude:number};
export type Impact={fraction:number;reason:'gate'|'obstacle'|'ground'};
// Find first contact on each short physics segment, including its interior.
// Local mesh depth stays physical even though course travel is displayed at 2.6x.
function contact(distanceSquared:(t:number)=>number,radius:number):number|null{
 const limit=radius*radius;if(distanceSquared(0)<=limit)return 0;
 let a=0,b=1;for(let i=0;i<24;i++){const p=a+(b-a)/3,q=b-(b-a)/3;if(distanceSquared(p)<distanceSquared(q))b=q;else a=p;}
 let hi=(a+b)/2;if(distanceSquared(1)<distanceSquared(hi))hi=1;
 if(distanceSquared(hi)>limit)return null;let lo=0;
 for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(distanceSquared(mid)<=limit)hi=mid;else lo=mid;}return hi;
}
export function flightImpact(a:Position,b:Position,nextGate:number,nextObstacle:number,id?:string):Impact|null{
 let hit:Impact|null=null;const record=(fraction:number|null,reason:Impact['reason'])=>{if(fraction!==null&&(!hit||fraction<hit.fraction))hit={fraction,reason};};
 const point=(t:number,z:number,cx:number,cy:number)=>{const d=a.distance+(b.distance-a.distance)*t;return [courseX(d,id)+(a.x+(b.x-a.x)*t)*20-cx,a.altitude+(b.altitude-a.altitude)*t-cy,(d-z)*WORLD_DEPTH_SCALE];};
 const boxHit=(z:number,cx:number,cy:number,box:{x:number;y:number;hx:number;hy:number;hz:number})=>contact(t=>{const p=point(t,z,cx+box.x,cy+box.y);return Math.max(0,Math.abs(p[0])-box.hx)**2+Math.max(0,Math.abs(p[1])-box.hy)**2+Math.max(0,Math.abs(p[2])-box.hz)**2;},AIRCRAFT_RADIUS);
 for(const z of [nextGate,nextGate-180])if(z>=160&&z<2400&&b.distance>=z-1.4&&a.distance<=z+1.4){const g=gateSpec(z,id),cx=courseX(z,id)+g.x;record(contact(t=>{const [x,y,dz]=point(t,z,cx,g.altitude);return (Math.hypot(x,y)-(g.radius+GATE_TUBE))**2+dz*dz;},GATE_TUBE+AIRCRAFT_RADIUS),'gate');for(const box of gateSupports(z,id))record(boxHit(z,cx,g.altitude,box),'gate');}
 if(nextObstacle<2400&&b.distance>=nextObstacle-1.4&&a.distance<=nextObstacle+1.4)for(const box of obstacleSpec(nextObstacle,id).boxes)record(boxHit(nextObstacle,courseX(nextObstacle,id),courseHeight(nextObstacle,id),box),'obstacle');
 const clearance=(p:Position)=>p.altitude-(courseHeight(p.distance,id)-9)-AIRCRAFT_RADIUS;
 if(clearance(b)<=0)record(Math.max(0,Math.min(1,clearance(a)/(clearance(a)-clearance(b)||1))),'ground');
 return hit;
}
