import {BOOST_MULTIPLIER,cruiseKph,type Drone,type Flight,clamp} from './drone';

// Longitudinal display spacing is independent of race physics and the speedometer.
// Both renderer paths map every gate and obstacle through the same player-relative plane.
export {WORLD_DEPTH_SCALE as VISUAL_TRAVEL_SCALE} from './courses';
import {WORLD_DEPTH_SCALE as VISUAL_TRAVEL_SCALE,courseHeight,courseX,courseHeading} from './courses';
export const visualTravel=(distance:number)=>distance*VISUAL_TRAVEL_SCALE;
export const visualHeading=(heading:number)=>Math.atan(Math.tan(heading)/VISUAL_TRAVEL_SCALE);
export type CameraMode='chase'|'fpv';
export function raceCamera(drone:Drone,state:Flight,viewMode:CameraMode='chase'){
 const surge=clamp((state.speed*3.6/cruiseKph(drone)-1)/(BOOST_MULTIPLIER-1),0,1);
 const aftermath=state.crashed?Math.min(1,(state.crashAge??0)*.9):0,back=12.5+aftermath*1.6,lift=1.7+aftermath*.5,heading=visualHeading(courseHeading(state.distance,state.courseId))+(state.yaw??0),sin=Math.sin(heading),cos=Math.cos(heading),length=Math.hypot(back,lift);
 const target:CameraVector=[courseX(state.distance,state.courseId)+state.x*20,flightPose(state).altitude,state.distance];
 const mode:CameraMode=viewMode==='fpv'&&!state.crashed?'fpv':'chase';
 if(mode==='fpv'){
  // Same pitch -> roll -> yaw transform as the actual aircraft mesh.
  const pitch=state.pitch??0,roll=-(state.roll??0),yaw=Math.PI-heading;
  const rotate=(v:CameraVector):CameraVector=>{const py=v[1]*Math.cos(pitch)-v[2]*Math.sin(pitch),pz=v[1]*Math.sin(pitch)+v[2]*Math.cos(pitch),rx=v[0]*Math.cos(roll)-py*Math.sin(roll),ry=v[0]*Math.sin(roll)+py*Math.cos(roll);return [rx*Math.cos(yaw)-pz*Math.sin(yaw),ry,rx*Math.sin(yaw)+pz*Math.cos(yaw)];};
  const right=rotate([-1,0,0]),bodyUp=rotate([0,1,0]),bodyForward=rotate([0,0,-1]),tilt=.10;
  const forward=bodyForward.map((n,i)=>n*Math.cos(tilt)+bodyUp[i]*Math.sin(tilt)) as CameraVector,up=bodyUp.map((n,i)=>n*Math.cos(tilt)-bodyForward[i]*Math.sin(tilt)) as CameraVector;
  const eye=target.map((n,i)=>n+bodyForward[i]*.85+bodyUp[i]*.25) as CameraVector;
  return {mode,surge,back:.85,lift:.25,fov:82*Math.PI/180,eye,target:eye.map((n,i)=>n+forward[i]*40) as CameraVector,right,up,forward,travelOrigin:state.distance};
 }
 const eye:CameraVector=[target[0]-sin*back,target[1]+lift,target[2]-cos*back];
 return {mode,travelOrigin:state.distance,surge,back,lift,fov:62*Math.PI/180,eye,target,right:[cos,0,-sin] as CameraVector,up:[sin*lift/length,back/length,cos*lift/length] as CameraVector,forward:[sin*back/length,-lift/length,cos*back/length] as CameraVector};
}

export function flightPose(s:Flight){const age=s.crashed?Math.min(2.6,s.crashAge??0):0;return {altitude:Math.max(courseHeight(s.distance,s.courseId)-7,(s.altitude??14)-3.2*age*age),roll:s.roll??0,pitch:s.pitch??0};}

export type CameraVector=[number,number,number];
export type RaceCamera=ReturnType<typeof raceCamera>;
export function projectRacePoint(camera:RaceCamera,x:number,y:number,z:number,width:number,height:number){
 const dx=x-camera.eye[0],dy=y-camera.eye[1],dz=z-camera.eye[2],depth=dx*camera.forward[0]+dy*camera.forward[1]+dz*camera.forward[2],k=height/(2*Math.tan(camera.fov/2))/Math.max(.5,depth);
 return {x:width*.5+(dx*camera.right[0]+dy*camera.right[1]+dz*camera.right[2])*k,y:height*.5-(dx*camera.up[0]+dy*camera.up[1]+dz*camera.up[2])*k,k,depth};
}
function multiply(a:number[],b:number[]){const c=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
export function raceViewProjection(camera:RaceCamera,aspect:number){
 const {eye,right:r,up:u,forward:f}=camera,dot=(a:CameraVector,b:CameraVector)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const view=[r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,eye),-dot(u,eye),dot(f,eye),1],scale=1/Math.tan(camera.fov/2),near=.25,far=1100;
 return multiply([scale/aspect,0,0,0,0,scale,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],view);
}
