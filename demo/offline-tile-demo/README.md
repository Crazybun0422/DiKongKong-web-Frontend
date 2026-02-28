# 离线瓦片包加载与识别 Demo（纯 JS，非 Module）

## 文件结构
- `index.html`：演示页面
- `app.js`：页面交互（加载 zip、地图瓦片图层显示、点击识别）
- `offlineTileApi.js`：核心 API 封装（重点）
- `styles.css`：页面样式

## 运行方式
本 Demo 已改为非 module，可直接双击 `index.html` 打开。

推荐方式（更稳定）：
```bash
npx serve .
```
访问：
```text
http://localhost:3000/demo/offline-tile-demo/index.html
```

## 图层显示
- 加载 zip 后，Demo 会把离线瓦片挂到腾讯地图 `overlayMapTypes`，显示为真实瓦片图层
- 不再绘制导出多边形遮罩

## 识别规则
- 未加载离线包：显示 `未加载`
- 点击像素透明（Alpha <= 16）：判定 `管制区`
- 点击像素非透明（Alpha > 16）：判定 `适飞区（120M）`

## UOM KML 导出/导入
- `导出当前层级 UOM`：按当前地图缩放层级提取着色区（`Alpha > 16`）边界，导出为 `KML`（`GCJ-02`）
- 可通过 `导出精度（最大分段，米）` 输入框设置导出精度（例如 `0.5`、`1`、`0.2`）
- 导出结果会自动填充到 `KML 文本` 文本框，并同时下载 `.kml` 文件
- 边界坐标按输入的“最大分段间距（米）”细分；实际几何精度仍受原始瓦片分辨率限制
- `导入 KML 并绘制`：支持从 `KML 文本` 或 `KML 文件` 导入并在地图上绘制区域

## 坐标类型
- 默认 `GCJ-02`
- 支持 `WGS84` 输入并自动转换为 `GCJ-02` 后再判定

## QQ 地图 Key
当前使用项目中的 key：
- `YJTBZ-5EBCT-SBAXN-VRUYM-SUXR7-O6FX4`
