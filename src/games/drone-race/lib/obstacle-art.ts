import obstacleTextureUrl from '../assets/textures/obstacle-materials.webp';
import {course,obstacleSpec,FIRST_OBSTACLE,OBSTACLE_SPACING,type CourseId,type SolidBox} from './courses';
import type {V} from './mesh';

export type ObstacleFace={points:V[];normal:V;color:string;material:number;detail:boolean;tint?:string;textureStrength?:number};
export type ObstacleFan={x:number;y:number;z:number;r:number};
export type ObstacleArt={faces:ObstacleFace[];data:Float32Array;fans:ObstacleFan[];lights:V[]};
const cache=new Map<string,ObstacleArt>();
const unit=(a:V):V=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l) as V;};
const rgb=(s:string):V=>{const n=parseInt(s.slice(1),16);return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255];};
export const obstacleKind=(distance:number)=>Math.max(0,Math.round((distance-FIRST_OBSTACLE)/OBSTACLE_SPACING))%6;
export const materialUV=(p:V,n:V):[number,number]=>Math.abs(n[2])>.5?[p[0]/8,-p[1]/8]:Math.abs(n[1])>.5?[p[0]/8,p[2]/8]:[p[2]/8,-p[1]/8];

export function obstacleArt(distance:number,id:CourseId,compact=false):ObstacleArt{
 const kind=obstacleKind(distance),key=id+':'+kind+(compact?':compact':''),old=cache.get(key);if(old)return old;
 const spec=obstacleSpec(distance,id),faces:ObstacleFace[]=[],fans:ObstacleFan[]=[],lights:V[]=[],values:number[]=[];
 const metal=id==='coast'?'#798e91':id==='city'?'#697e91':'#797d73',frame='#34454c',edge=id==='city'?'#78ccda':'#d7b86c';
 function face(points:V[],color:string,material=0,detail=true){const a=points[0],b=points[1],c=points[2],u=b.map((p,i)=>p-a[i]),v=c.map((p,i)=>p-a[i]),normal=unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);faces.push({points,normal,color,material,detail});const col=rgb(color);for(let i=1;i<points.length-1;i++)for(const p of[a,points[i],points[i+1]])values.push(...p,...normal,...col,0,0,0,material||.7,material===2?.4:.05);}
 function box(x:number,y:number,z:number,w:number,h:number,l:number,color:string,material=0,detail=true){const a=x-w/2,b=x+w/2,c=y,d=y+h,e=z-l/2,f=z+l/2;
  // Subdivide large textured faces for perspective-correct Canvas fallback sampling.
  const nx=material&&!compact?Math.max(1,Math.ceil(w/8)):1,ny=material&&!compact?Math.max(1,Math.ceil(h/8)):1;
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const x0=a+w*i/nx,x1=a+w*(i+1)/nx,y0=c+h*j/ny,y1=c+h*(j+1)/ny;face([[x0,y0,e],[x0,y1,e],[x1,y1,e],[x1,y0,e]],color,material,detail);face([[x1,y0,f],[x1,y1,f],[x0,y1,f],[x0,y0,f]],color,material,detail);}
  face([[a,c,f],[a,d,f],[a,d,e],[a,c,e]],color,material,detail);face([[b,c,e],[b,d,e],[b,d,f],[b,c,f]],color,material,detail);face([[a,d,e],[a,d,f],[b,d,f],[b,d,e]],color,material,detail);face([[a,c,f],[a,c,e],[b,c,e],[b,c,f]],color,material,detail);
 }
 function tube(a:V,b:V,r:number,color:string,n=12){const axis=unit(b.map((q,i)=>q-a[i]) as V),q:V=Math.abs(axis[1])>.9?[1,0,0]:[0,1,0],u=unit([axis[1]*q[2]-axis[2]*q[1],axis[2]*q[0]-axis[0]*q[2],axis[0]*q[1]-axis[1]*q[0]]),v:V=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
  const at=(p:V,i:number):V=>p.map((x,j)=>x+r*(u[j]*Math.cos(i/n*Math.PI*2)+v[j]*Math.sin(i/n*Math.PI*2))) as V;
  for(let i=0;i<n;i++)face([at(a,i),at(a,i+1),at(b,i+1),at(b,i)],color);face(Array.from({length:n},(_,i)=>at(b,i)),color);
 }
 const plate=(x:number,y:number,w:number,h:number,color:string,z=-.831)=>face([[x-w/2,y-h/2,z],[x-w/2,y+h/2,z],[x+w/2,y+h/2,z],[x+w/2,y-h/2,z]],color);
 function stripe(x:number,y:number,w:number){plate(x,y,w,.65,'#d6b85b');for(let xx=x-w/2+.16;xx<x+w/2-.45;xx+=1.15)face([[xx,y-.31,-.839],[xx+.44,y+.31,-.839],[xx+.86,y+.31,-.839],[xx+.42,y-.31,-.839]],'#27383d');}
 function vent(x:number,y:number,w:number,h:number){plate(x,y,w,h,'#172a32',-.79);for(let yy=y-h/2+.3;yy<y+h/2;yy+=.42)box(x,yy,-.808,w-.12,.10,.055,metal);}
 function rim(b:SolidBox){const lo=b.y-b.hy,hi=b.y+b.hy;for(const side of[-1,1]){box(b.x+side*(b.hx-.22),lo,-.69,.42,b.hy*2,.3,frame);box(b.x,side<0?lo:hi-.35,-.69,b.hx*2,.35,.3,metal);}for(const x of[b.x-b.hx+.22,b.x+b.hx-.22])for(const y of[lo+.35,hi-.35])tube([x,y,-.82],[x,y,-.848],.09,'#cad0ca',8);}
 for(const [index,b]of spec.boxes.entries()){
  const left=b.x-b.hx,right=b.x+b.hx,lo=b.y-b.hy,hi=b.y+b.hy,w=b.hx*2,h=b.hy*2;
  const stone=kind===0||kind===3,material=stone?3:kind===4||kind===5?4:2;
  const tint=stone?(id==='canyon'?'#d7aa79':id==='snow'?'#eef6fb':'#ced5c8'):'#e0e2d6';
  box(b.x,lo,0,w,h,1.55,tint,material,false);
  // The distant native 2D version uses the same collision boxes and openings.
  // Restore full fittings/texture subdivisions as the obstacle approaches.
  if(compact)continue;
  if(stone){
   // Retaining masonry has mortar courses, coping, drainage, and weathered metal fixtures.
   for(let y=lo+3;y<hi-.4;y+=3){plate(b.x,y,w,.055,'#707974',-.80);for(let x=left+((Math.round(y/3)%2)?3:0);x<right-.4;x+=6)box(x,y-2.96,-.80,.055,2.9,.025,'#879188');}
   box(b.x,hi-.32,0,w,.32,1.7,id==='snow'?'#eef5ef':'#a7b2a8');
   if(kind===0){for(let x=left+3;x<right-2;x+=6){tube([x,lo+1.5,-.78],[x,lo+1.5,-.845],.30,'#263936',16);tube([x,lo+1.5,-.846],[x,lo+1.5,-.85],.22,'#14282b',16);}for(let x=left+2;x<right-2;x+=8){plate(x,hi-1.4,.7,.3,'#e2bb67');}}
   else if(w>5&&h>9){vent(b.x,hi-4,Math.min(5,w-1.5),2.5);for(const sign of[-1,1]){tube([b.x+sign*(w*.28),lo+.4,-.79],[b.x+sign*(w*.28),hi-7,-.79],.065,metal);}}
  }else{
   rim(b);
   // Cargo doors and shutter panels: seams, corrugation, handles, locking rods, hinges.
   const spacing=kind===4?5:7;
   for(let x=left+spacing;x<right-.3;x+=spacing)box(x,lo+.4,-.79,.10,h-.8,.1,frame);
   if(kind===4||kind===5){for(let y=lo+.9;y<hi-.4;y+=.85)plate(b.x,y,w-.8,.07,'#73634d',-.81);}
   if(w>6&&h>7){const sections=Math.max(1,Math.floor(w/8));for(let i=0;i<sections;i++){const x=left+(i+.5)*w/sections;for(const side of[-1,1]){tube([x+side*1.2,lo+1,-.79],[x+side*1.2,Math.min(hi-1,lo+12),-.79],.09,'#b6bdb2',12);for(const y of[lo+1.5,Math.min(hi-1.5,lo+10)])box(x+side*1.2,y,-.80,.52,.25,.095,metal);}tube([x-.5,lo+3,-.8],[x+.5,lo+3,-.8],.10,edge);}}
  }
  // Recessed ventilation housings have moving blades behind a protective grille.
  if((kind===1||kind===2||kind===3)&&w>9&&h>10){const x=b.x,y=hi-6,r=Math.min(2.3,w*.16);tube([x,y,-.77],[x,y,-.79],r+ .24,metal,28);tube([x,y,-.793],[x,y,-.803],r,'#14272e',28);fans.push({x,y,z:-.813,r:r*.91});for(const d of[-.6,0,.6]){const width=Math.sqrt(Math.max(0,r*r-(d*r)**2));tube([x-width,y+d*r,-.847],[x+width,y+d*r,-.847],.055,'#84979a',8);}}
  // Small fittings stay within the existing solid envelope; the opening stays completely clear.
  if(w>3&&h>3){const x=index%2?right-1.3:left+1.3,y=hi-1.5;box(x,y-.38,-.73,.78,.76,.20,frame);plate(x,y,.38,.28,'#dfa85b',-.846);lights.push([x,y,-.849]);}
  if((kind===4||kind===5)&&w>4)stripe(b.x,lo+.68,w-.8);
 }
 const art={faces,data:new Float32Array(values),fans,lights};cache.set(key,art);return art;
}

