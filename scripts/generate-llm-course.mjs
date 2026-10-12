import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
const destination = new URL('../server/src/main/resources/db/migration/V7__llm_timeline_course.sql', import.meta.url);
const quote = value => `'${value.replaceAll("'", "''")}'`;
const lessons = course.chapters.flatMap(chapter => chapter.lessons);
if (course.chapters.length !== 14 || lessons.length !== 28) throw new Error('Expected 14 chapters and 28 lessons.');
if (new Set(course.chapters.map(chapter => chapter.title)).size !== course.chapters.length) throw new Error('Duplicate chapter title.');
if (new Set(lessons.map(lesson => lesson.title)).size !== lessons.length) throw new Error('Duplicate lesson title.');
for (const lesson of lessons) {
  if (!Number.isInteger(lesson.minutes) || lesson.minutes <= 0 || lesson.body.length < 500 || !lesson.body.includes('## 自测与解析') || !lesson.body.includes('https://')) {
    throw new Error(`Incomplete lesson: ${lesson.title}`);
  }
}
const minutes = lessons.reduce((total, lesson) => total + lesson.minutes, 0);
const sql = [
  '-- Generated from content/llm-basics.json by scripts/generate-llm-course.mjs.',
  '-- Archive earlier sections rather than deleting IDs referenced by user progress.',
  `UPDATE knowledge_sections SET status='ARCHIVED', updated_at=CURRENT_TIMESTAMP(3) WHERE knowledge_point_id IN (SELECT id FROM knowledge_points WHERE slug=${quote(course.slug)});`,
  `UPDATE knowledge_points SET title=${quote(course.title)}, summary=${quote(course.summary)}, learning_objectives=${quote(course.learningObjectives)}, estimated_minutes=${minutes}, updated_at=CURRENT_TIMESTAMP(3) WHERE slug=${quote(course.slug)};`,
];
course.chapters.forEach((chapter, chapterIndex) => {
  sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,sort_order,status) SELECT id,NULL,'DIRECTORY',${quote(chapter.title)},${chapterIndex + 1},'PUBLISHED' FROM knowledge_points WHERE slug=${quote(course.slug)};`);
  chapter.lessons.forEach((lesson, lessonIndex) => {
    sql.push(`INSERT INTO knowledge_sections(knowledge_point_id,parent_id,node_type,title,content_markdown,estimated_minutes,sort_order,status) SELECT p.id,d.id,'LESSON',${quote(lesson.title)},${quote(lesson.body)},${lesson.minutes},${lessonIndex + 1},'PUBLISHED' FROM knowledge_points p JOIN knowledge_sections d ON d.knowledge_point_id=p.id AND d.parent_id IS NULL AND d.node_type='DIRECTORY' AND d.status='PUBLISHED' AND d.title=${quote(chapter.title)} WHERE p.slug=${quote(course.slug)};`);
  });
});
const generated = sql.join('\n\n') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== generated) throw new Error('Course source and migration differ.');
  console.log(`Course verified: ${course.chapters.length} chapters, ${lessons.length} lessons, ${minutes} minutes.`);
} else {
  writeFileSync(destination, generated, 'utf8');
  console.log(`Generated ${fileURLToPath(destination)} (${lessons.length} lessons).`);
}
