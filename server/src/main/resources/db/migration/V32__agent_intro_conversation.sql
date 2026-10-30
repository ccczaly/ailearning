-- Generated from content/agents.json. Introduce the architecture and synchronized Agent conversation / execution demo in lesson 1.1; preserve identity and progress.

UPDATE knowledge_sections SET content_markdown='AI 可以解释一段代码为什么出错，也可以给出修改建议。可当你希望它直接把问题解决，还需要查看项目、修改文件、执行测试，并根据结果继续调整。

**从“给出回答”到“完成任务”，Agent 怎样把这些步骤连接起来？**

## 从回答到行动

先看 Agent 的组成，再跟随一次购物车修复，观察回答如何变成具体行动。

~~~agent
{
  "kind": "intro-demo",
  "title": "购物车修复：Agent 对话与程序执行",
  "prompt": "观察 Agent 的回复如何对应文件操作与测试结果。"
}
~~~

## 结果怎样改变下一步

第一次修改后，测试发现空购物车仍不符合项目约定。Agent 根据失败结果继续修复，直到三项测试通过，再交付修改与验证记录。

**本例的关键是：执行结果会改变下一步，完成任务需要经过验证。**
',estimated_minutes=8,updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND title='1.1 AI 会回答，为什么还需要 Agent？';
