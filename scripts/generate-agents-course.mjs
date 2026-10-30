import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderLessonSections } from '../src/markdown.ts';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const digest = text => createHash('sha256').update(text).digest('hex');
// V33 is an immutable historical migration. Later demonstrations are added by
// generate-agent-reference-course.mjs against the frozen V33 course below.
const course = JSON.parse(read('scripts/fixtures/agents-v33.json'));
const legacy = JSON.parse(read('scripts/agent-course-legacy.json'));
const destination = new URL('server/src/main/resources/db/migration/V33__progressive_agent_reading_course.sql', root);
const historical = {
  'V32__agent_intro_conversation.sql': 'e8eb715dc86a39418f8987509198bef38dcb505620a4af1884f6570c41d863dc',
  'V31__agent_intro_coding_case.sql': 'ae655b9df31d5b2ba5eef47aa586575895f46fd84b195603114049d8835f3714',
  'V30__agent_intro_showcase.sql': '25ef572765745b953ca39069bfdbb0f04ee0777f539cd44168857e33a104ea43',
  'V29__agent_workflow_animation.sql': '9509b528ed8bc73336e3bbc3c2e0d51fc19314c0423086ca30dbb25b3aec50df',
  'V28__agent_interaction_alignment.sql': 'e4794b85a47d174524a050480c62772fe28b50897e935e3e8096ab10e7d7feed',
  'V27__agent_story_curriculum.sql': 'ece2ab3c6cdf212ca9eacff7c581962b1a5a4dec78ea7827e8f4662447dcd2de',
  'V22__agent_system_curriculum.sql': '9556d9356ac93d5764da92636ce040c214b53f7dea0fa37813258aaaa0dde81b',
  'V23__agent_intro_capability_lab.sql': '12d3df38c10232a8c22b76a7b4ecc61fc2007fa3b287e3ea8e42e3a1a97f216a',
  'V24__preserve_agent_json_escapes.sql': 'db898bf74b28c2aa6fb69d07d446bf7dc9eed2617f2343bd7190b20fcb207778',
  'V26__agent_tool_call_demo.sql': 'ba04c1bf6a30892fbd2b8e82bbda843a7327a3d023581b898c410651923761cc',
};
for (const [name, hash] of Object.entries(historical)) {
  if (digest(read('server/src/main/resources/db/migration/' + name)) !== hash) throw Error('Historical migration changed: ' + name);
}
if (course.slug !== 'agents' || course.moduleCode !== 'agents' || course.chapters.length !== 8) throw Error('Expected eight Agent chapters');
if (legacy.version !== 32 || legacy.lessons.length !== 30 || legacy.chapters.length !== 10) throw Error('Invalid V32 identity map');
const keys = new Set();
const titles = new Set();
let total = 0;
let minutes = 0;
for (const [chapterIndex, chapter] of course.chapters.entries()) {
  if (!chapter.title.startsWith(String(chapterIndex + 1).padStart(2, '0') + ' · ') || !chapter.lessons.length) throw Error('Invalid chapter: ' + chapter.title);
  for (const [lessonIndex, lesson] of chapter.lessons.entries()) {
    if (!lesson.title.startsWith((chapterIndex + 1) + '.' + (lessonIndex + 1) + ' ') || keys.has(lesson.key) || titles.has(lesson.title)
      || lesson.questions.length || lesson.minutes < 4 || lesson.minutes > 8) throw Error('Invalid lesson: ' + lesson.title);
    keys.add(lesson.key);
    titles.add(lesson.title);
    total++;
    minutes += lesson.minutes;
    const sections = renderLessonSections(lesson.body);
    if (sections.some(section => !section.contentHtml.trim() || section.interactionError)) throw Error('Empty or invalid section: ' + lesson.title);
    const interactions = sections.flatMap(section => section.interactions);
    if (lesson.key === 'agent-introduction') {
      if (interactions.length !== 1 || interactions[0].kind !== 'intro-demo' || digest(lesson.body) !== legacy.introBodySha256) throw Error('Keep lesson 1.1 and its interaction unchanged');
    } else {
      if (interactions.length || sections.some(section => section.diagrams.length) || /~~~agent|~~~flow|~~~compare|动手验证：|换个任务，试着解释/.test(lesson.body)) throw Error('Only 1.1 may contain an interaction: ' + lesson.title);
      if (sections.length < 3 || sections.length > 5 || sections.at(-1).title !== '深入阅读'
        || sections.filter(section => section.title === '深入阅读').length !== 1
        || !/https:\/\//.test(sections.at(-1).contentHtml)) throw Error('Expected a plain mainline and sourced deeper reading: ' + lesson.title);
    }
  }
}
if (total !== 35) throw Error('Expected 35 lessons');
for (const [path, hash] of Object.entries(legacy.introAssets)) {
  const current = digest(read(path));
  if (current !== hash) throw Error('The preserved 1.1 demo changed: ' + path);
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const safeQuote = value => String(value).includes('\\')
  ? 'CONCAT(' + String(value).split('\\').map(quote).join(',CHAR(92),') + ')'
  : quote(value);
const pointId = "(SELECT id FROM knowledge_points WHERE slug='agents')";
const scope = 'knowledge_point_id=' + pointId;
const legacyByKey = new Map(legacy.lessons.map(lesson => [lesson.key, lesson.title]));
const sql = [
  '-- Generated from content/agents.json. Eight progressive chapters, 35 lessons; only 1.1 retains its existing interaction.',
  '-- Reuse identities for continuing subjects. Archive merged lessons and directories without deleting learning records, chats, or historical answers.',
  "UPDATE knowledge_points SET title=" + safeQuote(course.title) + ',summary=' + safeQuote(course.summary)
    + ',learning_objectives=' + safeQuote(course.learningObjectives) + ',estimated_minutes=' + minutes
    + ",updated_at=CURRENT_TIMESTAMP(3) WHERE slug='agents';",
  'UPDATE learning_modules SET description=' + safeQuote(course.summary) + ",updated_at=CURRENT_TIMESTAMP(3) WHERE code='agents';",
  "UPDATE knowledge_sections SET status='ARCHIVED',updated_at=CURRENT_TIMESTAMP(3) WHERE " + scope + ';',
];
course.chapters.forEach((chapter, chapterIndex) => {
  sql.push('UPDATE knowledge_sections SET title=' + quote(chapter.title) + ',sort_order=' + (chapterIndex + 1)
    + ",status='PUBLISHED',updated_at=CURRENT_TIMESTAMP(3) WHERE " + scope
    + " AND node_type='DIRECTORY' AND title=" + quote(legacy.chapters[chapterIndex]) + ';');
});
course.chapters.forEach(chapter => {
  // The aggregate-derived table avoids MySQL's same-target-table update restriction.
  const parent = '(SELECT target_directory.id FROM (SELECT MAX(d.id) AS id FROM knowledge_sections d JOIN knowledge_points p ON p.id=d.knowledge_point_id'
    + " WHERE p.slug='agents' AND d.node_type='DIRECTORY' AND d.title=" + quote(chapter.title) + ') target_directory)';
  chapter.lessons.forEach((lesson, index) => {
    const oldTitle = legacyByKey.get(lesson.key);
    if (oldTitle) {
      sql.push('UPDATE knowledge_sections SET parent_id=' + parent + ',title=' + quote(lesson.title)
        + ',content_markdown=' + safeQuote(lesson.body) + ',estimated_minutes=' + lesson.minutes + ',sort_order=' + (index + 1)
        + ",status='PUBLISHED',updated_at=CURRENT_TIMESTAMP(3) WHERE " + scope + " AND node_type='LESSON' AND title=" + quote(oldTitle) + ';');
    } else {
      sql.push('INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,content_markdown,estimated_minutes,sort_order,status)'
        + " SELECT p.id,d.id,'LESSON'," + quote(lesson.title) + ',' + safeQuote(lesson.body) + ',' + lesson.minutes + ',' + (index + 1)
        + ",'PUBLISHED' FROM knowledge_points p JOIN knowledge_sections d ON d.knowledge_point_id=p.id AND d.node_type='DIRECTORY'"
        + ' AND d.title=' + quote(chapter.title) + " WHERE p.slug='agents';");
    }
  });
});
const output = sql.join('\n\n') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== output) throw Error('V33 differs from course content; add a new migration for later revisions');
  console.log('Historical V33 verified: 8 chapters, 35 lessons, ' + minutes + ' minutes; original 1.1 and V22–V33 preserved.');
} else {
  if (existsSync(destination)) throw Error('V33 already exists; use --check. Subsequent revisions require a new migration.');
  writeFileSync(destination, output);
}

await import('./generate-agent-reference-course.mjs');
