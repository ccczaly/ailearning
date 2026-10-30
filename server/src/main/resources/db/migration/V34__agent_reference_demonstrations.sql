-- Generated from the immutable V33 course and src/agent-reference-demos.ts.
-- Add 16 local, pre-scripted demonstrations. Preserve IDs, hierarchy, reading records, chats, quizzes and the 1.1 demo.

UPDATE knowledge_sections SET content_markdown='研究助手回复“我去查一下乙课程的报名页”，浏览器却没有任何动作。问题出在哪里？模型写出一句行动说明，还需要有一条通道把这个行动交给程序。

## 把一句话变成明确的请求

你会在文档里看到 Function Calling（函数调用）和 Tool Calling（工具调用）。先抓住它们的共同点：模型可以返回一个明确的行动请求，告诉应用“用哪个工具、带哪些输入”。

例如程序提供了“读取课程页面”的工具。模型选择它，并给出乙课程的页面地址。应用收到请求后，检查输入、调用读取程序，把网页正文作为结果返回。模型接着利用正文回答，或决定再查别的资料。

整个过程可以记成：**模型提出请求 → 程序执行工具 → 结果交回模型。**

## 先接一个工具，就能看见区别

研究助手的第一版只需要一个读取工具。提供一个已知课程页面地址，让程序读取后把结果交给模型，观察回答里的费用和时间是否来自读取结果。这样就能分清“根据已有输入作答”和“先获得新资料再作答”。

后面再加入搜索与保存工具。工具能力来自你接入的程序：模型能生成保存请求，并不意味着报告已经出现在目录里。是否执行成功，要看工具返回的回执和实际产物。

## 交互演示

跟随一次工具调用的执行过程。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "tool-call",
  "title": "跟随一次工具调用的执行过程",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

Function Calling 常指让模型请求应用提供的函数，工具调用还可以包含其他类型的工具。两种说法在不少文档中会一起出现，具体支持哪些输入形式，需要查看所用接口。初学时无需为了名称差异拆成两套机制。

运行程序应把工具名映射到预先注册的实现，校验参数后再调用，避免把模型生成的任意文本当成代码执行。还要把返回结果对应到原调用，并将它加入后续模型输入。工具在后台执行过，但下一轮没收到结果，模型仍然无法据此继续判断。

