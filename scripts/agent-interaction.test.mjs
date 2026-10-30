import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, createSSRApp, h, nextTick, reactive } from 'vue';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';
import { parseAgentInteraction } from '../src/agent-interaction.ts';
import { capabilityDemo } from '../src/agent-capability-demo.ts';
import { agentReferenceDemos } from '../src/agent-reference-demos.ts';
import { renderLessonSections } from '../src/markdown.ts';

const course = JSON.parse(readFileSync(new URL('../content/agents.json', import.meta.url), 'utf8'));
const lessons = course.chapters.flatMap(c => c.lessons);
const activeInteractions = lessons.flatMap(l => renderLessonSections(l.body).flatMap(s => s.interactions));
// Keep regression coverage for historical renderers without publishing their old demos.
const legacyInteractions = JSON.parse(readFileSync(new URL('./fixtures/legacy-agent-interactions.json', import.meta.url), 'utf8'));
const interactions = [...activeInteractions, ...legacyInteractions];
// Historical course snapshots can still contain the previous capability interaction.
const legacyCapability = {
  kind: 'capability', title: '工具调用教学', prompt: '比较工具接入前后的执行过程。',
  task: '查找两门课程的费用并保存对比报告。',
  tools: [
    { id: 'search', label: '搜索资料', description: '找到课程网页。' },
    { id: 'read', label: '阅读网页', description: '读取费用信息。' },
    { id: 'save', label: '保存文件', description: '保存比较结果。' },
  ],
  report: '课程费用对比\n甲课程：1200 元。\n乙课程：1600 元。',
};
const url = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64')}`;
async function component(inlineTemplate = false) {
  const script = compileScript(parse(readFileSync(new URL('../src/components/AgentInteraction.vue',import.meta.url),'utf8')).descriptor,{id:'agent-test',inlineTemplate}).content;
  const child = compileScript(parse(readFileSync(new URL('../src/components/AgentCapabilityLab.vue',import.meta.url),'utf8')).descriptor,{id:'capability-test',inlineTemplate}).content;
  const childUrl = url(child.replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll("from '../agent-capability-demo'",`from '${new URL('../src/agent-capability-demo.ts',import.meta.url).href}'`));
  const workflow = compileScript(parse(readFileSync(new URL('../src/components/AgentWorkflowLab.vue',import.meta.url),'utf8')).descriptor,{id:'workflow-test',inlineTemplate}).content;
  const workflowUrl = url(workflow.replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`));
  const intro = compileScript(parse(readFileSync(new URL('../src/components/AgentIntroLab.vue',import.meta.url),'utf8')).descriptor,{id:'intro-test',inlineTemplate}).content;
  const introUrl = url(intro.replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`));
  const reference = compileScript(parse(readFileSync(new URL('../src/components/AgentReferenceLab.vue',import.meta.url),'utf8')).descriptor,{id:'reference-test',inlineTemplate}).content;
  const referenceUrl = url(reference.replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll("from '../agent-reference-demos.ts'",`from '${new URL('../src/agent-reference-demos.ts',import.meta.url).href}'`));
  return (await import(url(script.replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`)
    .replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`)
    .replaceAll("from './AgentCapabilityLab.vue'",`from '${childUrl}'`)
    .replaceAll("from './AgentWorkflowLab.vue'",`from '${workflowUrl}'`)
    .replaceAll("from './AgentIntroLab.vue'",`from '${introUrl}'`)
    .replaceAll("from './AgentReferenceLab.vue'",`from '${referenceUrl}'`)
    .replaceAll("from '../agent-interaction'",`from '${new URL('../src/agent-interaction.ts',import.meta.url).href}'`)))).default;
}
const renderer = createRenderer({createElement:()=>({}),createText:()=>({}),createComment:()=>({}),insert(){},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:()=>null,nextSibling:()=>null});

