import {referenceAircraftMesh} from './reference-aircraft-mesh';
import {Drone,Motor,Point,pointInside,polygonArea,rotorEnvelope} from './drone';
export type V=[number,number,number];
export type MeshData={vertices:Float32Array;extent:number};
const rgb=(s:string):V=>{const n=parseInt(s.slice(1),16);return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255];};
export function triangulate(p:Point[]):number[]{
 const ids=p.map((_,i)=>i);if(polygonArea(p)<0)ids.reverse();const out:number[]=[];let guard=0;
 const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 while(ids.length>3&&guard++<p.length*p.length){let found=false;for(let j=0;j<ids.length;j++){const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];if(cross(p[a],p[b],p[c])<=1e-8)continue;let contains=false;for(const q of ids){if(q===a||q===b||q===c)continue;if(cross(p[a],p[b],p[q])>=-1e-8&&cross(p[b],p[c],p[q])>=-1e-8&&cross(p[c],p[a],p[q])>=-1e-8){contains=true;break;}}if(contains)continue;out.push(a,b,c);ids.splice(j,1);found=true;break;}if(!found)break;}
 if(ids.length===3)out.push(...ids);return out;
}
const blend=(a:string,b:string,t:number)=>'#'+rgb(a).map((v,i)=>Math.round((v*(1-t)+rgb(b)[i]*t)*255).toString(16).padStart(2,'0')).join('');
export function buildMesh(d:Drone):MeshData{
 const data:number[]=[];let extent=1;const detail=d.detail,kind=d.kind??'quad',family=detail?.family??kind,profile=detail?.visualProfile??'',carbon=detail?.shell==='carbon'||(!detail&&kind==='racer'),industrial=detail?.shell==='industrial'||kind==='hex'||kind==='octo',airplane=kind==='vtol'||kind==='fixedwing',heli=kind==='helicopter'||kind==='tandem';
 const shell=blend(d.color,detail?.bodyColor??'#c5ced1',.24),panel=blend(shell,'#263943',.42),wingPaint=blend(shell,'#becbd1',.18),dark='#20282d',metal='#91a0a6',rubber='#121b20',accent=d.color,variant=detail?.variant??1;
 function tri(a:V,b:V,c:V,color:string,pivot:V=[0,0,0],normals?:V[]){const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);let norm:V=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...norm)||1;norm=norm.map(n=>n/len) as V;const col=rgb(color),material=color==='#0b283c'?[.13,.75]:color===metal?[.28,.8]:color===dark?[.91,.12]:color===shell||color===wingPaint?[.38,.32]:[.64,.08];for(const [i,p] of [a,b,c].entries()){data.push(...p,...(normals?.[i]??norm),...col,...pivot,...material);extent=Math.max(extent,Math.hypot(...p));}}
 function face(p:V[],color:string,pivot?:V,normals?:V[]){for(let i=1;i<p.length-1;i++)tri(p[0],p[i],p[i+1],color,pivot,normals?[normals[0],normals[i],normals[i+1]]:undefined);}
 const unit=(n:V):V=>{const len=Math.hypot(...n)||1;return n.map(v=>v/len) as V;};
 function roundedOutline(p:Point[]){let out=p;for(let pass=0;pass<2&&out.length<64;pass++)out=out.flatMap((a,i)=>{const b=out[(i+1)%out.length];return [{x:a.x*.82+b.x*.18,y:a.y*.82+b.y*.18},{x:a.x*.18+b.x*.82,y:a.y*.18+b.y*.82}];});return out;}
 // Rounded boxes stay inside the original part bounds and retain flat panel centers.
 function roundedBox(x:number,y:number,z:number,w:number,h:number,l:number,color:string,r=Math.min(w,h,l)*.18){
  const half=[w/2,h/2,l/2],inner=half.map(v=>v-r);
  const coords=(extent:number)=>[-extent,-extent+r*.35,-extent+r,extent-r,extent-r*.35,extent];
  for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){const u=(axis+1)%3,v=(axis+2)%3,us=coords(half[u]),vs=coords(half[v]);
   const at=(i:number,j:number)=>{const raw:V=[0,0,0];raw[axis]=sign*half[axis];raw[u]=us[i];raw[v]=vs[j];const core=raw.map((q,k)=>Math.max(-inner[k],Math.min(inner[k],q))) as V,n=unit(raw.map((q,k)=>q-core[k]) as V),p=core.map((q,k)=>q+n[k]*r+[x,y,z][k]) as V;return {p,n};};
   for(let i=0;i<us.length-1;i++)for(let j=0;j<vs.length-1;j++){let a=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];if(sign<0)a=a.reverse();face(a.map(q=>q.p),color,undefined,a.map(q=>q.n));}
  }
 }
 function solid(p:Point[],low:number,high:number,color:string){const ids=triangulate(p);for(let i=0;i<ids.length;i+=3){const [a,b,c]=ids.slice(i,i+3).map(i=>p[i]);tri([a.x,high,a.y],[c.x,high,c.y],[b.x,high,b.y],color);tri([a.x,low,a.y],[b.x,low,b.y],[c.x,low,c.y],color);}p.forEach((a,i)=>{const b=p[(i+1)%p.length];face([[a.x,low,a.y],[a.x,high,a.y],[b.x,high,b.y],[b.x,low,b.y]],color);});}
 function box(x:number,y:number,z:number,w:number,h:number,l:number,color:string){solid([{x:x-w/2,y:z-l/2},{x:x+w/2,y:z-l/2},{x:x+w/2,y:z+l/2},{x:x-w/2,y:z+l/2}],y-h/2,y+h/2,color);}
 function tube(a:V,b:V,r:number,color:string,n=16,r2=r,pivot?:V){
  if(n>4&&r>.055)n=Math.max(n,24);let axis=b.map((x,i)=>x-a[i]) as V,ln=Math.hypot(...axis)||1;axis=unit(axis);const q:V=Math.abs(axis[1])>.9?[1,0,0]:[0,1,0];const u=unit([axis[1]*q[2]-axis[2]*q[1],axis[2]*q[0]-axis[0]*q[2],axis[0]*q[1]-axis[1]*q[0]]),v:V=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
  const radial=(i:number):V=>u.map((x,j)=>x*Math.cos(i/n*Math.PI*2)+v[j]*Math.sin(i/n*Math.PI*2)) as V;
  const ring=(c:V,rr:number)=>Array.from({length:n},(_,i)=>c.map((x,j)=>x+rr*radial(i)[j]) as V),lo=ring(a,r),hi=ring(b,r2),norms=Array.from({length:n},(_,i)=>unit(radial(i).map((x,j)=>x-axis[j]*(r2-r)/ln) as V));
  face([...lo].reverse(),color,pivot,lo.map(()=>axis.map(x=>-x) as V));face(hi,color,pivot,hi.map(()=>axis));
  for(let i=0;i<n;i++){const next=(i+1)%n;face([lo[i],lo[next],hi[next],hi[i]],color,pivot,n>4?[norms[i],norms[next],norms[next],norms[i]]:undefined);}
 }
 function armFairing(a:V,b:V,r:number,color:string){
  const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,side:V=[dz/len,0,-dx/len],rings=8,segments=24;
  const point=(t:number,angle:number):V=>{const rr=r*(.98-.33*t),arch=.025*Math.sin(Math.PI*t);return [a[0]+dx*t+side[0]*rr*Math.cos(angle),a[1]+(b[1]-a[1])*t+arch+rr*.62*Math.sin(angle),a[2]+dz*t+side[2]*rr*Math.cos(angle)];};
  const at=(i:number,j:number)=>{const t=i/rings,angle=j/segments*Math.PI*2,p=point(t,angle),u=point(t,angle+.001).map((v,k)=>v-p[k]),v=point(t+.001,angle).map((v,k)=>v-p[k]);return {p,n:unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]])};};
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];face(q.map(v=>v.p),color,undefined,q.map(v=>v.n));}
  face(Array.from({length:segments},(_,i)=>at(0,i).p).reverse(),color);face(Array.from({length:segments},(_,i)=>at(rings,i).p),color);
 }
 // One continuous sweep, with shared rings and only two end caps, follows a drawn curve.
 function sweep(points:Point[],startY:number,endY:number,r:number,color:string){
  if(points.length<2)return;const walk=[0];for(let i=1;i<points.length;i++)walk.push(walk[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const total=walk.at(-1)!||1,n=12;
  const ring=(i:number,j:number)=>{const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz)||1,angle=j/n*Math.PI*2,normal:V=[dz/len*Math.cos(angle),Math.sin(angle),-dx/len*Math.cos(angle)];return {p:[p.x+normal[0]*r,startY+(endY-startY)*walk[i]/total+normal[1]*r*.7,p.y+normal[2]*r] as V,n:normal};};
  for(let i=0;i<points.length-1;i++)for(let j=0;j<n;j++){const q=[ring(i,j),ring(i+1,j),ring(i+1,j+1),ring(i,j+1)];face(q.map(v=>v.p),color,undefined,q.map(v=>v.n));}
  face(Array.from({length:n},(_,j)=>ring(0,j).p).reverse(),color);face(Array.from({length:n},(_,j)=>ring(points.length-1,j).p),color);
 }
 function drawnSurface(p:Point[],low:number,high:number,color:string){
  // A shallow bevel preserves deep concave notches. No convex hull or mirrored wing.
  const cx=p.reduce((n,q)=>n+q.x,0)/p.length,cz=p.reduce((n,q)=>n+q.y,0)/p.length;
  const bevel=Math.min(.025,(high-low)*.24),levels=[[low,.992],[low+bevel,1],[high-bevel,1],[high,.992]];
  const at=(i:number,j:number)=>{const q=p[j],a=p[(j+p.length-1)%p.length],b=p[(j+1)%p.length],s=levels[i][1],y=levels[i][0],nz=-(b.x-a.x),nx=b.y-a.y;return {p:[cx+(q.x-cx)*s,y,cz+(q.y-cz)*s] as V,n:unit([nx,i===0?-.45:i===3?.45:0,nz])};};
  for(let i=0;i<3;i++)for(let j=0;j<p.length;j++){const k=(j+1)%p.length,q=[at(i,j),at(i+1,j),at(i+1,k),at(i,k)];face(q.map(v=>v.p),color,undefined,q.map(v=>v.n));}
  const ids=triangulate(p);for(const [index,sign] of [[0,-1],[3,1]])for(let i=0;i<ids.length;i+=3){const q=ids.slice(i,i+3).map(j=>at(index,j).p);if(sign>0)q.reverse();tri(q[0],q[1],q[2],color,undefined,q.map(()=>[0,sign,0] as V));}
 }
 function bolt(x:number,y:number,z:number,r=.018){tube([x,y,z],[x,y+.014,z],r,metal,8);box(x,y+.014,z,r*1.25,.003,.007,dark);}
 function loft(source:Point[],levels:[number,number][],color:string){
  const subdivisions=levels.at(-1)![0]-levels[0][0]<.025?1:3;
  const outline=roundedOutline(source),rings:{y:number;s:number;ds:number}[]=[],slopes=levels.slice(1).map(([y,s],i)=>(s-levels[i][1])/(y-levels[i][0]));
  const tangent=(i:number)=>i===0?slopes[0]:i===levels.length-1?slopes.at(-1)!:slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]);
  for(let i=0;i<levels.length-1;i++){const [y0,s0]=levels[i],[y1,s1]=levels[i+1],dy=y1-y0,m0=tangent(i)*dy,m1=tangent(i+1)*dy;
   for(let j=0;j<subdivisions;j++){const t=j/subdivisions,t2=t*t,t3=t2*t,s=(2*t3-3*t2+1)*s0+(t3-2*t2+t)*m0+(-2*t3+3*t2)*s1+(t3-t2)*m1,ds=((6*t2-6*t)*s0+(3*t2-4*t+1)*m0+(-6*t2+6*t)*s1+(3*t2-2*t)*m1)/dy;rings.push({y:y0+dy*t,s,ds});}}
  const last=levels.at(-1)!;rings.push({y:last[0],s:last[1],ds:tangent(levels.length-1)});
  const at=(i:number,j:number)=>{const p=outline[j],a=outline[(j+outline.length-1)%outline.length],b=outline[(j+1)%outline.length],dx=b.x-a.x,dz=b.y-a.y,r=rings[i];return {p:[p.x*r.s,r.y,p.y*r.s] as V,n:unit([dz,r.ds*(p.y*dx-p.x*dz),-dx])};};
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<outline.length;j++){const k=(j+1)%outline.length,q=[at(i,j),at(i+1,j),at(i+1,k),at(i,k)];face(q.map(v=>v.p),color,undefined,q.map(v=>v.n));}
  for(const [index,sign] of [[0,-1],[rings.length-1,1]]){const r=rings[index],ids=triangulate(outline);for(let i=0;i<ids.length;i+=3){const q=ids.slice(i,i+3).map(j=>[outline[j].x*r.s,r.y,outline[j].y*r.s] as V);if(sign>0)q.reverse();tri(q[0],q[1],q[2],color,undefined,q.map(()=>[0,sign,0] as V));}}
 }
 function duct(m:Motor){
  const n=64,low=(m.y??.3)-(['neo','flip'].includes(profile)?.11:.24),high=(m.y??.3)+.075,inner=m.r+.045,outer=m.r+.115,lip=.017,section:{r:number;y:number;nr:number;ny:number}[]=[];
  for(const [cx,cy,start]of[[outer-lip,high-lip,0],[inner+lip,high-lip,Math.PI/2],[inner+lip,low+lip,Math.PI],[outer-lip,low+lip,Math.PI*1.5]])for(let j=0;j<=3;j++){const a=start+j/3*Math.PI/2;section.push({r:cx+Math.cos(a)*lip,y:cy+Math.sin(a)*lip,nr:Math.cos(a),ny:Math.sin(a)});}
  const at=(i:number,j:number)=>{const a=i/n*Math.PI*2,q=section[j%section.length];return {p:[m.x+Math.cos(a)*q.r,q.y,m.z+Math.sin(a)*q.r] as V,n:[Math.cos(a)*q.nr,q.ny,Math.sin(a)*q.nr] as V};};
  for(let i=0;i<n;i++)for(let j=0;j<section.length;j++){const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];face(q.map(v=>v.p),j<7?(variant%2?shell:accent):dark,undefined,q.map(v=>v.n));}
  for(let i=0;i<4;i++){const a=i*Math.PI/2;tube([m.x,low+.055,m.z],[m.x+Math.cos(a)*inner,low+.055,m.z+Math.sin(a)*inner],.021,metal,12);}
 }
 const bw=Math.max(...d.body.map(p=>Math.abs(p.x))),bl=Math.max(...d.body.map(p=>Math.abs(p.y))),height=detail?.bodyHeight??(carbon?.14:.3),top=height*.7,armY=carbon?-.025:-.075;
 const free=!!d.sketch&&!d.sketch.overlay;
 if(d.sketch){
  for(const part of d.sketch.parts)drawnSurface(part.outline,part.low,part.high,part.role==='panel'?panel:part.role==='wing'?wingPaint:shell);
  for(const path of d.sketch.paths){const m=path.motor===undefined?undefined:d.motors[path.motor],endY=m?(m.y??.52)-.15:path.height;sweep(path.points,path.height,endY,m?.072:path.height>.1?.011:.046,m?dark:path.height>.1?accent:metal);}
  if(free){
   // A compact avionics module is seated inside an actual triangle of the custom fuselage.
   const ids=triangulate(d.body);let best:Point[]=[];let size=0;
   for(let i=0;i<ids.length;i+=3){const q=ids.slice(i,i+3).map(j=>d.body[j]),s=Math.abs(polygonArea(q));if(s>size){best=q;size=s;}}
   if(best.length){const x=best.reduce((n,p)=>n+p.x,0)/3,z=best.reduce((n,p)=>n+p.y,0)/3,k=Math.min(1,Math.sqrt(size)*1.1);roundedBox(x,.22,z,.34*k,.08,.48*k,'#42545c',.025);roundedBox(x,.265,z,.29*k,.015,.4*k,shell,.006);for(let j=0;j<4;j++)roundedBox(x-.067*k+j*.045*k,.279,z+.09*k,.014*k,.008,.11*k,dark,.003);roundedBox(x,.280,z-.105*k,.09*k,.006,.025*k,metal,.002);for(const side of [-1,1]){bolt(x+side*.105*k,.278,z-.14*k,.012);tube([x+side*.14*k,-.13,z],[x+side*.25*k,-.42,z+.06],.025,metal);tube([x+side*.25*k,-.42,z-.2*k],[x+side*.25*k,-.42,z+.3*k],.026,dark);}tube([x,.215,z-.2*k],[x,.215,z-.3*k],.055,'#0b283c',20);}
  }
 }
 const referenced=!free&&referenceAircraftMesh(d,{face:(p,c,n)=>face(p,c,undefined,n),tube,box:roundedBox,arm:armFairing,loft},shell);
 if(!free&&!referenced){
 if(carbon){solid(d.body,-.1,-.065,dark);solid(d.body,.085,.12,panel);for(const x of [-bw*.65,bw*.65])for(const z of [-bl*.55,bl*.55]){tube([x,-.06,z],[x,.086,z],.028,metal,10);bolt(x,.12,z);}box(0,.018,0,bw, .085,bl*.8,'#354548');for(let i=0;i<7;i++)box(-bw*.5+i*bw/6,.066,0,.016,.008,bl*.5,metal);}
 else if(industrial){loft(d.body,[[-.22,.78],[-.16,1],[.05,1],[.09,.95],[top,.79]],shell);solid(d.body.map(p=>({x:p.x*1.005,y:p.y*1.005})),.037,.053,dark);}
 else{loft(d.body,[[-height*.75,.06],[-height*.67,.46],[-height*.42,.83],[-height*.12,.99],[.02,1],[top*.55,.90],[top*.88,.61],[top,.06]],shell);const seam=d.body.map(p=>({x:p.x*.975,y:p.y*.975}));loft(seam,[[-height*.185,.99],[-height*.17,1],[-height*.155,.99]],'#737e81');}
 // Battery pack with lid, straps/latches and contacts.
 if(!airplane&&!heli&&!['neo','flip','phantom','spark'].includes(profile)){const count=detail?.battery??1;for(let i=0;i<count;i++){const x=count===2?(i-.5)*bw*.82:0,w=bw*(count===2?.67:1.18),l=bl*(carbon?1.3:1.03),y=top+(carbon?.14:industrial?.015:-.025),bh=carbon?.23:industrial?.075:.06;roundedBox(x,y,bl*.12,w,bh,l,carbon?'#474b4d':'#707b7e');roundedBox(x,y+bh*.5+.006,bl*.12,w*.92,.018,l*.92,shell,.007);if(carbon||industrial)for(const z of [bl*.12-l*.27,bl*.12+l*.27]){box(x,y+bh*.5+.022,z,w*1.02,.022,.055,dark);box(x+w*.35,y+bh*.5+.04,z,.05,.025,.07,metal);}for(let j=0;j<4;j++)box(x-w*.22+j*w*.13,y+bh*.5+.015,bl*.12-l*.33,.025,.006,.013,j===0?accent:'#606d6e');}}
 // Housings: side vents, panel fasteners and navigation lights.
 for(const sign of [-1,1]){for(let j=0;j<5;j++)box(sign*bw*.86,top*.33,-bl*.22+j*.065,.008,.037,.028,dark);for(const z of [-bl*.48,bl*.48])bolt(sign*bw*.61,top*.76+.015,z,.012);tube([sign*bw*.84,-.015,-bl*.47],[sign*bw*.84,.005,-bl*.47],.025,sign<0?'#ff5c4d':'#56e7ab',12);}
 if(!carbon&&!airplane&&!heli&&(!detail?.branded||detail.frontSensors))for(const sign of [-1,1]){tube([sign*bw*.42,top*.43,-bl*.86],[sign*bw*.42,top*.43,-bl*.9],.065,dark,20);tube([sign*bw*.42,top*.43,-bl*.902],[sign*bw*.42,top*.43,-bl*.916],.037,'#0b283c',20);}
 // Gimbal/yoke and camera optics; lens points along the nose (-Z).
 if((detail?.camera??'gimbal')!=='none'){
  const fpv=detail?.camera==='fpv'||carbon,embedded=fpv||profile==='spark',cy=embedded?.045:profile==='inspire'?-.61:detail?.branded&&['folding','atom','evo','lito'].includes(profile)?-.22:-.35,cz=-bl*(embedded?.9:.85),cr=profile==='avata360'?.19:fpv?.11:industrial?.16:.125,n=Math.max(1,Math.min(4,detail?.cameraCount??(industrial||variant>=5?2:1)));
  if(!embedded){box(0,-.2,cz,.23,.075,.17,dark);tube([-.17,-.2,cz],[-.17,cy,cz],.025,metal);tube([.17,-.2,cz],[.17,cy,cz],.025,metal);tube([-.17,cy,cz],[.17,cy,cz],.032,metal);}
  const positions=n===1?[[0,0,1]]:n===2?[[0,-.055,.86],[.06,.11,.57]]:n===3?[[-.075,-.045,.83],[.095,-.045,.58],[.035,.115,.58]]:[[-.09,-.07,.65],[.09,-.07,.65],[-.09,.09,.55],[.09,.09,.55]];
  roundedBox(0,cy,cz,cr*(n>2?2.8:2.1),cr*(n>1?2.55:1.65),cr*1.6,'#343d43',cr*.32);
  for(const [x,dy,k] of positions){tube([x,cy+dy,cz-cr*.5],[x,cy+dy,cz-cr*1.35],cr*.75*k,dark,28);tube([x,cy+dy,cz-cr*1.36],[x,cy+dy,cz-cr*1.4],cr*.59*k,metal,28);tube([x,cy+dy,cz-cr*1.405],[x,cy+dy,cz-cr*1.42],cr*.49*k,'#0b283c',28);tube([x-.018,cy+dy+.02,cz-cr*1.425],[x-.018,cy+dy+.02,cz-cr*1.428],cr*.13*k,'#709da7',16);}
 }
 if(profile==='fpv'){loft(d.body.map(p=>({x:p.x*.87,y:p.y*.82-.11})),[[top*.42,.93],[top*.87,.53]],'#283a46');}
 if(profile==='lito'){roundedBox(0,top*.55,-bl*.84,.16,.08,.055,dark,.02);}
 if(profile==='avata360'){tube([0,.045,-bl-.04],[0,.045,-bl-.2],.15,'#0b283c',32);}
 if(profile==='enterprise'){roundedBox(0,top+.075,bl*.28,bw*.85,.13,.23,shell,.035);tube([0,top+.14,bl*.28],[0,top+.18,bl*.28],.065,'#263e45',24);}
 if(profile==='inspire'){tube([-bw,.03,-bl*.2],[bw,.03,-bl*.2],.11,dark,24);for(const sign of [-1,1])tube([sign*bw,-.04,-bl*.2],[sign*(bw+.26),.32,0],.07,metal);}
 if(carbon||industrial){const ay=industrial?top+.37:top+.31,az=bl*.53;tube([0,top,az],[.065,ay,az+.08],.014,dark,8);if(industrial)tube([.065,ay,az+.08],[.065,ay+.047,az+.08],.092,shell,24);else{tube([.065,ay,az+.08],[.065,ay+.055,az+.08],.061,dark,16);tube([-.12,top,az],[.12,top+.23,az+.1],.009,dark,8);}}
 }
 const horizontal=d.motors.filter(m=>!m.axis||m.axis==='y'),unique=horizontal.filter((m,i,all)=>all.findIndex(n=>n.x===m.x&&n.z===m.z)===i);
 if(!referenced&&kind==='hquad'){for(const sign of [-1,1]){const side=unique.filter(m=>Math.sign(m.x)===sign).sort((a,b)=>a.z-b.z);if(side.length>1)tube([side[0].x,profile==='inspire'?.37:armY,side[0].z],[side.at(-1)!.x,profile==='inspire'?.37:armY,side.at(-1)!.z],.065,dark);}}
 if(!referenced)unique.forEach((m,i)=>{
  if(d.sketch?.paths.some(p=>p.motor!==undefined&&d.motors[p.motor]===m))return;
  if(!free&&(kind==='helicopter'||kind==='tandem'))return;const len=Math.hypot(m.x,m.z)||1,near=free?[...d.body].sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.z)-Math.hypot(b.x-m.x,b.y-m.z))[0]:null,root:V=near?[near.x*.98,armY,near.y*.98]:[m.x/len*bw*.62,armY,m.z/len*bl*.35],end:V=[m.x,detail?.coaxial?armY:(m.y??.31)-.15,m.z],aw=detail?.armWidth??.075;
  if(carbon){tube(root,end,aw,dark,4);tube([root[0],armY+.04,root[2]],[end[0],end[1]+.04,end[2]],.008,'#576568',6);}else{if(!industrial&&!airplane)armFairing(root,end,aw,detail?.branded?shell:dark);else tube(root,end,aw,dark,24,aw*.65);tube(root,root.map((v,j)=>v+(end[j]-v)*.19) as V,aw*1.25,shell,16);tube(end.map((v,j)=>root[j]+(v-root[j])*.8) as V,end,aw*.93,shell,12);}
  tube([root[0],armY-.08,root[2]],[root[0],armY+.095,root[2]],aw*.94,metal,20);bolt(root[0],armY+.097,root[2],.028);
  tube([root[0],armY+.075,root[2]],[m.x,end[1]+.02,m.z],.013,'#514a43',6);tube([m.x-.07,armY-.04,m.z],[m.x+.07,armY-.04,m.z],.019,metal,8);
  if(detail?.gear==='feet'||(!detail&&i<2)){const footY=detail?.branded?armY-(m.z<0?.2:.11):armY-.34;tube([m.x,end[1]-.03,m.z],[m.x,footY+.02,m.z+.055],.035,shell);box(m.x,footY,m.z+.055,.09,.04,.15,rubber);}
 });
 d.motors.forEach((m,i)=>{
  const y=m.y??.31,axis=m.axis??'y',r=m.r,hub=Math.min(.13,r*.23),coax=detail?.coaxial;
  const center:V=[m.x,y,m.z],direction:V=axis==='y'?[0,m.inverted||coax&&i%2?-1:1,0]:axis==='z'?[0,0,1]:[1,0,0];
  const offset=(t:number):V=>center.map((x,j)=>x+direction[j]*t) as V;
  // Bell motor, stator slot band, mounting plate and shaft.
  tube(offset(-.15),offset(-.115),hub*1.2,metal,24);tube(offset(-.116),offset(-.035),hub,dark,28);tube(offset(-.047),offset(-.025),hub*1.06,metal,28);
  for(let k=0;k<12;k++){const angle=k*Math.PI/6,xx=Math.cos(angle)*hub,zz=Math.sin(angle)*hub;if(axis==='y')tube([m.x+xx,y-.104,m.z+zz],[m.x+xx,y-.052,m.z+zz],.009,k%2?'#654e36':'#53656c',5);}
  tube(offset(-.025),offset(.035),.026,metal,12);
  if(axis==='y'&&(m.duct??(!free&&(kind==='ducted'||kind==='twin'))))duct(m);
  if(coax)tube([m.x,-.36,m.z],[m.x,.34,m.z],hub*.55,dark,16);
  const rotorDir=coax?(i%2?1:-1):(i%2?-1:1),pivot:V=axis==='y'?[m.x,m.z,rotorDir]:axis==='z'?[m.x,y,rotorDir*2]:[y,m.z,rotorDir*3];
  const blades=axis!=='y'?2:detail?.blades??2;
  const transform=(rad:number,tan:number,a:number,yy:number):V=>{const u=rad*Math.cos(a)-tan*Math.sin(a),v=rad*Math.sin(a)+tan*Math.cos(a);return axis==='y'?[m.x+u,y+yy,m.z+v]:axis==='z'?[m.x+u,y+v,m.z+yy]:[m.x+yy,y+u,m.z+v];};
  for(let b=0;b<blades;b++){
   const a=b/blades*Math.PI*2+(i*.7),sections=[[.035,.023],[r*.2,r*.09],[r*.5,r*.105],[r*.82,r*.063],[r*.97,r*.018]];
   for(let j=0;j<sections.length-1;j++){const [r0,w0]=sections[j],[r1,w1]=sections[j+1],rise0=(1-r0/r)*.038,rise1=(1-r1/r)*.038;const p=[transform(r0,-w0,a,rise0),transform(r1,-w1,a,rise1),transform(r1,w1,a,-rise1),transform(r0,w0,a,-rise0)],lo=p.map(v=>axis==='y'?[v[0],v[1]-.009,v[2]]:axis==='z'?[v[0],v[1],v[2]-.009]:[v[0]-.009,v[1],v[2]]) as V[];face(p,j===3?(detail?.branded?(profile==='fpv'?'#e5452f':['phantom','dreamer'].includes(profile)?shell:'#f39837'):accent):detail?.branded&&['phantom','dreamer'].includes(profile)?shell:carbon?'#4d5d65':'#283238',pivot);face([...lo].reverse(),dark,pivot);for(let k=0;k<4;k++)face([p[k],lo[k],lo[(k+1)%4],p[(k+1)%4]],dark,pivot);}
  }
  tube(offset(.027),offset(.062),.038,metal,12);
 });
 if(heli&&!free){if(kind==='tandem')for(const m of horizontal){tube([0,-.05,Math.sign(m.z)*bl*.7],[0,.12,m.z],bw*.44,shell,20,bw*.24);tube([0,.12,m.z],[0,m.y!-.16,m.z],bw*.24,shell,20,.11);}if(kind==='helicopter'){const tail=d.motors.find(m=>m.axis==='x')?.z??2.12;tube([0,-.02,bl*.6],[0,.16,tail],.105,shell,20,.032);tube([0,.16,tail],[.12,.25,tail],.04,dark);const fin=[[-.035,.13,tail-.18],[-.035,.66,tail+.1],[-.035,.14,tail+.28]] as V[];face(fin,shell);face(fin.map(v=>[v[0]+.07,v[1],v[2]] as V).reverse(),shell);box(0,.15,tail-.25,.6,.03,.17,shell);}for(const m of horizontal){tube([m.x,-.04,m.z],[m.x,m.y!-.15,m.z],.075,metal,18);for(const sign of [-1,1])tube([sign*.09,.1,m.z],[sign*.045,m.y!-.08,m.z],.014,metal,8);}loft(d.body.map(p=>({x:p.x*.82,y:p.y*.85})),[[top*.25,.88],[top*.8,.7]],'#364853');}
 if(airplane&&d.wing&&!free){
  // Main wing has an airfoil section: rounded leading edge, raised camber, thin trailing edge.
  const half=Math.max(...d.wing.map(p=>Math.abs(p.x))),profile:Point[]=[];
  // Cosine-spaced airfoil samples concentrate detail around the rounded leading edge.
  const thickness=(x:number)=>(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x*x*x-.1036*x*x*x*x)/.10003;
  for(let i=0;i<=16;i++){const x=(1-Math.cos(i/16*Math.PI))/2;profile.push({x,y:.078*thickness(x)});}
  for(let i=15;i>0;i--){const x=(1-Math.cos(i/16*Math.PI))/2;profile.push({x,y:-.019*thickness(x)});}
  for(const sign of[-1,1]){const at=(q:number,k:number)=>{const c=profile[k],a=profile[(k+profile.length-1)%profile.length],b=profile[(k+1)%profile.length],chord=.72-q*.36,dy=b.y-a.y,dz=(b.x-a.x)*chord;return {p:[q*half*sign,q*q*.13+c.y,-.29+q*.45+c.x*chord] as V,n:unit([sign*(dy*(.45-c.x*.36)-dz*q*.26),dz*half,-dy*half])};};
   for(let j=0;j<8;j++)for(let k=0;k<profile.length;k++){const n=(k+1)%profile.length;let q=[at(j/8,k),at((j+1)/8,k),at((j+1)/8,n),at(j/8,n)];if(sign>0)q=q.reverse();face(q.map(v=>v.p),shell,undefined,q.map(v=>v.n));}
   const cap=profile.map((_,i)=>at(1,i).p);face(sign>0?cap.reverse():cap,shell);
   tube([sign*half*.55,.085,.34],[sign*half*.93,.16,.49],.012,dark,6);roundedBox(sign*half*.91,.15,.31,.15,.013,.23,accent,.005);
  }
  solid([{x:-.7,y:bl*.71},{x:.7,y:bl*.71},{x:.83,y:bl*.94},{x:-.83,y:bl*.94}],.08,.115,shell);const fin:V[]=[[0,.09,bl*.62],[0,.63,bl*.88],[0,.11,bl*.99]];for(const sign of [-1,1])face(fin.map(p=>[p[0]+sign*.025,p[1],p[2]] as V),shell);tube([0,.11,bl*.62],[0,.63,bl*.88],.022,shell,8);if(kind==='vtol')for(const sign of [-1,1])tube([sign*1.15,-.04,-bl*.8],[sign*1.15,-.04,bl*.8],.045,dark,12);
 }
 const gear=detail?.gear??'feet';
 if(!referenced&&profile==='inspire'){for(const m of unique){tube([m.x,.34,m.z],[m.x*.93,-.69,m.z+.12],.037,dark);roundedBox(m.x*.93,-.7,m.z+.12,.13,.05,.24,rubber,.02);}}
 if(!referenced&&profile!=='inspire'&&(gear==='tall'||gear==='skids')){const x=bw+.22,low=industrial?-.83:-.67;for(const sign of [-1,1]){for(const z of [-bl*.51,bl*.54])tube([sign*bw*.68,-.12,z],[sign*x,low,z+.06],.028,metal);tube([sign*x,low,-bl*.83],[sign*x,low,bl*.87],.038,dark);tube([sign*x,low,-bl*.83],[sign*x,low+.12,-bl*.99],.038,dark);}}
 if(gear==='wheels'){for(const [x,z] of [[-.42,.1],[.42,.1],[0,-bl*.7]]){tube([x*.5,-.08,z],[x,-.48,z],.023,metal);tube([x-.045,-.46,z],[x+.045,-.46,z],.11,rubber,24);tube([x-.047,-.46,z],[x+.047,-.46,z],.045,metal,16);}}
 if(['flip','neo'].includes(profile)){for(const m of horizontal){const n=profile==='neo'?6:12,yy=(m.y??.08)+.12;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;tube([m.x+Math.cos(a)*m.r*.4,yy+.06,m.z+Math.sin(a)*m.r*.4],[m.x+Math.cos(a)*(m.r+.055),yy-.06,m.z+Math.sin(a)*(m.r+.055)],profile==='neo'?.018:.012,shell,8);}for(let i=0;i<36;i++){const a=i/36*Math.PI*2,b=(i+1)/36*Math.PI*2;tube([m.x+Math.cos(a)*m.r*.4,yy+.06,m.z+Math.sin(a)*m.r*.4],[m.x+Math.cos(b)*m.r*.4,yy+.06,m.z+Math.sin(b)*m.r*.4],.016,shell,8);}}}
 if(detail?.payload==='tank'){loft(d.body.map(p=>({x:p.x*1.05,y:p.y*.9})),[[-.67,.67],[-.56,1],[-.23,.9]],'#e4e7da');tube([0,-.2,.2],[0,-.16,.2],.11,dark,20);tube([-1.5,-.58,0],[1.5,-.58,0],.025,metal);for(let i=-3;i<=3;i++){tube([i*.43,-.58,0],[i*.43,-.65,0],.025,'#519aae',8);}}
 if(detail?.payload==='box'){box(0,profile==='flycart'?-.67:-.49,0,bw*1.8,profile==='flycart'?.75:.47,bl*1.6,profile==='flycart'?'#62676b':'#ad9c78');for(const x of [-bw*.5,bw*.5])box(x,-.73,0,.055,.012,bl*1.63,dark);for(const z of [-bl*.55,bl*.55])tube([-bw,-.26,z],[bw,-.26,z],.025,metal);}
 for(const m of d.motors)extent=Math.max(extent,Math.hypot(m.x,m.y??.3,m.z)+m.r+.15);
 return {vertices:new Float32Array(data),extent:extent+.1};
}
