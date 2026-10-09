UPDATE learning_modules SET code='llm-basics', title='LLM 基础', description='理解 Token、上下文、生成原理与模型能力边界。', sort_order=1, updated_at=CURRENT_TIMESTAMP(3) WHERE code='basics';
INSERT INTO learning_modules(code,title,description,sort_order,status) VALUES
 ('prompt-output','提示词与结构化输出','设计提示词、拆解任务，让模型按指定格式输出。',2,'PUBLISHED'),
 ('model-api','模型 API 开发','掌握 API 调用、流式响应、异常重试与多模态输入。',3,'PUBLISHED'),
 ('rag','RAG 与知识库','从文档处理到向量检索、召回与重排。',4,'PUBLISHED'),
 ('agents','工具调用与 Agent','连接外部工具，构建 Agent 与工作流。',5,'PUBLISHED'),
 ('app-engineering','AI 应用工程','实现会话管理、记忆、服务端集成与前端交互。',6,'PUBLISHED'),
 ('evaluation-safety','评测与安全','评估应用效果，处理提示注入、权限与数据保护。',7,'PUBLISHED'),
 ('deployment','部署与运维','管理部署、日志监控、成本、延迟与缓存。',8,'PUBLISHED');
