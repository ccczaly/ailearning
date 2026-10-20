# 第一版登录使用说明

## 注册及登录

正常启动后端和前端后，在登录页点击“立即注册”（`/register`），填写账号、密码及确认密码。注册成功后返回登录页，使用新账号登录。普通用户无需通过管理员初始化脚本创建。

注册账号为 3–64 位英文字母、数字、点、下划线或短横线，统一转为小写；密码至少 12 个字符、最多 72 个 UTF-8 字节。新账号仅获得 USER 角色，已有管理员保持原有权限。数据库唯一约束防止重名，密码使用 BCrypt 存储，用户与角色在同一事务中创建。

`POST /api/auth/register` 使用表单字段 `username`、`password`，需要 CSRF 请求头；成功返回 204，输入不合法返回 400，账号重名返回 409。注册使用独立的内存限流，每账号每分钟 5 次、每 IP 每分钟 30 次，超限返回 429。

## 可选：首次管理员

后端默认连接本机 `ailearning`，数据库账号为 `ailearning_app`。网站用户保存在 `app_users`，与 MySQL 账号相互独立。

首次运行，先复制本地配置模板，在 `server/.env.local` 中填写 `DB_PASSWORD`，并按实际情况修改 `JAVA_HOME`、数据库地址和用户名。该文件已被 Git 忽略。

```powershell
Copy-Item .\server\.env.example .\server\.env.local
notepad .\server\.env.local
```

然后在 PowerShell 中执行：

```powershell
cd D:\Pojects\AILearning
.\server\start-local.ps1 -InitializeAdmin
```

脚本读取 `server/.env.local`，其中的值优先于当前终端环境变量；没有配置 MySQL 密码时才弹出凭据输入框。`JAVA_HOME` 未配置时默认使用 `D:\Java`。初始化时另外要求输入网站管理员账号和新密码，管理员密码不会保存到配置文件。数据库密码保存在被 Git 忽略的本地文件中。脚本退出后恢复原有环境变量。账号为 3–64 位英文字母、数字、点、下划线或短横线，统一转为小写；密码至少 12 字符、最多 72 个 UTF-8 字节（BCrypt 限制）。

启动自动执行新增的 V2 迁移，只建立用户、角色和关联表并插入 USER/ADMIN 角色，不修改 V1，不清空数据库。初始化通过事务和角色行锁确保仅创建首个管理员；已有管理员或用户名冲突会拒绝启动，不覆盖密码。没有默认管理员密码或匿名管理员初始化接口；公开注册只创建普通用户。

日后正常启动（不再加初始化参数）：

```powershell
npm run dev:server
```

启动前先停止占用 8080 的旧后端。若本地策略阻止脚本，可按 `server/README.md` 使用 `Get-Credential` 在当前终端设置 `DB_PASSWORD`，然后运行 Maven，不要把密码直接写在命令中。

另开终端启动前端：

```powershell
cd D:\Pojects\AILearning
npm ci
npm run dev
```

打开 Vite 输出的地址，使用网站管理员账号登录。Vite 将 `/api` 代理到 `http://localhost:8080`。页面刷新会通过 `/api/me` 恢复身份；退出后销毁服务器会话。窗口重新获得焦点或页面重新可见时检查会话，收到 401 时跳转登录并显示过期提示。不会在 localStorage 中保存密码、令牌或用户身份。

## 接口约定

| 接口 | 请求 / 响应 |
| --- | --- |
| GET /api/auth/csrf | 匿名可调用；返回 `headerName`、`token`，并建立 Session |
| POST /api/auth/login | `application/x-www-form-urlencoded`，字段 `username`、`password`；CSRF 请求头必需；成功 204 |
| GET /api/me | 返回 id、username、displayName、enabled、roles；未登录 401 |
| POST /api/auth/logout | CSRF 请求头必需；成功 204，会话失效并删除 Cookie |
| GET /api/admin/status | 管理员验证接口；普通用户 403，管理员 200 |
| GET /api/actuator/health | 匿名健康检查，不暴露数据库详情 |

错误响应为 `{ "code": "..." }`：401 `UNAUTHENTICATED` / `INVALID_CREDENTIALS`；403 `FORBIDDEN` / `CSRF_INVALID`；429 `LOGIN_RATE_LIMITED`，带 `Retry-After: 60`。错误密码与禁用账号使用相同提示。缺少 CSRF 的写请求优先返回 403，包括匿名登录和退出请求。

