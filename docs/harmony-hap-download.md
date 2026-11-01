# 鸿蒙官网测试包下载

管理端 → 系统设置 → 鸿蒙 → **HarmonyOS 测试安装包**，上传 HAP 后自动选为当前版本。官网主页的“鸿蒙”页签读取该版本，显示版本号、体积及“下载鸿蒙 HAP”按钮。管理员切换历史版本时，官网也使用所选版本；刷新主页或重新点击鸿蒙页签即可获取最新选择。

下载入口与 Android APK 相互独立，不把鸿蒙请求回退为 APK。没有已发布包时显示“鸿蒙安装包尚未发布”；接口失败时允许重试，不生成占位链接。明确包含原生 HarmonyOS/OpenHarmony 且不含 Android 的浏览器标识默认选中鸿蒙页签，其他设备可手动切换。

使用现有公开接口：

- `GET /api/harmony/app-releases/latest`：读取当前选中的版本，禁止缓存。
- `GET/HEAD /api/harmony/app-releases/{id}/versions/{versionCode}/{sha256}.hap`：下载对应版本，支持 Range/If-Range 断点续传。
- 管理员上传 `POST /api/harmony/app-releases`、切换 `PUT /api/harmony/app-releases/{id}/active` 仍需登录授权。

当前项目 HAP 最低 API 12，适用 HarmonyOS 5.0 及以上手机、平板。安装受签名与设备授权限制，下载不代表任意手机均可直接安装。微信内显示浏览器打开提示并可复制该版本的下载地址；iPhone/iPad 提示使用小程序。正式用户分发需遵循华为应用分发要求。

后端沿用现有鸿蒙发布链路和对象存储配置；代理上传体积及断点续传配置见 [安装包部署说明](android-apk-download.md)。发布本次前端后，上传/选中的 HAP 就可由官网直接下载，无需另外改首页链接。
