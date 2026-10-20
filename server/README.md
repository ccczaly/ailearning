# LearnAI Java 后端

## 其余七个模块

V19 新增七套完整入门课程，全部已发布、直接开放阅读。每模块 4 章 8 节、48 分钟，每节 3 道测验，共 56 节、168 题、336 分钟。首页九个模块现在都有课程入口。

| 模块 | 课程 slug / 内容源文件名 |
| --- | --- |
| 编程与工程基础 | `engineering-basics` |
| RAG 与知识检索 | `rag` |
| AI Agent | `agents` |
| MCP 与工具生态 | `mcp` |
| 多模态 AI | `multimodal` |
| AI 工程化 | `app-engineering` |
| 部署与基础设施 | `deployment` |

源文件为 `content/{slug}.json`，包含正文、目录顺序与题目。V19 只新增课程和题目，不修改旧课程、历史迁移或用户记录。所有新测验继续复用 `lesson_quiz_questions`、事务评分、答题快照与用户进度；知识接口只返回 `hasQuiz`，不公开题目答案。

`node scripts/generate-remaining-courses.mjs --check` 同时校验 V19 和生成的 `src/data/course-catalog.ts`，页面的章号、标题与下载入口由该目录表提供。已经应用的 V19 不可覆盖，后续内容修订须使用新迁移，避免修改源文件后与数据库不一致。

七套标准库 Python 3.11+ 示例位于 `examples/{slug}`，默认离线、不调用付费模型。运行 `python scripts/package-remaining-examples.py` 更新显式文件白名单生成的下载包，`--check` 核对源码一致性。`python scripts/check-remaining-examples.py` 运行全部示例测试、入口和 56 段正文 Python 代码。MCP 示范固定为 2025-11-25 只读 stdio 子集；其他模拟与生产边界见各模块 README。部署示例不自动构建镜像、发布云服务或修改实际数据库。

相关后端验证为 `RemainingCoursesTests`、`RemainingCoursesMigrationTests`，分别覆盖所有新课节评分、记录隔离与访问限制，以及旧课程、题库、用户与学习记录保留。`AiIntegrationTests` 使用模拟模型检查七个模块的课节上下文，测试不产生供应商用量。

## LLM 应用开发

首页「LLM 应用开发」已接入 `llm-app-dev` 课程：按调用模型、提示词、会话、结构化输出、流式交互、完整应用组织，6 章 12 节，预计 78 分钟。沿用正文阅读、机制图卡、延伸阅读、当前课节 AI 答疑及阅读位置恢复；所有正文直接开放。

每节 3 道单选题，答对至少 2 道通过。题目存于 V18 新增的 `lesson_quiz_questions`，按课节关联；知识接口的 `hasQuiz` 指示是否展示测验，不返回答案。提交继续沿用账号隔离、CSRF、评分快照与事务更新进度，后续未通过不清除已有通过状态。基础模块原有测验继续兼容。

正文和题目源文件：`content/llm-app-dev.json`；V18 由 `scripts/generate-app-course.mjs` 生成。执行 `node scripts/generate-app-course.mjs --check` 校验源文件与迁移完全一致。已执行迁移不可覆盖，后续修订需新增迁移。

配套 Python 3.11+ 标准库示例位于 `examples/llm-app-dev`，默认模拟、不调用真实模型；课程侧栏可下载 `/examples/llm-app-dev.zip`。运行说明、真实模型的显式开启方法和教学边界见示例 README。执行 `python scripts/package-app-examples.py` 更新下载包，`--check` 检查与源码一致；打包仅包含显式列出的 6 个文件，不包含环境文件或凭据。平台不执行学习者代码。

相关验证：后端 `-Dtest=ApplicationCourseTests,ApplicationCourseMigrationTests,LearningTests,LearningProgressTests,LessonQuizTests,AiIntegrationTests`；前端 `node --test scripts/learning-progress.test.mjs scripts/lesson-quiz.test.mjs scripts/markdown.test.mjs`；示例 `python -m unittest discover -s examples/llm-app-dev -p tests.py`。

