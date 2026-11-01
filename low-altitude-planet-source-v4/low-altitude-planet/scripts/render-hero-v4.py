"""Composite independent planet rotation, drone orbits and rotor motion.
The final landing is the map content of the user's recording, not a phone mockup.
All motion is encoded for reliable native autoplay plus animated-WebP fallback.
"""
from pathlib import Path
import math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy import ndimage as ndi

ROOT=Path(__file__).resolve().parents[1]
W,H,FPS,SECONDS=1080,810,30,16
BG=(17,20,19)
FRAMES=FPS*SECONDS
MAP_START=9.0

def ease(a,b,t):
    v=max(0,min(1,(t-a)/(b-a)))
    return v*v*(3-2*v)

def ff(*args):
    return subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True,capture_output=True)

def composite_matte(image,kind):
    # Chroma/texture mattes are evaluated only during video compositing.
    # Keep the source artwork unchanged, including the generated backdrop.
    rgb=np.asarray(image.convert('RGB')).astype(float)
    lum=rgb.mean(axis=2);chroma=rgb.max(axis=2)-rgb.min(axis=2)
    if kind=='planet':
        foreground=(lum<190)|(chroma>13)
        labels,count=ndi.label(foreground)
        areas=np.bincount(labels.ravel());areas[0]=0
        foreground=labels==areas.argmax()
        foreground=ndi.binary_fill_holes(foreground)
    else:
        local_mean=ndi.uniform_filter(lum,19)
        deviation=np.sqrt(np.maximum(0,ndi.uniform_filter(lum*lum,19)-local_mean**2))
        neutral=ndi.uniform_filter(chroma,9)<14
        background=(local_mean>199)&(deviation>7.5)&neutral
        foreground=~background
        labels,count=ndi.label(foreground)
        areas=np.bincount(labels.ravel());areas[0]=0
        foreground=areas[labels]>65
        # Restore smooth white arm and landing-gear surfaces that share checker colors.
        # Masks trace the interior of each physical part rather than the background.
        protection=Image.new('L',image.size,0);pen=ImageDraw.Draw(protection)
        rear=[(255,249),(292,236),(380,251),(513,279),(654,284),(615,337),(552,397),(534,413),(459,361),(372,322),(292,301),(254,276)]
        front=[(118,557),(224,507),(284,493),(451,446),(558,409),(601,447),(626,482),(618,538),(544,557),(400,576),(254,602),(184,618),(128,603)]
        leg=[(470,579),(537,592),(531,648),(520,707),(509,767),(497,827),(484,887),(473,917),(459,927),(445,926),(432,909),(429,888),(440,805),(451,724),(462,644)]
        for polygon in [rear,front,leg]:
            pen.polygon(polygon,fill=255)
            pen.polygon([(1536-x,y) for x,y in polygon],fill=255)
        foreground|=np.asarray(protection)>0
        foreground=ndi.binary_closing(foreground,iterations=3)
        foreground=ndi.binary_fill_holes(foreground)
        labels,count=ndi.label(foreground)
        areas=np.bincount(labels.ravel());areas[0]=0
        foreground=labels==areas.argmax()
    foreground=ndi.binary_erosion(foreground,iterations=1)
    alpha=Image.fromarray((foreground*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6))
    result=image.convert('RGBA');result.putalpha(alpha)
    return result

planet=composite_matte(Image.open(ROOT/'source/planet-layer.png'),'planet')
planet=planet.crop(planet.getbbox())
drone=composite_matte(Image.open(ROOT/'source/drone-layer.png'),'drone')
# Motor hub coordinates refer to the complete uncropped source image.
hubs=np.load(ROOT/'source/drone-hubs.npy')
# Scale the drone once, keeping the animation render light.
ratio=560/drone.width
hubs=hubs*ratio
drone=drone.resize((560,round(drone.height*ratio)),Image.Resampling.LANCZOS)

recording=ROOT/'source/low-altitude-demo-original.mp4'
raw=ff('-i',recording,'-map','0:v:0','-vf','crop=1200:900:4:920,scale=1080:810:flags=lanczos,fps=30,setsar=1','-an','-f','rawvideo','-pix_fmt','rgb24','pipe:1').stdout
map_data=np.frombuffer(raw,dtype=np.uint8).reshape((-1,H,W,3))
print('Map content:',len(map_data),'frames; status bar and phone navigation excluded.',flush=True)

