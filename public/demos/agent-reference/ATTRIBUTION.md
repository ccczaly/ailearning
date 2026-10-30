# 来源与修改说明

作者：洛小山 · 小山学堂。Copyright (c) 2026 洛小山 · Miyang Tech (Zhuhai Hengqin) Co., Ltd.

公开源仓库：<https://github.com/itshen/learn-ai>。2026-10-30 获取公开 `slides/` 源文件，当时主分支提交为 `ab023c8540c462c00f3db5b0262b3ddaa5e00633`。各演示的 `upstream-source` 元数据及页底链接记录对应原页。

本目录从公开源码改编，沿用 GNU Affero General Public License v3.0；完整文本见 [LICENSE](LICENSE)。本说明不更改项目其他部分的许可声明。

## 演示与原文件

| 本地目录 | 上游 slides 文件 | LearnAI 小节 |
| --- | --- | --- |
| tool-call | 7-2.html | 2.1 |
| tool-messages | 7-2a.html | 2.2 |
| tool-design | 7-2b.html | 2.4 |
| orchestration | 7-2c.html | 2.5 |
| react | 7-3.html | 3.1 |
| context-window | 7-3a.html | 4.2 |
| compression | 7-3b.html | 4.3 |
| vector-search | 7-3c.html | 5.2 |
| skill | 7-5.html | 6.1 |
| skill-file | 7-5b.html | 6.2 |
| mcp | 7-2d.html | 6.3 |
| failures | 7-4b.html | 7.1 |
| approval | 7-4c.html | 7.2 |
| tracing | 7-6c.html | 8.1 |
| multi-agent | 7-6b.html | 8.3 |
| harness | 7-4.html | 8.4 |

## 2026-10-30 修改

- 提取演示 DOM、样式、案例与原生 JavaScript，保留主要控件和状态联动；各演示的完整源码在 `<本地目录>/index.html`，可直接下载，无需构建。
- 移除原站页头、导航、认证、主题、统计、二维码和语言依赖，采用同源独立 iframe 隔离演示。
- [`shared/lesson.css`](shared/lesson.css) 来源于原 `slides/lesson.css`；[`shared/lesson.js`](shared/lesson.js) 保留原视口启动与渐入机制，移除站点二维码，增加页面卸载清理。
- 新增 [`shared/embed.js`](shared/embed.js)：来源及许可链接、键盘操作、暂停/继续、减少动态效果、定时任务取消、页面卸载和高度回报。由 LearnAI 编写的嵌入支持代码与本目录一起提供。
- 修正工具定义与消息格式的口径、示例计数和数量关系、MCP 历史传输说明，以及将特定实现绝对化的说法。案例均为教学预设，不执行模型请求、外部 API、命令、邮件、支付或部署。
- 修复等待人工确认时重置/切换留下的 Promise 和旧播放代次；Tracing 工具次数根据实际展示事件累计为 6 次。
- 课程接入代码：`src/agent-reference-demos.ts`、`src/components/AgentReferenceLab.vue`；公开目录包含播放器完整对应源码和许可。后续维护应保留本文件和页底署名。

源代码检查和虚拟 DOM / VM 检查不能替代浏览器视觉验收；逐页点击与宽度对照的执行状态记录在项目迁移计划中。
