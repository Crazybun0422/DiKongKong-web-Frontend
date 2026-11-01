# 低空星球主页 · 完整代码包

对应当前发布的第 4 版：星球转动、无人机独立环绕与旋翼动画，接入横向地图实录，16 秒自动循环。

## 内容

- `dist/`：可直接部署的完整网站。`index.html` 为页面，`style.css` 为样式，`app.js` 为交互，`assets/` 为 Logo、小程序码、视频与备用动图。
- `source/`：动画分层素材、旋翼坐标和你提供的原始 MP4。
- `scripts/render-hero-v4.py`：当前版本的动画生成脚本。
- `requirements-render.txt`：重新生成动画时所需的 Python 库。
- `SHA256SUMS.txt`：包内文件校验值。

网站是原生 HTML/CSS/JavaScript，不需要安装 Node.js，也不需要 npm 构建。所有页面素材均已包含，不依赖外部 CDN。

## 本地预览

解压后，在本目录打开终端执行：

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Windows 如使用 Python Launcher，可把 `python` 改为 `py`。

浏览器打开 http://127.0.0.1:8000 。预览网站不需要安装下面的动画生成依赖。

## 部署

把 `dist/` 内的全部文件及 `assets/` 文件夹上传到网站根目录即可，可使用 Nginx、Apache、静态托管等。

上传后，网站根目录应直接包含 `index.html`、`style.css`、`app.js` 和 `assets/`，保持它们的相对路径。

## 配置管理端登录

编辑 `dist/app.js` 顶部：

```js
const ADMIN_LOGIN_URL = '';
```

把空字符串改成你真实的 HTTPS 管理端登录地址。例如：

```js
const ADMIN_LOGIN_URL = 'https://admin.example.com/login';
```

地址为空时，入口显示“管理端入口暂未开放”。代码包包含跳转入口，没有管理后台、账号数据库或登录认证服务。

## 修改下载提示及小程序码

- Android 下载提示：修改 `dist/index.html` 中的 `download-dialog`。
- Logo：替换 `dist/assets/logo.png`。
- 小程序码：替换 `dist/assets/miniprogram-code.jpg`；保持名称可直接生效。

## 动画说明与重新生成

页面播放已经合成好的视频 `dist/assets/orbit-and-map-v4.mp4`，并使用 `orbit-and-map-fallback-v4.webp` 作为视频无法自动播放时的循环备用画面。动画采用分层图像合成；网站不包含可实时交互的三维模型。

直接部署不需要重新生成视频。如需修改星球转动、无人机轨迹、旋翼、地图裁剪或时间安排，可编辑 `scripts/render-hero-v4.py`。

运行环境需要 Python，以及系统 PATH 中可执行的 FFmpeg（支持 libx264 和 libwebp_anim）。首次安装 Python 依赖：

```bash
python -m pip install -r requirements-render.txt
```

然后在项目根目录运行：

```bash
python scripts/render-hero-v4.py
```

脚本会读取 `source/` 中的原始素材，覆盖 `dist/assets/` 下当前版视频和备用动图。处理过程需要一定内存与时间。

录屏当前裁取的是原始 1206 × 2622 画面中 `(x=4, y=920, width=1200, height=900)` 的地图区域，输出 1080 × 810；不包含手机外框。

修改页面资源或重新生成动画后，可同步更新 `index.html` 中的资源版本参数/文件名，以便已访问的浏览器获取新版。
