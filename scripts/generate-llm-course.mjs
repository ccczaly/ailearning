import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderLessonSections } from '../src/markdown.ts';

const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
// Applied migrations are immutable. V12 only revises the 24 remaining lessons.
const destination = new URL('../server/src/main/resources/db/migration/V12__concise_remaining_course.sql', import.meta.url);
const migration = name => readFileSync(new URL(`../server/src/main/resources/db/migration/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const baseline = migration('V7__llm_timeline_course.sql');
const preserved = [migration('V10__concise_language_origins.sql'), migration('V11__concise_eliza.sql')];
const quote = value => `'${value.replaceAll("'", "''")}'`;
const previousTitles = [
  ['N-gram：用附近的词预测下一个词', '没见过的句子：平滑与评测'],
  ['从计数表到可学习的词向量', '训练、损失与推理：数字怎样学出来'],
  ['从上下文学习词语的相似性', '一词多义：从静态向量到上下文表示'],
  ['RNN、LSTM 与编码器—解码器', '注意力：生成时重新查看相关输入'],
  ['自注意力：词语怎样直接建立联系', '位置、因果掩码与逐步生成'],
  ['预训练：先从大量文本学习', '微调与上下文：怎样适配一个新任务'],
  ['零样本、少样本与上下文学习', '规模效应、温度与生成的不确定性'],
  ['从续写器到助手：指令微调', '人类反馈、奖励与对齐的局限'],
  ['思维链提示：把解题过程变成示例', '多轮对话：模型与产品分别负责什么'],
  ['开放权重、模型许可与本地运行', '量化、LoRA 与任务适配'],
  ['从步骤提示到推理模型训练', '推理时计算、蒸馏与成本权衡'],
  ['幻觉、知识时效与证据', '综合实验：评测一个物流问答助手'],
];
const preservedTitles = [
  ['1950：机器能思考吗？', '模仿游戏：用文字观察机器'],
  ['1966：ELIZA 怎样接话？', '规则的边界：接话不等于理解'],
];
const lessons = course.chapters.flatMap(chapter => chapter.lessons);
if (course.slug !== 'llm-basics' || course.chapters.length !== 14 || lessons.length !== 28
  || course.chapters.some(chapter => chapter.lessons.length !== 2)) throw new Error('Expected the original 14 chapters and 28 lessons.');
if (new Set(course.chapters.map(chapter => chapter.title)).size !== 14 || new Set(lessons.map(lesson => lesson.title)).size !== 28) throw new Error('Duplicate chapter or lesson title.');

course.chapters.forEach((chapter, index) => {
  const directorySql = `INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,sort_order,status) SELECT id,NULL,'DIRECTORY',${quote(chapter.title)},${index + 1},'PUBLISHED' FROM knowledge_points WHERE slug=${quote(course.slug)};`;
  if (!baseline.includes(directorySql)) throw new Error(`V12 cannot revise or reorder directory: ${chapter.title}`);
  if (index < 2) {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      const update = `UPDATE knowledge_sections SET title=${quote(lesson.title)}, content_markdown=${quote(lesson.body)}, estimated_minutes=${lesson.minutes}, updated_at=CURRENT_TIMESTAMP(3) WHERE`;
      if (lesson.title !== preservedTitles[index][lessonIndex] || !preserved[index].includes(update.replaceAll('\r\n', '\n'))) throw new Error(`V12 cannot revise the earlier lesson: ${lesson.title}`);
    });
  }
});

for (const [index, lesson] of lessons.entries()) {
  if (!Number.isInteger(lesson.minutes) || lesson.minutes < 3 || lesson.minutes > 5 || !lesson.body.includes('https://')) throw new Error(`Incomplete lesson: ${lesson.title}`);
  const sections = renderLessonSections(lesson.body);
  if (sections.length !== 4 || sections[0].title || !sections[0].contentHtml.trim()
    || sections[2].title !== '留下的启发' || sections[3].title !== '延伸阅读'
    || sections.some(section => !section.contentHtml.trim())) throw new Error(`Expected intro, mechanism, insight and further reading: ${lesson.title}`);
  const visibleCharacters = lesson.body.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/~~~(?:flow|compare|text)?/g, '').replace(/[#*\s]/g, '').length;
  if (visibleCharacters < 350 || visibleCharacters > (index === 27 ? 850 : 700)) throw new Error(`Lesson length outside the concise range (${visibleCharacters}): ${lesson.title}`);
  if (index >= 4) {
    if (!sections[1].diagrams.length || sections[1].contentHtml.includes('language-flow') || sections[1].contentHtml.includes('language-compare')) throw new Error(`Missing or malformed mechanism diagram: ${lesson.title}`);
    if (/^## (?:自测|小实验|参考与下一站)/m.test(lesson.body)) throw new Error(`Old lesson boilerplate remains: ${lesson.title}`);
  }
}
const minutes = lessons.reduce((total, lesson) => total + lesson.minutes, 0);
const sql = [
  '-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.',
  '-- V12 rewrites the remaining 24 lessons, preserving all section IDs, directory relationships and learning progress.',
  '-- V7 through V12 are immutable after application. Add a new version for future content revisions.',
  `UPDATE knowledge_points SET estimated_minutes=${minutes}, updated_at=CURRENT_TIMESTAMP(3) WHERE slug=${quote(course.slug)};`,
];
course.chapters.slice(2).forEach((chapter, chapterIndex) => {
  // DISTINCT prevents MySQL from merging this same-table directory lookup.
  const scope = `SELECT id FROM (SELECT DISTINCT d.id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id WHERE p.slug=${quote(course.slug)} AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title=${quote(chapter.title)}) revised_chapter`;
  chapter.lessons.forEach((lesson, lessonIndex) => {
    const previous = previousTitles[chapterIndex][lessonIndex];
    if (!baseline.includes(`'LESSON',${quote(previous)},`)) throw new Error(`Unexpected previous lesson: ${previous}`);
    sql.push(`UPDATE knowledge_sections SET title=${quote(lesson.title)}, content_markdown=${quote(lesson.body)}, estimated_minutes=${lesson.minutes}, updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug=${quote(course.slug)}) AND parent_id IN (${scope}) AND node_type='LESSON' AND status='PUBLISHED' AND title=${quote(previous)} AND sort_order=${lessonIndex + 1};`);
  });
});
const generated = sql.join('\n\n') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== generated) throw new Error('Course source and V12 migration differ.');
  console.log(`V12 verified: 24 revised lessons; 1950 and 1966 preserved; 14 chapters, 28 lessons, ${minutes} minutes.`);
} else {
  writeFileSync(destination, generated, 'utf8');
  console.log(`Generated ${fileURLToPath(destination)} (${minutes} minutes). Do not overwrite applied V12.`);
}