let atlas:HTMLImageElement|null=null,tiles:HTMLCanvasElement[]=[];
export function resetObstacleAssets(){ atlas=null; tiles=[]; tintedTiles.clear(); }
export function obstacleAtlas(){if(typeof Image==='undefined')return null;if(!atlas){atlas=new Image();atlas.src=obstacleTextureUrl;}return atlas.complete&&atlas.naturalWidth?atlas:null;}
const tintedTiles=new Map<string,HTMLCanvasElement>();
function materialTile(material:number,tint?:string){const img=obstacleAtlas();if(!img)return null;const index=material-2;if(!tiles[index]){const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d')!.drawImage(img,(index%2)*img.width/2,Math.floor(index/2)*img.height/2,img.width/2,img.height/2,0,0,256,256);tiles[index]=c;}if(!tint)return tiles[index];const key=material+':'+tint;let result=tintedTiles.get(key);if(!result){result=document.createElement('canvas');result.width=result.height=256;const ctx=result.getContext('2d')!;ctx.drawImage(tiles[index],0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=tint;ctx.fillRect(0,0,256,256);tintedTiles.set(key,result);}return result;}
const patternCache=new WeakMap<CanvasRenderingContext2D,Map<string,CanvasPattern>>();
type Projected={x:number;y:number;depth:number;k:number};
export type SoftwareDetail={viewport:{width:number;height:number};textures?:boolean;details?:boolean};
export function paintObstacle(ctx:CanvasRenderingContext2D,art:ObstacleArt,project:(p:V)=>Projected,eye:V,time:number,quality?:SoftwareDetail){
 const detailed=project([0,10,0]).k>1.4;
 const drawn=art.faces.filter(f=>{if(f.detail&&(!detailed||quality?.details===false))return false;const p=f.points[0];return f.normal[0]*(eye[0]-p[0])+f.normal[1]*(eye[1]-p[1])+f.normal[2]*(eye[2]-p[2])>0;}).map(f=>({f,points:f.points.map(project)})).filter(q=>q.points.every(p=>p.depth>.45)&&(!quality||(!q.points.every(p=>p.x<0)&&!q.points.every(p=>p.x>quality.viewport.width)&&!q.points.every(p=>p.y<0)&&!q.points.every(p=>p.y>quality.viewport.height))));
 drawn.sort((a,b)=>b.points.reduce((n,p)=>n+p.depth,0)/b.points.length-a.points.reduce((n,p)=>n+p.depth,0)/a.points.length);
 let patterns=patternCache.get(ctx);if(!patterns){patterns=new Map<string,CanvasPattern>();patternCache.set(ctx,patterns);}
 for(const {f,points}of drawn){const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));if(maxX<0||minX>(quality?.viewport.width??ctx.canvas.width)||maxY<0||minY>(quality?.viewport.height??ctx.canvas.height))continue;if(f.detail&&Math.max(maxX-minX,maxY-minY)<2)continue;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
  if(f.material&&quality?.textures!==false&&Math.max(maxX-minX,maxY-minY)>12){const tile=materialTile(f.material,f.tint);const patternKey=f.material+':'+(f.tint??'');if(tile){let pattern=patterns.get(patternKey);if(!pattern){pattern=ctx.createPattern(tile,'repeat')!;patterns.set(patternKey,pattern);}for(let i=1;i<points.length-1;i++){const ids=[0,i,i+1],p=ids.map(j=>points[j]),uv=ids.map(j=>materialUV(f.points[j],f.normal).map(v=>v*256)),u1=uv[1][0]-uv[0][0],v1=uv[1][1]-uv[0][1],u2=uv[2][0]-uv[0][0],v2=uv[2][1]-uv[0][1],den=u1*v2-u2*v1;if(Math.abs(den)<1e-6)continue;const a=((p[1].x-p[0].x)*v2-(p[2].x-p[0].x)*v1)/den,b=((p[1].y-p[0].y)*v2-(p[2].y-p[0].y)*v1)/den,c=((p[2].x-p[0].x)*u1-(p[1].x-p[0].x)*u2)/den,d=((p[2].y-p[0].y)*u1-(p[1].y-p[0].y)*u2)/den;ctx.save();ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.closePath();ctx.clip();ctx.globalAlpha*=f.textureStrength??1;ctx.transform(a,b,c,d,p[0].x-a*uv[0][0]-c*uv[0][1],p[0].y-b*uv[0][0]-d*uv[0][1]);ctx.fillStyle=pattern;ctx.fillRect(Math.min(...uv.map(v=>v[0]))-1,Math.min(...uv.map(v=>v[1]))-1,Math.max(...uv.map(v=>v[0]))-Math.min(...uv.map(v=>v[0]))+2,Math.max(...uv.map(v=>v[1]))-Math.min(...uv.map(v=>v[1]))+2);ctx.restore();}}
  }

  const shade=.13+Math.max(0,-f.normal[1])*.30+Math.abs(f.normal[0])*.16;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=`rgba(7,20,27,${shade})`;ctx.fill();
 }
 for(const fan of art.fans){const p=project([fan.x,fan.y,fan.z]);if(p.depth<.5||p.k*fan.r<2)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*2.6);ctx.fillStyle='#7d9195';for(let j=0;j<5;j++){ctx.rotate(Math.PI*.4);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(fan.r*p.k*.9,-fan.r*p.k*.55,fan.r*p.k,0);ctx.quadraticCurveTo(fan.r*p.k*.65,fan.r*p.k*.35,0,0);ctx.fill();}ctx.restore();ctx.strokeStyle='#a3b2b1';ctx.lineWidth=Math.max(.5,.05*p.k);for(const dy of[-.6,0,.6]){const ww=Math.sqrt(1-dy*dy)*fan.r*p.k;ctx.beginPath();ctx.moveTo(p.x-ww,p.y+dy*fan.r*p.k);ctx.lineTo(p.x+ww,p.y+dy*fan.r*p.k);ctx.stroke();}}
 for(const [i,l]of art.lights.entries()){const p=project(l);if(p.depth<.5)continue;const pulse=.5+.5*Math.sin(time*4+i);ctx.save();ctx.fillStyle=`rgba(255,185,72,${.45+pulse*.55})`;ctx.shadowColor='#ffb94f';ctx.shadowBlur=4+pulse*7;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.8,p.k*.16),0,Math.PI*2);ctx.fill();ctx.restore();}
}