test('the 35-lesson reading course preserves 1.1 and embeds the 16 mapped local demonstrations', () => {
  assert.equal(course.chapters.length,8);
  assert.equal(lessons.length,35);
  assert.equal(activeInteractions.length,17);
  assert.equal(activeInteractions[0].kind,'intro-demo');
  const mappedLessons = new Map(agentReferenceDemos.map(demo => [demo.lessonKey, demo.demoId]));
  const authoredDemos = [];
  for (const lesson of lessons.slice(1)) {
    const sections=renderLessonSections(lesson.body);
    const demos=sections.flatMap(s=>s.interactions);
    if (mappedLessons.has(lesson.key)) {
      assert.equal(demos.length,1,lesson.title);
      assert.equal(demos[0].kind,'reference-demo',lesson.title);
      assert.equal(demos[0].demoId,mappedLessons.get(lesson.key),lesson.title);
      authoredDemos.push(demos[0].demoId);
      const demoIndex=sections.findIndex(section=>section.interactions.length);
      assert.ok(demoIndex>0 && demoIndex<sections.length-1,lesson.title);
    } else assert.equal(demos.length,0,lesson.title);
    assert.equal(sections.at(-1).title,'深入阅读',lesson.title);
    assert.ok(sections.at(-1).contentHtml.includes('https://'),lesson.title);
  }
  assert.deepEqual(authoredDemos.toSorted(),agentReferenceDemos.map(demo=>demo.demoId).toSorted());
  for (const path of ['examples/agents/lab.py','examples/agents/tests.py','public/examples/agents.zip']) assert.equal(existsSync(new URL('../'+path,import.meta.url)),false,path);
});

test('invalid interaction config is hidden from learners; nested teaching examples remain code', () => {
  assert.equal(parseAgentInteraction('null'),undefined);
  assert.equal(parseAgentInteraction('{"kind":"trace","title":"T","prompt":"P","steps":[]}'),undefined);
  const source='## 推演\n\n~~~agent\n{bad json}\n~~~\n\n> ~~~agent\n> '+JSON.stringify(interactions[0])+'\n> ~~~';
  const sections=renderLessonSections(source);
  assert.equal(sections[1].interactions.length,0);
  assert.equal(sections[1].interactionError,true);
  assert.doesNotMatch(sections[1].contentHtml,/bad json/);
  assert.match(sections[1].contentHtml,/blockquote/);
});

test('MySQL-decoded newlines in JSON strings cannot leak a configuration block into the lesson', () => {
  const broken=JSON.stringify({...interactions[0],prompt:'第一行\n第二行'},null,2).replaceAll('\\n','\n');
  assert.equal(parseAgentInteraction(broken),undefined);
  const sections=renderLessonSections('## 试一试\n\n~~~agent\n'+broken+'\n~~~');
  assert.equal(sections[1].interactions.length,0);
  assert.equal(sections[1].interactionError,true);
  assert.doesNotMatch(sections[1].contentHtml,/language-agent|partialReport|searchResult/);
});

test('capacity is enforced; feedback resets after selection changes and lesson switches', async () => {
  const Component=await component(); Component.render=()=>null;
  const props=reactive({interaction:structuredClone(interactions.find(i=>i.kind==='select'))});
  const app=renderer.createApp({render:()=>h(Component,props)}); app.mount({});
  const state=app._instance.subTree.component.setupState;
  try {
    for(let i=0;i<props.interaction.items.length;i++) state.toggle(i);
    assert.ok(state.cost<=props.interaction.capacity);
    assert.equal(state.selected.length,4);
    state.revealed=true; state.toggle(0); assert.equal(state.revealed,false);
    state.prediction='my prediction'; state.picked=1; state.position=2;
    const trace=interactions.find(i=>i.kind==='trace');
    props.interaction=structuredClone(trace); await nextTick();
    assert.deepEqual(state.selected,[]); assert.equal(state.position,0); assert.equal(state.picked,null); assert.equal(state.prediction,'');
    assert.equal(state.currentStep.label,trace.steps[0].label);
    props.interaction=structuredClone(interactions.find(i=>i.kind==='branch')); await nextTick();
    state.picked=1; assert.equal(state.outcome.effect,props.interaction.options[1].effect);
    state.reset(); assert.equal(state.outcome,undefined);
  } finally { app.unmount(); }
});

