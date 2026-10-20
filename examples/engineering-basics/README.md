# 本地课程清单

校验学习记录、统计完成时长，在临时 JSON 文件中保存并读回。

## 本地运行

Python 3.11+，只使用标准库。下载包解压后进入 `engineering-basics` 目录；仓库中可以这样运行：

```powershell
cd examples/engineering-basics
python --version
python lab.py
python -m unittest discover -s . -p tests.py
```

也可运行 `python -m venv .venv`，再用 `.\.venv\Scripts\python.exe` 替代以上 `python`；macOS/Linux 用 `.venv/bin/python`。没有 pip 安装步骤。

本模块正文中的短代码在当前目录保存后运行，以便导入 `lab.py`。所有练习默认离线、不调用付费模型、不发送消息，不需要任何 Key。

## 范围与验收

不处理多人并发，不连接本平台数据库；虚拟环境不等于系统沙箱。

测试验证输入拒绝、状态与结果等确定性规则，不代表真实模型准确性。请把程序验收与真实服务质量分开记录。示例不执行模型生成的任意代码，也不会替你操作本平台的账号或数据库。

