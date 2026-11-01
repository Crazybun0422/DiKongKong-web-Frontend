from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('artifacts/aircraft-samples-20261005');files=sorted((root/'images').glob('*'));font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',11)
canvas=Image.new('RGB',(960,((len(files)+5)//6)*150),'#eeeeee');d=ImageDraw.Draw(canvas)
for i,p in enumerate(files):
 im=Image.open(p).convert('RGBA');im.thumbnail((146,116));x=i%6*160;y=i//6*150;canvas.paste(im,(x+(160-im.width)//2,y+(120-im.height)//2),im);d.text((x+3,y+123),p.stem[:25],fill='black',font=font)
canvas.save(root/'qa-contact.jpg')
print(len(files))
