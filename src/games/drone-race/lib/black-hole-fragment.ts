// Bounded Schwarzschild-like ray bending; every visible disc sample is procedural.
export const BLACK_HOLE_FRAGMENT = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=noise2(p)*.57;p=mat2(.8,.6,-.6,.8)*p*2.03+vec2(7.2,3.8);a+=noise2(p)*.28;p=mat2(.8,.6,-.6,.8)*p*2.07;return a+noise2(p)*.15;}
vec3 gas(float r,float angle){
 float a=angle-uTime*.060/pow(max(1.,r/3.),1.45);vec2 uv=vec2(cos(a),sin(a))*r;
 float turbulence=fbm(uv*2.1),cloud=fbm(uv*.60);
 float veins=.70+.12*sin(r*21.+turbulence*9.+sin(a*3.)*1.3)+.06*sin(r*43.+turbulence*5.);
 float wisps=pow(max(0.,sin(r*13.+cloud*8.+sin(a*4.))),5.)*.26;
 float edge=smoothstep(3.,3.24,r)*(1.-smoothstep(8.8,13.,r));
 float density=edge*pow(3.1/r,1.75)*(.56+turbulence*.65+cloud*.23)*(veins+wisps);
 float heat=clamp((r-3.1)/8.,0.,1.),doppler=1.15-.42*cos(angle);
 vec3 hot=vec3(1.,.94,.81),gold=vec3(1.,.48,.15),color=mix(hot,gold,smoothstep(0.,.85,heat));
 return color*density*doppler*4.7;
}
vec3 acceleration(vec3 p,float angular){float r2=dot(p,p);return -1.5*angular*p/(r2*r2*sqrt(r2));}
void main(){
 float shortSide=min(uResolution.x,uResolution.y);vec2 p=(gl_FragCoord.xy-uResolution*.5)/shortSide;
 float co=cos(.15),si=sin(.15);vec2 q=vec2(p.x*co+p.y*si,-p.x*si+p.y*co);
 vec3 origin=vec3(0.,2.65,22.),forward=normalize(-origin),right=vec3(1.,0.,0.),up=normalize(cross(right,forward));
 vec3 at=origin,velocity=normalize(forward+q.x*.96*right+q.y*.96*up);vec3 momentum=cross(at,velocity);float angular=dot(momentum,momentum),transmit=1.;vec3 radiance=vec3(0.);float captured=0.;
 for(int i=0;i<112;i++){
  float r=length(at);if(r<1.03){captured=1.;break;}if(r>29.&&dot(at,velocity)>0.)break;
  float stepSize=clamp(r*.09,.075,.62);vec3 a=acceleration(at,angular),next=at+velocity*stepSize+a*(.5*stepSize*stepSize);vec3 nextVelocity=velocity+(a+acceleration(next,angular))*(.5*stepSize);
  if(at.y*next.y<0.){vec3 hit=mix(at,next,at.y/(at.y-next.y));float radius=length(hit.xz);if(radius>3.&&radius<13.){radiance+=gas(radius,atan(hit.z,hit.x))*transmit;transmit*=.24;}}
  at=next;velocity=nextVelocity;
 }
 float b=sqrt(angular),rim=exp(-pow((b-2.615)/.060,2.));radiance+=vec3(1.,.82,.56)*rim*.44*(1.-captured);
 float halo=exp(-pow((b-3.12)/1.25,2.))*.016; radiance+=vec3(.83,.47,.20)*halo*(1.-captured);
 vec3 mapped=1.-exp(-radiance*1.03);float alpha=max(mapped.r,max(mapped.g,mapped.b));alpha=mix(alpha,1.,captured);gl_FragColor=vec4(mapped,alpha);
}`;
