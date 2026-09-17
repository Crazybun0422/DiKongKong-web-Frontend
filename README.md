# 低空星球官网与管理端

## 开发和构建

```bash
npm install
npm run dev
npm run build
npm run preview
```

- 官网：`http://127.0.0.1:5173/`
- 管理端：`http://127.0.0.1:5173/admin/`，未登录会进入 `/admin/login`。
- 生产包预览：`http://localhost:4173/`（以命令输出端口为准）。

官网从 `low-altitude-planet-source-v4/low-altitude-planet/dist/` 导入，现由项目统一维护：

- `index.html`：官网页面、管理端入口和底部备案链接。
- `src/landing/app.js`、`src/landing/style.css`：官网交互和样式。
- `src/landing/assets/`：官网 Logo、小程序码、视频和备用动图；替换素材后重新构建。
- `admin/index.html`、`src/main.js`：原 Vue 管理端入口；路由统一位于 `/admin/` 下。

原始素材包作为参考保留；后续修改以上已接入的文件。普通构建不需要 Python 或 FFmpeg，也不需要重新渲染视频。Vite 每次构建都会处理官网与管理端两套入口，将页面引用的图片、视频、CSS 和 JavaScript 输出到根目录 `dist/assets/`，并添加内容哈希用于资源版本更新。

## 部署目录

将**项目根目录构建出的 `dist/` 内全部内容**上传到域名对应的网站根目录，保留目录结构。不是上传原始素材包的 `dist/`，也不是只上传管理端文件。

例如 Nginx 的站点根目录为 `/var/www/dikongkong`：

```text
/var/www/dikongkong/
├── index.html                  # 官网，访问 /
├── admin/
│   └── index.html              # 管理端页面入口
├── assets/                     # 两个页面的全部构建资源（保留构建后的文件名）
└── logo_full_hollow_square.ico
```

即 `dist/assets/` 应部署到 `/var/www/dikongkong/assets/`，`dist/admin/index.html` 应部署到 `/var/www/dikongkong/admin/index.html`。素材源码、原始视频和动画渲染脚本不需要单独上传。不要把整个 `dist` 文件夹嵌套成网站根目录下的 `/dist/`。当前配置按域名根路径部署。

## Nginx 路由配置

管理端使用 History 路由，必须让 `/admin/login`、`/admin/settings` 等地址回退到 `/admin/index.html`，否则直接打开或刷新管理端子页面会出现 404。

将以下静态站点配置合入现有站点的 `server` 块，保留现有域名、HTTPS、后端 `/api/`、WebSocket `/ws` 和地图 `/tmap` 代理配置：

```nginx
root /var/www/dikongkong;
index index.html;

location = /admin {
    return 301 /admin/$is_args$args;
}

location /admin/ {
    try_files $uri $uri/ /admin/index.html;
}

location /assets/ {
    try_files $uri =404;
}

location / {
    try_files $uri $uri/ =404;
}
```

确保 Nginx 的 `http` 块已包含 `include mime.types;`，使 JS、CSS、MP4、WebP 等资源返回正确的类型。官网管理端按钮进入 `/admin/`；已有登录状态时进入原管理首页，未登录时进入登录页。原后台 `/login`、`/settings` 等地址现对应 `/admin/login`、`/admin/settings`，已有收藏或外部链接需同步更新。

底部备案号为 `苏ICP备2025183953号-2`，点击在新标签页打开 `https://beian.miit.gov.cn/`。

管理端生产接口仍请求同域 `/api`；开发代理默认指向 `http://localhost:7010`，可用 `VITE_DEV_API_PROXY_TARGET` 覆盖。仅部署静态 `dist/` 不会启动后端服务。