## 知识阅读（第一版）

启动时 Flyway 自动执行未应用的数据库迁移。登录后点击首页「大模型基础」，或访问 `/knowledge/llm-basics`，可以阅读「沿着时间线认识大语言模型」：14 个时间节点、28 节正文，预计 110 分钟。全部课节统一采用简短导语、机制图解、关键结论与可展开的延伸阅读，每节约 3–5 分钟；公式、手算样例和综合验收步骤保留在核心内容中。接口为 `GET /api/knowledge/{slug}`，需要登录，只返回已发布且祖先目录可见的内容。

正文支持 Markdown 标题、表格、列表、代码块和参考链接，关闭原始 HTML，并兼容中文强调标记。机制区的 `flow`、`compare` 围栏代码块会显示为流程或对照图卡：每行使用“标题 | 说明”，包含 2–4 行。图卡文字来自同一份正文，通过 Vue 文本插值输出；非法、嵌套及延伸阅读内的图块保持普通代码显示，不会丢弃内容。1950 与 ELIZA 保留原有专用示意图，中文对话和数值均为教学示例。`user_section_progress` 已接入课节访问、手动完成与取消完成；课程进度只统计已发布且目录可见的正文课节。后续内容修改使用新的迁移，不修改已执行的 SQL。

V5 初始化应用开发分类，V6 更新为九个学习模块。首页通过需要登录的 `GET /api/learning/modules` 读取已发布模块，按 `sort_order,id` 排序；`entrySlug` 为首个已发布知识点的 slug，无内容则为空。首页通过知识星球进入课程，不展示或请求各课程进度；学习进度与阅读位置恢复保留在课程页，九个模块均提供阅读内容。前端 `src/data/modules.ts` 仅保存按模块 code 匹配的星球视觉配置。

V7 初始化时间线课程，归档此前的旧章节并保留其 ID。V8 将 1950 年代的两节课更新为互动序章；V9 将这两节课改为历史叙事；V10 精简这两节正文；V11 按相同结构精简 1966 年 ELIZA；V12 重写其余 12 章的 24 节内容，统一阅读结构并补充机制图卡。V8–V12 均原地更新标题、正文和预计时间，不改变课节 ID 或目录关系，保留学习记录的外键关联。正文源文件为 `content/llm-basics.json`，历史与技术资料附原论文或官方教材链接。

在项目根目录执行 `node scripts/generate-llm-course.mjs --check` 检查剩余 24 节正文与 V12 一致，同时核对 1950 与 V10、1966 与 V11 完全一致、全部目录顺序保持 V7。执行 `node --test scripts/markdown.test.mjs` 验证图解分节、安全输出及公式保留。生成器只生成 V12，以原 V7 课节标题和各自父目录限定更新范围，不会覆盖 V7–V11；一致性检查兼容 Windows CRLF。已应用的 V12 也不能再次覆盖；下一次修订须先新增迁移版本并调整生成器。`RemainingCourseMigrationTests` 验证 V11→V12 保留全部 ID、目录关系、已有学习进度及前四节内容。

基础工程：Java 21、Spring Boot 4.1.1、Maven Wrapper、Spring Web MVC、JDBC、MySQL、Flyway 和 Actuator。

已提供数据库迁移、健康检查、Spring Security 登录、Session、CSRF、用户及角色鉴权。首次管理员、安全启动脚本、接口和测试说明见 [登录使用说明](../LOGIN.md)。MyBatis 尚未接入，当前沿用 JDBC。

## 1. 准备环境

- 安装 JDK 21，设置 `JAVA_HOME`，确认 `java -version` 和 `javac -version` 可用。
- 使用 MySQL 8.4，创建 `ailearning` 数据库（字符集 `utf8mb4`）和专用用户。
- 本地开发用户需要对该数据库具有建表、修改表以及数据读写权限，供 Flyway 和业务访问使用；不要直接使用 root。
- 无需单独安装 Maven，首次执行 Wrapper 时需要网络下载 Maven 和依赖。

