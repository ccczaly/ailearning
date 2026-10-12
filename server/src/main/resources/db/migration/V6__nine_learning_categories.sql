UPDATE learning_modules SET code='engineering-basics', title='编程与工程基础', description='掌握编程、Git、HTTP 与软件工程基础。', sort_order=1, updated_at=CURRENT_TIMESTAMP(3) WHERE code='prompt-output';
UPDATE learning_modules SET title='大模型基础', sort_order=2, updated_at=CURRENT_TIMESTAMP(3) WHERE code='llm-basics';
UPDATE learning_modules SET title='LLM 应用开发', description='掌握提示词、结构化输出、模型 API 与会话开发。', sort_order=3, updated_at=CURRENT_TIMESTAMP(3) WHERE code='model-api';
UPDATE learning_modules SET title='RAG 与知识检索', sort_order=4, updated_at=CURRENT_TIMESTAMP(3) WHERE code='rag';
UPDATE learning_modules SET title='AI Agent', sort_order=5, updated_at=CURRENT_TIMESTAMP(3) WHERE code='agents';
INSERT INTO learning_modules(code,title,description,sort_order,status) VALUES
 ('mcp','MCP 与工具生态','理解 MCP 协议，连接工具、资源与外部服务。',6,'PUBLISHED');
UPDATE learning_modules SET code='multimodal', title='多模态 AI', description='理解与应用图像、音频、视频等多模态能力。', sort_order=7, updated_at=CURRENT_TIMESTAMP(3) WHERE code='evaluation-safety';
UPDATE learning_modules SET title='AI 工程化', description='掌握应用架构、评测、安全、可观测性与质量保障。', sort_order=8, updated_at=CURRENT_TIMESTAMP(3) WHERE code='app-engineering';
UPDATE learning_modules SET title='部署与基础设施', sort_order=9, updated_at=CURRENT_TIMESTAMP(3) WHERE code='deployment';
