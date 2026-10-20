import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { renderLessonSections } from '../src/markdown.ts';

const course = JSON.parse(readFileSync(new URL('../content/llm-app-dev.json', import.meta.url), 'utf8'));
const destination = new URL('../server/src/main/resources/db/migration/V18__llm_application_course.sql', import.meta.url);
const lessons = course.chapters.flatMap(c => c.lessons);
if (course.slug !== 'llm-app-dev' || course.chapters.length !== 6 || lessons.length !== 12) throw Error('Expected 6 chapters and 12 lessons.');
if (new Set(lessons.map(l => l.key)).size !== 12 || new Set(lessons.map(l => l.title)).size !== 12) throw Error('Duplicate lesson.');
for (const lesson of lessons) {
  const sections = renderLessonSections(lesson.body);
  if (sections.length !== 4 || sections[0].title || sections[2].title !== '留下的启发' || sections[3].title !== '延伸阅读'
      || !sections[1].diagrams.length || sections.some(s => !s.contentHtml.trim())
      || !lesson.body.includes('```python') || !lesson.body.includes('https://')
      || lesson.minutes < 5 || lesson.minutes > 10) throw Error(`Incomplete lesson: ${lesson.title}`);
  if (lesson.questions.length !== 3 || new Set(lesson.questions.map(q => q.id)).size !== 3) throw Error(`Expected three questions: ${lesson.title}`);
  for (const q of lesson.questions) {
    if (!q.id.startsWith(`${lesson.key}-`) || !q.tag || !q.text || !q.explanation || q.options.length !== 3
        || q.options.some(o => !o.trim()) || new Set(q.options).size !== 3 || !Number.isInteger(q.answer)
        || q.answer < 0 || q.answer > 2) throw Error(`Invalid question: ${q.id}`);
  }
}
// CHAR(92) avoids dependence on MySQL's backslash-escape SQL mode; H2 yields the same text.
const literal = s => `'${String(s).replaceAll("'", "''")}'`;
const quote = s => String(s).includes('\\') ? `CONCAT(${String(s).split('\\').map(literal).join(',CHAR(92),')})` : literal(s);
const minutes = lessons.reduce((n, l) => n + l.minutes, 0);
const sql = [
  '-- Generated from content/llm-app-dev.json. Once applied, add a new migration for revisions.',
  `CREATE TABLE lesson_quiz_questions (
 section_id BIGINT NOT NULL,
 question_id VARCHAR(80) NOT NULL,
 knowledge_tag VARCHAR(120) NOT NULL,
 question_text TEXT NOT NULL,
 options_json TEXT NOT NULL,
 correct_option INT NOT NULL,
 explanation TEXT NOT NULL,
 sort_order INT NOT NULL,
 PRIMARY KEY(section_id,question_id),
 FOREIGN KEY(section_id) REFERENCES knowledge_sections(id),
 CHECK(correct_option BETWEEN 0 AND 2)
);`,
  `INSERT INTO knowledge_points(module_id,slug,title,summary,learning_objectives,estimated_minutes,sort_order,status) SELECT id,${quote(course.slug)},${quote(course.title)},${quote(course.summary)},${quote(course.learningObjectives)},${minutes},1,'PUBLISHED' FROM learning_modules WHERE code=${quote(course.moduleCode)};`,
];
course.chapters.forEach((chapter, index) => {
  sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,sort_order,status) SELECT id,NULL,'DIRECTORY',${quote(chapter.title)},${index + 1},'PUBLISHED' FROM knowledge_points WHERE slug=${quote(course.slug)};`);
  chapter.lessons.forEach((lesson, lessonIndex) => {
    sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,content_markdown,estimated_minutes,sort_order,status) SELECT p.id,d.id,'LESSON',${quote(lesson.title)},${quote(lesson.body)},${lesson.minutes},${lessonIndex + 1},'PUBLISHED' FROM knowledge_points p JOIN knowledge_sections d ON d.knowledge_point_id=p.id AND d.node_type='DIRECTORY' AND d.title=${quote(chapter.title)} WHERE p.slug=${quote(course.slug)};`);
    lesson.questions.forEach((q, order) => sql.push(`INSERT INTO lesson_quiz_questions(section_id,question_id,knowledge_tag,question_text,options_json,correct_option,explanation,sort_order) SELECT s.id,${quote(q.id)},${quote(q.tag)},${quote(q.text)},${quote(JSON.stringify(q.options))},${q.answer},${quote(q.explanation)},${order + 1} FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug=${quote(course.slug)} AND s.parent_id IS NOT NULL AND s.title=${quote(lesson.title)};`));
  });
});
const output = `${sql.join('\n\n')}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== output) throw Error('V18 differs from course source. Applied migrations must not be edited.');
  console.log(`LLM application course verified: 6 chapters, 12 lessons, 36 questions, ${minutes} minutes.`);
} else {
  if (existsSync(destination)) throw Error('V18 already exists. Use --check; future revisions require a new migration.');
  writeFileSync(destination, output);
}
