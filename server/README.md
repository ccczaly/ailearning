# LearnAI Java 后端

## 知识阅读（第一版）

启动时 Flyway 自动执行未应用的数据库迁移。登录后点击首页「大模型基础」，或访问 `/knowledge/llm-basics`，可以阅读「沿着时间线认识大语言模型」：14 个时间节点、28 节正文，预计阅读与练习 397 分钟。接口为 `GET /api/knowledge/{slug}`，需要登录，只返回已发布且祖先目录可见的内容。

当前只提供阅读；`user_section_progress` 已建表，尚未接入写入和进度统计。正文支持 Markdown 标题、表格、列表、代码块和参考链接，关闭原始 HTML，并兼容中文强调标记。后续内容修改使用新的迁移，不修改已执行的 SQL。

V5 初始化应用开发分类，V6 更新为九个学习模块。首页通过需要登录的 `GET /api/learning/modules` 读取已发布模块，按 `sort_order,id` 排序；`entrySlug` 为首个已发布知识点的 slug，无内容则为空。首页不展示进度，目前「大模型基础」提供阅读内容。前端 `src/data/modules.ts` 仅保存按模块 code 匹配的星球视觉配置。

V7 更新大模型基础课程。正文源文件为 `content/llm-basics.json`，课程中的数值样例均为教学示例，历史节点附原始论文或教材链接。迁移归档旧章节并保留 ID，避免破坏学习记录的外键关联。

在项目根目录执行 `node scripts/generate-llm-course.mjs --check` 检查正文源文件与 V7 一致，执行 `node --test scripts/markdown.test.mjs` 验证排版与不安全输入处理。生成器用于重现 V7；V7 应用后不要修改正文并覆盖该迁移，未来课程修订应新增迁移版本。

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
