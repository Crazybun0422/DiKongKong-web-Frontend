from collect import *
keys={'phantom-3-advanced':'phantom-3-adv','phantom-4-advanced':'phantom-4-adv','m300-series':'matrice-300','dji-mini-4k':'mini-4k'}
rows=json.loads((ROOT/'manifest-final.json').read_text(encoding='utf8'))
def run(pair):
 slug,key=pair
 for url in ['https://www.dji.com/downloads/products/'+key,'https://www.dji.com/support/product/'+key]:
  try:
   t,final=html(url);s=BeautifulSoup(t,'html.parser');section=s.find(class_=re.compile('products-main-title'));img=section.find('img') if section else None
   candidates=[img.get('src')] if img else []
   h=s.find('h1')
   if h:candidates+=re.findall(r'background-image:\s*url\([\'"]?([^\)\'\"]+)',str(h.parent.parent))
   if not candidates:continue
   result=get_image(urljoin(final,candidates[0]),slug);result.update(sourceUrl=url,sourceTitle=s.title.get_text(),status='downloaded');print(slug,result,flush=True);return slug,result
  except Exception as e:print(slug,str(e),flush=True)
 return slug,{}
with concurrent.futures.ThreadPoolExecutor(4) as pool:
 for slug,result in pool.map(run,keys.items()):
  for row in rows:
   if row['slug']==slug and result:row.update(result);row.pop('error',None)
(ROOT/'manifest-final.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
