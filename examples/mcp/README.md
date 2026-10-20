# 只读 MCP 服务

运行真实 stdio 子进程，交换初始化、工具、资源和提示模板消息。

## 本地运行

Python 3.11+，只使用标准库。下载包解压后进入 `mcp` 目录；仓库中可以这样运行：

```powershell
cd examples/mcp
python --version
python lab.py
python -m unittest discover -s . -p tests.py
```

也可运行 `python -m venv .venv`，再用 `.\.venv\Scripts\python.exe` 替代以上 `python`；macOS/Linux 用 `.venv/bin/python`。没有 pip 安装步骤。

本模块正文中的短代码在当前目录保存后运行，以便导入 `lab.py`。所有练习默认离线、不调用付费模型、不发送消息，不需要任何 Key。

## 范围与验收

固定协议版本 2025-11-25，仅实现只读教学子集；不支持远程授权、所有方法或更新版无握手生命周期。生产接入应核对官方 SDK 与客户端版本。

测试验证输入拒绝、状态与结果等确定性规则，不代表真实模型准确性。请把程序验收与真实服务质量分开记录。示例不执行模型生成的任意代码，也不会替你操作本平台的账号或数据库。

协议演示：`python lab.py demo`。协议模式：`python lab.py serve`，仅从 stdin 读取逐行 JSON、向 stdout 输出协议消息；输入 EOF 后退出。优先使用 demo，它会自动关闭子进程。

版本说明：[MCP 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)；[官方 SDK 的生命周期版本说明](https://go.sdk.modelcontextprotocol.io/protocol/)。本例明确不实现新版 2026-07-28 无握手流程。

