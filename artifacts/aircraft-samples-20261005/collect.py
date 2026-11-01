import requests,json,re,concurrent.futures,hashlib,io,time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parent
(ROOT/'images').mkdir(exist_ok=True)
CAT=json.loads((ROOT/'dji-catalog.json').read_text(encoding='utf-8-sig'))['drones']
SPECIAL={
'dji-matrice-3d-3td':('https://enterprise.dji.com/matrice-3d','Matrice 3D/3TD series'),
'm-400':('https://enterprise.dji.com/matrice-400',''),
'dji-matrice-4d-4td':('https://enterprise.dji.com/matrice-4d','Matrice 4D/4TD series'),
'dji-matrice-4t-4e':('https://enterprise.dji.com/matrice-4-series','Matrice 4 series'),
'industry-260':('https://enterprise.dji.com/mavic-3-enterprise','Mavic 3 Enterprise series'),
'm30-series':('https://enterprise.dji.com/matrice-30','Matrice 30 series'),
'm300-series':('https://enterprise.dji.com/matrice-300','Matrice 300 RTK'),
'm350-rtk':('https://enterprise.dji.com/matrice-350-rtk',''),
'm200-series':('https://www.dji.com/support/product/matrice-200-series','Matrice 200 series'),
'm600-series':('https://www.dji.com/support/product/matrice600-pro','Matrice 600 Pro'),
'm100':('https://www.dji.com/support/product/matrice100',''),
'inspire-1-series':('https://www.dji.com/support/product/inspire-1','Inspire 1'),
'phantom-3-pro':('https://www.dji.com/support/product/phantom-3-pro',''),
'phantom-3-4K':('https://www.dji.com/support/product/phantom3-4k',''),
'phantom-4-pro-v2':('https://www.dji.com/phantom-4-pro-v2','Phantom 4 Pro V2.0'),
'phantom-4-multispectral':('https://www.dji.com/p4-multispectral',''),
'phantom-4-rtk':('https://www.dji.com/phantom-4-rtk',''),
'mg1p':('https://www.dji.com/mg-1p','AGRAS MG-1P (series representative)'),
'mg-new':('https://ag.dji.com/t20p',''),
'mg-new-t70':('https://ag.dji.com/t70p','T70P (series representative)'),
'mg-new-t70-s':('https://ag.dji.com/cn/t70s',''),
'mg-new-t100-s':('https://ag.dji.com/cn/t100s',''),
'dji-mini-2':('https://www.dji.com/support/product/mini-2','DJI Mini 2 (series representative)'),
'mavic-2':('https://www.dji.com/support/product/mavic-2','Mavic 2 series'),
'mavic-pro':('https://www.dji.com/support/product/mavic',''),
'dji-fpv':('https://www.dji.com/dji-fpv',''),
}
OLD={'spark','inspire-2','phantom-3-standard','phantom-3-advanced','phantom-3-se','phantom-4','phantom-4-pro','phantom-4-advanced','mavic-air','mavic-air-2','mavic-mini','mavic-2-enterprise'}
def initial(d):
 slug=d['slug'];p=slug.removeprefix('dji-')
 if slug in SPECIAL:return SPECIAL[slug]
 if slug.startswith('mg-new-'):return ('https://ag.dji.com/cn/'+slug.removeprefix('mg-new-'),'')
 if slug in OLD:return ('https://www.dji.com/support/product/'+p,'')
 return ('https://www.dji.com/'+p,'')
def request(url):
 r=requests.get(url,timeout=(10,28),headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status();return r

def html(url):
 key=hashlib.sha1(url.encode()).hexdigest();f=ROOT/'pages'/(key+'.html')
 if f.exists():return f.read_text(encoding='utf8'),url
 r=request(url);r.encoding='utf-8';f.write_text(r.text,encoding='utf8');return r.text,r.url

def get_image(url,slug):
 r=request(url);im=Image.open(io.BytesIO(r.content));im.verify();im=Image.open(io.BytesIO(r.content));w,h=im.size
 if w<80 or h<80:raise ValueError('Image too small')
 ext={'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','GIF':'.gif'}.get(im.format)
 if not ext:raise ValueError('unsupported '+str(im.format))
 path='images/'+slug+ext;(ROOT/path).write_bytes(r.content)
 return {'file':path,'imageUrl':r.url,'width':w,'height':h,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest()}

def process(d):
 row={**d,'brand':'DJI','status':'missing'};url,note=initial(d);row['representation']=note
 try:
  text,final=html(url);soup=BeautifulSoup(text,'html.parser');title=soup.title.get_text(' ',strip=True) if soup.title else '';row.update(sourceUrl=final,sourceTitle=title)
  if re.search('404|Page Not Found|页面不存在',title,re.I):raise ValueError('Product page unavailable')
  image_url=None
  if '/support/product/' in url:
   h=soup.find('h1')
   if h:
    m=re.search(r'background-image:\s*url\([\'"]?([^\)\'\"]+)',str(h.parent.parent))
    if m:image_url=m.group(1)
  if not image_url:
   meta=soup.find('meta',attrs={'property':'og:image'});image_url=meta.get('content') if meta else None
  if not image_url:raise ValueError('No product image')
  row.update(get_image(urljoin(final,image_url),d['slug']));row['status']='downloaded'
 except Exception as e:row['error']=str(e)
 print(row['slug'],row['status'],row.get('sourceTitle',row.get('error')),flush=True);return row
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(6) as pool:rows=list(pool.map(process,CAT))
 # Potensic official navigation explicitly labels each of these exact models.
 text,final=html('https://cn.potensic.com/atom-2.html');soup=BeautifulSoup(text,'html.parser')
 for name in ['ATOM 3','ATOM 2S','ATOM 2','ATOM SE']:
  slug='potensic-'+name.lower().replace(' ','-');row={'name':name,'slug':slug,'brand':'博坦','sourceUrl':final,'sourceTitle':soup.title.get_text(),'representation':'','status':'missing'}
  try:
   img=soup.find('img',alt=name);assert img is not None
   row.update(get_image(urljoin(final,img['src']),slug));row['status']='downloaded'
  except Exception as e:row['error']=str(e)
  print(slug,row['status'],flush=True);rows.append(row)
 (ROOT/'manifest-draft.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
 print('RESULT',len(rows),sum(r['status']=='downloaded' for r in rows),flush=True)
