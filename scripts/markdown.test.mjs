import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMarkdown } from '../src/markdown.ts';

test('course renders headings, tables, code and reference links', () => {
  const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
  const html = course.chapters.flatMap(chapter => chapter.lessons).map(lesson => renderMarkdown(lesson.body)).join('\n');
  assert.match(html, /<h2>自测与解析<\/h2>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code class="language-text">/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /<strong>人工智能（AI）<\/strong>研究/);
  assert.doesNotMatch(html, /\*\*/);
});

test('untrusted HTML and executable link protocols cannot become active markup', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n[click](data:text/html,test)\n\n~~~html\n<svg onload=alert(1)>\n~~~');
  assert.doesNotMatch(html, /<script|<img|<svg|href="javascript:|href="data:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;svg/);
});