test('every authored interaction renders without raw JSON or executable authored HTML', async () => {
  const Component=await component(true);
  for(const interaction of interactions) {
    const value=structuredClone(interaction); value.prompt='<script>alert(1)</script>';
    const html=await renderToString(createSSRApp({render:()=>h(Component,{interaction:value})}));
    if (interaction.kind !== 'intro-demo') assert.match(html,interaction.kind === 'capability' ? /预设教学演示/ : /预设教学案例/);
    assert.match(html,/&lt;script&gt;/);
    assert.doesNotMatch(html,/<script>|language-agent|"kind":/);
    if(interaction.kind==='trace') assert.match(html,/展开本步/);
    if(interaction.kind==='select') assert.match(html,/type="checkbox"/);
    if(interaction.kind==='branch' || interaction.kind==='compare') assert.match(html,/aria-pressed="false"/);
    if(interaction.kind==='capability') { assert.match(html,/下一步：/); assert.doesNotMatch(html,/自己推演|轮到你来决定/); assert.match(html,/demo-model/); assert.match(html,/暂未接入工具/); assert.match(html,/disabled/); }
    if(interaction.kind==='workflow') { assert.match(html,/src="\/demos\/agent-workflow\/index.html"/); assert.match(html,/独立窗口/); }
    if(interaction.kind==='reference-demo') { assert.ok(html.includes(`src="/demos/agent-reference/${interaction.demoId}/index.html"`)); assert.match(html,/正在准备演示/); assert.match(html,/独立窗口/); }
    if(interaction.kind==='intro-demo') { assert.match(html,/Agent 怎样把任务做完/); assert.match(html,/演示说明与参考来源/); assert.match(html,/对话与行动记录/); assert.match(html,/程序执行/); assert.match(html,/id="previous"/); assert.match(html,/href="\/demos\/agent-intro\/index.html"/); assert.match(html,/独立窗口/); }
  }
});

test('tool demonstration gates the first answer and resets the trace on tool and lesson changes', async () => {
  const source=compileScript(parse(readFileSync(new URL('../src/components/AgentCapabilityLab.vue',import.meta.url),'utf8')).descriptor,{id:'capability-demo'}).content;
  const Component=(await import(url(source.replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll("from '../agent-capability-demo'",`from '${new URL('../src/agent-capability-demo.ts',import.meta.url).href}'`)))).default;
  Component.render=()=>null;
  const props=reactive({lab:structuredClone(legacyCapability)});
  const app=renderer.createApp({render:()=>h(Component,props)});app.mount({});
  const state=app._instance.subTree.component.setupState;
  try {
    assert.deepEqual(state.tools,[]);assert.equal(state.visibleSteps.length,1);
    state.toggleTool('search');assert.deepEqual(state.tools,[]);
    state.next();assert.equal(state.finished,true);assert.equal(state.baselineSeen,true);
    state.toggleTool('search');assert.equal(state.position,1);assert.equal(state.finished,false);
    while(!state.finished) state.next();
    state.toggleTool('read');assert.equal(state.position,1);
    props.lab=structuredClone(legacyCapability);await nextTick();
    assert.deepEqual(state.tools,[]);assert.equal(state.baselineSeen,false);assert.equal(state.position,1);
  } finally {app.unmount();}
});

test('all tool combinations show valid call/result history and only save after supported research', () => {
  for(let mask=0;mask<8;mask++) {
    const selected=['search','read','save'].filter((_,i)=>mask & (1<<i));
    const trace=capabilityDemo(legacyCapability,selected);
    assert.ok(trace.every(step=>step.summary.trim().length>0));
    assert.equal(trace.at(-1).summary,trace.at(-1).payload.content);
    const requests=trace.filter(step=>step.title.includes('轮请求')).map(step=>step.payload);
    const executions=trace.filter(step=>step.title.startsWith('程序执行')).map(step=>step.payload);
    assert.equal(requests[0].tools.length,selected.length);
    assert.deepEqual(requests[0].messages.map(m=>m.role),['system','user']);
    for(const request of requests) {
      for(let i=2;i<request.messages.length;i+=2) {
        assert.equal(request.messages[i].role,'assistant');assert.equal(request.messages[i+1].role,'tool');
        assert.equal(request.messages[i].tool_calls[0].id,request.messages[i+1].tool_call_id);
        assert.doesNotThrow(()=>JSON.parse(request.messages[i].tool_calls[0].function.arguments));
      }
    }
    assert.equal(executions.some(call=>call.function==='save_report'),mask===7);
    assert.equal(executions.some(call=>call.function==='read_source'),(mask & 3)===3);
    if((mask & 3)===3) assert.deepEqual(executions.filter(call=>call.function==='read_source').map(call=>call.arguments.source_id),['A','B','C']);
    if(mask===7) assert.equal(executions.at(-1).arguments.content,legacyCapability.report);
    assert.match(trace.at(-1).title,/文字回答/);
  }
});
