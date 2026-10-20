# Python 学习助手

与「LLM 应用开发」6 章 12 节配套。Python 3.11+，仅使用标准库；无需安装第三方包。

## 运行

在项目根目录打开 PowerShell：

```powershell
cd examples/llm-app-dev
python --version
python -m venv .venv
# 无需激活脚本，直接使用虚拟环境中的 Python。
.\.venv\Scripts\python.exe steps.py call
.\.venv\Scripts\python.exe steps.py json
.\.venv\Scripts\python.exe app.py
```

打开 <http://127.0.0.1:8765>。默认是明确标记的本地模拟回答，不访问供应商、不产生模型用量。按 Ctrl+C 停止服务器。macOS/Linux 使用 `.venv/bin/python`。

课程代码中的 `python` 都指上述 Python 环境；`first.py` 等短例子请保存在本目录，以便导入 `client.py`。`steps.py` 提供可直接执行的 `call`、`prompt`、`context`、`history`、`budget`、`json`、`validate`、`stream`、`cancel`、`review` 示例。`validate` 故意使用错误数据，输出失败提示并以状态码 1 退出。

## 可选：真实模型

仅在需要观察真实模型行为时开启。使用自己的 DeepSeek Key，真实请求会产生供应商用量。Key 从当前进程环境读取；这个独立示例**不会自动加载** `server/.env.local` 或其他 `.env` 文件。

```powershell
$env:LLM_LIVE = '1'
$env:DEEPSEEK_MODEL = 'deepseek-flash'
$taskKey = Read-Host '输入自己的 DeepSeek Key' -AsSecureString
$taskCredential = [System.Net.NetworkCredential]::new('', $taskKey)
$env:DEEPSEEK_API_KEY = $taskCredential.Password
.\.venv\Scripts\python.exe app.py
```

修改配置后需重新启动。结束后清理当前终端中的凭据与开关：

```powershell
Remove-Item Env:DEEPSEEK_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:LLM_LIVE -ErrorAction SilentlyContinue
$taskCredential = $null
$taskKey = $null
```

Key 不放进网页、URL 或代码。示例使用 `POST https://api.deepseek.com/chat/completions`，关闭深度思考，每次输出上限 512 tokens，网络读取超时 30 秒，不自动重试。接口和可用模型可能变化，以 [官方接口文档](https://api-docs.deepseek.com/api/create-chat-completion/) 为准；JSON 模式还需在提示词中明确要求 JSON，参见 [官方 JSON 输出说明](https://api-docs.deepseek.com/guides/json_mode/)。

## 文件与课程

| 章节 | 对应文件或命令 |
| --- | --- |
| 01 调用模型 | `client.py`、`steps.py call` |
| 02 提示词 | `steps.py prompt`、`steps.py context` |
| 03 会话 | `steps.py history`，正文的历史裁剪例子 |
| 04 结构化输出 | `steps.py json`、`steps.py validate`、`parse_quiz` |
| 05 流式交互 | `steps.py stream`、`steps.py cancel`、网页停止按钮 |
| 06 完整应用 | `app.py`、`index.html`、`tests.py` |

网页只保留最近两轮完整问答，刷新或新对话清空；停止和失败的回答不加入完成历史。当前问题最多 1000 字符，这不是精确 Token 预算。模型输出作为纯文本显示。本例不执行模型生成的代码。

服务器仅绑定本机，不提供账号、数据库、生产鉴权或正式部署能力；请勿直接公开部署。停止浏览器读取后，服务器会在下一次写入失败时释放上游连接，不能保证供应商立即停止计算或撤销用量。

## 验证

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s . -p tests.py
```

测试全部离线，不调用真实模型。测试通过仅表示相应程序行为正确，不能证明真实模型的事实准确性。网页验收：发送、追问、停止、新问题、新对话、刷新；应只有完整回答加入历史，旧请求不覆盖当前回答。