此工程不会自动创建数据库，也不会修改已有 MySQL 账号。

## 2. 配置并启动（PowerShell）

推荐在仓库根目录打开 PowerShell，首次配置：

```powershell
Copy-Item .\server\.env.example .\server\.env.local
notepad .\server\.env.local
```

填写 `DB_PASSWORD`，检查 `JAVA_HOME`、`DB_URL` 和 `DB_USERNAME`。`.env.local` 已被 Git 忽略，请勿提交实际密码。以后在项目根目录运行 `npm run dev:server` 即可，无需重复输入密码，保存后端代码后自动重新编译并重启。只启动一次使用 `npm run start:server`。首次创建网站管理员时单独运行 `.\server\start-local.ps1 -InitializeAdmin`。不要重复复制模板覆盖已有配置。

脚本将配置按字面值读取，不展开变量。可用成对引号包裹值，注释必须单独一行。本地文件优先于环境变量，脚本退出后恢复原环境；未配置密码时仍会提示输入。

也可以在仓库根目录打开终端，手动设置环境变量启动：

```powershell
cd server
$env:DB_USERNAME = 'ailearning_app'
# 安全提示输入密码，避免密码直接写入命令历史。
$credential = Get-Credential -UserName $env:DB_USERNAME -Message '输入本地 MySQL 账号密码'
$env:DB_PASSWORD = $credential.GetNetworkCredential().Password
$env:DB_URL = 'jdbc:mysql://localhost:3306/ailearning?connectionTimeZone=UTC&characterEncoding=UTF-8'
.\mvnw.cmd spring-boot:run
```

默认监听 `8080`，可用 `SERVER_PORT` 环境变量覆盖。环境变量只对当前终端及其子进程有效。Spring Boot 不会自动读取 `.env` 或 `.env.local`；仅 `start-local.ps1` 自动加载 `.env.local`。

数据库不可用、凭据错误或数据库不存在时，启动会失败，以便尽早发现配置问题。不要把实际密码提交到 Git。

### 自动重启说明

`npm run dev:server` 使用 Node 监听 `server/src/main`、`pom.xml`、`.env.local` 和 `start-local.ps1`，保存稳定约一秒后终止本次启动的进程树，再执行 Maven 清理、编译和启动。删除或重命名 Java 文件也能清理旧 class。无需 IDE 自动编译或额外依赖。

编译失败会显示错误，修复并保存后重试；`Ctrl+C` 停止监听及后端。监听不包含 `target` 或测试代码。启动监听前请停止旧后端；监听器不会自动关闭其他进程。重启会丢失内存 Session，需要重新登录。迁移 SQL 应新增版本，不能修改已执行的迁移。

监听器回归验证：在根目录执行 `node --test scripts/dev-server.test.mjs`。

## 3. 验证

在另一个终端执行：

```powershell
Invoke-RestMethod http://localhost:8080/api/actuator/health
```

正常返回 `status: UP`，检查包含数据库连接。接口不公开数据库详情。

## 4. 测试与打包

测试使用隔离的进程内 H2，不需要数据库密码。执行：

```powershell
.\mvnw.cmd test
.\mvnw.cmd clean package
java -jar target/ailearning-server-0.0.1-SNAPSHOT.jar
```

测试不会连接现有 MySQL；打包后的 jar 启动时需要配置数据库环境变量，并执行尚未应用的迁移。

## 5. 目录与后续开发

```text
server/
├── pom.xml
├── mvnw / mvnw.cmd
├── .mvn/wrapper/
└── src/
    ├── main/java/com/ailearning/server/   启动类与后续业务代码
    ├── main/resources/
    │   ├── application.properties
    │   └── db/migration/                 Flyway SQL 迁移
    └── test/java/com/ailearning/server/
```

