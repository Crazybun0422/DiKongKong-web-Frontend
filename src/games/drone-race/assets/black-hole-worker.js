// CPU compatibility path: ray geometry is built once off the main thread.
// Animation shades the same curved light paths with flowing, procedural gas.
let geometry=null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function trace(width,height){
 const count=width*height,rays=new Float32Array(count*11),short=Math.min(width,height),co=Math.cos(.15),si=Math.sin(.15),length=Math.hypot(2.65,22),fy=-2.65/length,fz=-22/length,uy=-fz,uz=fy;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=(x+.5-width*.5)/short,py=(height*.5-y-.5)/short,qx=px*co+py*si,qy=-px*si+py*co;
  let vx=qx*.96,vy=fy+qy*.96*uy,vz=fz+qy*.96*uz,vl=Math.hypot(vx,vy,vz);vx/=vl;vy/=vl;vz/=vl;
  let ax=0,ay=2.65,az=22;const mx=ay*vz-az*vy,my=az*vx,mz=-ay*vx,L=mx*mx+my*my+mz*mz,o=(y*width+x)*11;let hits=0,transmit=1;
  for(let i=0;i<112;i++){
   const r2=ax*ax+ay*ay+az*az,r=Math.sqrt(r2);if(r<1.03){rays[o+9]=1;break;}if(r>29&&ax*vx+ay*vy+az*vz>0)break;
   const step=clamp(r*.09,.075,.62),force=-1.5*L/(r2*r2*r),fx=ax*force,fy=ay*force,fz=az*force,nx=ax+vx*step+fx*.5*step*step,ny=ay+vy*step+fy*.5*step*step,nz=az+vz*step+fz*.5*step*step,nr2=nx*nx+ny*ny+nz*nz,nforce=-1.5*L/(nr2*nr2*Math.sqrt(nr2));
   if(ay*ny<0&&hits<3){const t=ay/(ay-ny),hx=ax+(nx-ax)*t,hz=az+(nz-az)*t,hr=Math.hypot(hx,hz);if(hr>3&&hr<13){rays[o+hits*3]=hr;rays[o+hits*3+1]=Math.atan2(hz,hx);rays[o+hits*3+2]=transmit;transmit*=.24;hits++;}}
   vx+=(fx+nx*nforce)*.5*step;vy+=(fy+ny*nforce)*.5*step;vz+=(fz+nz*nforce)*.5*step;ax=nx;ay=ny;az=nz;
  }
  const b=Math.sqrt(L);rays[o+10]=Math.exp(-Math.pow((b-2.615)/.060,2))*.44;
 }
 return {width,height,rays};
}
function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function hash(x,y){x=(x*123.34)%1;y=(y*456.21)%1;if(x<0)x++;if(y<0)y++;const d=x*(x+45.32)+y*(y+45.32);return ((x+d)*(y+d))%1;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),f=x-ix,g=y-iy,u=f*f*(3-2*f),v=g*g*(3-2*g);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;}
function fbm(x,y){let n=noise(x,y)*.57,nx=(x*.8-y*.6)*2.03+7.2,ny=(x*.6+y*.8)*2.03+3.8;n+=noise(nx,ny)*.28;x=(nx*.8-ny*.6)*2.07;y=(nx*.6+ny*.8)*2.07;return n+noise(x,y)*.15;}
function shade(scene,time){
 const {width,height,rays}=scene,out=new Uint8ClampedArray(width*height*4);
 for(let pixel=0,o=0;pixel<width*height;pixel++,o+=11){let rr=0,gg=0,bb=0;
  for(let hit=0;hit<3;hit++){const r=rays[o+hit*3];if(!r)break;const angle=rays[o+hit*3+1],a=angle-time*.060/Math.pow(Math.max(1,r/3),1.45),x=Math.cos(a)*r,y=Math.sin(a)*r,turb=fbm(x*2.1,y*2.1),cloud=fbm(x*.60,y*.60),veins=.70+.12*Math.sin(r*21+turb*9+Math.sin(a*3)*1.3)+.06*Math.sin(r*43+turb*5),wisps=Math.pow(Math.max(0,Math.sin(r*13+cloud*8+Math.sin(a*4))),5)*.26,edge=smooth(3,3.24,r)*(1-smooth(8.8,13,r)),density=edge*Math.pow(3.1/r,1.75)*(.56+turb*.65+cloud*.23)*(veins+wisps),heat=smooth(0,.85,clamp((r-3.1)/8,0,1)),power=density*(1.15-.42*Math.cos(angle))*4.7*rays[o+hit*3+2];rr+=power;gg+=power*(.94-.46*heat);bb+=power*(.81-.66*heat);}
  const captured=rays[o+9],rim=rays[o+10]*(1-captured);rr+=rim;gg+=rim*.82;bb+=rim*.56;rr=1-Math.exp(-rr*1.03);gg=1-Math.exp(-gg*1.03);bb=1-Math.exp(-bb*1.03);const alpha=captured?1:Math.max(rr,gg,bb),i=pixel*4;if(alpha>.0001){out[i]=rr/alpha*255;out[i+1]=gg/alpha*255;out[i+2]=bb/alpha*255;out[i+3]=alpha*255;}
 }
 return out;
}
if(typeof self!=='undefined')self.onmessage=e=>{const {width,height,time}=e.data;if(!geometry||geometry.width!==width||geometry.height!==height)geometry=trace(width,height);const pixels=shade(geometry,time);self.postMessage({width,height,pixels},[pixels.buffer]);};
