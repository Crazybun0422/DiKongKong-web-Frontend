# 涂鸦飞行 V21：发布与部署

## 发布顺序

1. 在 Web 工程执行 `npm run build`。官网、管理端、网页游戏进入 `dist/`；同时生成 `dist/resource-packages/drone-flight-v21-<hash>.zip`。
2. 部署现有 Java 后端的新 JAR，保持原有数据库、MinIO 和 `/api/` 代理配置。个人成就天梯和资源版本均由这个 Java 服务处理；启动时执行 `V12__drone_personal_achievements.sql`。
3. 将 `dist/` 中的网站文件部署到原网站根目录。例如网站 root 是 `/var/www/dikongkong`，则放置 `/var/www/dikongkong/index.html`、`admin/index.html`、`assets/`、`games/drone-race/index.html`。不要再套一层 `dist/`。
4. 登录 **管理端 → 设置 → 系统设置 → 涂鸦飞行资源**，选择 `dist/resource-packages/drone-flight-v21-<hash>.zip`，填写版本号（例如 `21.2.0`），上传后点击「启用此版本」。同一个 ZIP 同时包含 Android 与小程序资源，不用自行解压上传。
5. 编译、发布小程序和 Android 新版本。本次涉及入口、横屏和控制逻辑，已有安装版本需升级客户端；后续兼容的素材更新可仅上传并启用资源版本。

`resource-packages/` 是交付给管理端上传的产物，可以保留在本地，不必作为网站静态目录发布。无需为 Android、小程序资源新建 Nginx 静态路由。管理端上传后，服务端通过已有 `FileStorageService` 保存到现有 MinIO bucket，下载继续使用 `/api/files/download/{文件名}`。代理上传限制应允许至少 40 MB 的文件及 multipart 开销（如 `client_max_body_size 50m`）；原有配置足够时无需改动。

生产只启动原有 Java JAR，不需要独立 Node 服务。开发电脑仍使用 Node/npm 构建。Java 启动执行新增迁移 `V12__drone_personal_achievements.sql`；资源目录保存在现有 SystemSetting 的 `CONFIG_DRONE_FLIGHT_RESOURCES`，无需额外资源表迁移。

## 客户端行为

- Android、小程序入口都在「图层 → 共享位置」的**自己头像下方**。其他人的头像、地图标记和选中气泡没有游戏入口。
- 仅 Android、小程序游戏为横屏。打开后左侧画板、右侧飞行器预览，右下角「所有机型」打开轮播卡片；选择机型同步对应草图。目录包含 277 款机型、六条赛道。
- 方向操控默认左侧，加速/减速默认右侧；「换边」切换左右，并保存偏好。
- 进入时自动请求当前环境的资源版本，显示准备进度，完整下载、校验、解压后立即加载。失败继续使用已验证缓存或随客户端发布的内置资源；正常流程没有手动下载按钮。
- Android 在 APK 内置完整 HTML、脚本、音频与纹理，离线运行；小程序引擎和基础纹理随分包发布，在线更新包只含音频及纹理，不下载执行代码。小程序首次进入需要微信完成分包加载。
- 渲染按设备像素比设置画布，最高 DPR 3；提高预览及软件渲染分辨率，小程序按原生 Canvas 帧回调刷新。参考阿飞现有 Canvas 尺寸与资源加载机制；低性能手机仍需实际评估帧率。
- 网页保留原有页面布局和页面内机型轮播，支持手机竖屏滚动浏览，不应用原生客户端的横屏工作台或「所有机型」弹窗。三端飞行过程均在本地运行；Android 和小程序不建立房间、不匹配其他玩家、不连接游戏 WebSocket，也不发送过程状态。抵达终点或坠毁时提交一次最终结果，由 Java 幂等写入独立月度个人成就榜。

## 资源协议

