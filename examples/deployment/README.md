# 部署与恢复演练

临时 SQLite 备份恢复与兼容迁移、模拟就绪、发布条件检查。

## 本地运行

Python 3.11+，只使用标准库。下载包解压后进入 `deployment` 目录；仓库中可以这样运行：

```powershell
cd examples/deployment
python --version
python lab.py
python -m unittest discover -s . -p tests.py
```

也可运行 `python -m venv .venv`，再用 `.\.venv\Scripts\python.exe` 替代以上 `python`；macOS/Linux 用 `.venv/bin/python`。没有 pip 安装步骤。

本模块正文中的短代码在当前目录保存后运行，以便导入 `lab.py`。所有练习默认离线、不调用付费模型、不发送消息，不需要任何 Key。

## 范围与验收

不修改本平台 MySQL，不执行 Docker 构建、云部署或真实生产备份；标准库 HTTP 服务器仅用于本地教学。

测试验证输入拒绝、状态与结果等确定性规则，不代表真实模型准确性。请把程序验收与真实服务质量分开记录。示例不执行模型生成的任意代码，也不会替你操作本平台的账号或数据库。

可选本地探针：`python service.py`，访问 http://127.0.0.1:8765/live 和 /ready，Ctrl+C 停止。
在启动前设置 `$env:DEMO_DATABASE_OK='0'` 可模拟未就绪；没有实际检查 MySQL。服务默认仅绑定回环地址。

Dockerfile 仅供阅读和自行选择的本地构建。未自动安装 Docker、拉取镜像或发布：

```powershell
docker build -t learning-probe:local .
docker run --rm -p 127.0.0.1:8765:8765 learning-probe:local
```

容器内显式绑定 0.0.0.0，宿主发布仍只绑定 127.0.0.1。镜像构建需要网络及已安装的 Docker，会下载基础镜像；教学标签可移动，生产应选择经审查的固定摘要。不要公开部署标准库教学服务器。

