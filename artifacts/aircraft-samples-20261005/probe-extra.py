import sys
sys.path.insert(0,str(__import__('pathlib').Path(__file__).parent))
from collect import *
urls=['https://www.dji.com/au/neo-2','https://www.dji.com/au/lito-x1','https://ag.dji.com/t100s','https://ag.dji.com/t200','https://www.dji.com/cn/flycart-200','https://www.dji.com/downloads/products/phantom-3-se','https://enterprise.dji.com/dock-2']
def probe(url):
 try:
  text,final=html(url);soup=BeautifulSoup(text,'html.parser');t=soup.title.get_text();m=soup.find('meta',attrs={'property':'og:image'});return {'url':url,'final':final,'title':t,'og':m.get('content') if m else None,'imgs':[(i.get('alt'),i.get('src') or i.get('data-src')) for i in soup.find_all('img') if i.get('alt')][:6]}
 except Exception as e:return {'url':url,'err':str(e)}
for row in concurrent.futures.ThreadPoolExecutor(6).map(probe,urls):print(json.dumps(row,ensure_ascii=False),flush=True)
