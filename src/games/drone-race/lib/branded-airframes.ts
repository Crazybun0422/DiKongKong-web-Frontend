import type {AirframeDetail,Drone,DroneKind,Motor,Point} from './drone';
import type {RealAircraft} from './real-aircraft';

// Game-scale geometry. These dimensions are modeling controls, never manufacturer specs.
type Shape={kind:DroneKind;w:number;l:number;h:number;x:number;front:number;rear:number;r:number;profile:string;shell:AirframeDetail['shell'];gear:AirframeDetail['gear'];camera:AirframeDetail['camera'];blades:number;speed:number;response:number;mass:number;span:number};
const base:Shape={kind:'quad',w:.37,l:.67,h:.28,x:1.15,front:1.0,rear:1.02,r:.49,profile:'mini',shell:'camera',gear:'feet',camera:'gimbal',blades:2,speed:64,response:1.02,mass:.7,span:.4};
const shapes:Record<string,Partial<Shape>>={
 mini:{w:.31,l:.57,h:.23,x:1.06,front:.87,rear:.98,r:.47,mass:.249,span:.3,speed:57,profile:'mini'},
 mavic:{w:.41,l:.82,h:.31,x:1.22,front:1.04,rear:1.19,r:.59,mass:.9,span:.45,speed:72,profile:'mavic'},
 air:{w:.4,l:.68,h:.3,x:1.19,front:.99,rear:1.08,r:.53,mass:.6,span:.37,speed:68,profile:'air'},
 lito:{w:.34,l:.6,h:.26,x:1.07,front:.9,rear:1.0,r:.48,mass:.249,span:.3,speed:57,profile:'lito'},
 spark:{w:.42,l:.54,h:.24,x:.99,front:.84,rear:.84,r:.4,mass:.3,span:.24,speed:45,profile:'spark'},
 phantom:{w:.49,l:.62,h:.29,x:1.16,front:1.08,rear:1.08,r:.57,mass:1.3,span:.59,speed:66,gear:'skids',profile:'phantom'},
 inspire:{kind:'hquad',w:.34,l:1.0,h:.43,x:1.39,front:1.05,rear:1.05,r:.71,mass:3.5,span:.75,speed:83,gear:'tall',profile:'inspire'},
 fpv:{kind:'racer',w:.48,l:.74,h:.62,x:1.13,front:.9,rear:.92,r:.48,mass:.8,span:.31,speed:100,response:1.3,camera:'fpv',blades:3,profile:'fpv'},
 avata:{kind:'ducted',w:.38,l:.53,h:.58,x:.84,front:.78,rear:.78,r:.6,mass:.4,span:.24,speed:76,response:1.22,camera:'fpv',blades:3,profile:'avata'},
 neo:{kind:'ducted',w:.36,l:.52,h:.2,x:.79,front:.72,rear:.72,r:.56,mass:.14,span:.17,speed:42,camera:'fpv',profile:'neo'},
 flip:{kind:'ducted',w:.4,l:.7,h:.29,x:1.09,front:.91,rear:.95,r:.68,mass:.249,span:.28,speed:54,profile:'flip'},
 atom:{w:.32,l:.58,h:.23,x:1.09,front:.89,rear:1.0,r:.47,mass:.249,span:.3,speed:57,profile:'atom'},
 dreamer:{w:.5,l:.64,h:.34,x:1.18,front:1.08,rear:1.08,r:.54,mass:.8,span:.35,speed:48,gear:'skids',profile:'dreamer'},
 evo:{w:.46,l:.78,h:.37,x:1.26,front:1.04,rear:1.13,r:.57,mass:1.1,span:.4,speed:65,profile:'evo'},
 nano:{w:.34,l:.59,h:.23,x:1.1,front:.92,rear:1.0,r:.48,mass:.249,span:.29,speed:54,profile:'nano'},
 lite:{w:.47,l:.76,h:.35,x:1.3,front:1.08,rear:1.14,r:.59,mass:.84,span:.43,speed:65,profile:'lite'},
 'mavic-enterprise':{w:.42,l:.82,h:.34,x:1.23,front:1.06,rear:1.13,r:.57,mass:1,span:.4,speed:70,profile:'enterprise'},
 'evo-max':{w:.58,l:.79,h:.45,x:1.26,front:1.1,rear:1.17,r:.63,mass:1.7,span:.5,speed:72,shell:'industrial',profile:'evo-max'},
 matrice:{kind:'hquad',w:.55,l:.75,h:.46,x:1.42,front:1.2,rear:1.21,r:.7,mass:5.5,span:1,speed:76,shell:'industrial',gear:'tall',camera:'survey',response:.83,profile:'matrice'},
 inspector:{w:.54,l:.82,h:.4,x:1.28,front:1.1,rear:1.16,r:.65,mass:3.5,span:.68,speed:75,shell:'industrial',gear:'tall',camera:'survey',response:.85,profile:'matrice'},
 alpha:{w:.58,l:.77,h:.46,x:1.45,front:1.23,rear:1.23,r:.72,mass:6.5,span:1.15,speed:76,shell:'industrial',gear:'tall',camera:'survey',response:.8,profile:'matrice'},
 agras:{kind:'quad',w:.54,l:.72,h:.38,x:1.58,front:1.32,rear:1.32,r:.83,mass:25,span:2.3,speed:48,shell:'industrial',gear:'tall',camera:'fpv',response:.65,profile:'agras'},
 flycart:{kind:'quad',w:.62,l:.94,h:.45,x:1.69,front:1.51,rear:1.51,r:.91,mass:65,span:3,speed:64,shell:'industrial',gear:'tall',camera:'fpv',response:.62,profile:'flycart'},
 'spreading-wings':{kind:'hex',w:.51,l:.6,h:.25,x:1.5,front:1.5,rear:1.5,r:.67,mass:4,span:1,speed:65,shell:'carbon',gear:'tall',camera:'survey',response:.8,profile:'spreading-wings'},
 dragonfish:{kind:'vtol',w:.29,l:1.83,h:.39,x:2.65,front:1.1,rear:1.2,r:.68,mass:10,span:2.49,speed:94,shell:'airplane',gear:'skids',camera:'survey',response:.8,profile:'dragonfish'},
 'dragonfish-25':{kind:'vtol',w:.39,l:2.08,h:.47,x:2.85,front:1.3,rear:1.3,r:.63,mass:29,span:4.566,speed:108,shell:'airplane',gear:'skids',camera:'survey',response:.76,profile:'dragonfish-25'},
 tello:{w:.4,l:.48,h:.17,x:.85,front:.76,rear:.76,r:.34,mass:.08,span:.17,speed:28,camera:'fpv',profile:'spark'},
};
function outline(w:number,l:number,profile:string):Point[]{
 return Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2,s=Math.sin(a),c=Math.cos(a),power=['enterprise','matrice','evo','agras','flycart','avata'].includes(profile)?.72:1;
  const rearTaper=s>0?1-s*.13:1+s*.09;
  return {x:Math.sign(c)*Math.abs(c)**power*w*rearTaper,y:Math.sign(s)*Math.abs(s)**power*l};
 });
}
export function createBrandedAirframe(spec:RealAircraft,color=spec.bodyColor):Drone{
 const s={...base,...shapes[spec.visualProfile]},name=spec.name.toLowerCase();
 // Generation differences change the relevant shell or camera, not arbitrary random geometry.
 if(/mini 3|mini 4|mini 5/.test(name)){s.w*=1.09;s.h*=1.12;s.front*=1.08;}
 if(/avata 2/.test(name)){s.h=.43;s.l=.66;s.x=.89;s.front=.81;s.rear=.82;}
 if(/avata 360/.test(name)){s.h=.41;s.l=.7;s.w=.45;s.profile='avata360';}
 if(/neo 2/.test(name)){s.w=.39;s.l=.57;s.h=.27;}
 if(/mavic 3/.test(name)){s.w=.45;s.l=.87;}
 if(/mavic 4/.test(name)){s.w=.49;s.l=.94;s.h=.4;}
 if(/air 3/.test(name)){s.w=.43;s.l=.8;s.x=1.25;}
 if(/inspire 3/.test(name)){s.w=.4;s.l=.69;s.h=.45;}
 if(/atom 2|atom 3/.test(name)){s.l=.64;s.w=.35;s.h=.27;}
 if(/evo ii/.test(name)){s.w=.5;s.h=.41;s.l=.85;}
 if(/matrice 4/.test(name)&&!/400/.test(name)){Object.assign(s,{kind:'quad',w:.47,l:.87,h:.4,x:1.25,front:1.09,rear:1.16,r:.6,gear:'feet',profile:'enterprise'});}
 if(/matrice 30/.test(name))Object.assign(s,{kind:'quad',x:1.3,w:.45,l:.85,h:.34,gear:'feet'});
 const coaxial=spec.coaxial===true,count=spec.rotorCount??(s.kind==='hex'?6:s.kind==='octo'?8:4),arms=coaxial?count/2:count;
 let kind=s.kind,motors:Motor[]=[],wing:Point[]|undefined;
 const y=s.profile==='inspire'?.52:s.profile.startsWith('avata')?.04:s.profile==='neo'?.08:s.profile==='flip'?.08:.24;
 if(s.profile.startsWith('dragonfish')){
  // Two wingtip tilt rotors and two fuselage lift rotors in hover configuration.
  motors=[{x:-s.x,z:0,r:s.r,y:.2},{x:s.x,z:0,r:s.r,y:.2},{x:0,z:-1.23,r:.59,y:.49},{x:0,z:1.26,r:.59,y:.49}];
  if(s.profile==='dragonfish-25')motors=[{x:-s.x,z:-.42,r:s.r,y:.25},{x:s.x,z:-.42,r:s.r,y:.25},{x:-s.x,z:.69,r:.52,y:.25,axis:'z'},{x:s.x,z:.69,r:.52,y:.25,axis:'z'},{x:0,z:-1.4,r:.67,y:.59},{x:0,z:1.4,r:.67,y:.59}];
  wing=[{x:-2.7,y:-.26},{x:-2.67,y:.38},{x:-.25,y:.34},{x:.25,y:.34},{x:2.67,y:.38},{x:2.7,y:-.26},{x:.2,y:-.43},{x:-.2,y:-.43}];
 }else if(arms===4){
  motors=[[-s.x,-s.front],[s.x,-s.front],[-s.x*.94,s.rear],[s.x*.94,s.rear]].map(([x,z])=>({x,z,r:s.r,y,duct:kind==='ducted'}));
 }else{
  kind=arms===6?'hex':arms===8?'octo':kind;
  motors=Array.from({length:arms},(_,i)=>{const t=i/arms*Math.PI*2-Math.PI/2;return{x:Math.cos(t)*s.x*1.26,z:Math.sin(t)*s.x*1.26,r:s.r*(arms===8?.82:1),y};});
 }
 if(/matrice (300|350|400)/.test(name))motors=motors.map(m=>({...m,y:-.08,inverted:true}));
 if(/matrice 30(?:t| |$)/.test(name))motors=motors.map(m=>({...m,y:m.z<0?.12:.32,inverted:m.z>0}));
 if(s.profile==='evo-max')motors=motors.map(m=>({...m,y:m.z<0?.4:.05}));
 if(coaxial)motors=motors.flatMap(m=>[{...m,y:.45},{...m,y:-.39}]);
 const gameSpeed=spec.maxSpeedKph??s.speed;
 const cameraCount=spec.cameraCount??(/mavic 4|mavic 3 pro/.test(name)?3:/air 3|mavic 3(?! classic)|mavic 2 enterprise dual/.test(name)?2:/max|4t|4e/.test(name)?3:1);
 const detail:AirframeDetail={family:spec.family,variant:0,shell:s.shell,blades:s.blades,coaxial,camera:spec.cameraCount===0?'none':s.camera,gear:s.gear,payload:s.profile==='agras'?'tank':s.profile==='flycart'?'box':'none',armWidth:s.shell==='industrial'?.115:s.profile==='phantom'?.17:.105,bodyHeight:s.h,battery:s.profile==='matrice'||s.profile==='inspire'||s.profile==='flycart'?2:1,mass:spec.massKg??s.mass,span:spec.widthM??s.span,prop:0,maxKph:gameSpeed,response:s.response,bodyColor:spec.bodyColor,visualProfile:s.profile,cameraCount,branded:true,frontSensors:spec.brand==='autel'&&!['dreamer','dragonfish','dragonfish-25'].includes(spec.visualProfile)||spec.brand==='dji'&&/mini (3 pro|4 pro|5 pro)|mavic(?! mini)|air |phantom 4|fpv|inspire (2|3)|matrice/i.test(name)};
 return {catalogId:spec.id,name:spec.name,body:outline(s.w,s.l,s.profile),motors,wing,kind,detail,color,inferred:false,speed:Math.min(99,Math.round(gameSpeed/1.7)),handling:Math.round(57+s.response*27),energy:s.shell==='industrial'?88:76};
}
