# 课程索引与维护

| 模块 | 内容源 | 章节 / 课节 | 分钟 | 本地示例 |
| --- | --- | --- | --- | --- |
| 编程与工程基础 | `engineering-basics.json` | 4 / 8 | 48 | `examples/engineering-basics` |
| 大模型基础 | `llm-basics.json` | 14 / 28 | 110 | 沿用历史时间线与图解 |
| LLM 应用开发 | `llm-app-dev.json` | 6 / 12 | 78 | `examples/llm-app-dev` |
| RAG 与知识检索 | `rag.json` | 4 / 8 | 48 | `examples/rag` |
| AI Agent | `agents.json` | 4 / 8 | 48 | `examples/agents` |
| MCP 与工具生态 | `mcp.json` | 4 / 8 | 48 | `examples/mcp` |
| 多模态 AI | `multimodal.json` | 4 / 8 | 48 | `examples/multimodal` |
| AI 工程化 | `app-engineering.json` | 4 / 8 | 48 | `examples/app-engineering` |
| 部署与基础设施 | `deployment.json` | 4 / 8 | 48 | `examples/deployment` |

共 96 节、预计 524 分钟。预计时间用于阅读与短练习参考，完整项目实践可能需要更长时间。正文结构为导语、机制与例子、留下的启发、可展开的延伸阅读；本地开发课程还包含可执行 Python 代码与练习。所有课程直接开放，不使用前置探索或解锁。

LLM 应用开发及 V19 的七个模块每节 3 道单选题，至少答对 2 道通过。大模型基础保留原有 1950 两节的测验范围，本轮不改其正文或题库。正式题库由已审核的源文件迁移进入数据库，模型助教生成的练习不自动写入正式题库。

## 内容一致性

```powershell
node scripts/generate-llm-course.mjs --check
node scripts/generate-app-course.mjs --check
node scripts/generate-remaining-courses.mjs --check
python scripts/package-app-examples.py --check
python scripts/package-remaining-examples.py --check
```

已应用迁移保持不可变。后续修改应新增迁移、保留课节 ID 与已有学习记录，并同步调整源文件及一致性校验版本。不要直接重新生成已执行的 V12、V18 或 V19。

## 本地示例

各下载包均包含 README、源码与相关测试，不包含环境凭据、虚拟环境或缓存。七个新增模块的所有例子可离线运行：

```powershell
python scripts/check-remaining-examples.py
```

该命令运行七套测试、入口与全部 56 段正文代码；不进行付费调用、容器构建或云部署。LLM 应用开发的真实调用需要按其 README 显式开启；其他模块的模拟、协议子集与实现边界也在各 README 中说明。
