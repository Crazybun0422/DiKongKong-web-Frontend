import json, pathlib, urllib.request, concurrent.futures
base='https://soft-flute-280.notion.site'
out=pathlib.Path(__file__).parent
doc=json.loads((out/'notion-bugs.json').read_text('utf-8'))
images=[x['value']['value'] for x in doc['recordMap']['block'].values() if x.get('value',{}).get('value',{}).get('type')=='image']
payload={'urls':[{'url':b['properties']['source'][0][0],'permissionRecord':{'table':'block','id':b['id']}} for b in images]}
req=urllib.request.Request(base+'/api/v3/getSignedFileUrls',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','User-Agent':'Mozilla/5.0'})
data=json.load(urllib.request.urlopen(req,timeout=30))
urls=data.get('signedUrls',[])
if len(urls)!=len(images): raise RuntimeError(str(data))
def download(pair):
 i,url=pair
 p=out/('notion-reference-'+str(i+1)+'.png')
 p.write_bytes(urllib.request.urlopen(url,timeout=30).read())
 print(str(p),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(download,enumerate(urls)))
