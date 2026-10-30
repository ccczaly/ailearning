# 课程索引与维护

| 模块 | 内容源 | 章节 / 课节 | 分钟 | 本地示例 |
| --- | --- | --- | --- | --- |
| 编程与工程基础 | `engineering-basics.json` | 4 / 8 | 48 | `examples/engineering-basics` |
| 大模型基础 | `llm-basics.json` | 14 / 28 | 110 | 沿用历史时间线与图解 |
| LLM 应用开发 | `llm-app-dev.json` | 6 / 12 | 78 | `examples/llm-app-dev` |
| RAG 与知识检索 | `rag.json` | 4 / 8 | 48 | `examples/rag` |
| AI Agent | `agents.json` | 8 / 35 | 195 | 1.1 原演示 + 16 个本地预设交互 |
| MCP 与工具生态 | `mcp.json` | 4 / 8 | 48 | `examples/mcp` |
| 多模态 AI | `multimodal.json` | 4 / 8 | 48 | `examples/multimodal` |
| AI 工程化 | `app-engineering.json` | 4 / 8 | 48 | `examples/app-engineering` |
| 部署与基础设施 | `deployment.json` | 4 / 8 | 48 | `examples/deployment` |

共 123 节、预计 671 分钟。预计时间用于阅读与练习参考，完整实践可能需要更长时间。所有课程直接开放，不使用前置探索或解锁。

AI Agent 按“工具调用 → 计划与循环 → 上下文与记忆 → RAG → Skill / MCP → 失败与安全 → 系统交付”逐步展开。除 1.1 外，每课以研究助手的一个具体问题切入，主线先讲清机制，参数格式、协议细节、工程边界和一手资料放在文末“深入阅读”，阅读页默认收起这一部分。1.1 的正文、架构图和购物车修复交互完整保留；V34 为另外 16 节接入本地预设演示，放在“深入阅读”之前，映射见 `src/agent-reference-demos.ts`。全部演示不执行模型或真实工具，操作结果不自动写入学习进度；不新增正式课后题。学习进度记录“已读”，不代表通过项目评测。

LLM 应用开发及其余六个实践模块每节 3 道单选题，至少答对 2 道通过。AI Agent 旧题库已移除，历史答题快照和原有课节学习记录保留。大模型基础保留原有 1950 两节的测验范围。模型助教生成的练习不自动写入正式题库。

## 内容一致性

```powershell
node scripts/generate-llm-course.mjs --check
node scripts/generate-app-course.mjs --check
node scripts/generate-remaining-courses.mjs --check
node scripts/generate-agents-course.mjs --check
python scripts/package-app-examples.py --check
python scripts/package-remaining-examples.py --check
```

已应用迁移保持不可变。AI Agent 由 V22 更新，八个原课节按主题保留 ID，重排到新章节；增加 22 节，移除旧活动题库，不删除用户学习记录或历史答题快照。V23 更新 1.1 正文与能力实验；V24 使用 `CONCAT` 与 `CHAR(92)` 修复 MySQL 对 JSON 字符串内反斜杠的解释，保留课节 ID 与学习记录。V19、V22 保留受固定摘要保护的历史快照；V26 更新 1.1 为离线工具调用教学，清理旧实验配置；V27 将全部 30 节更新为问题驱动的讲解，保留课节 ID、目录与学习记录；V28 完善交互情境与引导，保留已执行的 V27；V29 仅更新 1.2 的动画交互；V30 仅更新 1.1 为四能力逐步演示；V31 仅精简 1.1 正文并接入单个购物车代码修复案例；V32 将 1.1 调整为问题引入、架构图、Agent 对话与程序执行的顺序。V33 将课程重排为 8 章 35 节，并为各课增加通俗主线与深入阅读。生成器保护 V22–V24、V26–V32 历史快照，核对现役内容与 V33 一致，并用摘要验证 1.1 正文和演示资产未变。`scripts/agent-course-legacy.json` 保存 V32 身份映射：延续的主题保留课节 ID，新主题新增课节；合并的旧课节和多余目录归档，学习记录、助教会话和历史答案不删除，也不会转移成新课节的完成记录。交互配置解析失败时仅显示加载提示，不向学习者展示原始 JSON。后续修改应新增迁移，不覆盖已执行迁移。更新目录元数据可用 `node scripts/generate-remaining-courses.mjs --write-metadata`，此选项不修改迁移。

