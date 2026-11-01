# 适飞区图层 API 接入文档

文档版本：V2.0
更新时间：2026-08-10

## 1. 服务地址与鉴权

服务地址：

```text
https://skylane.cn/api/open/v1/suitable-fly-zone
```

所有接口都由业务后端直接提供，不经过静态资源 CDN。每次请求必须携带 B 端“API 接入管理”生成的 AuthToken：

```http
Authorization: Bearer <AuthToken>
```

示例：

```bash
curl \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  'https://skylane.cn/api/open/v1/suitable-fly-zone/catalog'
```

AuthToken 不得放在 URL 或日志中。受控联调页面可以使用 `fetch + Authorization` 获取 PNG Blob 后交给地图组件渲染；这会让 AuthToken 进入浏览器运行时，仅适用于测试。正式公开页面建议使用短期凭证或由调用方自己的后端/API 网关转发。

## 2. 图层切换规则

| 地图缩放级别 | 数据形式 | 处理方式 |
| --- | --- | --- |
| `zoom < 4` | 不加载 | 清除适飞区图层 |
| `4 ≤ zoom ≤ 13` | PNG XYZ 瓦片 | 使用目录接口返回的 `urlTemplate` |
| `zoom > 13` | KML 矢量瓦片 | 查询当前可视区域并绘制 Polygon/LineString |

`zoom = 13` 使用 PNG，`zoom = 14` 开始使用 KML。PNG 与 KML 坐标均为 WGS84；目标地图使用 GCJ-02 时，应在计算或绘制前完成坐标转换。

## 3. 获取 PNG 图层目录

### 请求

```http
GET /api/open/v1/suitable-fly-zone/catalog
Authorization: Bearer <AuthToken>
```

### 响应示例

```json
{
  "success": true,
  "message": {
    "en": "okay",
    "zh": "操作成功"
  },
  "data": {
    "version": "20260517",
    "tileCoordSystem": "WGS84",
    "routePrefix": "https://skylane.cn/api/open/v1/suitable-fly-zone/tiles",
    "layers": [
      {
        "layerKey": "collected_exact_geojson_merged_geojson_tiles",
        "minZoom": 4,
        "maxZoom": 13,
        "tileSize": 256,
        "variants": [
          {
            "color": "current",
            "directoryName": "collected_exact_geojson_merged_geojson_tiles_current",
            "urlTemplate": "https://skylane.cn/api/open/v1/suitable-fly-zone/tiles/collected_exact_geojson_merged_geojson_tiles/current/{z}/{x}/{y}.png"
          }
        ]
      }
    ]
  }
}
```

客户端不得硬编码 `version`、图层目录或颜色列表，应以目录响应为准。默认颜色可选择 `color=current`；找不到时选择 `variants[0]`。

## 4. 获取 PNG 瓦片

使用目录返回的 `urlTemplate` 替换 `{z}`、`{x}`、`{y}`，并继续携带 AuthToken：

```http
GET /api/open/v1/suitable-fly-zone/tiles/{layerKey}/{variant}/{z}/{x}/{y}.png
Authorization: Bearer <AuthToken>
```

示例：

```bash
curl \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  'https://skylane.cn/api/open/v1/suitable-fly-zone/tiles/collected_exact_geojson_merged_geojson_tiles/current/13/6665/3425.png' \
  --output tile.png
```

成功响应：

```http
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: private, max-age=3600
```

瓦片使用标准 Web Mercator XYZ 编号，`y` 从北向南递增，不是 TMS。

经纬度转 XYZ：

```javascript
function lonLatToTile(lng, lat, zoom) {
  const n = 2 ** zoom;
  const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const latRad = safeLat * Math.PI / 180;
  return {
    x: Math.floor((lng + 180) / 360 * n),
    y: Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    )
  };
}
```

## 5. 按可视区域查询 KML

### 请求

