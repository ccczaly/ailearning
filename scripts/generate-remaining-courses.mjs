import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { renderLessonSections } from '../src/markdown.ts';

const modules = ['engineering-basics', 'rag', 'agents', 'mcp', 'multimodal', 'app-engineering', 'deployment'];
const courses = modules.map(code => JSON.parse(readFileSync(new URL(`../content/${code}.json`, import.meta.url), 'utf8')));
const destination = new URL('../server/src/main/resources/db/migration/V19__remaining_learning_courses.sql', import.meta.url);
const metadataPath = new URL('../src/data/course-catalog.ts', import.meta.url);
const allCourses = [JSON.parse(readFileSync(new URL('../content/llm-app-dev.json', import.meta.url), 'utf8')), ...courses];
const titleSet = new Set();
for (const [index, course] of courses.entries()) {
  if (course.slug !== modules[index] || course.moduleCode !== modules[index] || course.chapters.length !== 4) throw Error(`Invalid module: ${course.slug}`);
  const keys = new Set();
  for (const chapter of course.chapters) {
    if (chapter.lessons.length !== 2) throw Error(`Expected two lessons: ${chapter.title}`);
    for (const lesson of chapter.lessons) {
      if (keys.has(lesson.key) || titleSet.has(lesson.title)) throw Error(`Duplicate lesson: ${lesson.title}`);
      keys.add(lesson.key); titleSet.add(lesson.title);
      const sections = renderLessonSections(lesson.body);
      if (sections.length !== 4 || sections[0].title || sections[2].title !== '留下的启发' || sections[3].title !== '延伸阅读'
          || sections.some(s => !s.contentHtml.trim()) || !sections[1].diagrams.length || !lesson.body.includes('```python')
          || !lesson.body.includes('**本地练习：**') || !lesson.body.includes('https://') || lesson.minutes !== 6
          || lesson.body.length < 350) throw Error(`Incomplete lesson: ${lesson.title}`);
      if (lesson.questions.length !== 3 || new Set(lesson.questions.map(q => q.id)).size !== 3) throw Error(`Expected three questions: ${lesson.title}`);
      for (const q of lesson.questions) {
        if (!q.id.startsWith(`${lesson.key}-`) || q.id.length > 80 || !q.tag || !q.text || !q.explanation || q.options.length !== 3
            || q.options.some(o => !o.trim()) || new Set(q.options).size !== 3 || !Number.isInteger(q.answer)
            || q.answer < 0 || q.answer > 2) throw Error(`Invalid quiz: ${q.id}`);
      }
    }
  }
}
const literal = s => `'${String(s).replaceAll("'", "''")}'`;
const quote = s => String(s).includes('\\') ? `CONCAT(${String(s).split('\\').map(literal).join(',CHAR(92),')})` : literal(s);
const sql = ['-- Generated from seven content/*.json sources. Applied migrations are immutable; revisions require a new migration.'];
for (const course of courses) {
  const minutes = course.chapters.flatMap(c => c.lessons).reduce((n, l) => n + l.minutes, 0);
  sql.push(`INSERT INTO knowledge_points(module_id,slug,title,summary,learning_objectives,estimated_minutes,sort_order,status) SELECT id,${quote(course.slug)},${quote(course.title)},${quote(course.summary)},${quote(course.learningObjectives)},${minutes},1,'PUBLISHED' FROM learning_modules WHERE code=${quote(course.moduleCode)};`);
  course.chapters.forEach((chapter, index) => {
    sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,sort_order,status) SELECT id,NULL,'DIRECTORY',${quote(chapter.title)},${index + 1},'PUBLISHED' FROM knowledge_points WHERE slug=${quote(course.slug)};`);
    chapter.lessons.forEach((lesson, lessonIndex) => {
      sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,content_markdown,estimated_minutes,sort_order,status) SELECT p.id,d.id,'LESSON',${quote(lesson.title)},${quote(lesson.body)},${lesson.minutes},${lessonIndex + 1},'PUBLISHED' FROM knowledge_points p JOIN knowledge_sections d ON d.knowledge_point_id=p.id AND d.node_type='DIRECTORY' AND d.title=${quote(chapter.title)} WHERE p.slug=${quote(course.slug)};`);
      lesson.questions.forEach((q, order) => sql.push(`INSERT INTO lesson_quiz_questions(section_id,question_id,knowledge_tag,question_text,options_json,correct_option,explanation,sort_order) SELECT s.id,${quote(q.id)},${quote(q.tag)},${quote(q.text)},${quote(JSON.stringify(q.options))},${q.answer},${quote(q.explanation)},${order + 1} FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug=${quote(course.slug)} AND s.parent_id IS NOT NULL AND s.title=${quote(lesson.title)};`));
    });
  });
}
const output = `${sql.join('\n\n')}\n`;
const metadata = '// Generated from course content by scripts/generate-remaining-courses.mjs.\n'
  + 'export const courseCatalog: Record<string, { hint: string; download: string; stages: { year: string; label: string; topic: string }[] }> = '
  + JSON.stringify(Object.fromEntries(allCourses.map(course => [course.slug, {
    hint: course.slug === 'llm-app-dev' ? '沿开发流程学习，逐步完成自己的学习助手。' : '按章节学习，结合本地示例与测验检查理解。',
    download: `/examples/${course.slug}.zip`,
    stages: course.chapters.map((c, index) => {
      const title = c.title.replace(/^\d+\s*·\s*/, '');
      const [label, topic] = title.split('：');
      return { year: String(index + 1).padStart(2, '0'), label, topic: topic ?? label };
    }),
  }])), null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== output) throw Error('V19 differs from course sources; do not edit applied migrations.');
  if (readFileSync(metadataPath, 'utf8').replaceAll('\r\n', '\n') !== metadata) throw Error('Course metadata differs from content.');
  console.log('Seven courses verified: 28 chapters, 56 lessons, 168 questions, 336 minutes.');
} else {
  if (existsSync(destination)) throw Error('V19 exists. Use --check; revisions require a new migration.');
  writeFileSync(destination, output);
  writeFileSync(metadataPath, metadata);
}
