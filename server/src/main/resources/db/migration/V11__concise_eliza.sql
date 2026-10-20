-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.

-- V11 shortens the two 1966 ELIZA lessons and groups further reading, preserving section IDs and user progress.

-- V7 through V11 are immutable after application. Add a new migration for future revisions.

UPDATE knowledge_points SET estimated_minutes=373, updated_at=CURRENT_TIMESTAMP(3) WHERE slug='llm-basics';

UPDATE knowledge_sections SET title='1966：ELIZA 怎样接话？', content_markdown='1966 年，约瑟夫·魏泽鲍姆发表 ELIZA。人们在终端输入一句话，程序就能接话。它没有今天大模型的训练过程，却能让人觉得“它在听我说”。这种感觉从哪里来？

## ELIZA 怎样生成回复

ELIZA 的回应由预先编写的脚本控制。知名的 DOCTOR 脚本模拟一种不断追问的谈话方式：不急着给出建议，而是引导用户继续说。

我担心考试 → 你为什么担心考试？

这是帮助理解的教学改写示例，不是原始脚本的逐字输出。回复沿用了“考试”，看起来回应了你的处境；其实程序不必知道考什么、为什么重要，也能拼出这句话。

追问又把解释留给用户。你会补上经历、语境与情绪，把一句通用回应读成有针对性的关心。对话的意义，有一部分来自人的参与。

## 留下的启发

**措辞相关，能制造被理解的感觉；是否理解了诉求，还要继续检验。** 下一节，我们换一种说法、加一句否定，看看规则还能不能接住。

## 延伸阅读

原论文说明：关键词触发分解规则，再由关联的重组规则生成回复；没有关键词时，也有回应办法。脚本可以修改，改变的是规则，而不是训练模型参数。

[ELIZA 原论文，1966](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) · [MIT 保存的源码与 DOCTOR 脚本](https://dome.mit.edu/entities/archivalmaterial/10076e5d-bf7f-4bda-80a1-e1622a356715)', estimated_minutes=3, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND parent_id IN (SELECT id FROM (SELECT DISTINCT d.id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id WHERE p.slug='llm-basics' AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title='1966 · ELIZA 与规则对话') eliza_chapter) AND node_type='LESSON' AND status='PUBLISHED' AND title='关键词和模板怎样模拟对话' AND sort_order=1;

UPDATE knowledge_sections SET title='规则的边界：接话不等于理解', content_markdown='把“我担心考试”换成“考试让我睡不着”，意思相近，字面却变了。一个只认“担心”的教学规则，会漏掉这句话。语言的灵活，开始显出手写规则的边界。

## 规则为什么会遇到边界

再试“我并不担心考试”。关键词还在，但意思已经相反。若规则忽略否定，仍问“你为什么担心考试？”，就会回应一个用户没有表达的困扰。这些是简化规则的示例，并非 ELIZA 原脚本的实测。

补上同义词和否定规则，可以修复部分错误。可场景扩大后，例外、上下文和优先级会越来越多；修好一种说法，还要检查是否影响其他说法。

语言研究也探索另一条路线：从文本实例中学习规律，减少逐句编写规则的负担。统计方法并非由 ELIZA 单独催生，数据也不保证覆盖所有表达或真正理解诉求。

## 留下的启发

**能接住关键词，不等于能接住意思。** 规则仍适合订单号格式、退款上限等明确约束；开放对话则需要更多办法。下一站，我们先看怎样用文本计数估计“下一个词”。

## 延伸阅读

ELIZA 原论文讨论了关键词优先级、上下文线索和脚本编辑。它展示了规则的可控性，也提醒我们区分相关回复与实际帮助。

[ELIZA 原论文：规则与讨论](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf)', estimated_minutes=3, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND parent_id IN (SELECT id FROM (SELECT DISTINCT d.id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id WHERE p.slug='llm-basics' AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title='1966 · ELIZA 与规则对话') eliza_chapter) AND node_type='LESSON' AND status='PUBLISHED' AND title='规则的边界：为什么开始从数据学习' AND sort_order=2;
