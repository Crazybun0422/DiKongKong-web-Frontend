import treeTextureUrl from '../assets/textures/trees.webp';
import {paintObstacle,type ObstacleArt,type ObstacleFace} from './obstacle-art';
import type {V} from './mesh';
import {course,noise} from './courses';

const assets=new Map<string,HTMLImageElement>();
export function sceneryImage(name:'trees'){
 if(typeof Image==='undefined')return null;
 let img=assets.get(name);if(!img){img=new Image();img.src=treeTextureUrl;assets.set(name,img);}
 return img.complete&&img.naturalWidth?img:null;
}
export function preloadScenery(){sceneryImage('trees');}
const skies=new Map<string,HTMLCanvasElement>();
export function resetSceneryAssets(){ assets.clear(); skies.clear(); }
export function skyImage(w:number,h:number,id:string){
 const key=`${id}:${w}:${h}`;
 const cached=skies.get(key);if(cached)return cached;
 const c=course(id),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d')!,sky=ctx.createLinearGradient(0,0,0,h*.8);sky.addColorStop(0,c.sky[0]);sky.addColorStop(1,c.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 if(id==='alien'){
  const darkness=ctx.createLinearGradient(0,0,0,h*.49);darkness.addColorStop(0,'#040710');darkness.addColorStop(.58,'#101622');darkness.addColorStop(1,c.fog);ctx.fillStyle=darkness;ctx.fillRect(0,0,w,h);
  for(let layer=0;layer<3;layer++){ctx.fillStyle=['#272a38','#333340','#3d3b47'][layer];ctx.beginPath();ctx.moveTo(0,h*.5);for(let x=0;x<=w+12;x+=12){const ridge=Math.abs(Math.sin(x*.0031+layer*2))*h*.035+Math.sin(x*.012+layer)*h*.009+Math.sin(x*.030+layer)*h*.003;ctx.lineTo(x,h*.395+layer*8-ridge);}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();}
 }else{
  const sx=w*.76,sy=h*.18,r=Math.max(12,h*.022),night=id==='city';
  const corona=ctx.createRadialGradient(sx,sy,r*.4,sx,sy,r*10);corona.addColorStop(0,night?'#9eb8db55':'#fff3c4aa');corona.addColorStop(.16,night?'#8faddb18':'#ffdda04b');corona.addColorStop(.45,'#ffeedc12');corona.addColorStop(1,'#fff9e400');ctx.fillStyle=corona;ctx.fillRect(sx-r*10,sy-r*10,r*20,r*20);
  const disc=ctx.createRadialGradient(sx-r*.24,sy-r*.28,r*.12,sx,sy,r);disc.addColorStop(0,night?'#e1e7eb':'#fffef0');disc.addColorStop(.7,night?'#bdcbd8':'#fff3c8');disc.addColorStop(1,night?'#738aa5':'#efcc8b');ctx.fillStyle=disc;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(sx,sy,r*.97,0,Math.PI*2);ctx.clip();for(let i=0;i<(night?48:170);i++){const x=sx+(noise(i+19)-.5)*r*2,y=sy+(noise(i+93)-.5)*r*2;ctx.fillStyle=night?'#73859733':'#d9a35418';ctx.beginPath();ctx.arc(x,y,night?.8+noise(i+45)*2:.3+noise(i+45)*.6,0,Math.PI*2);ctx.fill();}ctx.restore();
  if(night){for(let i=0;i<80;i++){ctx.fillStyle=`rgba(208,226,255,${.2+noise(i)*.55})`;ctx.fillRect(noise(i+5)*w,noise(i+19)*h*.42,1,1);}}
  else for(let layer=0;layer<3;layer++){ctx.fillStyle=id==='snow'?['#90aac6','#a7becf','#bdced8'][layer]:id==='canyon'?['#b6a797','#c0a88d','#c8b294'][layer]:['#839eaa','#91adb1','#a3bdba'][layer];ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w+20;x+=20){const peak=Math.abs(Math.sin(x*.006+layer*2.3))*h*.10+Math.sin(x*.019+layer)*h*.018;ctx.lineTo(x,h*.43+layer*16-peak);}ctx.lineTo(w,h);ctx.fill();}
 }
 skies.set(key,canvas);if(skies.size>8)skies.delete(skies.keys().next().value!);return canvas;
}
export function drawTree(ctx:CanvasRenderingContext2D,x:number,y:number,height:number,tile:number,flip=false){const img=sceneryImage('trees');if(!img)return;const s=img.width/2;ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(img,(tile%2)*s,Math.floor(tile/2)*s,s,s,-height*.5,-height,height,height);ctx.restore();}

const rocks=new Map<number|string,ObstacleArt>();
export function rockArt(seed:number,r:number,h:number,compact=false):ObstacleArt{
 const key=compact?`compact:${seed}`:seed,known=rocks.get(key);if(known)return known;const faces:ObstacleFace[]=[],rings=compact?2:6,segs=compact?6:14;
 const at=(i:number,j:number):V=>{const lat=i/rings*Math.PI/2,a=j/segs*Math.PI*2,rr=r*Math.cos(lat)*(1+.12*Math.sin(a*3+seed)+.08*Math.cos(a*5+lat*4));return [rr*Math.cos(a)+Math.sin(lat)*r*.15,Math.sin(lat)*h*(.94+.06*Math.sin(a*2+seed)),rr*Math.sin(a)*.7];};
 for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){const points=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],u=points[1].map((n,k)=>n-points[0][k]),v=points[2].map((n,k)=>n-points[0][k]),n:V=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;faces.push({points,normal:n.map(v=>v/l) as V,color:'#3e3e48',material:3,detail:false,tint:'#686675',textureStrength:.86});}
 const art={faces,data:new Float32Array(0),fans:[],lights:[]};rocks.set(key,art);if(rocks.size>160)rocks.delete(rocks.keys().next().value!);return art;
}
export function paintGround(ctx:CanvasRenderingContext2D,points:V[],project:(p:V)=>{x:number;y:number;k:number;depth:number},eye:V,color:string){paintObstacle(ctx,{faces:[{points,normal:[0,1,0],color,material:3,detail:false,tint:color,textureStrength:.30}],fans:[],lights:[],data:new Float32Array(0)},project,eye,0);}
