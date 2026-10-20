-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.

-- V10 shortens the two 1950 lessons and groups further reading, preserving section IDs and user progress.

-- V7, V8, V9 and V10 are immutable after application. Add a new migration for future revisions.

UPDATE knowledge_points SET estimated_minutes=385, updated_at=CURRENT_TIMESTAMP(3) WHERE slug='llm-basics';

UPDATE knowledge_sections SET title='1950：机器能思考吗？', content_markdown='1950 年，计算机还是装满机架和线路的庞然大物。图灵却已经追问：机器能思考吗？他的突破，是把难以定义的“思考”问题，转向可以观察的语言表现。

## 从“思考”到可观察的表现

在《计算机器与智能》中，图灵指出：回答这个问题，先得说清“机器”和“思考”是什么意思。如果思考指运算，机器已经能算题；如果还包括理解和感受，什么才算证据？

与其让讨论停在定义上，他提出“模仿游戏”：遮住外貌和声音，通过文字问答观察另一方的表现。能否答题、解释理由、应对追问，都可以成为观察线索。具体怎么玩，我们下一节再看。

## 留下的启发

**判断机器的能力，先说明你要观察什么。** 一次流畅的回答值得注意，持续追问则能检验它是否理解条件、前后是否一致。这个问题也贯穿今天的大模型评测。

## 延伸阅读

1936 年，图灵提出通用计算机器：同一种机器可以按照不同程序做不同工作。1948 年，曼彻斯特的 Baby 成功运行存储程序；它的主存仅约 128 字节。机器先能执行程序，研究者才有机会继续追问它能否交谈。

[1950 年原论文](https://doi.org/10.1093/mind/LIX.236.433) · [1936 年论文第 6 节](https://www.cs.columbia.edu/~tal/3261/Turing_Paper_1936.pdf) · [Baby 的历史档案](https://www.curation.cs.manchester.ac.uk/computer50/www.computer50.org/mark1/new.baby.html)', estimated_minutes=3, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND parent_id IN (SELECT id FROM (SELECT DISTINCT d.id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id WHERE p.slug='llm-basics' AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title='1950 年代起 · 机器能使用人类语言吗？') first_chapter) AND node_type='LESSON' AND status='PUBLISHED' AND title='1950：图灵问，机器能思考吗？' AND sort_order=1;

UPDATE knowledge_sections SET title='模仿游戏：用文字观察机器', content_markdown='隔着一堵墙，你只能读到文字回复，看不到对方，也听不到声音。你会怎样提问，判断对方的能力？图灵的模仿游戏，让语言成为观察机器的窗口。

## 模仿游戏怎样进行

今天常见的通俗表述是：一位提问者分别与人和机器文字交流，尝试判断谁是机器。这便于理解游戏的思路；原论文从男女模仿游戏出发，差异见延伸阅读。

遮住外貌和声音，可以减少外表带来的先入判断。问题可以涉及写诗、计算或下棋；回答之后继续追问，观察它能否解释理由、处理新条件。

例如，算出一道题后，再问：“如果条件变了呢？”一次答对只是一条线索，连续交流才能看到更多表现。

## 留下的启发

**回答得像人，是一种表现；是否具有理解，仍需进一步讨论。** 这个思想实验提供了观察办法，也留下了问题：怎样造出能交谈的程序，又怎样解释它的表现？

1966 年，ELIZA 用关键词和改写规则回应用户。下一站，我们看一段程序怎样让人产生“被理解”的感觉。

## 延伸阅读

原论文先设男子 A、女子 B 和提问者 C：C 判断谁是男子、谁是女子，A 试图误导，B 帮助判断。图灵随后问，让机器接替 A 会怎样？这与今天常见的“分辨人和机器”表述有别。

[1950 年原论文第 1—2 节](https://www.csee.umbc.edu/courses/471/papers/turing.pdf) · [ELIZA 原论文](https://doi.org/10.1145/365153.365168)', estimated_minutes=3, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND parent_id IN (SELECT id FROM (SELECT DISTINCT d.id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id WHERE p.slug='llm-basics' AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title='1950 年代起 · 机器能使用人类语言吗？') first_chapter) AND node_type='LESSON' AND status='PUBLISHED' AND title='模仿游戏：隔着一堵墙，怎样判断智能？' AND sort_order=2;
