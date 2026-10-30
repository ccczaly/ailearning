import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { agentReferenceDemos } from '../src/agent-reference-demos.ts';
import { renderLessonSections } from '../src/markdown.ts';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const v33 = 'server/src/main/resources/db/migration/V33__progressive_agent_reading_course.sql';
if (hash(read(v33)) !== 'd1917f8b2f825d03332b666a9fd80aec0b9e411889ded7bc04f19ff135c6b3b6') throw Error('Historical V33 changed');
const base = JSON.parse(read('scripts/fixtures/agents-v33.json'));
const expected = structuredClone(base);
const legacy = JSON.parse(read('scripts/agent-course-legacy.json'));
const lessons = expected.chapters.flatMap(chapter => chapter.lessons);
const titles = {
  'tool-call': '跟随一次工具调用的执行过程',
  'tool-messages': '对照用户界面与实际消息流',
  'tool-design': '比较工具说明如何改变调用过程',
  orchestration: '切换串行、并发和分批执行',
  react: '观察订酒店任务怎样依据反馈继续行动',
  'context-window': '观察消息怎样占用上下文窗口',
  compression: '拖动滑块观察上下文压缩',
  'vector-search': '观察记忆示例中的向量检索',
  skill: '比较有无 Skill 时的执行路径',
  'skill-file': '展开一份 Skill 文件并观察执行管线',
  mcp: '切换 MCP 传输示例并观察消息流',
  failures: '比较五类故障及其处理路径',
  approval: '切换权限模式并允许或拒绝操作',
  tracing: '观察执行事件怎样组成一条任务记录',
  'multi-agent': '观察协调者与子任务的状态变化',
  harness: '比较有无 Harness 的任务执行',
};
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const safeQuote = value => String(value).includes('\\')
  ? 'CONCAT(' + String(value).split('\\').map(quote).join(',CHAR(92),') + ')' : quote(value);
const updates = [];
for (const demo of agentReferenceDemos) {
  const lesson = lessons.find(item => item.key === demo.lessonKey);
  if (!lesson || !titles[demo.demoId] || lesson.key === 'agent-introduction') throw Error('Invalid reference mapping: ' + demo.demoId);
  const title = titles[demo.demoId];
  const prompt = '操作演示中的切换、播放或重置控件，结合本节正文观察结果。所有数据与执行均为预设教学示例。';
  const config = JSON.stringify({ kind: 'reference-demo', demoId: demo.demoId, title, prompt }, null, 2);
  const extra = '## 交互演示\n\n' + title + '。\n\n~~~agent\n' + config + '\n~~~\n\n';
  if (!lesson.body.includes('## 深入阅读')) throw Error('Missing deeper reading: ' + lesson.title);
  lesson.body = lesson.body.replace('## 深入阅读', extra + '## 深入阅读');
  const sections = renderLessonSections(lesson.body);
  const interactions = sections.flatMap(section => section.interactions);
  if (sections.some(section => section.interactionError) || interactions.length !== 1
      || interactions[0].kind !== 'reference-demo' || interactions[0].demoId !== demo.demoId) throw Error('Invalid authored reference: ' + lesson.title);
  const chapter = expected.chapters.find(item => item.lessons.includes(lesson));
  updates.push('UPDATE knowledge_sections SET content_markdown=' + safeQuote(lesson.body)
    + ",updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id=(SELECT id FROM knowledge_points WHERE slug='agents')"
    + " AND node_type='LESSON' AND status='PUBLISHED' AND title=" + quote(lesson.title)
    + ' AND parent_id IN (SELECT parent.id FROM (SELECT id FROM knowledge_sections WHERE node_type=\'DIRECTORY\' AND title='
    + quote(chapter.title) + ') parent);');
}
if (updates.length !== 16 || new Set(agentReferenceDemos.map(demo => demo.lessonKey)).size !== 16) throw Error('Expected 16 distinct reference lessons');
for (const [path, expectedHash] of Object.entries(legacy.introAssets)) if (hash(read(path)) !== expectedHash) throw Error('Preserved intro asset changed: ' + path);
const destination = new URL('server/src/main/resources/db/migration/V34__agent_reference_demonstrations.sql', root);
const output = '-- Generated from the immutable V33 course and src/agent-reference-demos.ts.\n'
  + '-- Add 16 local, pre-scripted demonstrations. Preserve IDs, hierarchy, reading records, chats, quizzes and the 1.1 demo.\n\n'
  + updates.join('\n\n') + '\n';
if (process.argv.includes('--check')) {
  const current = JSON.parse(read('content/agents.json'));
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error('Current course differs from the V33 baseline plus the 16 reference demonstrations');
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== output) throw Error('V34 differs; later revisions require a new migration');
  console.log('Agent reference course verified: 16 local demos; V33, the 1.1 demo and course identities preserved.');
} else {
  if (existsSync(destination)) throw Error('V34 exists; use --check and add a new migration for later changes');
  writeFileSync(new URL('content/agents.json', root), JSON.stringify(expected, null, 2) + '\n');
  writeFileSync(destination, output);
  console.log('Added 16 reference demonstrations and generated V34.');
}
