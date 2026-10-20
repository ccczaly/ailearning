-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.

-- V8 revises the two 1950 lessons in place, preserving section IDs and user progress.

-- V7 and V8 are immutable after application. Add a new migration for future revisions.

UPDATE knowledge_points SET estimated_minutes=386, updated_at=CURRENT_TIMESTAMP(3) WHERE slug='llm-basics';

UPDATE knowledge_sections SET title='它会接话，就算听懂了吗？', content_markdown='## 先当一次客服判官

你等了两个小时，订单还没发货。你对客服说：“你们效率可真高。”你更愿意收到哪个回复？

~~~learning-activity
{
  "type": "choice",
  "id": "1950-service-reply",
  "title": "哪句话更接得住你的意思？",
  "options": [
    {
      "id": "a",
      "label": "“谢谢夸奖，我们会继续努力。”",
      "feedback": "它认出了“效率高”这几个字，却把抱怨当成了夸奖。结合等待两小时的背景，这样的回复容易让你更生气。"
    },
    {
      "id": "b",
      "label": "“让你久等了，我帮你查一下发货情况。”",
      "feedback": "它结合等待的背景，接住了你的不满，也给出下一步。但“帮你查”只是承诺；订单状态仍要真的查询。"
    }
  ],
  "correctOptionId": "b",
  "takeaway": "语言不只有字面意思。要回应得合适，还需要看说话的场景和对方想解决的问题。"
}
~~~

*本章互动均为预设教学情境。*

这两句回复都很通顺，差别却很大。你说“效率高”，真正想表达的可能是“怎么还没发货”。人类聊天时常会自动补上这些背景；对机器来说，这就是需要处理的难题。

## 把时钟拨回 1950 年

今天我们习惯了对着聊天框提问。但在 1950 年，数学家艾伦·图灵已经在追问：机器能思考吗？直接讨论“思考”是什么，很容易争论不休。

他在论文中提出“模仿游戏”，把问题放进一个可以观察的交流场景：提问者看不到另一头的人，只能通过文字问答作判断。接着，他讨论让机器参与这个游戏会怎样。这成为后来讨论“图灵测试”的起点。

交流中，外貌、声音、表情都不再是线索；提问者只能继续问，看回答是否跟得上。

**1950 年是这条课程的思想起点。** 这篇论文没有提供今天大语言模型的训练方案。我们先从它提出的问题出发，再沿着时间线看研究者怎样寻找办法。

## 聊得自然，也要查得真实

回到订单场景。一个客服可以很体贴，也可以把发货日期说错。“听起来懂我”和“这件事是真的”需要两种检查。语气流畅、回答自信，都不能代替订单记录。

这也是使用 AI 的习惯：先看它有没有接住需求，再看它给出的事实有没有依据。语气让人舒服，是好的开始；作判断还需要证据。

## 自测与解析

~~~learning-activity
{
  "type": "choice",
  "id": "1950-conversation-and-evidence",
  "title": "客服接着说：“包裹明天一定到。”光看刚才的对话，能相信这个保证吗？",
  "options": [
    {
      "id": "a",
      "label": "能，它已经理解我的不满了。",
      "feedback": "接住情绪并不等于知道包裹在哪。我们还没看到物流记录或可靠的预计送达信息。"
    },
    {
      "id": "b",
      "label": "还不能，需要查询物流信息。",
      "feedback": "对。对话表现与事实依据要分别检查。查到记录后，还要看记录是否支持“明天一定到”这个保证。"
    },
    {
      "id": "c",
      "label": "不能，所以它说的每句话都不可信。",
      "feedback": "也不必一概否定。它可能准确识别了你的不满，但发货承诺仍缺少证据。应该逐项判断。"
    }
  ],
  "correctOptionId": "b",
  "takeaway": "会接话是交流表现；事实是否正确，要用可靠信息来核实。"
}
~~~

## 参考与下一站

