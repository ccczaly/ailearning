import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retrieve, splitText, evidenceAnswer, parseRagInteraction, ragDemoIds, documents } from '../src/rag-interaction.ts';
import { renderLessonSections } from '../src/markdown.ts';
test('permission is applied before top K; draft remains ineligible evidence', () => {
  assert.equal(retrieve('semantic', true, 1)[0].id, 'draft-3');
  assert.equal(retrieve('semantic', false, 1)[0].id, 'guide-2');
  assert.ok(!retrieve('hybrid', false, 4).some(d => d.access === 'staff'));
  assert.match(evidenceAnswer(['draft-3']), /无法确认/);
});
test('chunk offsets preserve source and overlapping windows terminate', () => {
  for (const size of [12, 24, 42]) for (const overlap of [0, 4, 10]) {
    const text = documents[0].text, chunks = splitText(text, size, overlap);
    assert.equal(chunks.at(-1).end, text.length);
    for (const chunk of chunks) assert.equal(chunk.text, text.slice(chunk.start, chunk.end));
  }
  assert.throws(() => splitText('abc', 2, 2));
});
test('answer requires supporting evidence and refuses uncovered questions', () => {
  assert.match(evidenceAnswer(['guide-2']), /\[guide-2\]/);
  assert.match(evidenceAnswer(['progress-1']), /无法确认/);
  assert.match(evidenceAnswer(['guide-2'], true), /无法据此回答/);
});
test('eight lessons render validated demos without leaking configuration', () => {
  const course = JSON.parse(readFileSync(new URL('../content/rag.json', import.meta.url), 'utf8'));
  const ids = [];
  for (const lesson of course.chapters.flatMap(c => c.lessons)) {
    const sections = renderLessonSections(lesson.body);
    assert.ok(!sections.some(s => s.interactionError));
    const demos = sections.flatMap(s => s.interactions);
    assert.equal(demos.length, 1); ids.push(demos[0].demoId);
    assert.ok(!sections.some(s => s.contentHtml.includes('rag-demo')));
    assert.equal(lesson.questions.length, 3);
  }
  assert.deepEqual(ids, [...ragDemoIds]);
  assert.equal(parseRagInteraction('{"kind":"rag-demo","demoId":"unknown","title":"x"}'), undefined);
});

test('retrieval modes change ranking for the same public corpus', () => {
  assert.equal(retrieve('keyword', false, 1)[0].id, 'progress-1');
  assert.equal(retrieve('semantic', false, 1)[0].id, 'guide-2');
  assert.equal(retrieve('hybrid', false, 1)[0].id, 'guide-2');
});
