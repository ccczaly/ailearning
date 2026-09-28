# LearnAI Java 后端

基础工程：Java 21、Spring Boot 4.1.1、Maven Wrapper、Spring Web MVC、JDBC、MySQL、Flyway 和 Actuator。

目前提供数据库连接、数据库迁移和健康检查；登录、角色权限、用户表及 MyBatis 尚未接入。此阶段仅用于本地开发。

## 1. 准备环境

- 安装 JDK 21，设置 `JAVA_HOME`，确认 `java -version` 和 `javac -version` 可用。
- 使用 MySQL 8.4，创建 `ailearning` 数据库（字符集 `utf8mb4`）和专用用户。
- 本地开发用户需要对该数据库具有建表、修改表以及数据读写权限，供 Flyway 和业务访问使用；不要直接使用 root。
- 无需单独安装 Maven，首次执行 Wrapper 时需要网络下载 Maven 和依赖。

此工程不会自动创建数据库，也不会修改已有 MySQL 账号。

## 2. 配置并启动（PowerShell）

在仓库根目录打开终端：

```powershell
cd server
$env:DB_USERNAME = 'ailearning_app'
# 安全提示输入密码，避免密码直接写入命令历史。
$credential = Get-Credential -UserName $env:DB_USERNAME -Message '输入本地 MySQL 账号密码'
$env:DB_PASSWORD = $credential.GetNetworkCredential().Password
$env:DB_URL = 'jdbc:mysql://localhost:3306/ailearning?connectionTimeZone=UTC&characterEncoding=UTF-8'
.\mvnw.cmd spring-boot:run
```

默认监听 `8080`，可用 `SERVER_PORT` 环境变量覆盖。环境变量只对当前终端及其子进程有效。`.env.example` 仅供参考，Spring Boot 不会自动读取 `.env`。

数据库不可用、凭据错误或数据库不存在时，启动会失败，以便尽早发现配置问题。不要把实际密码提交到 Git。

## 3. 验证

在另一个终端执行：

```powershell
Invoke-RestMethod http://localhost:8080/api/actuator/health
```

正常返回 `status: UP`，检查包含数据库连接。接口不公开数据库详情。

## 4. 测试与打包

在配置好上述环境变量的终端执行：

```powershell
.\mvnw.cmd test
.\mvnw.cmd clean package
java -jar target/ailearning-server-0.0.1-SNAPSHOT.jar
```

生成的上下文测试会连接真实 MySQL 并执行迁移，请使用专用开发或测试数据库，不能指向生产数据库。

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

`V1` 仅初始化迁移历史；用户和权限表会在登录功能实施时新增。已经执行的迁移不要修改，后续增加 `V2__描述.sql` 等文件。

前端仍在仓库根目录运行 `npm run dev`，后端独立启动。前端代理与登录页面将在接口接入时配置。后续计划接入 Spring Security、MyBatis、用户与角色模型、服务端会话及登录审计。
