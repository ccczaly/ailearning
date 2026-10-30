-- Generated from content/agents.json. Replace only lesson 1.2 with the animated workflow comparison; preserve identity and progress.

UPDATE knowledge_sections SET content_markdown='两个助手都能交付课程报告。第一个每次固定搜两次、读两页、生成报告；第二个读到乙课程没有价格后，临时决定去查报名页。

只看最后的报告，你可能分不清它们。把乙课程价格删掉再试一次，区别才会出现：第一个按既定分支处理，第二个需要结合缺失的信息选择行动。

## 下一步由谁决定

聊天机器人描述的是交互方式：用户通过对话获得服务，它背后也可以调用工具。工作流描述的是执行安排：主要步骤与分支由程序预先规定。Agent 则把部分行动选择交给模型，让它结合当前信息决定查什么、先做什么。

**判断时找决策的位置，不要数步骤或工具。** 一个聊天界面里，可以先运行固定采集流程，再让模型补查缺口，最后由程序检查保存权限。它们可以组成同一个系统。

## 动手验证：同样会查资料，为什么实现方式不同

先播放“乙费用缺失”的过程，再切换“费用齐全”和“报名页已迁移”。三列使用同一个任务；逐步比较观察之后的决定由谁作出。固定工作流也能处理预先写好的分支，Agent 的不同在于模型可以结合新信息选择补查方向。

~~~agent
{
  "kind": "workflow",
  "title": "同一个任务，谁在决定下一步？",
  "prompt": "用播放、下一步或进度条查看过程。改变资料条件，比较聊天助手、固定工作流与 Agent；所有路径均为预设教学示例。"
}
~~~

## 换个任务，试着解释

换成“整理每周销售报告”：写出一个固定步骤、一个可能交给模型的决定，以及一个必须由程序执行的检查。能指出这三处职责，比给整个产品贴上 Agent 标签更有用。
',estimated_minutes=8,updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND title='1.2 聊天机器人、工作流与 Agent';
