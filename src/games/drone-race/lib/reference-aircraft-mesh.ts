import type {Drone,Point} from './drone';
type V=[number,number,number];
export type AircraftParts={
 face:(p:V[],color:string,normals?:V[])=>void;
 tube:(a:V,b:V,r:number,color:string,n?:number,r2?:number)=>void;
 box:(x:number,y:number,z:number,w:number,h:number,l:number,color:string,r?:number)=>void;
 arm:(a:V,b:V,r:number,color:string)=>void;
 loft:(p:Point[],levels:[number,number][],color:string)=>void;
};
type Station=[z:number,width:number,bottom:number,top:number];
const DARK='#252a2e',GLASS='#092b3d',METAL='#959da1',BLACK='#12191d';
// Cross sections are authored from manufacturer photographs, in game units.
// Front is -Z. Related camera/radio variants deliberately retain their shared airframe.
export function referenceAircraftMesh(d:Drone,p:AircraftParts,shell:string):boolean{
 if(!d.detail?.branded)return false;
 const f=d.detail.visualProfile??'',name=d.name.toLowerCase(),w=Math.max(...d.body.map(q=>Math.abs(q.x))),l=Math.max(...d.body.map(q=>Math.abs(q.y))),h=d.detail.bodyHeight;
 const supported=['mini','mavic','air','atom','evo','nano','lite','evo-max','enterprise','lito','spark','phantom','dreamer','inspire','fpv','avata','avata360','neo','flip','matrice','agras','flycart','spreading-wings'];
 if(!supported.includes(f))return false;
 const unit=(v:V):V=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n) as V;};
 // Beveled sections give a flat deck, shoulders and belly, unlike a scaled ellipsoid.
 function hull(st:Station[],color=shell,offset:V=[0,0,0],bevel=.22){
  const ring=(s:Station):V[]=>{const[z,x,lo,hi]=s,b=(hi-lo)*bevel;return [[-x*(1-bevel),hi,z],[x*(1-bevel),hi,z],[x,hi-b,z],[x,lo+b,z],[x*(1-bevel),lo,z],[-x*(1-bevel),lo,z],[-x,lo+b,z],[-x,hi-b,z]].map(v=>v.map((q,k)=>q+offset[k]) as V);};
  const rings=st.map(ring),normal=(i:number,j:number):V=>{const a=rings[i][(j+7)%8],b=rings[i][(j+1)%8],c=rings[Math.max(0,i-1)][j],e=rings[Math.min(st.length-1,i+1)][j],u=b.map((q,k)=>q-a[k]),v=e.map((q,k)=>q-c[k]);return unit([v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]]);};
  for(let i=0;i<st.length-1;i++)for(let j=0;j<8;j++){const k=(j+1)%8;p.face([rings[i][j],rings[i+1][j],rings[i+1][k],rings[i][k]],color,[normal(i,j),normal(i+1,j),normal(i+1,k),normal(i,k)]);}
  p.face(rings[0],color);p.face([...rings.at(-1)!].reverse(),color);
 }
 function ball(center:V,rx:number,ry:number,rz:number,color:string){
  const at=(i:number,j:number)=>{const a=i/12*Math.PI,b=j/24*Math.PI*2,n:V=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];return{p:[center[0]+rx*n[0],center[1]+ry*n[1],center[2]+rz*n[2]] as V,n:unit([n[0]/rx,n[1]/ry,n[2]/rz])};};
  for(let i=0;i<12;i++)for(let j=0;j<24;j++){const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];p.face(q.map(x=>x.p),color,q.map(x=>x.n));}
 }
 function optic(x:number,y:number,z:number,r:number){p.tube([x,y,z+.012],[x,y,z-.022],r,DARK,24);p.tube([x,y,z-.023],[x,y,z-.032],r*.8,METAL,24);p.tube([x,y,z-.034],[x,y,z-.04],r*.68,GLASS,24);p.tube([x-r*.2,y+r*.23,z-.041],[x-r*.2,y+r*.23,z-.044],r*.15,'#77a6b3',12);}
 function eyes(y:number,z:number,x=w*.76,r=.07,pods=false){for(const side of[-1,1]){if(pods)ball([side*x,y,z+.02],r*1.48,r*1.38,r*1.5,shell);optic(side*x,y,z-r*.85,r);}}
 const miniPro=f==='mini'&&/mini [345]/.test(name),inspire=f==='inspire',integrated=f==='phantom'||f==='dreamer',guarded=['avata','avata360','neo','flip'].includes(f),industrial=['matrice','agras','flycart','evo-max','spreading-wings'].includes(f),atom3=f==='atom'&&/atom 3/.test(name),m30=/matrice 30(?:t| |$)/.test(name),underMounted=/matrice (300|350|400)/.test(name),autelArms=['evo','nano','lite'].includes(f);
 if(integrated){
  p.loft(d.body,[[ -.2,.7],[-.09,1],[.14,.98],[.31,.78],[.37,.38]],shell);
  if(f==='dreamer'){p.box(0,.36,.03,w*1.15,.055,l*1.25,'#d9dcdf',.02);p.box(0,.394,.1,.15,.007,.19,DARK,.015);}
  if(d.detail.frontSensors)eyes(.03,-l*.86,w*.38,.047);
 }else if(inspire){
  hull([[-l,.23,-.12,.27],[-l*.68,w,-.2,.47],[l*.12,w,-.22,.5],[l*.73,w*.78,-.12,.37],[l,w*.54,-.05,.26]],shell, [0,.08,0],.33);
  if(/inspire [23]/.test(name)){for(const side of[-1,1])p.box(side*w*.48,.22,l*.57,w*.85,.39,l*.87,DARK,.05);eyes(.2,-l,.18,.055);}
  p.box(0,-.14,-l*.6,.39,.09,.25,DARK,.018);
 }else if(f==='fpv'){
  hull([[-l,w*.62,-.22,.16],[-l*.5,w,-.3,.44],[l*.12,w*.95,-.2,.55],[l*.82,w*.62,-.16,.25],[l,w*.35,-.05,.1]],shell, [0,0,0],.42);
  ball([0,.3,-.13],w*.91,.32,l*.77,'#202b30');eyes(-.1,-l*.76,w*.75,.055);
 }else if(guarded){
  const low=f==='neo'?.04:-.03,high=f==='neo'?.21:f==='flip'?.3:/avata 2/.test(name)?.43:.6;
  hull([[-l,w*.86,low,high*.69],[-l*.73,w,low,high*.93],[l*.2,w*.85,low,high],[l*.95,w*.62,low,high*.85],[l,w*.49,low+.01,high*.75]],shell);
  p.box(0,high+.006,l*.2,w*1.21,.028,l*.98,f==='neo'?shell:'#676b6c',.035);
  if(f.startsWith('avata')){for(const side of[-1,1])p.box(side*w*.93,.17,-l*.92,.055,.25,.13,'#f78122',.012);}
  if(f==='neo'&&/neo 2/.test(name))eyes(.15,-l,.17,.046);
 }else if(m30){
  hull([[-l,w*.72,-.12,.17],[-l*.62,w,-.2,.33],[l*.67,w*.76,-.17,.36],[l,w*.5,-.07,.18]],shell);eyes(.14,-l,w*.74,.06);p.box(0,.35,l*.18,w,.03,l*.82,DARK,.025);
 }else if(f==='matrice'||f==='agras'||f==='flycart'||f==='spreading-wings'){
  hull([[-l,w*.65,-.25,.11],[-l*.57,w,-.28,.29],[l*.5,w,-.26,.32],[l,w*.8,-.19,.2]],shell);
  for(const side of[-1,1])p.box(side*w*.48,underMounted?.52:.35,l*.08,w*.87,underMounted?.52:.24,l*1.18,DARK,.035);
  if(f==='matrice'){eyes(.03,-l,w*.42,.056);for(const side of[-1,1]){p.tube([side*w*.83,.32,l*.62],[side*w*.83,.59,l*.62],.021,DARK);p.tube([side*w*.83,.59,l*.62],[side*w*.83,.63,l*.62],.093,shell);}}
 }else if(f==='atom'){
  hull([[-l,w*.69,-.16,atom3?.24:.12],[-l*.74,w,-.18,atom3?.34:.21],[-l*.15,w*.85,-.17,atom3?.38:.25],[l*.68,w*.65,-.11,.23],[l,w*.5,-.055,.15]],shell);
  p.box(0,atom3?.32:.246,l*.18,w*1.04,.02,l*1.24,shell,.07);
  p.box(0,.035,-l-.008,w*1.36,.08,.05,BLACK,.025);
 }else if(f==='mini'){
  if(miniPro){hull([[-l,w*.52,-.08,.15],[-l*.68,w,-.12,.25],[-l*.2,w*.78,-.13,.27],[l*.7,w*.66,-.06,.23],[l,w*.47,-.025,.12]],shell);for(const side of[-1,1]){p.box(side*w*.74,-.16,-l*.74,.1,.29,.24,shell,.034);}if(d.detail.frontSensors)eyes(.14,-l*.88,w*.8,.075,true);}
  else{hull([[-l,w*.71,-.1,.07],[-l*.58,w,-.15,.17],[l*.65,w*.83,-.08,.2],[l,w*.56,-.02,.1]],shell);p.box(0,-.02,-l,.34,.09,.04,DARK,.01);}
 }else if(f==='evo'||f==='nano'||f==='lite'){
  const big=f==='evo',nano=f==='nano';
  hull([[-l,w*.74,-.17,big?.25:.14],[-l*.64,w,-.26,big?.4:.27],[l*.15,w*.96,-.24,big?.46:.32],[l*.78,w*.69,-.14,big?.33:.24],[l,w*.5,-.04,.12]],shell);
  hull([[-l*.75,w*.68,-.245,-.1],[l*.55,w*.72,-.235,-.1]],DARK);
  if(big){p.box(0,.405,-l*.12,w*1.25,.024,l*.82,shell,.06);eyes(.15,-l*.95,w*.63,.065,true);}
  else{p.box(0,.16,-l*.86,w*1.68,.16,.13,DARK,.04);eyes(.17,-l*.95,w*.67,nano?.047:.06);}
 }else if(f==='evo-max'){
  hull([[-l,w*.72,-.2,.24],[-l*.63,w,-.25,.38],[l*.6,w*.88,-.24,.36],[l,w*.7,-.12,.2]],shell);
  p.box(0,.37,l*.22,w*1.25,.07,l*.93,DARK,.035);eyes(.15,-l,w*.7,.06);p.box(0,.48,l*.36,.31,.15,.24,shell,.022);
 }else if(f==='spark'){
  hull([[-l,w*.78,-.13,.12],[-l*.62,w,-.14,.2],[l*.65,w*.94,-.12,.18],[l,w*.67,-.06,.07]],shell);
  p.box(0,-.015,-l,w*1.65,.17,.09,DARK,.035);
 }else{
  // Mavic / Air: sloping forehead and raised rear deck, not the Mini/ATOM shell.
  const m4=/mavic 4/.test(name),m2=/mavic 2/.test(name),air=f==='air';
  hull([[-l,w*.65,-.13,.07],[-l*.78,w*.91,-.22,.21],[-l*.22,w,-.2,m4?.43:air?.31:.33],[l*.6,w*.82,-.11,m2?.35:.32],[l,w*.57,-.03,.17]],shell);
  p.box(0,.323,l*.24,w*1.23,.018,l*.75,shell,.035);
  if(f==='mavic')p.box(0,.19,-l*.73,.28,.035,.045,DARK,.012);
  if(d.detail.frontSensors){eyes(.115,-l*.9,w*.74,.065,true);eyes(.26,l*.84,w*.56,.05,true);}
  if(f==='enterprise'){p.box(0,.4,l*.38,.28,.14,.22,shell,.025);p.tube([0,.47,l*.38],[0,.49,l*.38],.079,DARK);}
 }
 // Recessed deck details. These remain small; silhouette carries identification.
 if(!guarded&&!integrated&&!inspire){for(const side of[-1,1])for(let j=0;j<4;j++)p.box(side*w*.91,-.01,l*.1+j*.052,.008,.032,.023,DARK,.002);}
 // Camera housings are model-specific, including lens arrangement and gimbal clearance.
 if(d.detail.camera!=='none'){
  const small=f==='mini'||f==='atom'||f==='nano',embedded=guarded||f==='fpv'||f==='spark',m4=/mavic 4/.test(name),m3pro=/mavic 3 pro/.test(name),m2pro=/mavic 2 pro/.test(name),air3=/air 3/.test(name);
  const cy=inspire?-.9:underMounted?-.65:integrated?-.54:embedded?(f==='fpv'?.01:.16):industrial?-.39:small?-.25:-.33,cz=-l*(inspire?.55:integrated?.61:1.0),r=inspire?.19:integrated?.12:industrial?.13:small?.10:m3pro?.14:.12;
  let cw=small?.28:.3,ch=small?.22:.25;
  const n=Math.max(1,Math.min(4,d.detail.cameraCount??1));if(n>1){cw=air3?.34:m3pro?.53:.4;ch=air3?.46:m3pro?.44:.35;}if(inspire){cw=.38;ch=.31;}if(embedded){cw=w*1.38;ch=f==='neo'?.18:.31;}if(atom3){cw=.31;ch=.25;}
  if(!embedded){const gy=integrated?-.17:inspire?-.19:-.08;p.tube([0,gy,cz+.06],[0,cy+.09,cz+.06],inspire?.065:.035,DARK);for(const side of[-1,1]){p.box(side*(cw*.5+.032),cy+.045,cz,.04,ch*.95,.115,inspire?DARK:METAL,.012);p.tube([side*(cw*.5+.025),cy,cz],[side*(cw*.5+.055),cy,cz],.07,DARK);} }
  if(m4){ball([0,cy,cz],.27,.26,.24,DARK);}
  else if(m3pro){hull([[-.12,.265,-.22,.22],[.13,.265,-.22,.22]],DARK,[0,cy,cz],.3);}
  else p.box(0,cy,cz,cw,ch,inspire?.31:.2,integrated?shell:(f==='evo'||f==='lite')?METAL:DARK,m2pro?.012:.05);
  const z=cz-(m4?.24:inspire?.24:.135);
  let lenses:number[][]=n===1?[[0,0,1]]:n===2?[[0,.08,1],[0,-.09,.63]]:n===3?[[-.09,.075,.83],[.085,.075,.65],[0,-.095,.73]]:[[-.09,.08,.72],[.09,.08,.55],[-.09,-.08,.6],[.09,-.08,.48]];
  if(m3pro)lenses=[[-.12,.10,.83],[.115,.10,.65],[0,-.12,.73]];
  if(f==='lite'&&/640t/i.test(name))lenses=[[-.085,0,.82],[.085,0,.65]];
  if(m4)lenses=[[-.105,.075,.82],[.105,.07,.6],[0,-.095,.9]];
  if(m2pro)p.box(0,cy,z+.01,.25,.23,.02,'#565e60',.008);
  if(inspire){p.tube([0,cy,cz-.06],[0,cy,cz-.3],r*1.18,DARK);optic(0,cy,cz-.31,r);}
  else for(const[x,y,k]of lenses)optic(x,cy+y,z,r*k);
 }
 const motors=d.motors.filter(m=>(!m.axis||m.axis==='y')).filter((m,i,a)=>a.findIndex(n=>n.x===m.x&&n.z===m.z)===i);
 if(inspire){
  for(const side of[-1,1]){const ms=motors.filter(m=>Math.sign(m.x)===side).sort((a,b)=>a.z-b.z),x=ms[0].x;p.tube([side*w*.72,.28,0],[x,.35,0],.105,DARK);p.tube([side*w*.8,-.01,.17],[x,.26,.17],.022,METAL);p.tube([x,.35,ms[0].z],[x,.35,ms.at(-1)!.z],.082,DARK);}
 }else for(const m of motors){
  const front=m.z<0,side=Math.sign(m.x),root:V=[side*w*(integrated?.54:.85),integrated?.05:f==='evo-max'?(front?.2:-.13):front?-.04:-.1,(front?-.55:.62)*l],end:V=[m.x,d.detail.coaxial?.06:(m.y??.24)+(m.inverted?.17:-.105),m.z];
  if(f==='evo-max'){p.arm(root,end,.11,shell);p.tube([root[0],root[1]-.05,root[2]],[root[0],root[1]+.05,root[2]],.09,DARK);}
  else if(industrial){p.tube(root,end,f==='agras'||f==='flycart'?.09:.064,DARK,20);p.box(root[0],root[1],root[2],.17,.16,.19,shell,.025);}
  else if(integrated){p.arm(root,end,.22,shell);if(/phantom [12]|x-star/.test(name)&&front)p.tube([end[0]*.72,end[1],end[2]*.72],[end[0]*.83,end[1],end[2]*.83],.12,'#d64032',12);}
  else if(!guarded){p.arm(root,end,f==='fpv'?.115:f==='evo'?.12:.085,autelArms?DARK:shell);p.tube([root[0],root[1]-.065,root[2]],[root[0],root[1]+.05,root[2]],.075,DARK,16);}
  else p.tube(root,end,.052,DARK,16);
  // DJI/ATOM folding aircraft have front antenna legs and short rear motor stubs.
  if(d.detail.gear==='feet'&&!guarded){const bottom=front?(f==='fpv'?-.46:smallLeg(f)?-.41:-.48):-.17;p.arm([m.x,end[1],m.z],[m.x+(front?side*.06:0),bottom,m.z+(front?.08:.025)],front?.045:.04,autelArms?DARK:shell);p.box(m.x+(front?side*.06:0),bottom,m.z+(front?.08:.025),.085,.032,.12,BLACK,.01);}
 }
 if(inspire){for(const m of motors){p.tube([m.x,.38,m.z],[m.x*.96,-.57,m.z+.13],.049,DARK,20,.031);p.box(m.x*.96,-.59,m.z+.13,.12,.04,.2,BLACK,.016);}}
 else if(d.detail.gear==='skids'||d.detail.gear==='tall'){
  const low=f==='flycart'?-1.15:-.88,x=w+(integrated?.13:.28);
  for(const side of[-1,1]){for(const z of[-l*.57,l*.52]){const a:V=[side*w*.72,-.1,z],b:V=[side*x,low+.12,z];if(integrated)p.arm(a,b,.05,shell);else p.tube(a,b,.033,DARK);}p.tube([side*x,low+.12,-l*.57],[side*x,low,-l*.42],.042,integrated?shell:DARK);p.tube([side*x,low,-l*.42],[side*x,low,l*.67],.044,integrated?shell:DARK);}
 }
 if(industrial&&!['evo-max','matrice'].includes(f)){p.tube([0,.3,l*.48],[0,.57,l*.48],.02,DARK);p.tube([0,.57,l*.48],[0,.61,l*.48],.09,shell);}
 return true;
}
function smallLeg(f:string){return ['mini','atom','nano','spark'].includes(f);}
