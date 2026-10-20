-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.

-- V9 revises the two 1950 lessons into historical narratives, preserving section IDs and user progress.

-- V7, V8 and V9 are immutable after application. Add a new migration for future revisions.

UPDATE knowledge_points SET estimated_minutes=389, updated_at=CURRENT_TIMESTAMP(3) WHERE slug='llm-basics';

UPDATE knowledge_sections SET title='1950：图灵问，机器能思考吗？', content_markdown='1940 年代末，曼彻斯特大学的一台实验计算机占据了整间屋子。高大的机架、密布的线路，和今天的聊天框相隔着一个漫长的时代。就在这样的年代，数学家艾伦·图灵写下了一个问题：机器能思考吗？

## 一次值得记下的运行

1948 年 6 月 21 日，曼彻斯特的“Baby”计算机成功运行了第一个程序。它把程序指令和计算用的数值一起存进电子存储器，是世界上第一台成功运行存储程序的电子数字计算机。[曼彻斯特大学的历史档案](https://www.curation.cs.manchester.ac.uk/computer50/www.computer50.org/mark1/new.baby.html)记录了这一天。

“把程序存起来”听着很平常，却意味着机器可以从内存中接连读取指令。换一种任务，研究者可以换一份程序，而不必为此重新搭建一套线路。让同一台机器承担不同工作，开始成为可以实际验证的事情。

Baby 的主存只有 32 个 32 位的存储单元，合计约 128 字节。它能完成的工作还很有限。可在这个阶段，仅仅让机器稳定存住并执行一段程序，就已经是值得庆祝的进展。

同年，图灵来到曼彻斯特大学。此后他使用当地的计算机研究数学问题，也参与早期编程工作。他关于机器智能的讨论，就处在数学理论与真实机器逐渐相遇的时刻。[曼大的图灵生平资料](https://www.curation.cs.manchester.ac.uk/digital60/www.digital60.org/about/biographies/alanturing/manchesteruniversity.html)保留了这些工作记录。

## 图灵先问过：计算是什么？

把时间再往前拨。1936 年，图灵提出了一种后来被称为“图灵机”的数学模型：一条分成格子的纸带，一个能读写符号的装置，再加上一套决定下一步动作的规则。

不用担心这套模型的细节。这里值得注意的是，他把看似复杂的计算，拆成了能逐步描述的动作：读一个符号、写一个符号、移动到另一格。

他还提出“通用计算机器”：给它另一台计算机器的规则描述，它就能模拟那台机器的计算。这给了“同一种机器，通过不同程序做不同工作”一个严格的理论表达。[1936 年论文第 6 节](https://www.cs.columbia.edu/~tal/3261/Turing_Paper_1936.pdf)专门讨论了这一点。

不过，从执行计算步骤走到参与人类谈话，中间还有很大的距离。算对一道题容易核验；一句回答有没有理解问题，该怎样核验？

## “思考”，到底要怎样判断？

1950 年，图灵在《Mind》发表《计算机器与智能》。论文开头提出“机器能思考吗”，随即指出：我们首先会碰到“机器”和“思考”该怎样定义的问题。[原论文第 1 节](https://doi.org/10.1093/mind/LIX.236.433)

这也是这个问题至今仍有分量的原因。如果思考意味着运算，计算机已经能完成一些运算。如果它还意味着理解、判断、感受，我们就需要说明：哪些表现算作证据，又怎样观察它们？

你可能愿意把解出难题当作证据，也可能更看重能否解释理由、应对追问。不同标准会带来不同答案。讨论还没开始，门槛就可能已经画在不同地方。

图灵于是换了一种问法，把争论带进一个有明确规则的交流场景。下一节，我们走进他提出的“模仿游戏”，看看当外貌与声音都被挡住，人还能凭什么作判断。', estimated_minutes=5, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND node_type='LESSON' AND status='PUBLISHED' AND title='它会接话，就算听懂了吗？' AND sort_order=1;

UPDATE knowledge_sections SET title='模仿游戏：隔着一堵墙，怎样判断智能？', content_markdown='一堵墙隔开了提问者和回答者。你看不到另一边的人，也听不到声音，手中只有传来的文字。对方是谁？你可以不断提问，却必须从回答里寻找线索。这是图灵在 1950 年论文中搭起的思想实验。

## 游戏最初有三个人

原论文里的游戏，先由一名男子 A、一名女子 B 和一位提问者 C 参加。C 待在另一个房间，要分辨两位回答者谁是男子、谁是女子。A 的任务是让 C 判断错误，B 则帮助 C 判断正确。

答案写在纸上，或通过电传打字机传送。身形、衣着、声线都不能作为线索。即使一方坚持说“相信我”，另一方也可以作出同样的声明；提问者需要继续追问。

接着，图灵改变了一个条件：让机器接替 A 的位置，提问者会怎样判断？从这里，机器的语言表现进入了游戏。这个设想是后来讨论“图灵测试”的起点。

*这里按原论文第 1 节叙述。今天常见的“分辨人和机器”是它的通俗表述；论文开头的男女模仿游戏保留了原始问题的来路。[1950 年原文](https://www.csee.umbc.edu/courses/471/papers/turing.pdf)*

## 为什么偏偏通过文字？

隔开身体，让问题集中到了交流本身。机器不用先长出一张逼真的脸，提问者也无法因金属外壳就提前下结论。双方都要通过同一个狭窄的窗口：语言。

这个窗口其实很宽。图灵在论文中列出的问答例子，涉及写诗、做加法和下国际象棋。它们说明，通过提问，可以把不同领域的能力带进同一场交流。[原论文第 2 节](https://www.csee.umbc.edu/courses/471/papers/turing.pdf)

顺着这个设想，你可以想象提问者怎样一步步加深问题：会算一道题之后，能否说清做法？作出一个判断之后，能否回应新的条件？一次漂亮的回答让人印象深刻，持续的追问则让能力受到更长的观察。

语言因此成了一种观察机器能力的方式。它把问题从机架和线路引向回答与理由，也让“计算”和人们熟悉的“交谈”有了相遇的可能。

## 一个设想，留下两条追问

1950 年的论文在讨论可设想的机器将来能否做好这个游戏。它没有宣布当时已有计算机通过测试，更没有交出一套现代大语言模型的制造方法。[原论文第 3 节](https://www.csee.umbc.edu/courses/471/papers/turing.pdf)

论文后半部还把目光转向“学习机器”：图灵设想，能否先构造类似儿童心智的程序，再通过教育让它成长？这是关于机器怎样获得能力的探索；其中的教育类比，不能直接当作今天的训练方案。[原论文第 7 节](https://www.csee.umbc.edu/courses/471/papers/turing.pdf)

此时，两条问题线索已经摆在面前。一条问怎样造出能交谈的程序，另一条问怎样解释它的表现。对话可以让我们观察应答，却无法让我们直接看到另一方的内在体验。“回答得像人”与“具有怎样的理解”，仍然需要认真讨论。

1966 年，约瑟夫·魏泽鲍姆发表 ELIZA：一个借助关键词和改写规则进行文字对话的程序。它将把这段历史带到更具体的代码与谈话中。[ELIZA 原论文](https://doi.org/10.1145/365153.365168)

带着一个问题进入下一站：当一段程序让人觉得被理解了，这种感觉究竟来自程序做了什么，又来自人补上了什么？', estimated_minutes=5, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND node_type='LESSON' AND status='PUBLISHED' AND title='同一句话，为什么能有不同意思？' AND sort_order=2;
