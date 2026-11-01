"""Extract existing product facts, excluding game physics/visual estimates."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
real = json.loads((ROOT / 'src/games/drone-race/lib/real-aircraft-data.json').read_text(encoding='utf-8'))
images = json.loads((ROOT / 'artifacts/aircraft-thumbnails-20261018/manifest.json').read_text(encoding='utf-8'))['aircraft']
picker = json.loads((ROOT / 'artifacts/aircraft-catalog-current.json').read_text(encoding='utf-8'))['drones']
def key(s):
    return re.sub('[^a-z0-9]', '', re.sub('^dji[ -]*', '', s.lower()))
brands = {'dji': 'DJI 大疆', 'autel': '道通智能', 'potensic': '博坦'}
legacy = {'m350-rtk':'dji-matrice-350-rtk', 'm100':'dji-matrice-100',
          'phantom-3-pro':'dji-phantom-3-professional', 'phantom-4-multispectral':'dji-p4-multispectral',
          'mg-new':'dji-agras-t20p'}
for source in picker:
    if re.fullmatch(r'mg-new-t\d+[a-z]*', source['slug']):
        legacy[source['slug']] = 'dji-agras-' + source['slug'][7:]
rows = []
for item in real:
    parameters = []
    for field, label, unit, multiplier in [('massKg','整机重量','g',1000), ('maxSpeedKph','最高速度','km/h',1)]:
        if field in item:
            parameters.append({'label': label, 'value': f'{item[field] * multiplier:g} {unit}'})
    row = {'slug': item['id'], 'name': item['name'], 'brand': brands.get(item['brand'], item['brand']),
           'sourceUrl': item['sourceUrl'], 'aliases': [], 'parameters': parameters}
    for source in picker + images:
        if legacy.get(source['slug']) == item['id'] or key(source['slug']) in (key(item['id']), key(item['name'])) or key(source['name']) in (key(item['id']), key(item['name'])):
            row['aliases'] += [source['slug'], source['name']]
    rows.append(row)
for source in picker + images:
    if not any(key(source['slug']) in [key(r['slug']), key(r['name'])] + [key(a) for a in r['aliases']] for r in rows):
        rows.append({'slug': source['slug'], 'name': source['name'], 'brand': '博坦' if source['slug'].startswith('potensic-') else 'DJI 大疆', 'sourceUrl': source.get('sourceUrl',''), 'aliases': [], 'parameters': []})

# Supplement with an offline snapshot of the exact official product pages.
snapshot = ROOT / 'artifacts/my-aircraft-official-specs.json'
if snapshot.exists():
    official = json.loads(snapshot.read_text(encoding='utf-8'))['models']
    for row in rows:
        if row['slug'] in official:
            row['parameters'] = official[row['slug']]['parameters']
            row['sourceUrl'] = official[row['slug']]['sourceUrl']

# Reviewed against DJI official specs 2026-10-27. Retain test conditions in values.
reviewed = {
 'dji-mini-4-pro': [('整机重量','< 249 g（标准电池）'),('最长飞行时间','34 min（标准电池）'),('最高速度','16 m/s（S挡、无风）'),('展开尺寸','298×373×101 mm（含桨）')],
 'dji-flip': [('整机重量','< 249 g'),('最长飞行时间','31 min'),('最高速度','12 m/s（S挡、无风）'),('抗风能力','10.7 m/s'),('展开尺寸','233×280×79 mm'),('影像传感器','1/1.3 英寸 CMOS'),('工作温度','-10～40°C')],
 'dji-air-3s': [('整机重量','724 g'),('最长飞行时间','45 min'),('最高速度','21 m/s（无风；欧盟19 m/s）'),('抗风能力','12 m/s'),('展开尺寸','266.11×325.47×106 mm（不含桨）'),('工作温度','-10～40°C')],
 'dji-inspire-3': [('整机重量','约 3995 g（含相机、镜头及双电池）'),('最大起飞重量','约 4310 g'),('最长飞行时间','28 min（起落架放下）'),('最高速度','94 km/h'),('抗风能力','起降12 / 飞行14 m/s'),('工作温度','-20～40°C')]
}
for row in rows:
    if row['slug'] in reviewed:
        row['parameters'] = [{'label': k, 'value': v} for k,v in reviewed[row['slug']]]
        row['sourceUrl'] = 'https://www.dji.com/' + row['slug'][4:] + '/specs'
    row['aliases'] = sorted(set(row['aliases']))
target = ROOT.parent / 'DiKongKong-Backend/src/main/resources/aircraft-catalog.json'
target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(rows)} models; {sum(bool(r["parameters"]) for r in rows)} with recorded product specifications')