```http
GET /api/open/v1/suitable-fly-zone/kml/tiles
Authorization: Bearer <AuthToken>
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `minLng` | number | 是 | WGS84 西南角经度 |
| `minLat` | number | 是 | WGS84 西南角纬度 |
| `maxLng` | number | 是 | WGS84 东北角经度 |
| `maxLat` | number | 是 | WGS84 东北角纬度 |
| `layerKey` | string | 否 | 不传时使用当前默认 KML 图层 |
| `limit` | integer | 否 | 返回上限，建议 `48` |

示例：

```bash
curl \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  'https://skylane.cn/api/open/v1/suitable-fly-zone/kml/tiles?minLng=112.90&minLat=28.20&maxLng=112.96&maxLat=28.26&limit=48'
```

建议将当前视口四周额外扩展约 60%，并在视口稳定约 180ms 后查询，减少拖动过程中的重复请求。

### 响应示例

```json
{
  "success": true,
  "message": {
    "en": "okay",
    "zh": "操作成功"
  },
  "data": {
    "version": "20260517",
    "layerKey": "geojson_kml_tiles/tile13",
    "tileZoom": 13,
    "matchedTileCount": 1,
    "returnedTileCount": 1,
    "tiles": [
      {
        "z": 13,
        "x": 6665,
        "y": 3425,
        "relativePath": "13/6665/3425.kml",
        "url": "https://skylane.cn/api/open/v1/suitable-fly-zone/kml/13/6665/3425.kml?layerKey=geojson_kml_tiles%2Ftile13",
        "downloadUrl": "https://skylane.cn/api/open/v1/suitable-fly-zone/kml/13/6665/3425.kml?layerKey=geojson_kml_tiles%2Ftile13",
        "fileSize": 2507,
        "featureCount": 2,
        "bbox": {
          "minLng": 112.8955078125,
          "minLat": 28.22697003891833,
          "maxLng": 112.939453125,
          "maxLat": 28.265682390146473
        }
      }
    ]
  }
}
```

`tileZoom=13` 是 KML 文件的存储网格级别，不是当前地图必须使用的缩放级别。当 `matchedTileCount > returnedTileCount` 时，应缩小查询范围。

## 6. 按中心点附近查询 KML

```http
GET /api/open/v1/suitable-fly-zone/kml/tiles/nearby
Authorization: Bearer <AuthToken>
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `longitude` | number | 是 | WGS84 中心经度 |
| `latitude` | number | 是 | WGS84 中心纬度 |
| `radiusMeters` | number | 是 | 查询半径，建议 `5000` |
| `layerKey` | string | 否 | 不传时使用默认图层 |
| `limit` | integer | 否 | 返回上限，建议 `48` |

```bash
curl \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  'https://skylane.cn/api/open/v1/suitable-fly-zone/kml/tiles/nearby?longitude=112.928&latitude=28.228&radiusMeters=5000&limit=48'
```

## 7. 下载 KML 文件

直接请求查询响应中的 `tiles[].url`，每个文件请求都必须携带 AuthToken：

```bash
curl \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  'https://skylane.cn/api/open/v1/suitable-fly-zone/kml/13/6665/3425.kml?layerKey=geojson_kml_tiles%2Ftile13' \
  --output 3425.kml
```

成功响应：

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.google-earth.kml+xml
Cache-Control: private, max-age=3600
```

KML 处理建议：

1. 按 UTF-8 XML 解析。
2. 读取 `Polygon`、内环和 `LineString`。
3. 坐标为 WGS84；目标地图使用 GCJ-02 时先转换。
4. 使用 `z/x/y` 作为缓存键，建议最多缓存 96 个已解析文件。
5. 单个 KML 加载失败时不要阻塞其他文件。

## 8. 完整调用逻辑

```javascript
const API_BASE = 'https://skylane.cn/api/open/v1/suitable-fly-zone';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function apiFetch(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

async function refreshSuitableFlyZone({ zoom, bounds }) {
  if (zoom < 4) {
    clearSuitableFlyZoneLayers();
    return;
  }

  if (zoom <= 13) {
    const catalogBody = await (await apiFetch(`${API_BASE}/catalog`)).json();
    const layer = catalogBody.data.layers[0];
    const variant = layer.variants.find(item => item.color === 'current') || layer.variants[0];
    renderAuthenticatedPngTiles(variant.urlTemplate, AUTH_TOKEN);
    clearKmlGraphics();
    return;
  }

  const params = new URLSearchParams({ ...bounds, limit: '48' });
  const result = await (await apiFetch(`${API_BASE}/kml/tiles?${params}`)).json();
  const resources = await Promise.all(
    result.data.tiles.map(async tile => parseKml(await (await apiFetch(tile.url)).text()))
  );
  renderKmlGraphics(resources);
  clearPngTiles();
}
```

示例代码默认运行在服务端。受控联调页面也可以直接执行 `apiFetch`；PNG 需要先通过带 Authorization 的 `fetch` 获取 Blob URL，不能直接把受保护 URL交给不支持自定义 Header 的图片组件。

## 9. 状态码

| HTTP 状态码 | 场景 | 处理建议 |
| --- | --- | --- |
| `200` | 请求成功 | 继续处理目录、PNG 或 KML |
| `400` | 参数缺失或格式错误 | 检查经纬度、范围和 `limit` |
| `401` | AuthToken 缺失或无效 | 检查 Authorization 请求头 |
| `403` | AuthToken 对应服务已到期 | 联系服务方续期 |
| `404` | 图层或瓦片不存在 | 视为空瓦片，不要无限重试 |
| `500` | 服务内部异常 | 记录请求时间和坐标后联系服务方 |

## 10. 接入检查清单

- [ ] 所有请求均访问 `https://skylane.cn/api/open/v1/suitable-fly-zone/**`。
- [ ] 所有请求均携带 `Authorization: Bearer <AuthToken>`。
- [ ] AuthToken 没有出现在 URL 和日志中；正式公开页面没有暴露长期 Token。
- [ ] 启动时读取目录，未硬编码版本和图层目录。
- [ ] `zoom=13` 使用 PNG，`zoom=14` 开始使用 KML。
- [ ] PNG 使用 XYZ 编号，未将 `y` 当成 TMS。
- [ ] WGS84 与目标地图坐标系之间已正确转换。
- [ ] KML 查询设置了合理缓冲区、请求防抖和 `limit`。
- [ ] 已处理 `401`、`403`、`404` 和单瓦片加载失败。
