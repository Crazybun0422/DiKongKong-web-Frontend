import json, requests, io, hashlib, concurrent.futures
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
# Explicitly verified product/source associations; original bytes are preserved.
items={
'potensic-atom-3':('https://cn.potensic.com/atom-2.html','https://omo-oss-image.thefastimg.com/portal-saas/pg2024050909140579882/cms/image/cca7712d-7683-4646-b7f1-af505cf3f356.jpg'),
'potensic-atom-2s':('https://cn.potensic.com/atom-2.html','https://omo-oss-image.thefastimg.com/portal-saas/pg2024050909140579882/cms/image/7734c0d9-85f6-4246-9c7b-b0aa58592dd7.jpeg'),
'potensic-atom-2':('https://cn.potensic.com/atom-2.html','https://omo-oss-image.thefastimg.com/portal-saas/pg2024050909140579882/cms/image/7df0c579-0037-40c9-adc9-e81776f28c95.png'),
'potensic-atom-se':('https://cn.potensic.com/atom-2.html','https://omo-oss-image.thefastimg.com/portal-saas/pg2024050909140579882/cms/image/9727e18d-be2f-4214-b3cf-7a19903f258d.png'),
'dji-lito-x1':('https://store.dji.com/sg/product/dji-lito-x1?from=site-nav&set_region=SG','https://se-cdn.djiits.com/tpc/uploads/in_the_box/cover/9cbb1a270de53e714a5247c6a9351fc9%40retina_small.png?format=webp'),
'dji-lito-1':('https://store.dji.com/sg/product/dji-lito-x1?from=site-nav&set_region=SG','https://se-cdn.djiits.com/stormsend/uploads/0a523a91829ad7352f604835a08fc9b3.png?h=576&w=576'),
'mg-new-t200':('https://x-droners.com/uav/productInfo/26040044','https://x-droners.com/upload/img/260421/da-jiang-t200-nong-ye-wu-ren-fei-ji.png'),
'dji-flycart-200':('https://www.xtuav.cn/fc200.html','https://30634770.s21i.faiusr.com/4/ABUIABAEGAAg0rKgzwYo9rWz3AIw3Ak44wk.png'),
'dji-neo-2':('https://www.bigcamera.co.th/dji-neo-2','https://www.bigcamera.co.th/media/catalog/product/cache/6cfb1b58b487867e47102a5ca923201b/d/j/dji_neo_2_1.png'),
'dji-mini-5-pro':('https://www.istorm.gr/products/dji-mini-5-pro','https://www.istorm.gr/cdn/shop/files/DJIMini5PRO-unfolded_frontview_22_low-angle_22_1.png?v=1758110749&width=1445')}
def download(entry):
 slug,(source,url)=entry
 try:
  r=requests.get(url,headers={'User-Agent':'Mozilla/5.0','Referer':source},timeout=(10,35));r.raise_for_status()
  im=Image.open(io.BytesIO(r.content));im.verify();im=Image.open(io.BytesIO(r.content))
  ext={'PNG':'png','JPEG':'jpg','WEBP':'webp','GIF':'gif'}[im.format]
  file=f'images/{slug}.{ext}';(ROOT/file).write_bytes(r.content)
  return slug,dict(status='downloaded',file=file,sourceUrl=source,sourceTitle=slug,imageUrl=r.url,width=im.width,height=im.height,bytes=len(r.content),sha256=hashlib.sha256(r.content).hexdigest())
 except Exception as e:return slug,dict(error=str(e))
def main():
 rows=json.loads((ROOT/('manifest-final.json' if (ROOT/'manifest-final.json').exists() else 'manifest-fixed.json')).read_text(encoding='utf-8-sig'))
 by={r['slug']:r for r in rows}
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  for slug,result in pool.map(download,items.items()):
   by[slug].update(result)
   if result.get('status')=='downloaded':by[slug].pop('error',None)
   print(slug,result.get('status',result.get('error')),flush=True)
 (ROOT/'manifest-final.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
if __name__=='__main__':main()