参考 [Function Calling 的请求与执行流程](https://developers.openai.com/api/docs/guides/function-calling)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='2.1 Function Calling / Tool Calling：模型怎样请求程序做事？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='02 · Function Calling：让模型连接真实工具') parent);

UPDATE knowledge_sections SET content_markdown='读取工具已经返回“乙课程周二晚开课”，助手却说自己还不知道时间。先别急着怀疑模型记性：工具拿到的数据，可能没有被交回下一轮对话。

## 一次调用，消息怎样往返

把消息看成不同角色写下的记录，会容易理解得多。下面用研究助手的一个小任务说明：

> 用户：乙课程什么时候上课？  
> 助手的工具请求：读取乙课程页面，调用编号为 read-1。  
> 工具结果：对应 read-1，页面写着“周二 19:30”。  
> 助手的回答：乙课程周二 19:30 上课，并附上来源。

应用一开始还会提供任务规则和可用工具说明。模型根据这些输入选择动作；工具结果回来后，应用把已有对话、调用记录和结果组织成下一轮输入。助手这时才有依据回答。

## 别把结果接错了地方

如果同时读取甲乙两个页面，每个结果都需要对应自己的调用。不能把“甲课程周三开课”接到乙的请求后面，否则模型看到的记录从一开始就是错的。

工具请求、工具结果、最终回答也要分开保存。**“准备读取”“读取成功”“根据原文回答”是三个不同事件。** 看懂这条消息链，就能检查问题究竟出在调用、执行，还是结果没有进入模型输入。

## 交互演示

对照用户界面与实际消息流。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "tool-messages",
  "title": "对照用户界面与实际消息流",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

示例是便于阅读的角色记录，不是某个接口的完整请求格式。不同 API 可能把调用与结果表示为消息、内容块或事件项；系统说明也可能单独传入，所以一次调用并没有通用固定的“消息条数”。

实现时要保留工具调用标识，把每个结果关联到原请求。并行调用完成顺序可能不同，按返回顺序猜测归属并不可靠。模型一轮也可能返回多个工具请求，收到结果后还可能继续请求工具。程序需要处理完整往返，不能默认一次调用后一定紧接着最终文字答案。

参考 [工具调用流程与调用结果关联](https://developers.openai.com/api/docs/guides/function-calling)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='2.2 消息结构：一次工具调用，消息怎样来回传递？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='02 · Function Calling：让模型连接真实工具') parent);

UPDATE knowledge_sections SET content_markdown='研究助手明明有读取工具，却总用搜索工具反复找同一个课程。工具能运行，不代表模型容易选对。它首先看到的是工具说明，而不是你脑中对工具的理解。

## 把用途、输入和结果讲明白

一个叫“万能查询”的工具很难判断何时使用。把它换成清楚的说明，会更容易理解：

> 搜索课程：按关键词找候选来源，返回页面标识和摘要。  
> 读取来源：接收已经找到的页面标识，返回正文和来源信息。  
> 保存报告：把已核对的报告写入指定位置，返回保存结果。

搜索负责发现来源，读取负责获得原文，保存负责交付产物。描述要说明适用情境，参数要让模型知道该填什么，返回值要让它知道接下来还能做什么。

## 用一次选错，检查哪里含糊

如果读取工具返回“成功”，却只拿到被截断的页面，模型可能以为费用不存在。更有用的结果是说明“正文已截断，尚未覆盖全部页面”，让助手继续读取或明确留下缺口。

先拿研究助手最常见的任务检查工具：已有页面时会不会正确读取？费用缺失时能不能识别？保存完成后有没有回执？**工具设计要围绕下一步需要的判断。**

## 交互演示

比较工具说明如何改变调用过程。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "tool-design",
  "title": "比较工具说明如何改变调用过程",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

工具粒度没有统一答案。过大的工具把多个动作绑在一起，可能让错误难以定位；过细的工具则会增加调用轮次，并让模型在相近名称间反复选择。可以先用少量职责清楚的工具，再根据真实失败案例调整拆分方式。

输入与返回结构也应一起设计。例如读取接收来源标识时，搜索就要返回可供后续读取的标识；缺失、无权限和内容截断应当能够区分。工具说明帮助模型选择，执行程序仍要验证资源和参数。把这些检查写进描述，并不能代替实际检查。

参考 [Anthropic：怎样为 Agent 设计清楚的工具接口](https://www.anthropic.com/research/building-effective-agents#appendix-2-prompt-engineering-your-tools)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='2.4 工具设计：描述和参数怎样影响 Agent 的选择？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='02 · Function Calling：让模型连接真实工具') parent);

UPDATE knowledge_sections SET content_markdown='研究助手要读取甲乙两个课程页面。如果先读完甲再读乙，总要多等一段时间。能不能同时读？先看两个动作之间有没有依赖。

## 独立的事一起做，有依赖的事按顺序

并行，是让互不依赖的工作同时推进。甲乙页面都已经找到，读取甲不需要乙的内容，读取乙也不需要甲的结果，就可以同时发起。

串行，是下一步必须等待上一步。还不知道报名页地址，就得先搜索再读取；两门课的费用还没核对完，就不能生成一份宣称资料完整的比较报告。

一个简单的安排是：“找到来源 → 同时读取甲乙 → 汇总并核对 → 保存报告”。**判断能不能并行，先找下一步需要谁的结果。**

## 有一个工具失败，结果怎样合并

如果甲读取成功，乙超时，已经拿到的甲资料可以保留。助手应根据乙的失败情况决定有限重试、换来源或标注缺口，而不是把甲也当成没有读取。

并行也会让结果顺序变化。先返回的未必是甲，所以每份结果都要带上对应来源。报告汇总的是两门课各自的证据，而不是“第一条结果”和“第二条结果”。

## 交互演示

切换串行、并发和分批执行。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "orchestration",
  "title": "切换串行、并发和分批执行",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

可以把执行过程画成依赖图：节点是动作，连线表示“必须先拿到这个结果”。只有依赖已满足的动作，才进入可执行队列。程序还需要限制同时运行的数量，考虑服务限流、连接数和共同写入同一文件等情况。

并行通常能减少独立请求的等待叠加，但不会自动减少请求次数或模型用量。结果合并还需要明确失败策略：是某个关键动作失败就停止，还是保留其他成功结果后再处理缺口。不要让“同时执行”悄悄变成“无论是否齐全都继续交付”。

参考 [LangGraph：并行与其他工作流模式](https://docs.langchain.com/oss/python/langgraph/workflows-agents)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='2.5 多工具编排：哪些能并行，哪些必须按顺序？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='02 · Function Calling：让模型连接真实工具') parent);

UPDATE knowledge_sections SET content_markdown='助手第一次搜索找到了甲课程费用和乙课程介绍。乙的页面只写“详情见报名页”。如果到这里就直接生成比较，报告里仍然缺少乙的费用。

## 让这次结果决定下一步

ReAct 是把推理与行动结合的一种思路。先用简单方式理解：根据已有信息选择行动，接收行动结果，再决定接下来做什么。

在研究助手里，这个过程可以是：

> 搜索课程 → 发现乙的费用缺失 → 读取报名页 → 找到当前班次费用 → 核对比较条件 → 生成报告。

重点在于“发现缺失”怎样改变后续动作。若报名页仍没有费用，下一步就要继续寻找合适来源，或把这项信息标为待确认。

## 循环需要程序把环节接起来

工具返回结果后，程序要把它交给下一轮模型，并记录已经确认的资料。模型随后可以请求另一个工具，也可以给出完成说明。

没有新信息、没有可行工具，或已经达到完成条件时，循环就应该改变方向或结束。**循环的价值来自反馈让行动更合适。** 单纯把相同请求再发几遍，不会让缺失的价格自动出现。

到这一节，我们的助手开始能够处理查资料时遇到的分岔，而不必提前列出所有可能的网页路径。

## 交互演示

观察订酒店任务怎样依据反馈继续行动。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "react",
  "title": "观察订酒店任务怎样依据反馈继续行动",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

ReAct 原始研究探索了交替生成推理文本、行动和环境观察的方式。本课程用公开的行动记录和工具结果解释反馈循环；这些记录不能当作模型内部计算的完整复原，也无需要求模型公开完整思维过程。

工程实现还要区分“模型提议的下一步”和“程序允许执行的下一步”。程序负责检查工具是否可用、结果是否成功、是否还有预算，并组织下一轮输入。ReAct 是理解这类协作的一个入口，实际系统也可以采用固定工作流、先计划后执行等安排，按任务选择合适的组合。

参考 [ReAct 原始研究与示例](https://react-lm.github.io/)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='3.1 ReAct：怎样把行动结果变成下一步的依据？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='03 · 计划与运行循环：让 Agent 自己推进任务') parent);

UPDATE knowledge_sections SET content_markdown='报告写到一半，助手又把已经排除的周末班放回比较表。它是真的“忘了”，还是本轮根本没看到“只选晚班”这条要求？

## Token 是模型处理信息的小块

模型会把文字等输入转换成小块信息，称为 Token。一个汉字、单词或标点会占多少块，取决于模型使用的切分方式，不能统一按“一个字等于一个 Token”计算。

上下文窗口可以理解为这一轮可使用的容量。用户的话、规则、工具说明、历史记录和工具返回都可能占用它，还需要为新输出留空间。反复把同一份长网页放进去，容量和处理成本都会增加。

## 先看它收到什么，再判断为什么遗漏

容量不足时，应用可能裁掉旧消息或换成摘要。如果“只比较晚班”被删掉，模型自然缺少这条条件；即使它仍在输入里，也不能保证模型每次都注意到。

研究助手应把当前范围单独放在容易找到的位置，只带入相关班次，长资料按需读取。出现遗漏时，先检查本轮真实输入，确认关键条件是否还在，再决定补充信息或调整组织方式。换更大的窗口，有时有帮助，但资料选择仍然要做。

## 交互演示

观察消息怎样占用上下文窗口。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "context-window",
  "title": "观察消息怎样占用上下文窗口",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

窗口上限、单次输出上限和实际用量是不同指标。实现程序应按使用的模型与接口计数，给输出预留容量，并观察真实请求的耗时与用量；不能用字数估算替代严格的请求边界检查。[Claude 的上下文窗口说明](https://platform.claude.com/docs/en/build-with-claude/context-windows)展示了历史、工具使用与输出如何共同影响容量。

排查长对话问题时，可分别记录“未发送”“被裁剪”“被压缩”“已发送但未被正确使用”。这几种情况表现相似，修复位置却不同。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='4.2 Token 与上下文窗口：它为什么聊着聊着就“忘了”？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='04 · 上下文工程与记忆：让 Agent 记住重点') parent);

UPDATE knowledge_sections SET content_markdown='乙课程原文写着：“基础晚班 1600 元，教材另计，优惠月底结束。”压缩后的笔记却只剩“乙课程 1600 元”。文字短了，比较条件也丢了。

## 压缩要留下会改变结论的条件

上下文压缩是把较长的过程整理成更短的记录，让后续任务能够继续。它可以删除重复搜索、无关介绍和已经放弃的方案，同时保留目标、当前结论、未解决问题和证据位置。

这段课程资料至少应留下：基础晚班、1600 元、教材另计、优惠期限，以及原文来源。它们都会影响费用比较。把记录压成一句漂亮的概括，却省掉适用范围，后续就容易拿不同班型直接比较。

## 留一份能继续工作的交接记录

给研究助手的短记录可以这样写：

> 目标：比较甲乙晚班。甲资料已齐。乙基础晚班标价 1600 元，教材另计；优惠月底结束。仍缺乙教材费。原文见来源 B 的费用段落。

下一轮看这段记录，就知道哪些已确认、哪些还要查。关键数字核对不清时，回到原文，而不是继续把摘要当成事实。压缩以后也要检查：下一步是否还能依据同一组条件作出决定？

## 交互演示

拖动滑块观察上下文压缩。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "compression",
  "title": "拖动滑块观察上下文压缩",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

压缩存在信息损失风险，宜把用户要求、未完成动作和已确认事实分别整理，避免摘要把“准备查询”写成“已经核实”。对金额、日期、引用和操作回执，可以保留原值及来源，不让摘要自由改写。

实现上既可以主动生成摘要，也可以在达到容量阈值后压缩；还可只移除已不需要的工具结果。应先用带有边界条件的真实任务核对压缩前后的行动是否一致，再调整保留策略。[Compaction 官方说明](https://platform.claude.com/docs/en/build-with-claude/compaction)介绍了摘要替换历史及保留近期内容的几种方式。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='4.3 上下文压缩：哪些能删，哪些必须留？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='04 · 上下文工程与记忆：让 Agent 记住重点') parent);

UPDATE knowledge_sections SET content_markdown='用户搜索“下班以后能学的课程”，资料里却写着“工作日晚间授课”。两句话没有完全相同的关键词，系统怎样把它们联系起来？

## 给文字一个可以比较的位置

Embedding 会把文字转换成一组数字，称为向量。可以先把它想成按内容安排的坐标：表达相关含义的文字，可能被放在相近位置。这里的“相近”由所用模型和比较方式决定。

准备课程知识库时，先为各段资料生成向量；查询时也把用户问题转换为可比较的向量，再查找接近的资料。这就是向量检索。它让研究助手有机会找到不同措辞下的相关内容，而不只依赖字面匹配。

## 相似的内容，仍然要逐条核对

“晚间班已开放报名”和“晚间班已停止报名”谈的是相近主题，实际含义却相反。相似度高，只能说明它值得检查，不能证明它回答了问题。

研究助手取回片段后，还要核对班型、日期、否定条件和原始来源。课程编号、精确金额等内容也可以结合关键词筛选。先把候选资料找回来，再判断它们是否足以作为结论依据。

## 交互演示

观察记忆示例中的向量检索。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "vector-search",
  "title": "观察记忆示例中的向量检索",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

文档向量和查询向量需要采用兼容的模型与配置；更换嵌入模型后，旧向量通常不能直接混用。短问题检索长段落，还要注意模型是否适合这种不对称检索任务。[Sentence Transformers 的语义检索文档](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html)解释了这类区别。

资料规模较小时，可直接计算候选相似度；规模扩大后再考虑索引与向量数据库。候选较多时，还可以用 Rerank 重新比较问题与片段的相关性。它改善排序，仍不替代事实核验；可参考[检索与重排示例](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='5.2 Embedding 与向量检索：怎样按含义找到相关内容？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='05 · RAG 与知识库：让回答有资料依据') parent);

UPDATE knowledge_sections SET content_markdown='每次比较课程，你都要提醒助手：“先统一班型，再核对费用；有缺项就补查；报告必须带来源。”这套做法已经反复用过，能不能保存下来，下次直接使用？

## 把有效的方法整理成可读取的指南

Skill 可以理解为一份围绕特定任务组织的做事指南。它说明什么时候适用、需要哪些输入、怎样完成任务，以及最后检查什么。必要时还可以配上模板、参考资料和脚本。

研究助手的“课程比较”技能，可以要求先确认晚班和比较日期，再收集费用与安排，最后检查是否拿了相同班型作比较。下次遇到相近任务，系统找到这份技能，助手再读取其中的方法，并结合当前条件执行。

## 复用经验，也要允许情况变化

好的技能应该留下真正有用的经验。例如“优惠价格要保留截止日期”，就比“认真查资料”更能指导行动。它也应说明遇到缺失信息时怎么办，避免为了凑齐报告而猜测。

课程类型、可用工具或项目规则变化后，技能仍需要更新和验证。保存一份技能文件，是给 Agent 增加可读取的说明与资源，模型参数并没有因此被重新训练。

## 交互演示

比较有无 Skill 时的执行路径。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "skill",
  "title": "比较有无 Skill 时的执行路径",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

Agent Skills 的开放格式以包含 SKILL.md 的目录组织技能，也可附带脚本、参考文档和素材。兼容的运行程序可以先加载名称与简介，匹配任务后再读取正文，需要时才加载附加资源。[Agent Skills 官方概述](https://agentskills.io/home)

这种按需加载减少了无关说明占用上下文，但是否选对技能、是否正确执行，仍要通过任务样例检查。设计时宜从已经完成的具体工作提取步骤、纠正记录和验收条件，再用成功与失败案例改进，而不只堆积通用建议。[技能编写实践](https://agentskills.io/skill-creation/best-practices)给出了类似的组织方法。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='6.1 Skill 入门：怎样复用一套做事方法？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='06 · Skill 与 MCP：复用方法，扩展能力') parent);

UPDATE knowledge_sections SET content_markdown='上节的方法要真正留下来，需要有一个程序能找到、助手能读懂的入口。课程比较技能的入口文件就可以叫 SKILL.md。

## 先让它知道这份技能什么时候有用

一份技能文件需要回答三个问题：它做什么，什么时候用，具体怎么做。假如简介只写“帮助用户”，系统很难判断是否适合本次任务；写成“比较两门课程的费用与上课时间，生成带来源的一页报告”，范围就清楚得多。

执行说明则要接住常见分岔：班型不一致先统一，费用缺失继续查，查不到就明确列为未知。最后写上交付要求，让助手能对照检查，而不是把完成标准留给它临时猜测。

## 文件短一些，步骤具体一些

可以先只写这一个任务，等确实出现重复需求再拆分。报告模板和较长的领域资料可以放在旁边，用文件路径引用；工具、脚本或外部连接则由运行环境另外提供。

阅读技能时，可以逐句问：“这句话会改变下一步行动吗？”把模糊口号改成可执行的条件，把来源、例外和交付要求留下来，文件就更容易被正确使用。

## 交互演示

展开一份 Skill 文件并观察执行管线。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "skill-file",
  "title": "展开一份 Skill 文件并观察执行管线",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

下面是一份符合 Agent Skills 基本格式的教学示例，可保存为 course-compare/SKILL.md；它不是从已有产品中摘录的技能。

~~~markdown
---
name: course-compare
description: 比较两门课程的费用与上课时间，生成带来源的一页报告。
---
# 课程比较

1. 确认课程、班型、日期与用户可学习时段。
2. 收集同口径的费用和安排，记录来源。
3. 缺少关键条件时补查；无法确认的内容标为未知。
4. 生成一页报告，检查费用条件、引用和未解决项。
~~~

文件头采用 YAML，包含名称与用途描述，后面是 Markdown 指令；名称应与目录名相同，其他格式限制见 [Agent Skills 规范](https://agentskills.io/specification)。这份说明没有创建搜索工具或授予文件权限。安装、发现、加载和执行仍依赖支持该格式的运行程序。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='6.2 SKILL.md 拆解：一份真实的技能文件里有什么？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='06 · Skill 与 MCP：复用方法，扩展能力') parent);

UPDATE knowledge_sections SET content_markdown='研究助手已经会搜网页，现在还想读取内部课程库。再加一个文档系统时，又要为它重新处理工具列表和调用格式。有没有一种双方都认识的连接方式？

## 先约定怎样介绍能力、怎样交换结果

MCP 是 Model Context Protocol，即模型上下文协议。可以把它理解为应用与外部能力之间的一套交流约定：对方能提供什么，输入需要什么，调用以后怎样返回结果。

例如，内部课程库通过一个 MCP 服务提供“查询课程资料”的能力。研究助手所在的应用连接服务，发现可用工具，再把合适的工具交给模型选择。模型提出查询后，程序发送请求，拿到结果，再放回任务中使用。

## 接通以后，还要知道该怎么用

统一协议让接入方式更容易复用，但它不会自动替我们完成课程比较。该查哪门课、缺什么资料、何时保存报告，仍然属于应用和 Agent 的任务逻辑。

不同服务支持的能力、账号能访问的数据也可能不同。研究助手要读清工具说明和返回内容；查询失败时，不能因为连接已经建立，就把资料当成已获取。连接成功、调用成功和任务完成，是三个需要分别检查的结果。

## 交互演示

切换 MCP 传输示例并观察消息流。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "mcp",
  "title": "切换 MCP 传输示例并观察消息流",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

MCP 架构中，Host 是承载 AI 功能的应用，Client 负责连接，Server 提供能力。协议关注信息交换，不规定应用必须怎样调用模型或管理上下文。[MCP 架构概述](https://modelcontextprotocol.io/docs/learn/architecture)

除 Tools 外，服务还可提供 Resources 和 Prompts，分别用于提供上下文资源和可复用提示模板。应用决定怎样把它们带入用户任务；数据访问、调用校验和必要的用户控制仍需正确实现。[服务端能力说明](https://modelcontextprotocol.io/docs/learn/server-concepts)及站内 [MCP 与工具生态课程](/knowledge/mcp)提供进一步展开。',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='6.3 MCP 协议：不同工具怎样用统一方式接入？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='06 · Skill 与 MCP：复用方法，扩展能力') parent);

UPDATE knowledge_sections SET content_markdown='研究助手已经生成课程对比报告，保存时却遇到超时。它连续点了三次“再试一次”，目录里最后出现三份内容相同的报告。

重试就是重新发起一次操作。它适合解决暂时的问题，但每次重试前，要先知道上次发生了什么。

## 先分清失败，再选择下一步

读取网页暂时超时，可以稍后再试；地址已经失效，就应该换入口搜索；参数里的课程名称写错了，需要先修参数。把这些情况都交给“原样重试”，通常只会更快耗尽预算。

保存超时还多一层问题：服务器可能已经写好文件，只是成功回执没有传回来。此时状态是“结果未知”，应先查询上次操作或检查目标文件，再决定是否重发。

## 每次尝试都要有新的理由

助手发现乙课程的报名页已迁移，换到新地址后读到了时间安排，这次继续有实际进展。如果只是连续收到同一个错误，就应记录缺口，换方法或结束当前尝试。

可以给本次研究设置有限次数与总时限。用尽额度时，交付已核实的甲课程资料，明确乙课程仍缺什么，比没有尽头地等待更有用。

## 交互演示

比较五类故障及其处理路径。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "failures",
  "title": "比较五类故障及其处理路径",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

执行层可以把错误区分为暂时故障、参数问题、权限拒绝和结果未知，并返回是否适合重试。对暂时故障采用逐渐增加的等待时间，并加入少量随机间隔，避免许多请求同时再次到达；重试也要计入原任务预算。

有副作用的操作需要幂等设计：同一项写入使用稳定的操作标识，让服务端识别重复请求并返回已有结果。标识应对应同一意图和内容，改变报告内容后不能继续冒用旧标识。仅在客户端“先查再写”，仍可能被并发请求打断。

[AWS：让重试通过幂等 API 保持安全](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)。
',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='7.1 失败处理与重试：一直重试，为什么还是没有进展？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='07 · 失败与安全：让 Agent 在边界内工作') parent);

UPDATE knowledge_sections SET content_markdown='研究助手准备把报告保存为 course-report.md，却发现那里已经有一份旧报告。用户说过“整理一份报告”，但还没说是否要替换旧文件。

这时需要的不是继续猜测，而是把这个决定交回用户。Human-in-the-loop，简称 HITL，就是在需要人判断的地方暂停，收到明确输入后再继续。

## 让人决定真正影响结果的事

助手可以说明：“目标文件已存在。要保留旧版并另存，还是覆盖？这是本次准备写入的内容。”

用户能看见将发生的变化，才能作出有意义的选择。课程名称存在歧义、资料结论互相矛盾，也可能需要人补充条件；普通标题措辞或未指定的文件名，通常可以使用合理默认值。

等待覆盖决定时，已经完成的检索和证据整理可以保存下来，避免用户回答后又从头开始。

## 确认之后，也要对得上这次动作

用户同意覆盖的是刚看到的那份草稿。如果助手随后又改了大段结论，或者目标文件已经被别人更新，就需要重新核对，不能把先前的一次同意用在所有后续修改上。

人参与的位置要清楚：问题是什么、有哪些选择、选完会做什么。这样暂停才是在解决关键不确定性，而不是把每一步都推给用户。

## 交互演示

切换权限模式并允许或拒绝操作。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "approval",
  "title": "切换权限模式并允许或拒绝操作",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

可以把等待确认保存为一种任务状态，同时记录操作类型、目标资源、内容摘要、目标版本和确认人。执行时检查这些条件是否仍一致；内容或目标发生实质变化时，旧确认失效。对覆盖操作，可用版本号或内容摘要检测“确认后文件又变了”的情况。

框架的暂停与恢复机制负责保存流程位置，业务系统仍需校验用户身份及其对该资源的权限。恢复也可能重新执行暂停点前的一段程序，因此那些写入操作需要防止重复。

[LangGraph：暂停与恢复](https://docs.langchain.com/oss/python/langgraph/interrupts) · [OWASP：授权检查](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。
',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='7.2 Human-in-the-loop：什么时候应该暂停，让人来判断？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='07 · 失败与安全：让 Agent 在边界内工作') parent);

UPDATE knowledge_sections SET content_markdown='报告写着乙课程每周上两晚，原网页却只写周四一晚。助手解释“已经核对过”，你仍然不知道错误出现在哪一步。

Tracing，执行追踪，就是把一次任务中的重要事件连起来，让你能沿着记录找回当时发生的事情。

## 顺着证据往前找

先找到报告中这句话对应的来源，再看读取工具实际返回了什么。如果原文正确，就继续查下一轮输入：是不是摘要把“隔周加课”写成了“每周两晚”？

一次任务里至少要分清模型请求、工具调用、工具结果和状态变化。“准备读取乙课程”表示一个意图；收到正文并记录来源后，才有已读取的证据。

记录这些事件，比事后让模型重新猜测自己当时为什么这样做更可靠。

## 留下能用于排查的记录

为每次研究分配任务标识，把相关调用、耗时、成功或失败、使用的来源以及最终文件关联起来。这样才能看出：是工具读错了页面，还是整理信息时丢掉了条件。

记录也能回答效率问题：同一网页是否反复读取？等待主要花在哪里？先找到最早出现的偏差，再修对应环节，通常更容易定位问题。

## 交互演示

观察执行事件怎样组成一条任务记录。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "tracing",
  "title": "观察执行事件怎样组成一条任务记录",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

工程上可以把一次操作记录为 span，再用 trace 标识和父子关系连接整个任务。异步工具与子 Agent 需要继续传递关联信息；重试要能够识别是同一操作的不同尝试。

可见轨迹应记录实际请求、结果、状态和必要的简短行为说明，不把模型生成的解释当作完整内部计算记录。原始输入输出可能包含账号、个人资料或密钥，因此要控制采集范围、脱敏、访问权限和保留时间。工具的“成功”也要与业务验证结果分开记录。

[OpenTelemetry：Trace 与 Span](https://opentelemetry.io/docs/concepts/signals/traces/)。
',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='8.1 Tracing：一次任务里，模型和工具到底做了什么？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='08 · Agent 工程：从“能运行”到“能交付”') parent);

UPDATE knowledge_sections SET content_markdown='研究助手现在要比较两门课。甲乙的资料可以分别查找，这时可以让一个助手负责甲，另一个负责乙，最后由主助手整理成报告。

Multi-Agent 就是多个 Agent 协作；Subagent，子 Agent，是被分配一部分任务、向主 Agent 返回结果的工作者。

## 先划分能独立交付的工作

适合拆开的任务，要能说清各自负责什么、返回什么。例如两位研究者各交一张证据表，列出费用、上课时间、班次、来源与未解决问题。

主助手统一比较口径，再核对结论。子 Agent 直接同时修改同一份报告，反而容易互相覆盖；先各自提交材料，通常更容易合并。

如果只是接着读同一张网页，拆分未必能省下多少时间。

## 多一个助手，也多一份协调工作

子 Agent 需要获得足够背景，但不必接收整段历史。分工还会增加模型调用、结果检查和等待成本，任务很小时，一个 Agent 可能更直接。

两位研究者得出相同结论，也要检查是否都用了同一篇过期资料。独立运行不自动产生独立证据。协作是否值得，要看交付质量和总成本，而不只看角色数量。

## 交互演示

观察协调者与子任务的状态变化。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "multi-agent",
  "title": "观察协调者与子任务的状态变化",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

编排层需要定义子任务输入、可用工具、预算、输出格式以及超时和失败处理。结果最好带上来源与任务版本；当用户已修改范围，晚返回的旧结果不能直接合并到新报告。

主从分工可保持主 Agent 负责整合，交接控制权则是另一类协作方式。不同框架对 handoff 的含义与状态传递方式有所区别，设计时要明确谁负责接下来的行动。共享写入、取消任务和重复执行，需要额外的协调机制；先从可独立返回结果的小分工开始更容易验证收益。

[Anthropic：多 Agent 研究系统的设计经验](https://www.anthropic.com/research/multi-agent-research-system)。
',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='8.3 Multi-Agent 与 Subagent：什么时候需要分工协作？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='08 · Agent 工程：从“能运行”到“能交付”') parent);

UPDATE knowledge_sections SET content_markdown='同一个模型放进两个程序：一个能记住已读来源、处理失败并保存报告，另一个搜索几轮就开始重复。差别可能出在模型周围的运行设施。

Agent Harness 可以理解为支撑 Agent 工作的整套运行框架。它让模型提出的行动接上真实工具，也让任务在多轮执行中保持连续。

## 把前面学过的职责接起来

研究助手开始前，需要组织任务、规则和可用工具；每次模型提出动作，程序检查后执行，再把结果交回下一轮。状态记录进度，预算限制资源，权限约束动作范围。

报告生成后，还要检查来源、缺口和保存结果。这些连接与检查共同决定任务怎样运行，不能只靠一段提示词承担。

Harness 的具体组成会随任务变化，简单任务也可以只用很少的程序连接这些职责。

## 框架帮你搭结构，决定仍要自己写清楚

可以自己实现运行循环，也可以借助现有框架。无论选择哪种方式，都要能回答：下一轮带什么信息？工具失败怎么办？任务结束的证据是什么？

当任务跨越多次会话，记录会变得更重要。下一轮应能接到已确认的来源、产物和待办，而不是靠重新阅读一大段聊天去猜测进度。

## 交互演示

比较有无 Harness 的任务执行。

~~~agent
{
  "kind": "reference-demo",
  "demoId": "harness",
  "title": "比较有无 Harness 的任务执行",
  "prompt": "操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。"
}
~~~

## 深入阅读

Harness 常涉及上下文构建、工具调度、持久化、权限、预算、追踪和验证，边界并没有唯一固定的划分。评估系统时，应把模型、运行程序与环境一起看：换一个工具返回格式，也可能改变整段任务的表现。

长任务可在每个阶段留下小而明确的产物，例如证据表、草稿版本和待解决问题。恢复时先读取这些记录，再核对外部变化。框架提供的自动管理仍需结合业务规则配置与测试；阶段结束时保留可验证成果，比只保留“已完成”的自然语言说明更有价值。

[Anthropic：长任务 Agent 的运行框架](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents)。
',updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents') AND node_type='LESSON' AND status='PUBLISHED' AND title='8.4 Agent Harness：模型之外，谁在管理整套运行？' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type='DIRECTORY' AND title='08 · Agent 工程：从“能运行”到“能交付”') parent);
