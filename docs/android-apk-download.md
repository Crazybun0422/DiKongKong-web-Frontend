# Android 公测安装包

管理端 → 系统设置 → Android → **Android 公测安装包**，选择 APK 后点击“上传并发布”。版本号、versionCode 和包名读取自安装包，上传成功后官网自动显示最新版、体积和下载按钮。每次发布须提高 Android 工程 `app/build.gradle.kts` 中的 `versionCode`；`versionName` 为展示版本。旧包保留，版本地址不变，可断点续传。

后端升级后 Flyway 自动执行 `V8__android_app_release.sql`，无需手工建表。安装包存放在 MinIO 的 `android-apks` 桶（可用 `minio.android-apk-bucket` 配置），上传时自动创建；版本记录存放在 MySQL。应同时保留数据库及对象存储。尚未上传时官网明确显示“安装包即将上线”，不会下载占位文件。

上传需要管理端登录；`GET /api/android/app-releases/latest` 和 `GET/HEAD /api/android/app-releases/{id}/download` 为公开下载接口。最大 APK 350 MB，服务端检查实际包名 `cn.llplanet.lowlatitudeplanet` 并记录 SHA-256。上传失败或重复 versionCode 不会替换当前下载版本。

若站点前方使用 Nginx，**在现有 `/api/` 代理配置中**合入以下设置，保留原有 `proxy_pass`、请求头及其他业务路由，不新建同名 location：

```nginx
client_max_body_size 400m;
client_body_timeout 600s;
proxy_send_timeout 600s;
proxy_read_timeout 600s;
```

同时检查 CDN/WAF 的上传体积限制。前端源码无法修改线上代理配置；否则大文件可能被代理以 413 拒绝，尚未到达后端。下载接口须保留 `Range` / `If-Range` 请求头及 `Content-Disposition` / `Content-Range` 响应头。

Android 浏览器直接下载 APK；微信内提示在系统浏览器打开；iPhone/iPad 提示仅支持 Android。iOS 入口仍为筹备中，鸿蒙使用独立的 [HAP 下载入口](harmony-hap-download.md)。下载后由 Android 系统确认安装，网页不会自动绕过系统安装授权。