## Agent 交互演示维护

公开上游为洛小山的 `itshen/learn-ai`，本地 16 页位于 `public/demos/agent-reference/`；来源、映射、修改和许可见该目录 `ATTRIBUTION.md` 与 `LICENSE`。每页为独立 HTML，依赖本地 `shared/lesson.css`、`shared/lesson.js`、`shared/embed.js`，不加载原站账号、导航或远程脚本。每个页面保留原交互玩法，并修正消息格式、计数和特定实现的教学口径。

课程正文只配置 `reference-demo` 和白名单 `demoId`，实际 iframe 路径由 registry 决定。容器核对消息来源、当前 iframe 和演示 ID；共享脚本提供暂停/继续、取消旧定时任务、键盘操作及高度回报。卸载课节会销毁旧页面。原 1.1 继续使用原组件和资产，摘要检查保持。

V33 的课程源快照冻结于 `scripts/fixtures/agents-v33.json`；`generate-agents-course.mjs --check` 校验历史 V33 后继续检查 V34。`generate-agent-reference-course.mjs` 由历史快照和 registry 生成当前课程及 V34，已有迁移不能覆盖；后续内容变化仍需新迁移。

必要检查：`node scripts/check-agent-reference-demos.mjs`；相关测试为 `agent-interaction.test.mjs`、`agent-reference.test.mjs`、`agent-reference-approval.test.mjs`、`agent-reference-runtime.test.mjs`，后端为 `AgentsCourseTests`、`AgentsCourseMigrationTests`。源码/VM检查不代替浏览器点击和视觉对照；2026-10-30 本轮浏览器工具因无法可靠识别当前 URL 停止，尚未完成该项验收。

## 本地示例运行

各下载包均包含 README、源码与相关测试，不包含环境凭据、虚拟环境或缓存。AI Agent 原求和与日程内存示例、测试和下载包已移除；其他六个模块的例子可离线运行：

```powershell
python scripts/check-remaining-examples.py
```

该命令运行六套测试、入口与全部 48 段正文代码；不进行付费调用、容器构建或云部署。LLM 应用开发的真实调用需要按其 README 显式开启；其他模块的模拟、协议子集与实现边界也在各 README 中说明。

## 历史 1.2 动画演示维护

该动画已从现役 1.2 正文移除，源码保留作历史资料。演示源为 `public/demos/agent-workflow/index.html`，设计约束见同目录 `DESIGN.md`。GSAP 随演示本地分发，课程播放不依赖 CDN。在该目录运行 `npm run check` 做动画与布局检查，`npm run dev` 打开 HyperFrames Studio。历史播放器支持固定地址嵌入和窄屏高度调整，所有路径均为预设例子。

## 1.1 代码修复演示维护

课程入口为 `src/components/AgentIntroLab.vue`，直接渲染结构图和播放器；独立演示入口为 `public/demos/agent-intro/index.html`。两种视图共用 `scenario.js` 案例数据、三版 Python 代码和 `player.js` 控制器。单个购物车修复任务串起计划、读取项目规则、调用工具、检查失败和再次修复，中文结构图与出处由演示页统一呈现。正文只保留问题引入、架构与演示的衔接和简短结论；具体任务在演示中出现，避免重复引入。演示来源、原作者署名、修改说明和许可证保留在演示目录；后续修改应同时维护。所有步骤均为预设教学内容，不会在线执行真实工具。

`node --test scripts/agent-intro-scenario.test.mjs` 会用 Python 标准库 unittest 实际运行原版、首修和最终版，核对预设失败与通过结果。可通过 `AILEARNING_TEST_PYTHON` 指定 Python 路径。