| 接口 | 作用 |
| --- | --- |
| GET `/api/config/drone-flight-resources` | 管理员查询版本列表 |
| POST 同一路径，multipart `file`、`version` | 管理员上传完整发布 ZIP |
| POST `/api/config/drone-flight-resources/activate` | 管理员启用/回滚版本，body 为 `{ "version": "21.2.0" }` |
| GET `/api/config/drone-flight-resources/current?platform=mini&engineVersion=21` | 小程序查询当前可用版本；Android 使用 `platform=android` |
| GET `/api/files/download/{文件名}` | 现有文件下载接口 |
| POST `/api/drone-game/achievement` | 登录用户在本局自然结束后提交一次个人飞行成就 |
| GET `/api/drone-game/leaderboard` | 查询个人飞行成就榜 |
| GET `/api/drone-game/my-rank` | 查询当前登录用户的个人名次 |

资源接口返回现有 `ApiResponse` 格式。版本不能覆盖，只能新增或重新启用历史版本。外层包最多 40 MB，包含 `release.json`、`android.zip`、`mini.zip`；服务端上传前检查路径、每个文件大小/摘要、引擎兼容版本和平台内容。当前协议为 `engineVersion:21`、Android `uiRevision:3`、小程序 `uiRevision:2`、`apiContract:java-jwt-v1`。Android V21 客户端会拒绝旧的 UI2 下载包并使用 APK 内置 UI3 资源，避免旧服务器资源覆盖新布局。

小程序 `request` 和 `downloadFile` 合法域名都需包含当前环境的 **apiBase 域名**。不再从 guideAssetBase 或手工部署的 manifest URL 下载游戏资源。Android 也使用当前 apiBase 的 HTTPS 文件接口，账号 JWT 不进入游戏脚本。

## 构建同步与检查

`npm run build` 同时同步 Java 计算库到后端 `src/main/resources/drone-game/`，小程序引擎到 `miniprogram/packages/drone-game/engine/`，Android 离线资源到 `app/src/main/assets/drone-game/`。跨电脑可设置 `DRONE_JAVA_ROOT`、`DRONE_MINI_ROOT`、`DRONE_ANDROID_ASSETS`。引擎变更后重新编译 Java JAR。

- Web：`npm run check:drone-race`、`npm run build`；`node scripts/check-drone-game-layout.mjs` 验证网页桌面/竖屏布局及按钮操作、Android 横屏工作台与机型弹窗互不影响；`node scripts/check-drone-resources-ui.mjs` 检查编译后管理端 ZIP 上传及启用，使用隔离 API fixture。
- 后端：`DroneResourceServiceTest` 覆盖上传、校验、版本启用、回滚及管理员权限；设置 `-Ddrone.resource.package=<实际发布ZIP>` 可测试真实产物。游戏专项测试覆盖个人成就认证、UUID 幂等、一次结算和榜单隔离。
- 小程序：`check-drone-game.cjs`、`check-drone-game-entry.cjs`、`check-drone-game-page.cjs` 验证资源更新/回滚、仅自己头像的入口、横屏左右布局、轮播草图同步和控制换边。游戏分包约 1.052 MiB，低于 2 MiB。
- Android：`DroneGamePackageTest`、`check-drone-game-entry.cjs`、`check-drone-game-offline.cjs` 与设备测试 `DroneGameEntryDeviceTest`。

小程序截图是实际 Page.js/WXML/WXSS 的浏览器适配测试，不是微信真机截图；本机微信开发者工具 CLI 服务端口未开启，微信真机帧率与触控还需发布前验收。没有执行线上部署。

当前交付资源包以 `dist/resource-packages/` 中最新生成的 `drone-flight-v21-<hash>.zip` 为准。Android 设备测试验证自动 ZIP 下载、横屏、真实画布像素、机型选择、个人天梯、换边及返回。已处理 WebView 横屏后 CSS 视口高度为 0 的兼容问题，画布使用实际窗口尺寸。

本次样式范围修正仅隔离共享网页/Android 界面：网页恢复原有布局与触控按钮，Android 保留横屏及摇杆，小程序页面不变。已重新构建 dist、发布 ZIP 和 Android debug APK，并通过布局隔离与 APK 离线资源检查；上述 Android 设备测试是此前记录，本次未重新运行真机/模拟器。