# The map occupies the scene, with a soft edge into the page background.
yy,xx=np.mgrid[0:H,0:W]
edge=np.minimum.reduce([xx/34,(W-1-xx)/34,yy/34,(H-1-yy)/34])
edge=np.clip(edge,0,1);edge=edge*edge*(3-2*edge)
map_mask=Image.fromarray((edge*255).astype('uint8'))
base=Image.new('RGBA',(W,H),(*BG,255))
rng=np.random.default_rng(42)
star_x=rng.uniform(-1700,1700,180);star_y=rng.uniform(-1300,1300,180)
star_phase=rng.random(180);star_strength=rng.uniform(.3,1,180)

def rotor_sprite(t,phase):
    radius=drone.width*.14
    margin=int(radius)+4
    im=Image.new('RGBA',(drone.width+2*margin,drone.height+2*margin),(0,0,0,0))
    im.alpha_composite(drone,(margin,margin))
    ink=ImageDraw.Draw(im)
    # Each rotor is a projected spinning two-blade assembly around its own hub.
    for j,(x,y) in enumerate(hubs+margin):
        theta=t*(37+2*j)+phase+j*1.3
        ink.ellipse((x-radius,y-radius*.24,x+radius,y+radius*.24),fill=(190,213,219,26),outline=(218,233,235,65),width=1)
        # Multiple shutter samples produce fast but clearly changing rotor motion.
        for k,alpha in [(-2,48),(-1,72),(0,180),(1,72),(2,48)]:
            a=theta+k*.16
            dx=math.cos(a)*radius;dy=math.sin(a)*radius*.24
            ink.line((x-dx,y-dy,x+dx,y+dy),fill=(225,237,240,alpha),width=3)
        ink.ellipse((x-3,y-2,x+3,y+2),fill=(78,92,98,255))
    return im

def flight_path(radius,t,cx,cy,front,opacity):
    overlay=Image.new('RGBA',(W,H),(0,0,0,0));ink=ImageDraw.Draw(overlay)
    phi=-.25
    points=[]
    for a in np.linspace(0,math.pi*2,200):
        z=math.sin(a)
        if (z>=0)!=front:
            if len(points)>1:ink.line(points,fill=(210,255,111,int(160*opacity)),width=2)
            points=[];continue
        x=radius*1.2*math.cos(a);y=radius*.33*math.sin(a)
        points.append((cx+x*math.cos(phi)-y*math.sin(phi),cy+x*math.sin(phi)+y*math.cos(phi)))
    if len(points)>1:ink.line(points,fill=(210,255,111,int(160*opacity)),width=2)
    a=t*.7
    if (math.sin(a)>=0)==front:
        x=radius*1.2*math.cos(a);y=radius*.33*math.sin(a)
        x,y=cx+x*math.cos(phi)-y*math.sin(phi),cy+x*math.sin(phi)+y*math.cos(phi)
        ink.ellipse((x-3,y-3,x+3,y+3),fill=(225,255,154,int(255*opacity)))
    glow=overlay.filter(ImageFilter.GaussianBlur(5))
    return Image.alpha_composite(glow,overlay)

def paste_drone(im,item,t,opacity):
    j,x,y,size,bank,z=item
    sprite=rotor_sprite(t,j)
    if math.cos(t*(.57+j*.09)+j*1.65)<0:sprite=ImageOps.mirror(sprite)
    sprite=sprite.resize((max(6,int(size)),max(4,int(size*sprite.height/sprite.width))),Image.Resampling.LANCZOS)
    sprite=sprite.rotate(bank,resample=Image.Resampling.BICUBIC,expand=True)
    if opacity<1:sprite.putalpha(sprite.getchannel('A').point(lambda p:int(p*opacity)))
    im.alpha_composite(sprite,(int(x-sprite.width/2),int(y-sprite.height/2)))

if '--matte-preview' in __import__('sys').argv:
    (ROOT/'preview').mkdir(exist_ok=True)
    preview=Image.new('RGBA',drone.size,(*BG,255))
    preview.alpha_composite(drone)
    preview=preview.resize((1120,round(1120*drone.height/drone.width)),Image.Resampling.LANCZOS)
    preview.convert('RGB').save(ROOT/'preview/drone-composite-preview.jpg')
    preview=Image.new('RGBA',planet.size,(*BG,255));preview.alpha_composite(planet)
    preview.convert('RGB').save(ROOT/'preview/planet-composite-preview.jpg')
    raise SystemExit(0)

