from collect import *
rows=json.loads((ROOT/'manifest-draft.json').read_text(encoding='utf8'))
BAD='de46652dd99c67d4f8d17607e3bf0dce'
custom={'phantom-3-pro':'phantom-3-pro','phantom-3-4K':'phantom3-4k','phantom-4-pro-v2':'phantom-4-pro-v2','phantom-4-multispectral':'p4-multispectral','m300-series':'matrice-300-rtk','dji-matrice-3d-3td':'matrice-3d','dji-matrice-4d-4td':'matrice-4d','mg-new-t70-s':'t70s','mg-new-t100-s':'t100s','mg-new-t60':'t60','mg-new-t200':'t200','dji-fpv':'dji-fpv'}
def fix(row):
 if row['brand']!='DJI' or (row['status']=='downloaded' and BAD not in row['imageUrl']):return row
 slug=row['slug'];key=custom.get(slug,slug.removeprefix('dji-'));sources=['https://www.dji.com/support/product/'+key,'https://www.dji.com/downloads/products/'+key]
 errors=[]
 for url in sources:
  try:
   text,final=html(url);s=BeautifulSoup(text,'html.parser');title=s.title.get_text() if s.title else ''
   if title.startswith('DJI Support for Products') or title.startswith('DJI - The World Leader'):raise ValueError('Generic page')
   candidates=[]
   if '/downloads/' in url:
    section=s.find(class_=re.compile('products-main-title'))
    if section:
     im=section.find('img');candidates.append(im.get('src')) if im else None
   h=s.find('h1')
   if h:
    candidates+=re.findall(r'background-image:\s*url\([\'"]?([^\)\'\"]+)',str(h.parent.parent))
   m=s.find('meta',attrs={'property':'og:image'});
   if m and BAD not in m.get('content',''):candidates.append(m.get('content'))
   if not candidates:raise ValueError('No exact product image')
   image_url=urljoin(final,candidates[0]);row.update(get_image(image_url,slug));row.update(sourceUrl=final,sourceTitle=title,status='downloaded');row.pop('error',None);print('FIXED',slug,flush=True);return row
  except Exception as e:errors.append(str(e))
 row.update(status='missing',error='; '.join(errors));print('MISSING',slug,flush=True);return row
with concurrent.futures.ThreadPoolExecutor(8) as pool:rows=list(pool.map(fix,rows))
(ROOT/'manifest-fixed.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
print('COUNT',sum(r['status']=='downloaded' for r in rows))
