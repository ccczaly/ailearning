# LearnAI

面向 AI 初学者的学习平台，目前为桌面端首页原型。

## 本地运行

```sh
npm install
npm run dev
```

## 构建

```sh
npm run build
npm run preview
```

技术栈：Vue 3 + Vite + TypeScript + Three.js + GSAP。

- `src/App.vue`：导航和演示消息。
- `src/components/KnowledgeUniverse.vue`：GSAP 相机控制、三维标签投影、模块入口和输入框。
- `src/scene/createKnowledgeScene.ts`：透视相机、球体与人物的空间坐标、三维轨道、雾和遮挡。
- `src/components/ModuleIcon.vue`：统一 SVG 图标。
- `src/components/HeroHeading.vue`：图片标题。
- `src/data/modules.ts`：知识模块、模拟进度、球体位置与材质颜色。
- `src/style.css`：桌面端布局与 HTML 覆盖层。

以 1920 × 919 为主要验收尺寸，场景保持 1440 × 660 的构图，按照窗口可用空间等比缩放。不再提供手机端重排布局。

所有球体在同一个 Three.js 场景中，世界 Z 坐标从 -570 到 440，使用 40° 透视相机形成真实的近大远小效果。鼠标通过 GSAP 驱动相机围绕场景中心移动（左右约 10°、上下约 3°），而不是逐个平移 DOM 元素。人物使用 `src/assets/xiaobaozi.png` 贴在场景中的透明平面上，参与深度测试；它仍为二维素材，不是三维人物模型。轨道位于倾斜的 XZ 平面，前后半圈与球体、人物自然遮挡。

文字和进度条根据每个球体的世界坐标逐帧投影到屏幕；球体图标被人物或其他球体遮挡时隐藏。导航、图片标题和输入框保持固定。`src/data/modules.ts` 中的 world/size 控制真实空间坐标与半径，x/y/radius 仅用于 WebGL 不可用时的静态回退。

页面隐藏时暂停连续渲染；组件卸载时释放 WebGL 资源和动画。系统开启减少动态效果时禁用持续悬浮与鼠标视差。WebGL 不可用时回退到 CSS 星球，模块仍可操作。

已检查 1920 × 919 下无页面滚动，并验证前后景模块点击、输入提交和控制台无渲染错误。对相机中心与八个边界位置进行投影边界检查，包含悬浮和悬停尺寸余量，八个模块保持在场景内并避开底部输入框。TypeScript/生产构建通过。

已新增 `server/` Java 后端基础工程，使用 Spring Boot + MySQL，提供数据库迁移与健康检查。环境配置和启动方式见 [后端说明](server/README.md)。前后端分别启动和构建。