out=ROOT/'dist/assets/orbit-and-map-v4.mp4'
enc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
for n in range(FRAMES):
    t=n/FPS
    im=base.copy();ink=ImageDraw.Draw(im)
    travel=n/FRAMES*2
    z=40+((star_phase-travel)%1)*1800
    travel_brightness=1-.7*ease(2.5,5,t)+.7*ease(14.5,16,t)
    cx,cy=W*.5,H*.47
    for j in range(len(z)):
        x=cx+star_x[j]/z[j]*490;y=cy+star_y[j]/z[j]*490
        if not(-20<x<W+20 and -20<y<H+20):continue
        speed=12+80*(1-ease(2,5,t))
        bx=cx+star_x[j]/(z[j]+speed)*490;by=cy+star_y[j]/(z[j]+speed)*490
        a=(1-z[j]/1900)*star_strength[j]*travel_brightness*.66
        color=tuple(int(BG[k]+(c-BG[k])*a) for k,c in enumerate((216,232,238)))
        ink.line((bx,by,x,y),fill=(*color,255),width=1)
    approach=ease(0,4.2,t)
    scale=math.exp(math.log(.1)*(1-approach))
    plunge=1+2.8*ease(7.9,9.15,t)
    scene_alpha=1-ease(8.2,9.1,t)
    spin=-12+t*4.4
    if t>9.1:
        scene_alpha=ease(15.15,16,t);scale=.1;plunge=1;spin=-12
    radius=H*.405*scale*plunge
    if scene_alpha>.002:
        positions=[]
        for j in range(5):
            a=t*(.57+j*.09)+j*1.65
            orbital=radius*(1.23+.06*(j%2));tilt=-.35+(j%3)*.25
            px=orbital*math.cos(a);py=radius*(.29+.07*(j%3))*math.sin(a)
            x=cx+px*math.cos(tilt)-py*math.sin(tilt)
            y=cy+px*math.sin(tilt)+py*math.cos(tilt)+math.sin(t*2.2+j)*radius*.025
            z=math.sin(a)
            size=radius*(.50+.06*(j%2))*(.82+.21*z)
            positions.append((j,x,y,size,8*math.sin(a)+math.cos(t*1.8+j)*2,z))
        im=Image.alpha_composite(im,flight_path(radius,t,cx,cy,False,scene_alpha))
        for item in sorted(positions,key=lambda a:a[-1]):
            if item[-1]<0:paste_drone(im,item,t,scene_alpha)
        sz=max(8,int(radius*2))
        p=planet.resize((sz,max(8,int(sz*planet.height/planet.width))),Image.Resampling.LANCZOS)
        p=p.rotate(spin,resample=Image.Resampling.BICUBIC,expand=True)
        if scene_alpha<1:p.putalpha(p.getchannel('A').point(lambda a:int(a*scene_alpha)))
        im.alpha_composite(p,(int(cx-p.width/2),int(cy-p.height/2)))
        im=Image.alpha_composite(im,flight_path(radius,t,cx,cy,True,scene_alpha))
        for item in sorted(positions,key=lambda a:a[-1]):
            if item[-1]>=0:paste_drone(im,item,t,scene_alpha)
    map_alpha=ease(8.25,9,t)*(1-ease(14.55,15.65,t))
    if map_alpha>.002:
        idx=max(0,min(len(map_data)-1,int((t-MAP_START)*FPS)))
        frame=Image.fromarray(map_data[idx]).convert('RGBA')
        frame.putalpha(map_mask if map_alpha>=1 else map_mask.point(lambda a:int(a*map_alpha)))
        im=Image.alpha_composite(im,frame)
    enc.stdin.write(im.convert('RGB').tobytes())
    if n%90==0:print('Rendered',n,'/',FRAMES,flush=True)
enc.stdin.close()
if enc.wait()!=0:raise RuntimeError('Video encoder failed')
ff('-i',out,'-vf','fps=15,scale=720:540:flags=lanczos','-an','-c:v','libwebp_anim','-lossless','0','-quality','77','-compression_level','4','-loop','0',ROOT/'dist/assets/orbit-and-map-fallback-v4.webp')
print('Done:',out.stat().st_size,'bytes',flush=True)