CSRF 使用 Spring Security 默认 Session token 和遮罩机制。登录成功后会轮换 Session ID 并清除旧 CSRF；前端下次写请求重新取 token。退出后也清除本地 token。前端遇到 CSRF 错误不会自动重放写请求。

## 安全边界与配置

- BCrypt 成本 12；数据库只存密码哈希。
- Session Cookie 为 HttpOnly、SameSite=Lax、Path=/；默认允许本地 HTTP。
- 上线必须使用 HTTPS，并设置 `SESSION_COOKIE_SECURE=true`；前端与 `/api` 通过同源反向代理提供。前端路由需要配置回退到 `index.html`。
- 会话默认空闲 30 分钟过期，服务重启后丢失。生产不启用持久化会话和 remember-me。
- 每个账号每分钟最多 5 次认证尝试，成功后重置账号计数；每个来源 IP 每分钟最多 30 次尝试，包含成功登录。存储上限 10000 个键，满时拒绝新尝试，过期项自动清理。
- 不信任客户端转发 IP 头；部署反向代理后来源可能都显示为代理地址，需按实际拓扑配置可信代理或在网关增加限流。
- 已登录用户在后续受保护请求中重新检查启用状态和角色；禁用、删除或角色变化使原会话失效。
- 当前使用单实例内存 Session 和限流；不支持多实例共享，重启会重置计数。后续可接 Spring Session 和共享限流存储，没有引入 Redis 或微服务。
- 普通用户可通过注册页面自行创建账号；USER 角色及权限规则已经实现并测试。初始化仅用于首个管理员，不能用于重置密码。

## 测试与构建

```powershell
cd D:\Pojects\AILearning\server
$env:JAVA_HOME = 'D:\Java'
.\mvnw.cmd test
.\mvnw.cmd package
cd ..
npm run build
```

测试使用进程内 H2（MySQL 兼容模式），不需要创建 MySQL 测试库，不使用 DB_PASSWORD，不清理或写入现有 MySQL。执行与生产相同的 V1、V2 迁移。真实 HTTP 测试验证登录、错误密码、禁用账号、401/403、CSRF、Cookie 属性、会话轮换、过期、注销旧会话失效和限流；另测首次管理员初始化和限流窗口恢复。H2 无法完全替代 MySQL 行为验证，真实 MySQL 的迁移和登录仍需要本地密码配置后验证。

可选的隔离浏览器联调（测试入口不会进入生产 jar）：

```powershell
# 终端一：server 目录
$env:JAVA_HOME = 'D:\Java'
.\mvnw.cmd spring-boot:test-run '-Dspring-boot.run.main-class=com.ailearning.server.BrowserTestApplication'
# 终端二：仓库根目录
$env:API_PROXY_TARGET = 'http://127.0.0.1:18080'
npm run dev -- --host 127.0.0.1 --port 15173 --strictPort
```

仅此隔离入口创建 `browser-user`、`browser-admin`、`browser-disabled`，测试密码均为 `browser-test-password`。数据库固定为进程内 H2，后端只绑定 127.0.0.1:18080，不连接现有 MySQL；停止进程即丢弃数据。正式 `spring-boot:run` 不创建这些账号。联调完成后关闭两进程；正式前端启动前移除 `API_PROXY_TARGET` 环境变量。

## 本次验证结果（2026-09-28）

- 后端 11 项测试通过，生产 jar 已打包；前端 TypeScript 检查和 Vite 构建通过。
- 内置真实浏览器验证了错误密码提示、普通用户登录、刷新恢复登录、用户名显示和退出；首页场景已目视检查。
- 当前进程未配置 MySQL 密码，所以尚未在 `ailearning` 执行 V2 或创建正式管理员。按上方初始化步骤在本地输入密码后启动即可执行；实际 MySQL 联调仍待验证。

## 后续工作范围

找回密码、企业 SSO、MFA、完整用户管理后台、审计记录、密码重置与轮换策略、共享会话及分布式限流尚未实现。这是基础登录版本，不代表已经达到完整企业级标准。

实现参考：[Spring Security 表单认证](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html)、[CSRF 与 JavaScript 应用](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)。依赖版本由 Spring Boot 4.1.1 BOM 管理（Spring Security 7.1.1）。
