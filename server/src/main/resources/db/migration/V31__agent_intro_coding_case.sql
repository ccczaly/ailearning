-- Generated from content/agents.json. Replace only lesson 1.1 with the cart-repair Agent case; preserve identity and progress.

UPDATE knowledge_sections SET content_markdown='你维护的购物车把金额算错了。现在交给助手一个具体任务：

> 购物车总价算错了，帮我修复并补上测试。

只给出建议还不够：代码要遵守项目约定，修改后也要有测试结果。

## 看一次完整修复

本例把计划、工具、项目记忆和反思放进同一个任务，观察它们如何配合。

~~~agent
{
  "kind": "intro-demo",
  "title": "修复购物车：一次完整的 Agent 任务",
  "prompt": "观察测试结果怎样改变下一步。"
}
~~~

## 为什么还要再改一次

助手先安排步骤，再读取 `AGENTS.md` 的持久规则：使用 unittest、金额用 Decimal、保持接口。规则读入当前上下文，才会影响这次修改；项目记忆不等于向量数据库。

首次修复后，常规金额测试通过，空购物车测试却失败。助手没有直接宣布完成，而是读失败信息、检查返回值，再修改并重新运行测试。直到三项测试都通过，才交付修改和验证结果。

四种机制在本例中协作，并非所有 Agent 都必须配齐。**关键是：执行结果会改变下一步。**
',estimated_minutes=8,updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND title='1.1 AI 会回答，为什么还需要 Agent？';