`V1` 仅初始化迁移历史；`V2__users_and_roles.sql` 新增用户、角色及关联表。已经执行的迁移不要修改，后续按版本新增。

前端在仓库根目录运行 `npm run dev`，后端独立启动，Vite 已配置 `/api` 代理。当前是单实例基础登录版本；完整用户管理、SSO、MFA、密码找回及登录审计属于后续工作。

## AI 助教（DeepSeek）

沿用 Java 后端，通过 Spring AI 2.0.1 调用 DeepSeek。首页输入学习问题打开「小包子 AI 助教」，阅读页的助教入口关联当前课节，可以解释、举例和出自测题。打开面板和读取历史不会调用模型；发送普通问题通常产生一次模型请求，查询学习进度时最多两次（选择工具、依据结果回答），不是自动重试。会话和消息保存在 MySQL，按登录用户和课节隔离。

小包子已支持当前账号学习进度的只读工具 `get_current_learning_progress`。可以问“我的学习进度怎么样”“RAG 完成了多少”“上次学到哪里”，或点击助教内的“学习进度”快捷提问。工具按需执行，不在打开首页或面板时预取进度。

工具只接受空对象 `{}`，登录账号由 `AiController` 的认证身份在请求内绑定，不暴露用户 ID 参数，也没有修改进度能力。返回各已发布模块的总课节数、完成数、已访问数、最近阅读标题和站内地址；课节与祖先目录的可见性沿用阅读接口。访问不代表完成，完成状态只按数据库记录统计；无记录明确返回零与空阅读位置，查询失败返回安全错误，不伪造零进度。每次进度提问重新查询，不以旧聊天数字代替实时数据。

调用使用 Spring AI 2.0 的 `ChatClient` 工具循环，每轮最多执行一次只读工具，再生成回答；重复调用会终止并提示重新提问。原有整轮超时、停止生成、错误脱敏和历史隔离继续生效。只保存最终用户/助教消息，不把工具协议消息混入普通聊天历史；工具结果作为本轮模型参考数据使用。本功能复用已有数据库表，无需新增迁移，首页仍不展示进度卡片。

相关验证：`AiLearningProgressTests` 和 `AiIntegrationTests` 覆盖当前账号隔离、隐藏课节过滤、无记录、实时追问、错误参数、数据库失败与工具循环限制；`AiProgressProviderTests` 将真实 DeepSeek 适配器连接到本机 SSE 替身，检查工具定义发送、分片参数合并和结果回传。浏览器测试入口以模拟模型实际调用同一查询工具，所有这些验证都不消耗真实模型用量。

打开助教时自动恢复该账号、该课节上次选择的会话，并从后端重新读取消息；没有选择记录时恢复最近一段会话。也可以在「历史对话」中切换，或点击「新对话」从空白开始。浏览器只保存会话选择和阅读位置 ID，消息正文仍以数据库为准；切换账号或课节会取消过期请求。历史加载失败时先重试读取，避免把追问误发到另一段会话；重试历史不会调用模型。

同一个标签页刷新时，原本打开的助教会自动重新打开并恢复消息；主动关闭后保持关闭。阅读页会先恢复课节，再恢复对应会话，避免加载过程中误打开普通会话。

阅读页切换课节会更新 URL 的 `section` 参数，并按账号、课程记住最近阅读位置。刷新、返回课程后可以回到原课节，再恢复该课节的历史对话。最近访问课节同时保存到后端，换设备可继续学习；完成状态由“完成本节”按钮手动确认，复习不会清除完成状态。

在已被 Git 忽略的 `server/.env.local` 中配置以下变量，保留原有数据库设置，不要再次复制模板覆盖整个文件：

```dotenv
AI_CHAT_PROVIDER=deepseek
DEEPSEEK_API_KEY=填写自己的Key
DEEPSEEK_MODEL=deepseek-flash
AI_MAX_TOKENS=512
```

