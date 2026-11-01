import type {Drone} from './drone';
import {buildMesh,type MeshData} from './mesh';
type Entry={mesh:MeshData;buffer?:WebGLBuffer|null};
const meshes=new Map<string,Entry>();let objectMeshes=new WeakMap<Drone,Entry>();
const locations=new Map<string,WebGLUniformLocation|null>();let attributes:number[]=[];
let surface:HTMLCanvasElement|null=null,gl:WebGLRenderingContext|null=null,program:WebGLProgram|null=null;
let fallback:HTMLCanvasElement|null=null;let initialized=false;
export type Pose={roll?:number;pitch?:number};
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute vec3 aRotor;attribute vec2 aMaterial;
uniform vec2 uYaw;uniform vec2 uTilt;uniform vec2 uRoll;uniform vec2 uPitch;uniform float uScale;uniform float uDepth;uniform float uTime;
varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying vec2 vMaterial;
vec2 rot(vec2 q,float a){return vec2(q.x*cos(a)-q.y*sin(a),q.x*sin(a)+q.y*cos(a));}
vec3 pose(vec3 p){p.yz=vec2(p.y*uPitch.x-p.z*uPitch.y,p.y*uPitch.y+p.z*uPitch.x);p.xy=vec2(p.x*uRoll.x-p.y*uRoll.y,p.x*uRoll.y+p.y*uRoll.x);return vec3(p.x*uYaw.x-p.z*uYaw.y,p.y,p.x*uYaw.y+p.z*uYaw.x);}
void main(){vec3 p=aPosition;vec3 n=aNormal;float axis=abs(aRotor.z);float a=uTime*19.0*sign(aRotor.z);
 if(axis>.5&&axis<1.5){p.xz=aRotor.xy+rot(p.xz-aRotor.xy,a);n.xz=rot(n.xz,a);}else if(axis<2.5&&axis>1.5){p.xy=aRotor.xy+rot(p.xy-aRotor.xy,a);n.xy=rot(n.xy,a);}else if(axis>2.5){p.yz=aRotor.xy+rot(p.yz-aRotor.xy,a);n.yz=rot(n.yz,a);}
 vec3 r=pose(p);vNormal=pose(n);vPosition=r;vColor=aColor;vMaterial=aMaterial;
 float y=r.y*uTilt.x-r.z*uTilt.y;float depth=r.z*uTilt.x+r.y*uTilt.y;
 gl_Position=vec4(r.x*uScale,y*uScale,-depth/uDepth,1.0);}`;
const fragment=`precision mediump float;varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying vec2 vMaterial;uniform vec2 uTilt;
void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-.5,1.0,.6));vec3 view=vec3(0.,uTilt.y,uTilt.x);float diffuse=max(dot(n,light),0.);float fill=max(dot(n,normalize(vec3(.7,.1,-.8))),0.)*.16;float hemi=.24+.17*(n.y*.5+.5);vec3 halfDir=normalize(light+view);float spec=pow(max(dot(n,halfDir),0.),mix(110.,16.,vMaterial.x))*(.18+vMaterial.y*.6);float rim=pow(1.-max(dot(n,view),0.),3.)*.07;
 float weave=1.;if(vMaterial.x>.86){vec2 cell=floor(vPosition.xz*40.);weave=.96+.04*mod(cell.x+cell.y,2.);}float brush=1.;vec3 color=vColor*weave*brush*(hemi+diffuse*.66+fill)+vec3(spec*.8)+vec3(.5,.68,.8)*rim;

 gl_FragColor=vec4(pow(clamp(color,0.,1.),vec3(.9)),1.);}`;
function initialize(){
 if(initialized||typeof document==='undefined')return;initialized=true;surface=document.createElement('canvas');
 gl=surface.getContext('webgl',{alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)return;
 const shader=(type:number,source:string)=>{const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s);if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS))throw Error(gl!.getShaderInfoLog(s)??'shader compile');return s;};
 try{program=gl.createProgram()!;const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader link');gl.deleteShader(vs);gl.deleteShader(fs);attributes=['aPosition','aNormal','aColor','aRotor','aMaterial'].map(n=>gl!.getAttribLocation(program!,n));for(const n of ['uYaw','uTilt','uRoll','uPitch','uScale','uDepth','uTime'])locations.set(n,gl.getUniformLocation(program,n));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);surface.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;program=null;});}catch(error){console.warn('Drone renderer fallback',error);gl=null;program=null;}
}
function entry(d:Drone){const known=objectMeshes.get(d);if(known)return known;const key=JSON.stringify([d.kind,d.body,d.motors,d.wing,d.color,d.detail,d.sketch]);let e=meshes.get(key);if(e){objectMeshes.set(d,e);return e;}e={mesh:buildMesh(d)};meshes.set(key,e);objectMeshes.set(d,e);if(meshes.size>40){const key=meshes.keys().next().value!;const old=meshes.get(key);if(old?.buffer&&gl){gl.deleteBuffer(old.buffer);old.buffer=null;}meshes.delete(key);}return e;}
export function modelExtent(d:Drone){return entry(d).mesh.extent;}
// Reused buffers and interpolated vertex lighting keep the software path smooth too.
let rasterDepth=new Float32Array(0),rasterVertices=new Float32Array(0),rasterImage:ImageData|null=null;
type RasterBase={color:Uint8ClampedArray;depth:Float32Array};
function rasterize(mesh:MeshData,size:number,yaw:number,tilt:number,phase:number,side:number,pose:Pose,base?:RasterBase){
 fallback??=document.createElement('canvas');if(fallback.width!==side||fallback.height!==side){fallback.width=side;fallback.height=side;rasterImage=null;}
 const ctx=fallback.getContext('2d')!,pixels=side*side,v=mesh.vertices;
 if(!rasterImage)rasterImage=ctx.createImageData(side,side);if(rasterDepth.length!==pixels)rasterDepth=new Float32Array(pixels);
 const depth=rasterDepth,img=rasterImage.data;if(base){depth.set(base.depth);img.set(base.color);}else{depth.fill(-Infinity);img.fill(0);}
 const count=v.length/14;if(rasterVertices.length<count*6)rasterVertices=new Float32Array(count*6);const out=rasterVertices;
 const co=Math.cos(yaw),si=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt),cp=Math.cos(pose.pitch??0),sp=Math.sin(pose.pitch??0),cr=Math.cos(pose.roll??0),sr=Math.sin(pose.roll??0);
 let hx=-.394,hy=.789+st,hz=.473+ct,hl=Math.hypot(hx,hy,hz);hx/=hl;hy/=hl;hz/=hl;
 for(let i=0,j=0;i<v.length;i+=14,j+=6){
  let x=v[i],y=v[i+1],z=v[i+2],nx=v[i+3],ny=v[i+4],nz=v[i+5];
  if(v[i+11]){const a=phase*Math.sign(v[i+11]),c=Math.cos(a),ss=Math.sin(a),axis=Math.abs(v[i+11]);
   if(axis===1){const px=x-v[i+9],pz=z-v[i+10],n=nx;x=v[i+9]+px*c-pz*ss;z=v[i+10]+px*ss+pz*c;nx=n*c-nz*ss;nz=n*ss+nz*c;}
   else if(axis===2){const px=x-v[i+9],py=y-v[i+10],n=nx;x=v[i+9]+px*c-py*ss;y=v[i+10]+px*ss+py*c;nx=n*c-ny*ss;ny=n*ss+ny*c;}
   else {const py=y-v[i+9],pz=z-v[i+10],n=ny;y=v[i+9]+py*c-pz*ss;z=v[i+10]+py*ss+pz*c;ny=n*c-nz*ss;nz=n*ss+nz*c;}}
  const py=y*cp-z*sp,pz=y*sp+z*cp,px=x*cr-py*sr;y=x*sr+py*cr;x=px;z=pz;
  const xx=x*co-z*si,zz=x*si+z*co,nny=ny*cp-nz*sp,nnz=ny*sp+nz*cp,nnx=nx*cr-nny*sr;ny=nx*sr+nny*cr;nx=nnx*co-nnz*si;nz=nnx*si+nnz*co;
  const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
  const diffuse=Math.max(0,-.394*nx+.789*ny+.473*nz),fill=Math.max(0,.655*nx+.094*ny-.749*nz)*.16,hemi=.24+.17*(ny*.5+.5),spec=Math.pow(Math.max(0,nx*hx+ny*hy+nz*hz),110-94*v[i+12])*(.18+v[i+13]*.6),light=hemi+diffuse*.66+fill;
  out[j]=side/2+xx*size;out[j+1]=side/2+(zz*st-y*ct)*size;out[j+2]=zz*ct+y*st;
  for(let k=0;k<3;k++)out[j+3+k]=Math.pow(Math.min(1,v[i+6+k]*light+spec),.9)*255;
 }
 for(let i=0;i<count*6;i+=18){
  const ax=out[i],ay=out[i+1],bx=out[i+6],by=out[i+7],cx=out[i+12],cy=out[i+13],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<.00001)continue;
  const minx=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxx=Math.min(side-1,Math.ceil(Math.max(ax,bx,cx))),miny=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxy=Math.min(side-1,Math.ceil(Math.max(ay,by,cy)));
  const dux=(by-cy)/den,dwx=(cy-ay)/den;
  for(let y=miny;y<=maxy;y++){let u=((by-cy)*(minx+.5-cx)+(cx-bx)*(y+.5-cy))/den,w=((cy-ay)*(minx+.5-cx)+(ax-cx)*(y+.5-cy))/den;
   for(let x=minx;x<=maxx;x++,u+=dux,w+=dwx){const k=1-u-w;if(u<0||w<0||k<0)continue;const z=out[i+2]*u+out[i+8]*w+out[i+14]*k,index=y*side+x;if(z<depth[index])continue;depth[index]=z;const px=index*4;
    img[px]=out[i+3]*u+out[i+9]*w+out[i+15]*k;img[px+1]=out[i+4]*u+out[i+10]*w+out[i+16]*k;img[px+2]=out[i+5]*u+out[i+11]*w+out[i+17]*k;img[px+3]=255;
   }
  }
 }
 ctx.putImageData(rasterImage,0,0);return fallback;
}
export function drawDrone(ctx:CanvasRenderingContext2D,d:Drone,cx:number,cy:number,size:number,yaw:number,time:number,tilt=.62,pose:Pose={}){
 initialize();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";const e=entry(d),logicalSide=e.mesh.extent*size*2+6;
 if(!gl||!surface||!program){const quality=Math.min(3,Math.max(1.5,ctx.getTransform().a)),side=Math.max(64,Math.min(1800,Math.ceil(logicalSide*quality))),scale=side/logicalSide;const img=rasterize(e.mesh,size*scale,yaw,tilt,time*19,side,pose);ctx.drawImage(img,cx-logicalSide/2,cy-logicalSide/2,logicalSide,logicalSide);return;}
 const quality=Math.min(2.5,Math.max(1.5,typeof devicePixelRatio==='number'?devicePixelRatio:1)),side=Math.max(40,Math.min(1400,Math.ceil(logicalSide*quality)));
 if(surface.width<side||surface.height<side){const capacity=Math.ceil(side/128)*128;surface.width=capacity;surface.height=capacity;}
 gl.viewport(0,0,side,side);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
 if(!e.buffer){e.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,e.buffer);gl.bufferData(gl.ARRAY_BUFFER,e.mesh.vertices,gl.STATIC_DRAW);}else gl.bindBuffer(gl.ARRAY_BUFFER,e.buffer);
 for(const [name,offset] of [['aPosition',0],['aNormal',12],['aColor',24],['aRotor',36],['aMaterial',48]] as const){const location=attributes[['aPosition','aNormal','aColor','aRotor','aMaterial'].indexOf(name)];gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,name==='aMaterial'?2:3,gl.FLOAT,false,56,offset);}
 gl.uniform2f(locations.get('uRoll')!,Math.cos(pose.roll??0),Math.sin(pose.roll??0));gl.uniform2f(locations.get('uPitch')!,Math.cos(pose.pitch??0),Math.sin(pose.pitch??0));gl.uniform2f(locations.get('uYaw')!,Math.cos(yaw),Math.sin(yaw));gl.uniform2f(locations.get('uTilt')!,Math.cos(tilt),Math.sin(tilt));gl.uniform1f(locations.get('uScale')!,size*2/logicalSide);gl.uniform1f(locations.get('uDepth')!,e.mesh.extent*2);gl.uniform1f(locations.get('uTime')!,time%1000);
 gl.drawArrays(gl.TRIANGLES,0,e.mesh.vertices.length/14);ctx.drawImage(surface,0,surface.height-side,side,side,cx-logicalSide/2,cy-logicalSide/2,logicalSide,logicalSide);
}

// Cache the stationary mesh and its depth buffer; only blades are rasterized per frame.
// This preserves occlusion without redrawing the full detailed airframe on CPU devices.
type RaceSprite=RasterBase&{rotors:MeshData;size:number};
let raceSprites=new WeakMap<Drone,RaceSprite>();
export function drawCachedDrone(ctx:CanvasRenderingContext2D,d:Drone,x:number,y:number,radius:number,pose:Pose={},phase=0){
 let sprite=raceSprites.get(d);const side=512;
 if(!sprite){const mesh=entry(d).mesh,body:number[]=[],rotors:number[]=[];for(let i=0;i<mesh.vertices.length;i+=42){const target=Math.abs(mesh.vertices[i+11])>.5?rotors:body;for(let j=0;j<42;j++)target.push(mesh.vertices[i+j]);}
  const size=240/mesh.extent;rasterize({vertices:new Float32Array(body),extent:mesh.extent},size,0,.4,0,side,{});
  sprite={color:rasterImage!.data.slice(),depth:rasterDepth.slice(),rotors:{vertices:new Float32Array(rotors),extent:mesh.extent},size};raceSprites.set(d,sprite);
 }
 const frame=rasterize(sprite.rotors,sprite.size,0,.4,phase,side,{},sprite);
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.translate(x,y);ctx.rotate(-(pose.roll??0)*.6);ctx.drawImage(frame,-radius,-radius,radius*2,radius*2);ctx.restore();
}

export function drawMeshFragment(ctx:CanvasRenderingContext2D,mesh:MeshData,x:number,y:number,scale:number,yaw:number,tilt:number,pose:Pose,phase=0){const logical=mesh.extent*scale*2+4,side=Math.max(40,Math.min(250,Math.ceil(logical*1.25))),quality=side/logical;const img=rasterize(mesh,scale*quality,yaw,tilt,phase,side,pose);ctx.drawImage(img,x-logical/2,y-logical/2,logical,logical);}

export function disposeDroneRenderer(){
 if(gl){for(const entry of meshes.values())if(entry.buffer)gl.deleteBuffer(entry.buffer);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
 meshes.clear();objectMeshes=new WeakMap();raceSprites=new WeakMap();locations.clear();attributes=[];
 surface=null;gl=null;program=null;fallback=null;initialized=false;rasterImage=null;rasterDepth=new Float32Array(0);rasterVertices=new Float32Array(0);
}
