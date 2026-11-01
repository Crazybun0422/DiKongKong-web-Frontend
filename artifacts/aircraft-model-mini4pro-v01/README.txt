DJI Mini 4 Pro — 三维外观样例 V02

打开方式
Windows 运行 serve-preview.cmd（需要 Python 3），浏览器打开 http://127.0.0.1:17839/。
支持拖动旋转、缩放、前/侧/俯/底视、“相机细节”及四组桨叶旋转。
mini-4-pro.glb 可独立导入支持 glTF 2.0 的查看器或 Blender。

V02 改动
- 重新制作平滑机身、收腰轮廓、前肩和渐变截面机臂。
- 新建三轴云台，圆角方形滤镜框、七道细槽、光学内层和散热鳍片。
- 补充侧后感知镜头、后部通风口、机腹模块、电机金属环、线圈与桨轴螺钉。
- 内嵌程序化磨砂法线/粗糙度纹理、印字及不同金属、橡胶和镀膜材质。
- 离线摄影棚环境反射、柔和自阴影和接触阴影；新增相机近景。

文件
mini-4-pro.glb：独立模型，网格、材质、纹理内嵌。
model.js、gimbal.js：可编辑参数化源文件，?build=1 从源文件构建。
index.html、vendor/：离线预览器及 Three.js 依赖。
preview/：导出后重新加载实际 GLB 的六个视角。
verification.json、gltf-validation.json：导入与 Khronos glTF 校验记录。
reference/highres/：用于外形校对的官方照片；来源见 sources.json。
manifest.json：文件摘要、来源、范围及 SHA256。

范围与限制
这是根据公开照片进行的外观近似重建，不是原厂 CAD、摄影测量或逐部件实测模型。
重点是单款外观与材质试样。机腹、内部结构与部分细节仍有简化。
模型单位为米，Y轴向上，+Z为机头。四组 Rotor_FL/FR/RL/RR 支持局部Y轴独立旋转。
预览页驱动桨叶动画，GLB没有烘焙动画、折叠机构、碰撞体或移动端LOD。
本轮未接入小程序、Android、鸿蒙或修改后端。官方尺寸仅用于参考，不代表此近似模型的精确外廓尺寸。
上一版原始交付压缩包保留在同级 aircraft-model-mini4pro-v01.zip。

来源与权利
https://www.dji.com/mini-4-pro/specs
https://store.dji.com/product/dji-mini-4-pro
网格和建模代码为本次本地创建，未调用付费模型生成服务。
品牌与参考照片权利属于 DJI；本包不额外授予品牌或原图商用许可。
Three.js 许可见 vendor/THREE-LICENSE.txt。
