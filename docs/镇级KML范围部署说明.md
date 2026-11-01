# 镇级 KML 范围

## 使用

1. 更新后端 JAR、管理端 `dist`、Android APK；小程序更新后需按原流程发布。
2. 管理端「设置 → 系统设置 → 镇级 KML 范围」上传：
   `D:\镇级geo\china_geo_data-main_GCJ02_KML.zip`。
3. 填写版本，例如 `2026.10.02`；这份已经转换过的 ZIP **选择 GCJ-02**。
4. 上传进度到 100% 后，还需等待服务器拆分校验结束。只有全部成功后才切换到新版本，失败保留原版本。
5. 临时禁飞区编辑区点击「加载镇级范围」，依次选择省、市、县、镇；也可以搜索镇名、街道名，或输入“县名 镇名”组合查询。搜索覆盖整个当前版本，结果显示省市县归属并分页，不下载边界。选中结果才下载；加载是草稿操作，填写有效期等信息并点击保存才发布。
6. 小程序和 Android 的图层面板开启「行政区范围高亮」，沿同一棵省 → 市 → 县 → 镇目录展开，不再设置单独的镇级入口。点击县或镇只暂存选择，底部固定确认栏显示待选范围；点击「确定加载」才下载县/镇边界并应用。目录接口不返回边界，不下载全国镇级 ZIP。

全包测试：46,516 个 KML → 43,655 个唯一乡镇（原包区县汇总和单镇文件重复），46,912 个目录节点。名称和目录来自数据源，不自行推断行政区代码。

## 服务端存储与代理

- 配置项：`town-kml.root`，环境变量可用 `TOWN_KML_ROOT`。
- 默认存储位置：后端运行工作目录下的 `data/town-kml`。请使用持久化目录；Docker 部署需要将此目录挂载为持久卷，避免换容器丢失资源。
- 这里存储当前索引、按发布批次 UUID 分目录的镇级 JSON。保留旧版本，以便已经展开旧目录的用户继续下载对应边界；不要手工删除当前版本。
- 用户上传 ZIP 后由服务器自动拆分，不需要把 KML 手工放进 Web `dist`。
- 每次成功上传生成新的 revision，即便显示版本号相同，也不会误用旧缓存。
- 此包约 384 MiB。Spring 现有 multipart 单文件和请求限制均为 400 MB，可接收此包。若前置 Nginx 限制更小，需要为上传接口允许至少 400 MB 的请求；建议 `client_max_body_size 450m`、`proxy_read_timeout 1800s`，同时检查网关的上传/请求超时。
- 上传时保留压缩包临时文件，边解析边写单镇数据。转换成功或失败都会清理临时 ZIP；失败批次不会替换已发布批次。
- 同一后端实例同时只能处理一个镇级上传，重复上传返回 409。此实现面向当前单实例资源服务；多实例部署需要共享持久卷并指定一个实例处理上传，不能并行写同一个目录。

## 接口

所有接口使用现有 `Authorization: Bearer ...`。上传仅 ADMIN；查询允许 ADMIN / OPERATOR 和已登录小程序、Android 用户。

| 方法 | 地址 | 参数与结果 |
| --- | --- | --- |
| POST | `/api/config/town-kml` | multipart：`file` ZIP、`version`、`coordinateSystem`（GCJ02/WGS84），返回版本、revision、townCount |
| GET | `/api/config/town-kml` | 当前版本，不下载边界 |
| GET | `/api/town-regions` | `parentId`（根目录传空）、`revision`（根可省略），返回该级目录 |
| GET | `/api/town-regions/search` | `keyword`（最多80字，空格或斜杠分隔的词全部匹配）、`revision`、`page`（从0开始）、`size`（默认30，最多100）；返回 items（含完整 path）、total、revision，不含边界 |
| GET | `/api/town-regions/{id}/geometry` | `revision`，返回单县/单镇 JSON，坐标均为 GCJ02 |

县级范围按该县已入库的乡镇边界在服务器合并，去除内部公共边，首次选择县时生成并原子缓存。已上传的版本无需重传；重启后复用缓存。新增 `/api/town-regions/{id}/ancestors` 返回当前版本的祖先目录，供恢复已确认的县/镇选择。

目录结果用现有 `success/message/data` 封装。geometry 返回直接 JSON：`id/name/revision/coordinateSystem/polygons/parts`；polygons 保留外环与内环，parts 为适配绘制和禁飞区编辑器的不含洞片段，避免将内环误填为禁飞区。

ZIP 支持先前生成的 KML（ExtendedData 中有省、市、县、乡）；也支持 `省/市/县/镇.kml` 目录和 Placemark 名称。KML 有显式坐标系时必须与上传选择一致，不会重复偏移。WGS84 只在服务器转换一次。

## 客户端缓存

两端共享 `utils/town-regions.js`，Android 由 `sync-mini-parity.cjs` 同步到自己的资源包。
镇级边界写入应用文件缓存，文件名包含 revision 和镇 ID。重复选择复用缓存；下载中的相同请求合并；失败可重试；缓存限制为当前版本最多 20 个镇，下载新版本时清理旧缓存。快速切换或关闭图层时，过期响应不覆盖当前地图。

## 验证

- 后端 `TownKmlServiceTest`、`TownKmlControllerTest`：真实整包、去重、内环、重启恢复、鉴权、并发上传、失败保持原版本、旧版本读取、坐标系与 XML 安全。
- Web：`node scripts/check-town-regions.mjs`。
- 小程序：`node scripts/check-town-regions.cjs`、`npm run check:px`，官方 WXML 编译器检查图层组件。
- Android：`node scripts/check-town-regions.cjs`、原省市高亮回归检查；覆盖手机与桌面宽度的目录交互和原生地图桥接。未进行实体手机验收。
