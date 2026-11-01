import requests,json,concurrent.futures
from pathlib import Path
from bs4 import BeautifulSoup
root=Path('artifacts/aircraft-samples-20261005');(root/'pages').mkdir(exist_ok=True)
urls=['https://www.dji.com/mini-4-pro','https://www.dji.com/support/product/spark','https://ag.dji.com/cn/t100','https://enterprise.dji.com/matrice-400','https://cn.potensic.com/atom-2.html','https://cn.potensic.com/drones-comparision.html']
def get(url):
 try:
  r=requests.get(url,timeout=25,headers={'User-Agent':'Mozilla/5.0'});key=url.split('//')[1].replace('/','_');(root/'pages'/ (key+'.html')).write_text(r.text,encoding='utf8');soup=BeautifulSoup(r.text,'html.parser');return {'url':url,'status':r.status_code,'final':r.url,'title':str(soup.title),'meta':[(x.get('property') or x.get('name'),x.get('content')) for x in soup.find_all('meta') if 'image' in str(x.get('property') or x.get('name'))],'images':[(i.get('alt'),i.get('src'),i.get('data-src')) for i in soup.find_all('img')][:8]}
 except Exception as e:return {'url':url,'error':str(e)}
for row in concurrent.futures.ThreadPoolExecutor(6).map(get,urls):print(json.dumps(row,ensure_ascii=False),flush=True)
