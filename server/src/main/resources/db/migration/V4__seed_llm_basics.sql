INSERT INTO learning_modules(id,code,title,description,status) VALUES
 (1,'basics','基础概念','从基本概念开始，认识人工智能。','PUBLISHED');
INSERT INTO knowledge_points(id,module_id,slug,title,summary,learning_objectives,estimated_minutes,status) VALUES
 (1,1,'llm-basics','LLM 基础','从 Token 到文本生成，用简单的例子理解大语言模型。','理解大语言模型的基本工作方式；区分训练与推理；认识模型的能力边界。',25,'PUBLISHED');
INSERT INTO knowledge_sections(id,knowledge_point_id,parent_id,node_type,title,sort_order,status) VALUES
 (1,1,NULL,'DIRECTORY','认识大语言模型',1,'PUBLISHED'),
 (2,1,NULL,'DIRECTORY','训练与使用',2,'PUBLISHED');
INSERT INTO knowledge_sections(id,knowledge_point_id,parent_id,node_type,title,sort_order,status) VALUES
 (3,1,1,'DIRECTORY','文本是怎样生成的',2,'PUBLISHED');
INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,content_markdown,estimated_minutes,sort_order,status) VALUES
 (1,1,'LESSON','什么是 LLM','LLM 是 Large Language Model 的缩写，中文叫“大语言模型”。它通过大量文本学习语言中的模式，并根据输入生成文本。

你可以让它解释概念、整理材料、改写文章或辅助编程。它生成的回答可能很流畅，但流畅不代表事实一定正确。

一个例子：输入“请用小学生能理解的方式解释重力”，模型会结合问题和上下文生成解释。它不是简单地从固定答案库中取出一条答案。

记住：大语言模型擅长处理语言，但不能把它的每次回答都当作可靠事实。',4,1,'PUBLISHED'),
 (1,3,'LESSON','Token 与上下文','模型处理文本时，会先把文本转换成 Token，再转换成数字表示。Token 可以是一个词、词的一部分、标点或其他文本片段。

中文的一个字不一定对应一个 Token；具体如何切分取决于模型使用的分词器。

上下文是模型本次生成时可参考的信息，例如系统指令、对话历史、你的问题，以及提供的文档。上下文窗口限制一次可以处理的信息量，输入与输出的额度还取决于具体模型。

实践建议：问题中写清背景、目标和约束。长材料可以先筛选相关段落，再交给模型。',4,1,'PUBLISHED'),
 (1,3,'LESSON','预测下一个 Token','常见的自回归语言模型会根据已有上下文，计算下一个 Token 的概率分布，选择一个 Token，再继续生成后面的内容。

例如输入“天空的颜色是”，后面可能出现“蓝色”等不同续写。模型会结合上下文逐步生成，而不是一次输出整篇文章。

生成过程中可能使用随机采样，因此同一个问题多次提问，答案也可能不同。温度等参数会影响采样的随机程度。

需要注意：概率高表示某种续写更符合模型学到的模式，不等于它在现实中一定正确。',4,2,'PUBLISHED'),
 (1,2,'LESSON','预训练、微调与推理','预训练：模型利用大量数据学习语言模式和知识关联，通过训练调整内部参数。

微调：在预训练基础上，用进一步准备的数据继续训练，让模型更适合特定任务或更好地遵循指令。

推理：训练完成后，模型根据输入生成结果。日常向模型提问主要发生在这个阶段。

在一次对话里补充背景，通常只是改变本次推理的上下文，并不意味着模型参数被实时更新。',5,1,'PUBLISHED'),
 (1,2,'LESSON','能力边界与幻觉','幻觉是指模型生成看似合理、实际错误或缺乏依据的内容。例如，它可能编造论文标题、引用来源或不存在的接口。

模型也可能误解问题、遗漏条件，或给出已经过时的信息。提供材料和检索工具可以帮助提高可靠性，但不能保证完全没有错误。

使用时可以这样做：明确任务和输出格式；提供可信材料；要求指出不确定之处；对关键结论核对原始来源。

小练习：让模型总结一段你熟悉的文字，再逐条检查总结是否有原文没有提到的内容。',8,2,'PUBLISHED');
