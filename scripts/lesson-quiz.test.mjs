import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, h, nextTick } from 'vue';
import ts from 'typescript';
const url = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const script = compileScript(parse(readFileSync(new URL('../src/components/LessonQuiz.vue', import.meta.url), 'utf8')).descriptor, { id: 'quiz-test' }).content;
const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null });
let sequence = 0;
async function mount(fail = false) {
  const id = ++sequence; const calls = []; let passes = 0;
  globalThis[`quizTest${id}`] = async (path, options) => {
    calls.push({ path, options });
    if (!options) return path.endsWith('/attempts') ? [] : { version: 1, passScore: 2, questions: ['a','b','c'].map(id => ({ id, text: id, options: ['A','B','C'] })) };
    if (fail) throw new Error('network');
    return { id: 1, score: 2, total: 3, passed: true, submittedAt: new Date().toISOString(), answers: [] };
  };
  const apiUrl = url(`export const api = globalThis.quizTest${id};`);
  const component = (await import(url(script.replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`).replaceAll("from '../api'", `from '${apiUrl}'`)))).default;
  component.render = () => null;
  const app = renderer.createApp({ render: () => h(component, { slug: 'llm-basics', sectionId: 1, onPassed: () => passes++ }) }); app.mount({});
  await nextTick(); await new Promise(resolve => setImmediate(resolve));
  return { state: app._instance.subTree.component.setupState, calls, passes: () => passes, cleanup() { app.unmount(); delete globalThis[`quizTest${id}`]; } };
}
test('all questions are required; graded response drives pass and history; retry clears choices', async () => {
  const view = await mount();
  try {
    view.state.start(); await view.state.submit();
    assert.equal(view.calls.filter(c => c.options).length, 0);
    view.state.answers = { a: 0, b: 1, c: 2 };
    await view.state.submit();
    assert.equal(view.state.history.length, 1); assert.equal(view.passes(), 1);
    assert.deepEqual(JSON.parse(view.calls.at(-1).options.body), { version: 1, answers: { a: 0, b: 1, c: 2 } });
    view.state.start(); assert.deepEqual(view.state.answers, {}); assert.equal(view.state.result, undefined);
  } finally { view.cleanup(); }
});
test('an unconfirmed submission does not claim a pass or erase answers', async () => {
  const view = await mount(true);
  try {
    view.state.start(); view.state.answers = { a: 0, b: 1, c: 2 }; await view.state.submit();
    assert.equal(view.passes(), 0); assert.equal(view.state.history.length, 0);
    assert.match(view.state.error, /提交未确认/); assert.equal(view.state.answers.b, 1);
  } finally { view.cleanup(); }
});
