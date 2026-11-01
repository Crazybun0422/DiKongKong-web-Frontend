"""Build transparent 128/1024 PNG pairs from original alpha assets and reviewed cutouts."""
import json, hashlib, zipfile, urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/aircraft-samples-20261005'
OUT = ROOT / 'artifacts/aircraft-thumbnails-20261018'
CUTOUTS = ROOT / 'artifacts/aircraft-cutouts-20261018'
catalog = json.loads((ROOT / 'artifacts/aircraft-catalog-current.json').read_text(encoding='utf-8-sig'))['drones']
old = {item['slug']: item for item in json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8-sig'))['images']}
catalog += [{'name': name, 'slug': 'potensic-' + name.lower().replace(' ', '-')} for name in ['ATOM 3', 'ATOM 2S', 'ATOM 2', 'ATOM SE']]
OUT.mkdir(parents=True, exist_ok=True)
new_image = OUT.parent / 'matrice-5td-original.png'
new_url = 'https://www-cdn.djiits.com/cms/uploads/b097bfe5016cb10feae4fb647b0d16e3.png'
if not new_image.exists():
    urllib.request.urlretrieve(new_url, new_image)
old['dji-matrice-5td'] = {'file': str(new_image), 'sourceUrl': 'https://www.dji.com/products/comparison-small-ent-drones', 'imageUrl': new_url, 'sourceType': '官方'}
manifest = {'schemaVersion': 2, 'kind': 'aircraft-thumbnails', 'version': '20261018', 'aircraft': []}
for model in sorted(catalog, key=lambda item: item['slug']):
    source = old[model['slug']]
    original = ImageOps.exif_transpose(Image.open(SOURCE / source['file'])).convert('RGBA')
    cutout = CUTOUTS / (model['slug'] + '.png')
    image = Image.open(cutout).convert('RGBA') if cutout.exists() else original
    assert image.getchannel('A').getextrema()[0] == 0, f'Missing transparent cutout: {model["slug"]}'
    bounds = image.getchannel('A').getbbox()
    assert bounds, f'Blank image: {model["slug"]}'
    if bounds:
        image = image.crop(bounds)
    entry = {**model, **{key: source.get(key, '') for key in ['sourceUrl', 'imageUrl', 'sourceType', 'representation', 'note']}}
    entry['sourceDimensions'] = list(original.size)
    entry['backgroundProcessing'] = 'AI-assisted cutout, visually reviewed' if cutout.exists() else 'Original transparent alpha preserved'
    for size in (128, 1024):
        margin = max(2, size // 32)
        scaled = ImageOps.contain(image, (size-2*margin, size-2*margin), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (size, size))
        canvas.alpha_composite(scaled, ((size-scaled.width)//2, (size-scaled.height)//2))
        relative = f'{size}/{model["slug"]}.png'
        file = OUT / relative
        file.parent.mkdir(exist_ok=True)
        canvas.save(file, optimize=True)
        assert Image.open(file).size == (size, size)
        assert canvas.getchannel('A').getextrema() == (0, 255)
        entry[f'thumbnail{size}'] = relative
        entry[f'sha256_{size}'] = hashlib.sha256(file.read_bytes()).hexdigest()
    manifest['aircraft'].append(entry)
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / 'README.txt').write_text('执飞机型图片：78 个机型条目，每项包含 128×128 和 1024×1024 透明 PNG。\n客户端仅获取 128×128；1024×1024 由后端保存并提供访问链接。\n按 slug 匹配，保持比例；系列/组合机型采用清单中注明的代表图。\n保留原图透明通道；非透明图经过辅助抠图并检查。1024 为输出画布尺寸，部分低分辨率来源经等比例放大，不代表原生高清细节。\n上传整个 ZIP 到后台「设置 → 系统设置 → 机型缩略图」。来源、处理方式及代表机型说明见 manifest.json。\n图片权利归原权利人，资源包不附带新的商用授权。\n', encoding='utf-8')
with zipfile.ZipFile(OUT.with_suffix('.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['manifest.json', 'README.txt'] + [row[f'thumbnail{s}'] for row in manifest['aircraft'] for s in (128,1024)]:
        archive.write(OUT / name, name)
preview = Image.new('RGB', (8*170, 10*165), 'white')
draw = ImageDraw.Draw(preview)
for index, item in enumerate(manifest['aircraft']):
    x, y = index%8*170, index//8*165
    img = Image.open(OUT / item['thumbnail128'])
    preview.paste(img, (x+20,y), img)
    draw.text((x+4,y+132), item['slug'][:25], fill='black')
preview.save(OUT.parent / 'aircraft-thumbnails-preview-20261018.jpg')
print(f'{len(catalog)} models, {len(catalog)*2} thumbnails: {OUT.with_suffix(".zip")}')
