# ll-planet 离线地图包使用文档

本文档针对首页导出的 `ll-planet_*.zip` 离线瓦片包，说明如何直接加载该包，以及如何判定：
- 管制区（透明区域）
- 适飞区（120m，蓝色区域）

## 1. 包格式与目录

导出 zip 示例：
- `ll-planet_z9_lng121.2454-121.6793_lat30.7506-30.9910_n368_20260225_180012.zip`
- `ll-planet_z6-18_lng121.2454-121.6793_lat30.7506-30.9910_n5120_20260225_180945.zip`

解压后目录示例：

```text
ll-planet_z6-18_lng121.2454_121.6793_lat30.7506_30.9910/
  metadata.json
  z6/
    x52/
      y26.png
  z7/
  ...
  z18/
```

关键规则：
- 根目录前缀固定 `ll-planet_`
- 瓦片路径固定 `z{z}/x{x}/y{y}.png`

## 2. metadata.json 字段

公共字段：
- `type`: `ll-planet-offline-tiles`
- `generatedAt`: 生成时间
- `rootDir`: 根目录
- `filePattern`: `rootDir/z{z}/x{x}/y{y}.png`
- `polygon`: 导出多边形（GCJ-02）
- `bounds`: 导出包围盒（GCJ-02）

单级包：
- `zoom`
- `tileSummary`: `attempted/downloaded/failed/truncated`
- `tiles`: 每瓦片信息（`x/y/z/path/size/bounds`）

连续包（6-18）：
- `zoomRange`: `{ start, end }`
- `tileSummary.levels`: 每级统计

## 3. 坐标系与缩放说明

- 当前包按 `GCJ-02`（腾讯地图坐标）导出。
- 瓦片索引采用 Web Mercator 标准 `z/x/y`。
- 若在非 GCJ-02 底图直接叠加，可能出现偏移。

## 3.1 商用必选项：非 GCJ-02 必须先转换

商用接入时，输入坐标如果不是 `GCJ-02`，必须先转换，再参与：
- 瓦片索引计算（`z/x/y`）
- 点位像素判定（透明/适飞）
- 管制区与适飞区业务判断

否则不允许进入判定流程。建议直接抛错并记录日志。

```js
// 伪代码：统一入口，强制坐标系归一
function normalizeToGcj02({ lng, lat, coordType }) {
  if (coordType === 'GCJ02') return { lng, lat };
  if (coordType === 'WGS84') {
    // 使用项目现有坐标工具：wgs84ToGcj02
    return wgs84ToGcj02(lng, lat);
  }
  throw new Error(`Unsupported coordType: ${coordType}`);
}
```

推荐落地规则：
- `coordType` 必填（`GCJ02 | WGS84`）
- 缺失 `coordType` 时直接拒绝
- 禁止“猜坐标系”自动判定
- 记录原始坐标、转换后坐标、转换来源，便于审计

## 4. 如何加载 zip 包

## 4.1 浏览器内直接加载（推荐）

依赖：`jszip`

```js
import JSZip from 'jszip';

export async function openOfflinePack(file) {
  const zip = await JSZip.loadAsync(file);
  const metadataEntry = Object.values(zip.files).find((f) => /metadata\.json$/i.test(f.name));
  if (!metadataEntry) throw new Error('metadata.json not found');
  const metadata = JSON.parse(await metadataEntry.async('string'));
  return { zip, metadata };
}

export async function readTileBlob(zip, metadata, z, x, y) {
  const path = metadata.filePattern
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const entry = zip.file(path);
  if (!entry) return null;
  return await entry.async('blob');
}
```

## 4.2 作为地图图层加载

思路：
1. 打开 zip，读取 `metadata.json`
2. 地图请求某个 `z/x/y` 时，从 zip 读取 `z/x/y.png`
3. 用 URL.createObjectURL(blob) 交给地图 SDK 作为瓦片 URL

说明：连续包可直接按当前缩放级别请求对应 `z` 目录。

## 5. 如何判定“管制区 / 适飞区（120m）”

当前实现的核心判定依据是 **像素透明度 alpha**：
- `alpha <= 16`：透明区域，判定为管制区/非适飞
- `alpha > 16`：有效覆盖区域，判定为适飞区（限高 120m）

该阈值与首页现有逻辑一致。

## 5.1 点位转瓦片与像素

输入：GCJ-02 点位 `(lng, lat)` 与缩放 `z`

```js
function lonLatToTileXY(lng, lat, z) {
  const scale = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * scale);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale);
  return { x, y };
}

function tileXYToLonLatBounds(x, y, z) {
  const n = Math.pow(2, z);
  const lngLeft = (x / n) * 360 - 180;
  const lngRight = ((x + 1) / n) * 360 - 180;
  const latTopRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latBottomRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return {
    latTop: (latTopRad * 180) / Math.PI,
    latBottom: (latBottomRad * 180) / Math.PI,
    lngLeft,
    lngRight,
  };
}

function lonLatToPixelInTile(lng, lat, tileBounds, size = 256) {
  const u = (lng - tileBounds.lngLeft) / (tileBounds.lngRight - tileBounds.lngLeft);
  const v = (tileBounds.latTop - lat) / (tileBounds.latTop - tileBounds.latBottom);
  const px = Math.min(size - 1, Math.max(0, Math.round(u * (size - 1))));
  const py = Math.min(size - 1, Math.max(0, Math.round(v * (size - 1))));
  return { px, py };
}
```

## 5.2 像素判定（透明=管制，非透明=适飞120m）

```js
async function judgeAreaByPixel(zip, metadata, lng, lat, z) {
  const { x, y } = lonLatToTileXY(lng, lat, z);
  const blob = await readTileBlob(zip, metadata, z, x, y);
  if (!blob) return { ok: false, reason: 'tile not found' };

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, 256, 256);

  const bounds = tileXYToLonLatBounds(x, y, z);
  const { px, py } = lonLatToPixelInTile(lng, lat, bounds, 256);
  const data = ctx.getImageData(px, py, 1, 1).data; // [r,g,b,a]
  const alpha = data[3];

  if (alpha > 16) {
    return { ok: true, area: '适飞区', heightLimit: 120, color: 'blue', rgba: data };
  }
  return { ok: true, area: '管制区/非适飞', rgba: data };
}
```

补充：
- “蓝色区域”通常可从 `rgba` 看到蓝通道更高，但生产判定建议以 `alpha` 为主。
- 若需要“颜色兜底”，可附加：`b > r && b > g && alpha > 16`。

## 6. 连续包（6-18）使用建议

- 默认按地图当前缩放级别读取对应 `z` 目录。
- 当当前缩放超出导出范围时：
  - 小于最小级：使用 `start`
  - 大于最大级：使用 `end`
  - 或使用最近级别（nearest zoom）策略

## 7. 排查建议

- 判定总是“管制区”：
  - 检查坐标是否 GCJ-02
  - 检查读到的瓦片是否正确（`z/x/y`）
  - 检查 `alpha` 阈值是否改动
- 图层偏移：
  - 检查底图坐标系是否与 GCJ-02 一致
  - 检查缩放级别与瓦片索引是否一一对应

---

低空星球拥有最终解释权。
