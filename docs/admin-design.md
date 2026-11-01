# 管理端主题与移动端

管理端沿用官网的深炭黑、荧光绿和浅绿色卡片。入口仍为 /admin/，原有登录、接口、权限和业务路由保持不变。

- src/App.vue：Ant Design Vue 主题，覆盖表单、表格、抽屉与弹窗。
- src/style.css：共享语义颜色与响应式规则。
- src/layouts/MainLayout.vue、src/components/AdminNavigation.vue：桌面侧栏、分组与搜索、手机抽屉导航。
- src/views/LoginView.vue：官网同风格登录页。
- 各业务组件的样式使用 --admin-* 变量；空域地图的安全状态颜色保持原语义。富文本正文保留浅色画布。

900px 以下使用抽屉导航，760px 以下调整表单、筛选、弹窗与表格。宽表格在自身区域内滑动，页面本身不横向滚动。地图面板在手机上移至地图上方。头像裁剪支持鼠标与触摸拖动。

## 手机本地访问

运行 npm run dev:lan，同一局域网手机访问 http://电脑局域网IP:5173/admin/（端口以终端输出为准）。开发 API 仍通过 Vite 代理至原后端；可通过 VITE_DEV_API_PROXY_TARGET 指定后端地址。正式站点使用原有 HTTPS 地址即可，无需新建手机端页面。

## 验证

先启动开发或生产预览服务，再设置 ADMIN_CHECK_URL 指向该服务（默认 http://127.0.0.1:5186）。

- npm run check:admin-responsive：13 个管理路由、登录页、4 种宽度、菜单搜索和账户弹窗。
- npm run check:admin-settings：设置页的一级/二级标签，以及商城编辑保存和发货弹窗。

检查使用 Playwright 和隔离的模拟 API，不连接真实后台，也不修改业务数据。截图和 JSON 报告默认写入 build/checks/admin-responsive，可用 ADMIN_CHECK_OUTPUT 覆盖。需要本机已有 Playwright Chromium。

前端可单独执行 npx vite build 验证。项目完整 npm run build 还会生成游戏和 Java 资源；管理端改动不要求运行这些额外生成步骤。
