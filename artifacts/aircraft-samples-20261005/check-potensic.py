from collect import *
url='https://omo-oss-image.thefastimg.com/portal-saas/pg2024050909140579882/cms/image/7734c0d9-85f6-4246-9c7b-b0aa58592dd7.jpeg'
r=requests.get(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://cn.potensic.com/'},timeout=20)
print(r.status_code,r.headers.get('Content-Type'),len(r.content))
if r.status_code==200:(ROOT/'images'/'potensic-atom-2s.jpg').write_bytes(r.content)
print((ROOT/'repair.log').read_text()[-1500:])
