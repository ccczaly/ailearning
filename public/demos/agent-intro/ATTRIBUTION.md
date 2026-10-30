# 来源与修改说明

本目录的播放器最初由以下课件的逐步演示移植；现已重做为 LearnAI 的单一代码修复案例，保留原有版权和许可说明：

- 作者：洛小山 · 小山学堂
- Copyright (c) 2026 洛小山 · Miyang Tech (Zhuhai Hengqin) Co., Ltd.
- 原版课件：<https://xueai.miyang.cn/slides/7-1.html>
- 上游项目：<https://github.com/itshen/learn-ai>
- 来源文件：`slides/7-1.html`、`slides/lesson.css`、`slides/lesson.js`
- 许可证：GNU Affero General Public License v3.0，完整文本见 [LICENSE](./LICENSE)。

2026-10-27 对 LearnAI 的适配：

- 原四个独立案例替换为 LearnAI 编写的购物车代码修复案例，串联计划、工具、项目记忆和依据测试证据反思。
- 重写中文教学结构图、单步代码与结果面板、执行轨迹、播放／暂停／下一步／重播及定位控制；自动播放每步停留三秒。
- 图的知识结构参考 Lilian Weng 的《LLM Powered Autonomous Agents》（2023）及 Anthropic 的《Building effective agents》（2024），是教学改绘，不主张固定“四大能力”。页面提供原文和原图链接。
- 移除与该演示无关的课件页头、架构图、LLM 对照、导航、认证和远程脚本依赖。
- 将可点击卡片改为原生按钮，增加键盘焦点、选择状态和减少动态效果支持。
- 使用文本节点渲染固定案例，补充短定时器与卸载清理。
- 课程由原生 Vue 组件直接渲染，独立页面与课程共用 player.js 和 scenario.js；卸载、重试时清理播放器事件与定时器。独立页面仍支持同源嵌入时的高度回报。

2026-10-28 对 LearnAI 的适配：

- 页面顺序调整为简短引入、中文架构图、左右双栏任务演示。
- 左侧累积模拟的 Agent 回复与工具回执，右侧同步展示文件、真实样例对应的代码差异和预设终端输出。
- 默认手动推进，增加上一步与四阶段回看；自动播放需主动开启，每步停留六秒，重置回到初始状态。
- 课程和独立页面共用 demo.css、player.js 与 scenario.js，保留原作者署名、原文和原图链接。

此静态演示的完整对应源码可直接访问或下载，无需构建：

- [index.html](./index.html)
- [demo.css](./demo.css)
- [demo.js](./demo.js)
- [player.js](./player.js)：课程和独立页面共用的播放器控制逻辑。
- [scenario.js](./scenario.js)：代码、项目约定、步骤和预设测试输出。

案例代码使用 Python 标准库 unittest，无需外部包。项目内 `scripts/agent-intro-scenario.test.mjs` 实际运行原版、首次修复版和最终版；预设页面本身不执行 Python 或真实模型。

原作的版权和许可证声明适用于本目录中改编的内容；本文件不更改项目其他部分的许可证声明。
