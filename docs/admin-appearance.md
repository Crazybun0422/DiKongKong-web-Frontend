# 管理员皮肤

入口：管理端「设置 → 外观与皮肤」。五种皮肤为青柠夜航（默认）、深海蓝、暮光紫、暖砂金、墨白（黑白灰）。

选择卡片后点击「保存皮肤」，接口成功才应用配色。失败保留原来的皮肤，可重试。刷新及换设备登录从后端恢复当前账号设置；浏览器只缓存最近成功的配色，用于登录页及首次渲染。没有设置或服务端存储了已废弃皮肤时使用默认值。

前后端需一起发布。后端使用现有 `system_setting` 表，每位管理员单独一条 `admin.appearance.<管理员ID>`，不新增数据库字段。尚未升级后端时，皮肤设置会提示读取失败，不会把本地缓存冒充为保存成功。

## 接口

- `GET /api/auth/appearance`：读取当前管理员的皮肤。
- `PUT /api/auth/appearance`：请求体 `{"skin":"ink-white"}`。
- 均使用现有 `Authorization: Bearer <token>`；管理员 ID 由登录凭证解析，不接受客户端指定账号。
- 成功响应 `{"success":true,"message":{"zh":"操作成功","en":"OK"},"data":{"skin":"ink-white"}}`。
- skin 白名单：`lime-night`、`ocean-blue`、`twilight-purple`、`sand-gold`、`ink-white`。无效参数返回 400，未登录返回 401。

主题同时更新 CSS 变量及 Ant Design 组件 token，包括移动抽屉和弹窗。业务状态色、地图图层颜色与飞前安全看板原有样式保留。

## 检查

本地预览构建产物后设置 `ADMIN_CHECK_URL`（默认 `http://127.0.0.1:5193`），可用 `ADMIN_CHECK_OUTPUT` 指定截图与结果目录。

- `node scripts/check-admin-appearance.cjs`：模拟接口验证五种皮肤、保存失败、刷新恢复、账号隔离、手机布局和主按钮文字对比度。
- `node scripts/check-admin-contrast.cjs`：模拟接口扫描五种皮肤下主要页面和设置子页的可见文字；普通文字对比度至少 4.5，大号文字至少 3。扫描对纯色背景有效，地图、图片、禁用状态和实际业务富文本内容需另做视觉检查。
- 后端 `maven/apache-maven-3.9.9/bin/mvn.cmd -Dtest=AdminAppearanceControllerTest test`：测试鉴权、皮肤白名单、按账号存储及读取；使用模拟仓储，不连接真实业务数据库。