随后运行 `npm run dev:server` 和 `npm run dev`。本地启动脚本加载上述变量；直接运行 jar 时须自行设置环境变量。`AI_CHAT_PROVIDER=none` 可关闭模型调用，课程和登录仍然可用。Key 只在后端使用，不进入前端、版本库、历史消息或接口错误响应。

默认关闭深度思考和自动重试，每次模型请求最多生成 512 tokens；问题最多 1000 字符、课节与历史共享最多 6000 字符、最多携带最近 4 条已完成消息。进度工具另提供当前账号的精简汇总，不返回完整课文、其他账号记录或凭据。当前不设置每日提问额度和后端并发限制。

后端重启后将遗留的生成中记录标记为已中断，继续追问时只携带已完成的问答。

`AI_MAX_CONTEXT_CHARS`、`AI_MAX_MESSAGE_CHARS`、`AI_MAX_HISTORY_MESSAGES` 和 `AI_TIMEOUT_SECONDS` 也可配置，默认分别为 `6000`、`1000`、`4`、`60`。停止生成或关闭面板会取消本地流式请求，已产生的供应商用量仍可能计费。余额不足、Key 无效、供应商繁忙会显示对应提示，由用户决定是否再次发送。

接口沿用 Session 和 CSRF：

- `POST /api/ai/chat`：发送问题，可携带 `conversationId`、`sectionId`；返回 `meta`、`delta`、`done`、`error` SSE 事件。
- `GET /api/ai/conversations`：读取当前用户的普通会话；加 `sectionId` 读取对应课节会话。
- `GET /api/ai/conversations/{id}/messages`：读取自己的会话消息。

V13 新增 AI 会话、消息和原额度表，V14 移除已停用的额度表，启动时通过 Flyway 迁移。课节内容由后端重新读取，只使用已发布且目录可见的正文。自动测试使用 H2 和模拟模型，不访问 DeepSeek、也不消耗余额。

后端执行 `.\mvnw.cmd test`；前端流式协议、安全渲染和页面恢复执行 `node --test scripts/ai-stream.test.mjs scripts/ai-history.test.mjs scripts/ai-tutor.test.mjs scripts/reading-position.test.mjs`。隔离浏览器验证时，在 `server` 目录执行 `.\mvnw.cmd spring-boot:test-run '-Dspring-boot.run.main-class=com.ailearning.server.AiBrowserTestApplication'`，再以 `API_PROXY_TARGET=http://127.0.0.1:18080` 启动前端。这个测试入口强制使用 H2 和模拟模型，创建 `browser-user` / `browser-test-password`，仅绑定本机 18080 端口；关闭进程即丢弃数据，生产 jar 不包含该入口或账号。

