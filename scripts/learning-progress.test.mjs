import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, h, nextTick, reactive } from 'vue';
import ts from 'typescript';
import { courseCatalog } from '../src/data/course-catalog.ts';

const url = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const script = compileScript(parse(readFileSync(new URL('../src/components/KnowledgeView.vue', import.meta.url), 'utf8')).descriptor, { id: 'progress' }).content;
const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null });
let sequence = 0;
async function settle() { for (let i = 0; i < 5; i++) { await nextTick(); await new Promise(resolve => setImmediate(resolve)); } }
async function mount({ failWrite = false, query = {}, slug = 'llm-basics' } = {}) {
  const id = ++sequence;
  const route = reactive({ params: { slug }, query });
  const writes = [];
  let saved = { total: 2, completed: 0, lastSectionId: 2, sections: [{ sectionId: 2, status: 'IN_PROGRESS' }] };
  const context = {
    route, router: { replace(value) { route.query = value.query; } },
    async api(path, options) {
      if (path.startsWith('/knowledge/')) return { title: '课程', sections: [1, 2, 3].map(id => ({ id, nodeType: 'LESSON', title: `课节 ${id}`, hasQuiz: Boolean(courseCatalog[slug]) })) };
      if (!options) return saved;
      const sectionId = Number(path.split('/').at(-1));
      const change = JSON.parse(options.body);
      writes.push({ sectionId, ...change });
      if (failWrite) throw new Error('offline');
      const entries = saved.sections.filter(s => s.sectionId !== sectionId);
      const previous = saved.sections.find(s => s.sectionId === sectionId);
      entries.push({ sectionId, status: change.completed === undefined ? previous?.status ?? 'IN_PROGRESS' : change.completed ? 'COMPLETED' : 'IN_PROGRESS' });
      saved = { ...saved, sections: entries, completed: entries.filter(s => s.status === 'COMPLETED').length, lastSectionId: sectionId };
      return saved;
    },
  };
  globalThis[`progressContext${id}`] = context;
  const prefix = `const ctx = globalThis.progressContext${id};`;
  const apiUrl = url(`${prefix} export const api = ctx.api; export class ApiError extends Error {}`);
  const routerUrl = url(`${prefix} export const useRoute = () => ctx.route; export const useRouter = () => ctx.router;`);
  const component = (await import(url(script
    .replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from 'vue-router'", `from '${routerUrl}'`)
    .replaceAll("from '../api'", `from '${apiUrl}'`)
    .replaceAll("from '../auth'", `from '${url('export const auth = { user: { id: 1 } };')}'`)
    .replaceAll("from '../reading-position'", `from '${url('export function rememberReadingSection() {} export function restoreReadingSection(user,slug,sections,query) { return sections.some(s=>s.id===Number(query)) ? Number(query) : sections[0]?.id; }')}'`)
    .replaceAll("from '../markdown'", `from '${url('export const renderLessonMarkdown = s => s;')}'`)
    .replaceAll("from '../data/course-catalog'", `from '${url(`export const courseCatalog = ${JSON.stringify(courseCatalog)};`)}'`)
    .replace(/from '\.\/.+?\.vue'/g, `from '${url('export default {};')}'`)))).default;
  component.render = () => null;
  const app = renderer.createApp({ render: () => h(component) }); app.mount({});
  await settle();
  return { state: app._instance.subTree.component.setupState, writes, cleanup() { app.unmount(); delete globalThis[`progressContext${id}`]; } };
}
test('server reading location restores across devices and explicit URL takes priority', async () => {
  for (const [query, expected] of [[{}, 2], [{ section: '1' }, 1]]) {
    const view = await mount({ query });
    try { assert.equal(view.state.selectedId, expected); assert.equal(view.writes.at(-1).sectionId, expected); }
    finally { view.cleanup(); }
  }
});
test('failed visit writes show a retry message without inventing progress', async () => {
  const view = await mount({ failWrite: true, query: { section: '1' } });
  try { assert.equal(view.state.selectedId, 1); assert.equal(view.state.progress.completed, 0); assert.match(view.state.progressError, /保存失败/); }
  finally { view.cleanup(); }
});
test('all published lessons are directly accessible through links and selection', async () => {
  const view = await mount({ query: { section: '3' } });
  try {
    assert.equal(view.state.selectedId, 3);
    view.state.select(1); await settle();
    assert.equal(view.state.selectedId, 1);
    assert.equal(view.state.lessons.length, 3);
  } finally { view.cleanup(); }
});

test('application lesson quiz follows server metadata and resets when changing lessons', async () => {
  const view = await mount({ slug: 'llm-app-dev', query: { section: '1' } });
  try {
    assert.equal(view.state.hasQuiz, true);
    view.state.showQuiz = true;
    view.state.select(2); await settle();
    assert.equal(view.state.showQuiz, false);
    assert.equal(view.state.hasQuiz, true);
    assert.equal(view.writes.at(-1).sectionId, 2);
  } finally { view.cleanup(); }
});

test('every remaining module restores the requested lesson with its own download and quiz', async () => {
  for (const slug of ['engineering-basics', 'rag', 'agents', 'mcp', 'multimodal', 'app-engineering', 'deployment']) {
    const view = await mount({ slug, query: { section: '3' } });
    try {
      assert.equal(view.state.selectedId, 3);
      assert.equal(view.state.hasQuiz, true);
      assert.equal(view.state.courseInfo.download, `/examples/${slug}.zip`);
      assert.equal(view.state.courseInfo.stages.length, 4);
    } finally { view.cleanup(); }
  }
});
