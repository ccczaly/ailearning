import type { AgentCapabilityLab } from './agent-interaction';

type Message = { role: string; content?: string | null; tool_calls?: unknown[]; tool_call_id?: string };
export type DemoStep = { title: string; summary: string; explanation: string; payload: unknown };

// Illustrative tool-calling messages. All responses and tool results are local fixtures.
export function capabilityDemo(lab: AgentCapabilityLab, selected: string[]): DemoStep[] {
  const definitions = [
    { id: 'search', name: 'search_sources', description: '搜索课程资料，返回网页标识', field: 'query', descriptionField: '搜索关键词' },
    { id: 'read', name: 'read_source', description: '读取已搜索到的网页正文', field: 'source_id', descriptionField: '网页标识' },
    { id: 'save', name: 'save_report', description: '保存课程比较报告', field: 'content', descriptionField: '报告正文' },
  ].filter(tool => selected.includes(tool.id));
  const tools = definitions.map(tool => ({ type: 'function', function: {
    name: tool.name, description: tool.description,
    parameters: { type: 'object', properties: { [tool.field]: { type: 'string', description: tool.descriptionField } }, required: [tool.field], additionalProperties: false },
  } }));
  const messages: Message[] = [
    { role: 'system', content: '根据工具结果比较课程费用。缺少能力或资料时说明局限，不编造价格或保存结果。' },
    { role: 'user', content: lab.task },
  ];
  const steps: DemoStep[] = [];
  let round = 0;
  const request = () => steps.push({ title: `程序 → 模型：第 ${++round} 轮请求`,
    summary: round === 1 ? `任务：${lab.task} 可用能力：${definitions.map(tool => lab.tools.find(item => item.id === tool.id)?.label).join('、') || '暂未接入工具'}。`
      : '程序把刚才的执行结果交回模型，让它判断资料是否足够、下一步做什么。',
    explanation: round === 1
    ? '先把任务和可用能力告诉模型，此时还没有执行搜索或保存。'
    : '留意后续行动是否因新结果而改变。原始请求可在下方展开。',
    payload: structuredClone({ model: 'demo-model', messages, tools }) });
  const answer = (content: string) => { request(); steps.push({ title: '模型 → 程序：文字回答', summary: content, explanation: '这是助手给用户的回答。核对它说明了哪些成果，以及哪些事情仍未完成。', payload: { role: 'assistant', content } }); };
  const call = (name: string, args: Record<string, string>, result: unknown, explanation: string) => {
    request();
    const id = `call_${round}`;
    const message: Message = { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] };
    const action = name === 'search_sources' ? `搜索“${args.query}”` : name === 'read_source' ? `读取来源 ${args.source_id}` : '保存已经整理好的课程比较报告';
    steps.push({ title: '模型 → 程序：请求调用工具', summary: `模型请求：${action}。`, explanation: '这一步只提出行动，工具尚未执行。程序接下来会检查是否允许、参数是否有效。', payload: structuredClone(message) });
    steps.push({ title: `程序执行：${name}`, summary: `程序实际执行：${action}。`, explanation, payload: { function: name, arguments: args, result } });
    const returned: Message = { role: 'tool', tool_call_id: id, content: JSON.stringify(result) };
    const observed = result as { sources?: { id: string; title: string }[]; text?: string; filename?: string };
    const summary = observed.sources ? `找到入口：${observed.sources.map(source => `${source.id}（${source.title}）`).join('、')}。尚需读取正文。`
      : observed.text || `保存工具返回成功回执：${observed.filename}（模拟文件）。`;
    steps.push({ title: '程序 → 对话：加入工具结果', summary, explanation: '程序把这条结果加入下一轮输入。模型随后才能依据它继续判断。', payload: returned });
    messages.push(message, returned);
  };
  if (!selected.includes('search')) {
    answer('我可以提供课程费用的比较方法，但目前没有搜索工具，无法查询两门课的资料，也无法完成有来源的比较报告。');
    return steps;
  }
  call('search_sources', { query: '甲课程 乙课程 费用' }, { sources: [{ id: 'A', title: '甲课程费用页' }, { id: 'B', title: '乙课程介绍页' }] }, '搜索函数返回网页入口，标题不代表已读到正文。');
  if (!selected.includes('read')) {
    answer('已找到甲、乙课程的网页入口，但没有阅读工具，尚未取得正文和价格，不能直接比较费用。');
    return steps;
  }
  call('read_source', { source_id: 'A' }, { source_id: 'A', text: '甲课程标准班费用 1200 元。' }, '把搜索返回的标识 A 作为参数读取正文。');
  call('read_source', { source_id: 'B' }, { source_id: 'B', text: '乙课程标准班每周两次课，费用请查看官方报名页。' }, '读到缺失价格的资料后，需要补查。');
  call('search_sources', { query: '乙课程 官方报名页 费用' }, { sources: [{ id: 'C', title: '乙课程官方报名页' }] }, '下一步搜索参数因刚才发现的费用缺口而改变。');
  call('read_source', { source_id: 'C' }, { source_id: 'C', text: '乙课程标准班费用 1600 元，与甲课程费用口径相同。' }, '读取新来源，得到可比较的费用。');
  if (!selected.includes('save')) {
    answer('甲课程 1200 元，乙课程 1600 元，同口径下甲便宜 400 元。来源：A、C。报告草稿已整理，但没有保存工具，尚未保存文件。');
    return steps;
  }
  call('save_report', { content: lab.report }, { saved: true, filename: '课程对比.md' }, '将模型整理的报告正文交给保存函数。本演示只返回预设回执。');
  answer('已比较两门课的费用：甲 1200 元，乙 1600 元，甲便宜 400 元。根据保存工具回执，课程对比.md 已保存。价格来源：A、C。');
  return steps;
}
