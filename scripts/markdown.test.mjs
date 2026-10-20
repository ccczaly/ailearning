import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMarkdown, renderLessonMarkdown, renderLessonSections } from '../src/markdown.ts';

test('course renders headings, tables, code and reference links', () => {
  const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
  const html = course.chapters.flatMap(chapter => chapter.lessons).map(lesson => renderMarkdown(lesson.body)).join('\n');
  assert.match(html, /<h2>留下的启发<\/h2>/);
  assert.match(renderMarkdown('| 条目 | 数值 |\n| --- | --- |\n| 概率 | 0.6 |'), /<table>/);
  assert.match(html, /<pre><code class="language-text">/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.match(renderMarkdown('**人工智能（AI）**研究如何完成智能任务。'), /<strong>人工智能（AI）<\/strong>研究/);
  assert.doesNotMatch(html, /\*\*/);
});

test('mechanism diagrams preserve text while malformed or nested blocks remain readable', () => {
  const source = '## 机制\n\n~~~flow\n输入 | <script>alert(1)</script>\n输出 | 安全的文字\n~~~\n\n~~~compare\n预训练 | 学习参数\n上下文 | 参数不变\n~~~\n\n~~~flow\n不完整的一行\n~~~\n\n> ~~~flow\n> A | 引用里的示例\n> B | 继续作为代码\n> ~~~';
  const sections = renderLessonSections(source);
  const mechanism = sections[1];
  assert.equal(sections.map(section => section.html).join(''), renderMarkdown(source));
  assert.deepEqual(mechanism.diagrams.map(diagram => diagram.kind), ['flow', 'compare']);
  assert.equal(mechanism.diagrams[0].steps[0].description, '<script>alert(1)</script>');
  assert.doesNotMatch(mechanism.contentHtml, /<script>|安全的文字|学习参数/);
  assert.match(mechanism.contentHtml, /不完整的一行/);
  assert.match(mechanism.contentHtml, /引用里的示例/);
});

test('all revised lessons expose one mechanism diagram and retain formulas and prose', () => {
  const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
  for (const lesson of course.chapters.slice(2).flatMap(chapter => chapter.lessons)) {
    const sections = renderLessonSections(lesson.body);
    assert.equal(sections.length, 4, lesson.title);
    assert.ok(sections[1].diagrams.length, lesson.title);
    assert.deepEqual(sections.slice(2).map(section => section.title), ['留下的启发', '延伸阅读']);
    assert.doesNotMatch(sections[1].contentHtml, /language-(flow|compare)/, lesson.title);
    assert.equal(sections.map(section => section.html).join(''), renderMarkdown(lesson.body));
  }
  const formula = course.chapters[6].lessons[0];
  assert.match(renderLessonSections(formula.body)[1].contentHtml, /Attention\(Q,K,V\)/);
  assert.match(renderLessonSections(formula.body)[1].contentHtml, /0\.8,0\.3/);
});

test('historical sections retain content and safely separate only top-level headings', () => {
  const source = '导语。\n\n## 正文\n\n> ## 引用标题\n> 引用内容。\n\n~~~text\n## 代码中的标题\n~~~\n\n## 延伸阅读\n\n<script>alert(1)</script>\n\n[原论文](https://example.com/paper)';
  const sections = renderLessonSections(source);
  assert.deepEqual(sections.map(section => section.title), ['', '正文', '延伸阅读']);
  assert.equal(sections.map(section => section.html).join(''), renderMarkdown(source));
  assert.match(sections[1].contentHtml, /<blockquote>\n<h2>引用标题<\/h2>/);
  assert.match(sections[1].contentHtml, /## 代码中的标题/);
  assert.doesNotMatch(sections[2].contentHtml, /<script|<h2>延伸阅读/);
  assert.match(sections[2].contentHtml, /&lt;script&gt;/);
  assert.match(sections[2].contentHtml, /rel="noopener noreferrer"/);
});

test('untrusted HTML and executable link protocols cannot become active markup', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n[click](data:text/html,test)\n\n~~~html\n<svg onload=alert(1)>\n~~~');
  assert.doesNotMatch(html, /<script|<img|<svg|href="javascript:|href="data:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;svg/);
});

test('lesson cards preserve all course content and keep authored HTML inert', () => {
  const course = JSON.parse(readFileSync(new URL('../content/llm-basics.json', import.meta.url), 'utf8'));
  for (const lesson of course.chapters.flatMap(chapter => chapter.lessons)) {
    const html = renderLessonMarkdown(lesson.body);
    assert.equal(html.replace(/<section class="lesson-callout lesson-callout-(?:tip|review)">|<\/section>/g, ''), renderMarkdown(lesson.body));
  }
  const html = renderLessonMarkdown('## 小实验\n\n<script>alert(1)</script>\n\n## 自测与解析\n\n检查理解。\n\n## 参考\n\n普通内容。');
  assert.match(html, /lesson-callout-tip/);
  assert.match(html, /lesson-callout-review/);
  assert.match(html, /<\/section><h2>参考<\/h2>/);
  assert.doesNotMatch(html, /<script>/);
});
