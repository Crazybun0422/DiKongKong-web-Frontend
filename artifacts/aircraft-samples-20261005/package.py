import json,csv,io,html,hashlib,zipfile,collections
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
root=Path(__file__).resolve().parent
rows=json.loads((root/'manifest-final.json').read_text(encoding='utf8'))
notes={
'dji-matrice-3d-3td':'组合机型条目，使用 Matrice 3D 代表图。',
'dji-matrice-4d-4td':'组合机型条目，使用 Matrice 4D 代表图。',
'dji-matrice-4t-4e':'组合机型条目，使用 Matrice 4 系列代表图。',
'industry-260':'组合机型条目，使用 Mavic 3 Enterprise 系列代表图。',
'dji-mini-2':'组合机型条目，使用 DJI Mini 2 代表图。',
'mavic-2':'组合机型条目，使用 Mavic 2 系列代表图。',
'mg1p':'组合机型条目，使用 AGRAS MG-1P 代表图。',
'mg-new-t70':'组合机型条目，使用 T70P 代表图。',
'm600-series':'系列条目，使用 Matrice 600 Pro 代表图。',
'm300-series':'系列条目，使用 Matrice 300 RTK 代表图。',
'm200-series':'系列条目，使用 Matrice 200 系列代表图。',
'inspire-1-series':'系列条目，使用 Inspire 1 代表图。',
'm30-series':'系列条目，使用 Matrice 30 系列代表图。',
'phantom-4-pro-v2':'组合机型条目，使用 Phantom 4 Pro V2.0 代表图。',
'mg-new-t100-s':'场景图。','mg-new-t200':'场景图。','mg-new-t60':'场景图。','mg-new-t70-s':'包含飞行器与配件的套装图。',
'dji-neo-2':'产品图带来源页面原有品牌文字。','dji-lito-x1':'折叠状态产品图。'
}
assert len(rows)==77 and len({r['slug'] for r in rows})==77
for r in rows:
 assert r['status']=='downloaded',r['slug']
 raw=(root/r['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==r['sha256']
 im=Image.open(io.BytesIO(raw));im.verify()
 r.pop('error',None);r['note']=notes.get(r['slug'],'');r['sampleDate']='2026-10-05'
 host=urlparse(r['sourceUrl']).hostname or ''
 r['sourceType']='官方' if host=='dji.com' or host.endswith('.dji.com') or host=='potensic.com' or host.endswith('.potensic.com') else '第三方产品页面'
 r['sourceTitle']=r['name']+' 产品页面' if r.get('sourceTitle')==r['slug'] else r.get('sourceTitle','')
rows.sort(key=lambda r:(r['brand']!='DJI',r['slug'].lower()))
meta={'schemaVersion':1,'createdDate':'2026-10-05','scope':'地图机型选择器：73 个 DJI 条目 + 4 个博坦条目；每个条目一张样例，组合型号使用代表图。','count':len(rows),'images':rows}
(root/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
(root/'aircraft-image-map.json').write_text(json.dumps({r['slug']:r['file'] for r in rows},ensure_ascii=False,indent=2),encoding='utf8')
with (root/'机型图片清单.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.writer(f);writer.writerow(['品牌','型号','类型标识','图片文件','宽','高','来源类型','来源页面','原始图片地址','备注','SHA256'])
 for r in rows:writer.writerow([r['brand'],r['name'],r['slug'],r['file'],r['width'],r['height'],r['sourceType'],r['sourceUrl'],r['imageUrl'],r['note'],r['sha256']])
counts=collections.Counter(r['sourceType'] for r in rows)
readme=f'''机型样例图片资源包 / 2026-10-05

覆盖范围：当前地图机型选择器全部 77 个条目（73 个 DJI + 4 个博坦）。
每个条目对应一张图片；接口中的组合型号/系列使用代表机型，不表示每个子型号均有独立图片。
来源：官方 {counts['官方']} 张，第三方产品页面 {counts['第三方产品页面']} 张。

目录
images/                   图片原文件，以机型 slug 命名
manifest.json             型号、图片、尺寸、来源、备注及 SHA256
机型图片清单.csv          Excel 可打开的中文对照清单
aircraft-image-map.json    slug -> 本地图片相对路径
index.html                无需联网的图片预览页；解压后打开

图片说明
保留来源原图，不拉伸、不放大、不合成机型、不去除原有品牌字样。
T60、T100S、T200 使用场景图；T70S 为套装图；Lito X1 为折叠状态。
其余系列/组合型号的具体代表图说明见清单。
官方产品页面优先；无法取得图片时使用可确认型号的第三方产品页面。
图片及商标权利归原权利人；本包为样例整理，不附带新的商用授权。

接入
根据 aircraft-image-map.json 查找本地文件；上传后使用实际返回的文件名。
图片文件已逐一解码检查，清单带 SHA256 可用于校验。
本次仅生成资源包，未替换小程序、Android 或 Web 中现有机型资源。
'''
(root/'README.txt').write_text(readme,encoding='utf8')
esc=lambda x:html.escape(str(x),quote=True)
cards=[]
for r in rows:
 cards.append(f'''<article data-search="{esc(r['name']+' '+r['slug']+' '+r['brand'])}"><a href="{esc(r['file'])}"><img src="{esc(r['file'])}" alt="{esc(r['name'])}" loading="lazy"></a><h2>{esc(r['name'])}</h2><p>{esc(r['brand'])} · {r['width']} × {r['height']}</p><code>{esc(r['slug'])}</code><p class="note">{esc(r['note'] or '产品样例图')}</p><a href="{esc(r['sourceUrl'])}" target="_blank" rel="noopener noreferrer">{esc(r['sourceType'])}来源</a></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>机型样例图片 · 77 个条目</title><style>*{box-sizing:border-box}body{font:15px system-ui,sans-serif;margin:0;background:#f3f6f8;color:#152331}header{padding:30px 5%;background:#fff;border-bottom:1px solid #dfe5ea}h1{font-size:26px;margin:0 0 12px}header p{color:#627083}input{margin-top:12px;width:min(100%,520px);padding:12px;border:1px solid #cad5df;border-radius:10px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:24px 5%}article{padding:15px;background:#fff;border:1px solid #dde4eb;border-radius:14px;min-width:0}article[hidden]{display:none}img{display:block;width:100%;height:190px;object-fit:contain;background:#eff2f4;border-radius:8px}h2{font-size:17px;margin:14px 0 6px}p{line-height:1.5;margin:8px 0}code{font-size:12px;overflow-wrap:anywhere;color:#526374}a{color:#1767bb}.note{font-size:13px;color:#6b7480;min-height:40px}</style><header><h1>机型样例图片</h1><p>77 个条目 · DJI 73 / 博坦 4 · 2026-10-05</p><p>点击图片查看原图。系列与组合型号使用代表图，具体对应关系见清单。</p><input id="query" placeholder="搜索机型、品牌或标识" aria-label="搜索机型"></header><main>'''+''.join(cards)+'''</main><script>document.querySelector('#query').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.toLowerCase().includes(q))});</script></html>'''
(root/'index.html').write_text(page,encoding='utf8')
zip_path=root.parent/'aircraft-samples-20261005.zip'
files=[r['file'] for r in rows]+['README.txt','manifest.json','机型图片清单.csv','aircraft-image-map.json','index.html']
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name in files:z.write(root/name,'aircraft-samples/'+name)
with zipfile.ZipFile(zip_path) as z:
 assert z.testzip() is None
 assert len(z.namelist())==82
print(json.dumps({'count':len(rows),'sources':counts,'zip':str(zip_path),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest()},ensure_ascii=False))
