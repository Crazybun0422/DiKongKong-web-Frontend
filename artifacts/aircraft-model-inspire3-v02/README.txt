DJI Inspire 3 · 三维外观样例 V02
制作日期：2026-10-18

文件
- inspire-3.glb：可独立导入的 glTF 2.0 二进制模型，材质和纹理已内嵌。
- index.html：本地交互预览；旋转、缩放、六个视角、桨叶显隐、桨叶旋转和重置。
- model.js / camera.js：可编辑的参数化模型源代码。
- vendor/：本地 Three.js 依赖，无远程 CDN 请求。
- preview/：从导出的 GLB 重新加载后生成的预览图。
- verification.json / gltf-validation.json：交互验证与 Khronos glTF 校验结果。
- manifest.json：文件大小、SHA-256、制作与验证信息。
- reference/sources.json：官方参考来源与比例推断说明。

打开预览
当前本机服务：http://127.0.0.1:17840/
解压后运行 serve-preview.cmd（需要本机安装 Python），再用浏览器打开该地址。
不要直接双击 index.html；浏览器会限制 file:// 模型加载。
也可在此目录运行：py -3 -m http.server 17840 --bind 127.0.0.1

模型结构
坐标：Y 向上，Z 向机头，GLB 世界单位为米；源代码内部以毫米构建。
Fuselage：带真实开口的曲面侧壳、FPV 相机、双电池和内部升降机构。
Lift_Assembly_L / R：碳纤维升降臂、连杆及前宽后窄的纵向机臂。
Gimbal / Camera：下挂 X9 外观重建、偏置支架、俯仰轴、镜头握环和分层曲面玻璃。
Rotor_FL / FR / RL / RR：四个独立转子节点。
Propeller_FL / FR / RL / RR：独立桨叶节点，隐藏时保留电机。

制作范围
沿用前一款 V02 的细节与材质流程，使用官方照片及顶视图进行人工参数化重建。
采用降落状态，电机对角距按官方 685 mm 标定；前后电机横向间距按图示比例推断。
碳纤维、聚合物微表面、金属和镜头镀膜均为本次模型的程序化材质。
这是外观研究模型，不是厂家 CAD；非标定尺寸、内部结构和局部细节存在近似。
桨叶动画由预览页面驱动，GLB 内没有烘焙动画；起落架没有升降动画或物理约束。
当前为高细节展示版本，未制作 LOD、移动端面数裁剪、碰撞体或游戏引擎性能预算。

验证边界
使用 Khronos glTF Validator 验证实际 GLB；再经 GLTFLoader 重载并截图。
检查四个转子、相机细节节点、桨叶显隐、旋转、重置以及 320/390/700 像素布局。
已目测透视、前视、侧视、俯视、底视、相机近景。
没有使用 Blender，也未在 Android、小程序或鸿蒙应用中集成该模型。

来源与权利
照片及厂家文档仅用于本机参考，不包含在交付压缩包中；官方来源见 reference/sources.json。
DJI、Inspire 和 Zenmuse 标识属于其权利人，模型制作不代表获得品牌或商标授权。
Three.js 依赖按 MIT 许可分发，见 THREE-LICENSE.txt。