接入参考：[Spring AI 版本兼容性](https://docs.spring.io/spring-ai/reference/getting-started.html)、[DeepSeek 模型适配](https://docs.spring.io/spring-ai/reference/api/chat/deepseek-chat.html)、[DeepSeek 调用参数](https://api-docs.deepseek.com/zh-cn/)。

学习进度接口：`GET /api/learning/progress/{slug}` 读取当前账号课程进度；`PUT /api/learning/progress/{slug}/sections/{sectionId}` 更新访问（`{}`），完成状态由测验评分维护，写入需要 Session 和 CSRF。复用现有进度表，无需新增迁移。

## 1950 章节测验

大模型基础的 1950 两节课各提供 3 道固定单选题，答对至少 2 道通过。页面显示每次提交的成绩、答案和解析，可重新测验；后续未通过不清除已有通过状态。该两节课不能通过进度接口手动完成或取消完成，所有课节均不再提供手动完成入口。

V15 新增 `quiz_attempts` 和 `quiz_answers`，保存账号、课节、测验版本、成绩、提交时间以及每题的答案、知识点标签和题目/选项/解析快照。历史接口展示最近 50 次，数据库保留所有提交。V15 将该两节课此前的手动完成状态调整为学习中，保留访问记录。

`GET /api/learning/quizzes/{slug}/sections/{id}` 返回题目（不含答案）；同路径 `/attempts` 的 POST 接收版本和逐题选项并由后端评分，GET 返回当前账号的提交记录。POST 沿用 Session 和 CSRF，评分、记录与进度更新在同一事务内完成。验证：后端 `-Dtest=LessonQuizTests,LearningProgressTests`，前端 `node --test scripts/lesson-quiz.test.mjs scripts/learning-progress.test.mjs`。

## 阅读访问

已删除历史推演入口、接口和阅读解锁限制。所有已发布且目录可见的课节均可直接阅读，并可使用对应课节的 AI 答疑。课后测验和学习进度继续保留，完成状态仍由测验评分维护。

V17 删除 `historical_reflections`、`historical_explorations` 两张专用表及其中的全部推演和评价记录；课程、用户、测验和学习进度不受影响。已执行的 V16 历史迁移保留。后端启动时自动应用 V17。


### AI 消息操作项

AI 正文仍通过 SSE `delta` 的 `text` 字段流式传输。成功的 `done` 事件单独携带 `actions` 数组，例如：

```json
{"status":"COMPLETED","conversationId":7,"messageId":12,"actions":[{"type":"continue_learning","label":"继续学习","url":"/knowledge/rag?section=12"}]}
```

操作项由后端根据本轮进度工具结果生成，不解析模型正文。当前支持 `continue_learning` 和 `review_course`；普通回答返回空数组，失败或取消的回答不提供操作项。前端仅渲染已支持的操作类型和本地课节地址，按钮文案不参与行为判断。

V20 迁移为 `ai_messages` 添加 `actions_json`，操作项与回答一起保存；历史消息接口返回独立的 `actions` 字段。升级前的消息没有操作项，原有正文和链接保持可读。

本地 `start-local.ps1` 使用 `-Dmaven.test.skip=true`，启动时只编译业务代码；测试请单独执行 `.\mvnw.cmd test`。源码变化仍会触发开发服务重启，重启期间接口会短暂不可用。


### 用户长期记忆（轻量版）

V21 新增 `user_memories`，每个账号一行，保存称呼（80 字符）、技术背景、学习目标、回答偏好（各 240 字符）。首页「设置」可查看、修改、清空和关闭；关闭后保留内容，但不注入聊天或自动抽取。用户手动修改或清空的字段由服务端保护，不再自动覆盖；清空全部会保护四个字段，后续可手动填写。

聊天请求读取记忆，与课节和近期消息共用上下文预算，当前问题优先。用户消息成功落库后，单线程后台队列使用同一模型额外发起一次记忆抽取请求（不带工具、课文或助手回答）；只接受四个字段、用户原话证据和长度限制内的非空更新。提取采用 20 秒超时、4096 字符输出上限和 32 个排队任务；失败、队列满或版本冲突时跳过，不影响 SSE。后台提取会产生额外供应商用量；重启时未完成任务不重试，历史消息不回填。数据库版本校验防止待处理结果覆盖用户修改、关闭和清空操作。

接口：`GET /api/me/memory`、`PUT /api/me/memory`（完整四字段、enabled、version）、`DELETE /api/me/memory?version=...`（清空），均只操作登录账号；写入沿用 CSRF，版本冲突返回 409，应重新加载。`lockedFields` 由后端维护，客户端不能解除保护。数据库 `updated_at` 记录最后更新时间。此功能只在本地表保存提取后的信息，不需要向量数据库。

相关验证：`UserMemoryTests` 覆盖记忆抽取落库、来源校验、手动保护、关闭清空、版本冲突、账号隔离、CSRF、字段校验；`AiIntegrationTests` 验证新会话记忆注入、读取失败降级及已有流式对话行为。测试使用 H2 和模拟模型，不调用供应商。
