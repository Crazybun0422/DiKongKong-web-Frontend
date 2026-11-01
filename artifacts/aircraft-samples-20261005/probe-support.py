from collect import *
urls=['https://www.dji.com/support/product/mini-4k','https://www.dji.com/support/product/neo-2','https://www.dji.com/support/product/mini-5-pro','https://www.dji.com/support/product/t200','https://www.dji.com/downloads/products/phantom-3-se','https://store.dji.com/sg/product/dji-lito-x1']
def run(u):
 try:
  t,f=html(u);s=BeautifulSoup(t,'html.parser');h=s.find('h1');print(json.dumps({'url':u,'title':s.title.get_text() if s.title else '', 'h1':str(h.parent.parent)[:1500] if h else '', 'metas':[x.get('content') for x in s.find_all('meta',attrs={'property':'og:image'})]},ensure_ascii=False),flush=True)
 except Exception as e:print(u,str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(6) as p:list(p.map(run,urls))
