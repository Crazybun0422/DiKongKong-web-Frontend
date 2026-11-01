"""Refresh a local snapshot from existing official DJI specification URLs.
Run manually; no client or server startup depends on external product sites.
"""
import concurrent.futures
import datetime
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT.parent / 'DiKongKong-Backend/src/main/resources/aircraft-catalog.json').read_text(encoding='utf-8'))
labels = {'Takeoff Weight':'整机重量', 'Weight (with propellers)':'整机重量', 'Aircraft Weight':'整机重量', 'Weight':'整机重量',
          'Max Takeoff Weight':'最大起飞重量', 'Dimensions':'尺寸', 'Max Flight Time':'最长飞行时间',
          'Max Flight Speed':'最高速度', 'Max Horizontal Speed':'最高速度', 'Maximum Speed':'最高速度',
          'Max Wind Speed Resistance':'抗风能力', 'Max Wind Resistance':'抗风能力',
          'Max Ascent Speed':'最大上升速度', 'Max Descent Speed':'最大下降速度',
          'Operating Temperature':'工作温度', 'Operating Temperature Range':'工作温度', 'Image Sensor':'影像传感器'}
def clean(value):
    value = re.sub(r'<sup\b[^>]*>.*?</sup>', '', value, flags=re.S | re.I)
    value = re.sub(r'<br\s*/?>', ' / ', value, flags=re.I)
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', '', value)).replace('\u200c', '').split()).strip(' /')
def fetch(row):
    url = row['sourceUrl']
    try:
        request = urllib.request.Request(url, headers={'Accept-Language':'en-US,en;q=0.9','User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=18) as response:
            final = response.url
            if not re.match(r'https://(?:www\.)?dji.com/', final):
                return row['slug'], None
            source = response.read(4 * 1024 * 1024).decode('utf-8')
        parameters = []
        used = set()
        for block in re.findall(r'<ul\b[^>]*class="detailed-parameter-list"[^>]*>(.*?)</ul>', source, re.S):
            heading = re.search(r'<h4[^>]*>(.*?)</h4>', block, re.S)
            content = re.search(r'<div\b[^>]*class="detailed-parameter-value"[^>]*>(.*?)</div>', block, re.S)
            if not heading or not content:
                continue
            label = labels.get(clean(heading.group(1)))
            value = clean(content.group(1))
            # Never truncate away variant/test-condition qualifiers.
            if label and label not in used and 0 < len(value) <= 260:
                parameters.append({'label':label, 'value':value})
                used.add(label)
        return row['slug'], {'sourceUrl':final, 'parameters':parameters} if parameters else None
    except Exception as error:
        return row['slug'], None

target = ROOT / 'artifacts/my-aircraft-official-specs.json'
snapshot = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'models':{}}
sources = [r for r in catalog if re.match(r'https://www\.dji\.com/', r['sourceUrl']) and r['sourceUrl'].endswith('/specs')]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for slug, result in pool.map(fetch, sources):
        if result:
            snapshot['models'][slug] = result
snapshot['checkedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Official specifications recorded for', len(snapshot['models']), 'models')
