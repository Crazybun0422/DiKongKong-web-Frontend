import {noise} from './courses';
import {BLACK_HOLE_FRAGMENT} from './black-hole-fragment';

type GPU={canvas:HTMLCanvasElement;gl:WebGLRenderingContext;program:WebGLProgram;time:WebGLUniformLocation|null;size:WebGLUniformLocation|null};
let gpu:GPU|null=null,tried=false;
function graphics(){
 if(tried)return gpu;tried=true;const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)return null;
 try{const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'black hole shader');return s;},vs=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}'),fs=compile(gl.FRAGMENT_SHADER,BLACK_HOLE_FRAGMENT),program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('black hole link');gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);gpu={canvas,gl,program,time:gl.getUniformLocation(program,'uTime'),size:gl.getUniformLocation(program,'uResolution')};canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gpu=null;});return gpu;}catch{return null;}
}
// The compatibility renderer computes curved ray paths once in a worker.
// Only gas shading changes, keeping the main flight loop free of ray marching.
let software:HTMLCanvasElement|null=null,composited:HTMLCanvasElement|null=null,worker:Worker|null=null,workerTried=false,busy=false,last=-100;
function composite(frame:HTMLCanvasElement){composited??=document.createElement('canvas');if(composited.width!==frame.width||composited.height!==frame.height){composited.width=frame.width;composited.height=frame.height;}const c=composited.getContext('2d')!;c.clearRect(0,0,frame.width,frame.height);c.save();c.filter='blur(6px)';c.globalAlpha=.48;c.globalCompositeOperation='screen';c.drawImage(frame,0,0);c.restore();c.drawImage(frame,0,0);}
function softwareFrame(time:number){
 if(!workerTried){workerTried=true;try{worker=new Worker(new URL('../assets/black-hole-worker.js',import.meta.url),{type:'module'});worker.onmessage=e=>{const {width,height,pixels}=e.data;software??=document.createElement('canvas');if(software.width!==width||software.height!==height){software.width=width;software.height=height;}software.getContext('2d')!.putImageData(new ImageData(pixels,width,height),0,0);composite(software);busy=false;};worker.onerror=()=>{busy=false;worker?.terminate();worker=null;};}catch{worker=null;}}
 if(worker&&!busy){busy=true;worker.postMessage({width:512,height:328,time});}
}
export function preloadBlackHole(){if(!graphics()&&!software&&!busy)softwareFrame(0);}
export function drawAlienSky(ctx:CanvasRenderingContext2D,w:number,h:number,time:number){
 // Distant stars vary softly rather than streaking with the aircraft.
 ctx.save();for(let i=0;i<110;i++){const x=noise(i+132)*w,y=noise(i+227)*h*.35,alpha=(.22+noise(i+516)*.5)*(.82+.18*Math.sin(time*(.22+noise(i)*.21)+i)),r=.35+noise(i+822)*.8;ctx.fillStyle=`rgba(198,218,239,${alpha})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();if(i%29===0){ctx.strokeStyle=`rgba(198,218,239,${alpha*.35})`;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x-r*2.2,y);ctx.lineTo(x+r*2.2,y);ctx.moveTo(x,y-r*2.2);ctx.lineTo(x,y+r*2.2);ctx.stroke();}}ctx.restore();
 const width=Math.min(560,w*(w<700?.72:.40)),height=width*.64,x=w*.75-width*.5,y=h*.18-height*.5,pw=720,ph=460;
 const g=graphics();if(time-last>1/(g?24:8)||time<last){last=time;if(g){const {gl,canvas}=g;if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}gl.viewport(0,0,pw,ph);gl.useProgram(g.program);gl.uniform1f(g.time,time);gl.uniform2f(g.size,pw,ph);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);composite(canvas);}else softwareFrame(time);}
 if(composited)ctx.drawImage(composited,x,y,width,height);
}