[图灵原始论文：Computing Machinery and Intelligence，1950](https://doi.org/10.1093/mind/LIX.236.433)

下一节只改一点背景，看看同一句话的意思怎样跟着变。', estimated_minutes=3, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND node_type='LESSON' AND status='PUBLISHED' AND title='从智能问题到语言任务' AND sort_order=1;

UPDATE knowledge_sections SET title='同一句话，为什么能有不同意思？', content_markdown='## “这个苹果不错”，说的是什么？

朋友发来一句：“这个苹果不错。”你能马上确定他在夸什么吗？先看没有背景的版本，再切换两个场景。

~~~learning-activity
{
  "type": "context",
  "id": "1950-apple-context",
  "title": "换个场景，意思会变吗？",
  "phrase": "这个苹果不错。",
  "scenes": [
    {
      "id": "unknown",
      "label": "没有背景",
      "context": "你只收到这一句话，没有之前的聊天，也不知道朋友在哪里。",
      "interpretation": "信息还不够。它可能在说水果，也可能在说苹果公司的产品。先问“你说的是水果还是手机？”会比直接猜更稳妥。"
    },
    {
      "id": "fruit",
      "label": "水果摊",
      "context": "朋友站在水果摊，刚尝了一口，还说：“脆，也很甜。”",
      "interpretation": "现在，“苹果”指向水果，“不错”在评价口感。刚才模糊的意思，被地点和后一句话补清楚了。"
    },
    {
      "id": "phone",
      "label": "手机店",
      "context": "朋友在手机店试用一部苹果手机，接着说：“拍照效果挺好。”",
      "interpretation": "现在，他是在评价这部手机。词语没变，周围信息变了，应该理解出的意思也跟着改变。"
    }
  ]
}
~~~

## 背景就是理解的线索

这些帮助判断的前后文和场景，叫作**上下文**。你可以把它想成一句话周围的线索：前面聊了什么、现在讨论哪个对象、说话的人想做什么。线索不足时，“我还不确定”也是一个有用的回答。

这不只涉及“苹果”。“它明天能到吗”里的“它”，也需要联系前文判断。

先记住这个动作：**意思不清楚时，补背景或问一句。** 比如请 AI 帮你回复时，补上“朋友在水果摊试吃，说苹果很甜”，它才更容易接得合适。

## 自测与解析

再来一句更容易让简单程序踩坑的话。它看到了两个“担心”，但你知道两个对象的地位并不相同。

~~~learning-activity
{
  "type": "choice",
  "id": "1950-negation-and-intent",
  "title": "朋友说：“我不担心考试，只担心迟到。”哪句回应更合适？",
  "options": [
    {
      "id": "a",
      "label": "“你为什么担心考试？”",
      "feedback": "它抓到了“担心”和“考试”，却漏掉了“不”。朋友已经明确说考试不是他担心的事。"
    },
    {
      "id": "b",
      "label": "“要不要提前一点出门？”",
      "feedback": "对。朋友真正担心的是迟到，提前出门是在回应这个问题。“不”和“只”帮助你排除了错误对象。"
    },
    {
      "id": "c",
      "label": "“原来考试和迟到都让你担心。”",
      "feedback": "这把两个“担心”一视同仁了。“不担心考试”与“只担心迟到”需要连起来读，不能只数关键词。"
    }
  ],
  "correctOptionId": "b",
  "takeaway": "识别出词语还不够；否定、对象和前后关系，都会改变一句话的意思。"
}
~~~

## 多了解一点：名字不用急着背

~~~learning-activity
{
  "type": "glossary",
  "id": "1950-language-glossary",
  "title": "多了解一点：三个常见名字",
  "items": [
    {
      "term": "人工智能（AI）",
      "description": "研究让机器完成通常需要智能的任务。处理语言是其中一个方向。"
    },
    {
      "term": "自然语言处理（NLP）",
      "description": "研究计算机怎样处理人平时使用的语言，例如翻译、提取信息或生成回复。"
    },
    {
      "term": "语言模型（LM）",
      "description": "为文本及其后续内容建立概率模型，也就是估计“接下来可能出现什么”。大语言模型是这个方向发展出的模型。"
    }
  ]
}
~~~

## 参考与下一站

如果我们写个程序，见到“担心”就追问，见到“苹果”就套一句回复，它能聊多久才露馅？1966 年发表的 ELIZA 展示了利用关键词和规则接话的办法。下一站，我们亲自试试这种思路。

[ELIZA 原始论文，1966](https://doi.org/10.1145/365153.365168)', estimated_minutes=4, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug='llm-basics') AND node_type='LESSON' AND status='PUBLISHED' AND title='怎样阅读这条技术时间线' AND sort_order=2;
