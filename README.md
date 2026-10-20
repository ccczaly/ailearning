# LearnAI

已接入第一版前后端登录闭环，首次管理员设置、启动和验证方式见 [登录使用说明](LOGIN.md)。首页需登录后访问，场景沿用当前组件实现。

面向 AI 初学者的桌面端学习平台，九个模块均已开放阅读。

编程与工程基础、RAG 与知识检索、AI Agent、MCP 与工具生态、多模态 AI、AI 工程化、部署与基础设施各提供 4 章 8 节，共 56 节和 168 道测验。沿用机制图解、延伸阅读、课节 AI 答疑与进度记录；每个模块的侧栏都可下载 Python 本地示例。示例均可离线运行，具体范围见各自 README，平台不在线执行学习者代码。完整课程与维护方式见 [课程索引](content/README.md)。

已开放「LLM 应用开发」：6 章 12 节，按开发流程学习 Python 模型调用、提示词、会话、JSON 输出、流式交互与完整学习助手；每节配测验，沿用 AI 答疑和学习进度。首页点击对应模块，或登录后访问 `/knowledge/llm-app-dev`。配套代码可在课程侧栏下载，也可查看 [Python 示例运行说明](examples/llm-app-dev/README.md)。

已接入 DeepSeek AI 助教：支持首页聊天、结合当前课节答疑、流式输出、历史对话和停止生成。本地 Key 配置、调用配置和验证方式见 [后端 AI 助教说明](server/README.md#ai-助教deepseek)。

小包子还可按需查询当前登录账号的学习进度，包括各模块完成情况、已访问课节数和最近阅读位置。在助教中点击“学习进度”，或直接问“我上次学到哪里了”。工具只读，不接受其他账号参数，不会恢复首页进度卡片。

## 本地运行

```sh
npm install
npm run dev
```

同时启动前端和后端（Windows，需先配置好 `server/.env.local` 并启动 MySQL）：

```sh
npm run dev:all
```

前端保留 Vite 热更新，后端保留保存代码后自动编译重启。按 `Ctrl+C` 同时停止两者；前端退出时也会停止后端监听及其进程。启动前请先停止已单独运行的服务，避免端口冲突。后端编译失败时监听继续运行，修复并保存后重试。首次管理员初始化仍使用下方说明中的独立命令。

## 后端开发

首次在 `server/.env.local` 配置数据库（见 [后端说明](server/README.md)），之后在项目根目录另开终端：

```sh
npm run dev:server
```

保存 `server/src/main` 下的 Java、配置、SQL 文件，或修改 `server/pom.xml`、`server/.env.local`、启动脚本后，会自动重新编译并重启后端。连续保存会合并处理，编译失败后修复并保存即可重试。按 `Ctrl+C` 停止监听及它启动的后端进程。

前端继续使用 `npm run dev`。只启动一次、不监听修改时使用 `npm run start:server`。首次切换前先停止之前手动启动的后端，避免端口冲突。自动重启期间接口暂时不可用，内存登录会话会失效，需要重新登录。此启动入口适用于 Windows 开发环境。

## 构建

```sh
npm run build
npm run preview
```

技术栈：Vue 3 + Vite + TypeScript + Three.js + GSAP。

- `src/App.vue`：路由出口及会话过期处理；`src/components/HomeView.vue`：原首页、真实用户信息和退出入口。
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

