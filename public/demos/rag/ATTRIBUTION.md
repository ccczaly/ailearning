# RAG 工作台来源与修改说明

本目录的 RAG 案例、二维向量图、分块映射、双路融合、权限关卡、引用定位、集合评测和播放运行时代码由 LearnAI 编写。所有问题、资料、分数与结果是本地教学预设，不调用真实模型、外部检索或 tokenizer。

视觉设计沿用本项目 `public/demos/agent-reference` 的专题体系，入口直接引用其 `shared/lesson.css`。该样式来自洛小山 · 小山学堂，Copyright (c) 2026 洛小山 · Miyang Tech (Zhuhai Hengqin) Co., Ltd.，源仓库 https://github.com/itshen/learn-ai ，按 GNU AGPL-3.0 提供。对应许可及来源记录保留在相邻 `agent-reference/LICENSE` 和 `agent-reference/ATTRIBUTION.md`。本目录作为该演示组合的一部分按 AGPL-3.0 提供，不改变项目其他部分许可。

RAG 的原创内容不冒用上游课程页署名。页面与共享模型由 `scripts/generate-rag-pages.mjs` 生成；共享模型的维护源是 `src/rag-interaction.ts`。`shared/lab.js`、`shared/lab.css`、`shared/clock.js` 是可直接维护的专题实现。

播放器使用可取消时钟管理单步、暂停、重播和离开清理；减少动态模式不自动播放，保留全部手动操作。iframe 使用独立的 `rag-demo-height` 消息，宿主验证来源、窗口、演示 ID 和高度范围。
