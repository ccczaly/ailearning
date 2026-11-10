import { documents, retrieve, splitText, cosine, retrievalMetrics, evidenceAnswer } from './model.js';
import { TeachingClock } from './clock.js';

const id = document.body.dataset.demo;
const lessons = {
  'rag-boundary': ['01', '检索与生成', '证据怎样进入本次回答', '同一个问题，比较直接回答与检索增强两条路径。', '⇢'],
  chunking: ['02', '分块与元数据', '把规则的条件一起保留下来', '移动切割窗口，观察片段边界、重复字符与来源。', '▤'],
  vectors: ['03', '向量与相似度', '方向相同，长度不同', '调整文档向量的方向和长度，核对余弦计算。', '↗'],
  hybrid: ['04', '混合召回', '两条线索，合成一份候选', '比较关键词与语义两路排名，观察融合后的升降。', '⑂'],
  'rag-access': ['05', '权限与重排', '相关、可访问、有效，是三次检查', '切换身份，跟随候选穿过权限与有效性关卡。', '◇'],
  citations: ['06', '引用与拒答', '让回答中的引用回到原文', '选择送入上下文的证据，再检查结论是否得到支持。', '❞'],
  'rag-eval': ['07', '检索评测', '看见命中、漏检与噪声', '扩大 Top K，观察两个集合的交集与指标分母。', '◎'],
  'rag-project': ['08', '完整问答流程', '跟随一条证据走到答案', '从查询到引用保留每一步，不跳过过滤与证据筛选。', '↳'],
};
const lesson = lessons[id];
if (!lesson) throw Error('Unknown RAG demonstration');
const timeline = ['rag-boundary', 'rag-access', 'rag-project'].includes(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const initial = () => ({ phase:0, topK:2, size:18, overlap:4, angle:35, length:1, staff:false, mode:'hybrid', weight:50, included:['guide-2'], missing:false, linked:'', chunk:0, evalQuery:'rules' });
let state = initial(), disposed = false, interacted = false, userPaused = false, lastChange = '';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = selector => document.querySelector(selector);
const question = () => state.missing ? '补考最多可以参加几次？' : '测验怎样才算通过？之后未通过会清除原状态吗？';
const activeDocs = () => documents.filter(d => state.staff || d.access === 'public');
const isValid = d => d.id === 'guide-2';
const pickedRows = () => retrieve(state.mode, state.staff, state.topK);
const stat = (label, number, caption, color='green') => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-number ${color}">${number}</div><div class="stat-caption">${caption}</div></div>`;
const stats = items => `<aside class="panel stats" aria-label="实时统计">${items.join('')}</aside>`;
const panel = (title, body, extra='', cls='') => `<section class="panel ${cls}"><div class="panel-head"><h2>${title}</h2>${extra}</div><div class="panel-body">${body}</div></section>`;
const insight = text => `<div class="insight" role="status"><strong>本次观察</strong><p>${text}</p></div>`;
const slider = (key,label,min,max,step=1,suffix='') => `<label class="control">${label}<input type="range" data-bind="${key}" min="${min}" max="${max}" step="${step}" value="${state[key]}" aria-label="${label}"><output data-output="${key}">${state[key]}${suffix}</output></label>`;
const choice = (key,value,label) => `<button data-set="${key}" data-value="${value}" aria-pressed="${String(state[key]) === String(value)}">${label}</button>`;
function rankRow(doc, {prefix='rank', rank=0, score=doc.score, cls='', note='', body=false}={}) {
  return `<div class="rank-row ${cls}" data-motion="${prefix}-${doc.id}"><span class="rank-num">${rank || '·'}</span><div class="rank-detail"><div class="rank-title">${escape(doc.title)}</div>${body ? `<p class="sub">${escape(doc.text)}</p>` : ''}<div class="rank-sub">${escape(doc.id)}${note ? ' · '+note : ''}</div>${score !== undefined ? `<div class="track"><i style="width:${Math.max(0,score)*100}%;background:${prefix === 'semantic' ? 'var(--purple)' : 'var(--cyan)'}"></i></div>` : ''}</div>${score !== undefined ? `<span class="rank-score">${score.toFixed(2)}</span>` : ''}</div>`;
}
function message(role, title, text, meta='', key=title) {
  const avatars={query:'Q',evidence:'E',answer:'A',system:'S'};
  return `<div class="message ${role}" data-motion="msg-${key}"><div class="avatar">${avatars[role]}</div><div class="message-body"><div class="message-role">${title}</div><div class="bubble">${text}</div>${meta ? `<div class="message-meta">${meta}</div>` : ''}</div></div>`;
}
function pipeline(labels, phase) {
  return `<div class="flow" aria-label="处理阶段">${labels.map((label,i) => `${i ? `<span class="flow-arrow ${phase > i ? 'done':''}" aria-hidden="true">→</span>` : ''}<div class="flow-node ${phase === i+1 ? 'active' : phase > i+1 ? 'done':''}">${label}</div>`).join('')}</div>`;
}
function controls() {
  switch(id) {
    case 'chunking': return slider('size','窗口大小',12,36,1,' 字符') + slider('overlap','重叠大小',0,10,1,' 字符');
    case 'vectors': return slider('angle','文档方向',0,180,1,'°') + slider('length','文档长度',0,2,.1) + `<button data-action="same-direction">同向对照</button><button data-action="zero-vector">零向量</button>`;
    case 'hybrid': return `<div class="control">${choice('mode','keyword','只看关键词')}${choice('mode','semantic','只看语义')}${choice('mode','hybrid','混合召回')}</div>` + slider('weight','关键词权重',0,100,5,'%') + slider('topK','Top K',1,3);
    case 'rag-access': return `<div class="control">检索身份 ${choice('staff',false,'普通学员')}${choice('staff',true,'内部成员')}</div>`;
    case 'citations': return `<div class="control">问题 ${choice('missing',false,'资料覆盖')}${choice('missing',true,'资料未覆盖')}</div>`;
    case 'rag-eval': return `<div class="control">评测问句 ${choice('evalQuery','rules','通过规则')}${choice('evalQuery','setup','安装依赖')}</div>` + slider('topK','Top K',1,3);
    case 'rag-project': return `<div class="control">身份 ${choice('staff',false,'普通学员')}${choice('staff',true,'内部成员')}</div>` + slider('topK','Top K',1,4) + `<label class="control">召回方式<select data-bind="mode" aria-label="召回方式"><option value="keyword">关键词</option><option value="semantic">语义</option><option value="hybrid" selected>混合</option></select></label>`;
    default: return '';
  }
}
const root = $('#lab');
root.innerHTML = `<div class="toolbar"><span>预设教学演示 · 无真实模型调用 · 分数与耗时均为示意</span><button id="motion" type="button">减少动态效果</button></div><article class="lesson"><header class="intro"><div class="intro-icon" aria-hidden="true">${lesson[4]}</div><div><div class="eyebrow">RAG LAB / ${lesson[0]}</div><h1>${lesson[1]}：${lesson[2]}</h1><p class="sub">${lesson[3]}</p></div></header><div id="controls" class="controls">${controls()}</div>${timeline ? `<div class="panel playback"><span class="status" id="status" role="status"><i class="status-dot"></i><span>准备演示</span></span><button id="play" class="primary" type="button">播放演示</button><button id="next" type="button">下一步</button><button data-action="reset" type="button">↺ 重播</button></div>` : `<div class="controls"><span class="sub">操作参数，观察图形和结果同步变化</span><button data-action="reset" type="button" style="margin-left:auto">↺ 重置实验</button></div>`}<div id="scene"></div><div id="live" class="visually-hidden" aria-live="polite"></div></article><footer class="footer"><span>LearnAI 原创 RAG 案例 · 视觉体系沿用 Agent 专题演示</span><a href="../ATTRIBUTION.md" target="_blank" rel="noopener">来源与修改说明</a><a href="../../agent-reference/LICENSE" target="_blank" rel="noopener">共享样式 AGPL-3.0</a></footer>`;
const scene = $('#scene');
function settleScene() {
  for (const animation of scene.getAnimations({subtree:true})) {
    // A paused teaching step must remain readable, including its newest message.
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish();
    else animation.pause();
  }
}
const clock = new TeachingClock(() => {
  if (state.phase >= 6 || disposed) return false;
  state.phase++; render();
  if (state.phase === 6) { queueMicrotask(updatePlayback); return false; }
  return true;
});
function updatePlayback() {
  if (!timeline) return;
  const status = state.phase === 6 ? '演示完成' : clock.running ? '自动播放中…' : state.phase ? `已暂停 · ${state.phase} / 6 步` : '准备演示 · 0 / 6 步';
  $('#status').classList.toggle('running',clock.running); $('#status span').textContent=status;
  $('#play').textContent=clock.running ? '暂停演示' : state.phase === 6 ? '重新播放' : state.phase ? '继续演示' : '播放演示';
  $('#play').setAttribute('aria-pressed',String(clock.running)); $('#next').disabled=state.phase===6;
}
function boundary() {
  const p=state.phase;
  const baseline=message('query','用户问题',question(),'固定教学问题','baseline-question') + (p>=1 ? message('answer','直接回答 · 未提供平台资料','当前没有平台规则依据，无法确认通过条件。','本例采用保守拒答预设；不是实际模型输出','baseline-answer') : '<div class="empty">等待处理问题</div>');
  const msgs=[
    message('query','用户问题',question(),'两条路径使用同一问题','query'),
    message('system','构造检索查询','目标：通过门槛 + 通过状态保留规则。','只查询当前身份可访问的资料','search'),
    message('evidence','召回规则片段',escape(documents[0].text),documents[0].source,'retrieved'),
    message('evidence','装入本次上下文','<span class="badge">guide-2</span> 保留来源、版本和完整条件。','模型参数没有被本次检索修改','context'),
    message('answer','基于证据组织回答','三题答对两题即可通过；之后未通过，不清除已有通过状态。','[guide-2] → course-guide · v2 · §3','answer'),
    message('system','核对结论与来源','答案的两项规则都能在 guide-2 原文中找到。','找到资料和正确使用资料，需要分别验收','verify'),
  ];
  return pipeline(['提出问题','检索资料','装入上下文','组织回答'],Math.min(4,Math.ceil(p*4/6))) + `<div class="dual">${panel('基线 · 直接回答',baseline,'<span class="badge warn">没有外部证据</span>')}${panel('当前 · 检索增强',p ? msgs.slice(0,p).join('') : '<div class="empty">播放或单步，跟随证据进入回答</div>','<span class="badge">携带来源</span>')}</div>` + insight(p<3 ? '两条路径的差异来自本次输入是否包含平台资料。先观察检索何时带回证据。' : p<5 ? '检索结果已进入本次上下文，仍需组织答案并核对引用；找到资料不等于回答完成。' : '新增证据支持了通过门槛和状态保留两项结论；RAG 改变本次上下文，不更新模型参数。');
}
function chunking() {
  const text=documents[0].text,chunks=splitText(text,state.size,state.overlap);
  state.chunk=Math.min(state.chunk,chunks.length-1);
  const selected=chunks[state.chunk], total=chunks.reduce((n,c)=>n+c.text.length,0);
  const colors=['var(--cyan)','var(--purple)','var(--success)','var(--amber)'];
  const starts=new Set(chunks.map(c=>c.start));
  const chars=[...text].map((ch,i)=> { const count=chunks.filter(c=>i>=c.start&&i<c.end).length;
    return `<span class="char ${starts.has(i)?'boundary':''} ${count>1?'overlap':''} ${i>=selected.start&&i<selected.end?'focused':''}" title="字符 ${i} · 属于 ${count} 个片段">${ch}<small>${i}</small></span>`;
  }).join('');
  const condition='之后未通过，不清除已有通过状态';
  const intact=chunks.some(c=>c.text.includes(condition));
  return `<div class="workspace"><div><div class="paper"><div class="paper-head"><span class="paper-icon">▤</span><div><h2>课程规则 · 原文</h2><div class="sub">course-guide / v2 / §3 · 公开 · 字符窗口示意</div></div></div><div class="characters">${chars}</div><div class="legend" style="padding:8px 0 0"><span><i style="background:var(--purple)"></i>紫线：片段起点</span><span><i style="background:#cbb4ed"></i>紫底：重复字符</span><span><i style="background:var(--accent)"></i>绿底：当前片段</span></div></div><div class="chunk-grid">${chunks.map((c,i)=>`<button class="chunk ${i===state.chunk?'selected':''}" data-action="chunk" data-index="${i}" data-motion="chunk-${i}" aria-pressed="${i===state.chunk}" style="--chunk-color:${colors[i%colors.length]}"><h3>CHUNK ${String(i+1).padStart(2,'0')} <span class="sub">[${c.start}, ${c.end})</span></h3><p>${i>0 ? `<mark>${escape(c.text.slice(0,Math.min(state.overlap,c.text.length)))}</mark>${escape(c.text.slice(state.overlap))}` : escape(c.text)}</p><small>course-guide · v2 · chunk-${i+1} · 公开</small></button>`).join('')}</div></div>${stats([stat('片段数量',chunks.length,`原文 ${text.length} 字符`),stat('重复字符',total-text.length,`共写入索引 ${total} 字符`,'purple'),stat('条件完整性',intact?'完整':'被拆开',intact?'至少一块包含完整状态规则':'没有一块保留完整状态规则',intact?'green':'amber')])}</div>` + insight(`${lastChange ? lastChange+'。' : ''}当前步长 ${state.size-state.overlap} 字符；${intact?'至少一个片段保留了“之后未通过”及其后果。':'“之后未通过”与后果被分开，检索到单块时可能丢失条件。'}点击片段可核对它对应的原文位置。`);
}
function vectors() {
  const a=state.angle*Math.PI/180, length=state.length, v=[Math.cos(a)*length,Math.sin(a)*length], value=cosine([1,0],v);
  const ox=205,oy=245, scale=85, x=ox+v[0]*scale,y=oy-v[1]*scale;
  const arcX=ox+45*Math.cos(a),arcY=oy-45*Math.sin(a);
  const grid=Array.from({length:9},(_,i)=>{const d=i*45+25;return `<path d="M${d} 20V290M20 ${d-5}H390" stroke="rgba(0,0,0,.04)"/>`;}).join('');
  const visual=`<div class="vector-stage"><svg viewBox="0 0 410 320" role="img" aria-label="查询向量固定向右，文档向量方向 ${state.angle} 度，长度 ${length}"><defs><marker id="q-head" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--cyan)"/></marker><marker id="d-head" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--purple)"/></marker></defs>${grid}<path d="M22 ${oy}H390M${ox} 290V22" stroke="#c5cbc7"/><text x="388" y="${oy+17}" font-size="10" fill="var(--sub)">x</text><text x="${ox+8}" y="25" font-size="10" fill="var(--sub)">y</text><circle cx="${ox}" cy="${oy}" r="4" fill="#68756e"/><path d="M${ox} ${oy}H${ox+scale}" stroke="var(--cyan)" stroke-width="3" marker-end="url(#q-head)"/><text x="${ox+scale+6}" y="${oy+20}" font-size="11" fill="var(--cyan)">Q = [1, 0]</text>${length ? `<path d="M${ox+45} ${oy}A45 45 0 0 0 ${arcX} ${arcY}" fill="none" stroke="var(--amber)" stroke-width="2"/><text x="${ox+50}" y="${oy-14}" font-size="12" fill="var(--amber)">θ ${state.angle}°</text><path d="M${ox} ${oy}L${x} ${y}" stroke="var(--purple)" stroke-width="3" marker-end="url(#d-head)"/><path d="M${x} ${y}V${oy}" stroke="var(--purple)" opacity=".25" stroke-dasharray="4 4"/>` : ''}<circle class="handle" data-drag="vector" cx="${x}" cy="${y}" r="13" fill="var(--purple)" fill-opacity=".15" stroke="var(--purple)" stroke-width="2"/><text x="${Math.max(20,Math.min(300,x+14))}" y="${Math.max(40,y-13)}" font-size="11" fill="var(--purple)">D [${v[0].toFixed(2)}, ${v[1].toFixed(2)}]</text></svg></div><div class="vector-key"><span><i class="key-line"></i>固定查询 Q</span><span><i class="key-line doc"></i>可调文档 D</span><span class="sub">拖动紫色端点，或使用上方滑块</span></div><div class="formula">cos(Q, D) = (Q · D) / (‖Q‖ × ‖D‖)<br>= ${v[0].toFixed(2)} / (1 × ${length.toFixed(1)}) = ${value===undefined?'未定义':value.toFixed(3)}</div>`;
  return `<div class="workspace">${panel('二维向量空间',visual,'<span class="badge query">人工向量 · 非真实 embedding</span>')}${stats([stat('余弦相似度',value===undefined?'—':value.toFixed(3),value===undefined?'零向量不能计算余弦':'比较方向，不是答案概率','cyan'),stat('向量夹角',length ? `${state.angle}°`:'—','查询始终沿 x 正方向','amber'),stat('文档向量长度',length.toFixed(1),'固定角度时，缩放不改变余弦','purple')])}</div>`+insight(value===undefined?'文档向量变成零向量，方向不存在，余弦未定义；本演示明确显示缺失值。配套 Python 示例约定返回 0，两者应区分。':`${lastChange ? lastChange+'。' : ''}当前夹角 ${state.angle}°，余弦 ${value.toFixed(3)}。只改变长度时方向不变，余弦也不变；相似度不能证明文档内容真实。`);
}
function hybrid() {
  const docs=activeDocs(), w=state.weight/100;
  const keyword=[...docs].sort((a,b)=>b.keyword-a.keyword),semantic=[...docs].sort((a,b)=>b.semantic-a.semantic);
  const fused=docs.map(d=>({...d,score:state.mode==='hybrid'?w*d.keyword+(1-w)*d.semantic:d[state.mode]})).sort((a,b)=>b.score-a.score);
  const lanes=`<div class="dual"><div class="lane"><div class="lane-title"><i class="lane-dot"></i>关键词召回 · 字面线索</div>${keyword.map((d,i)=>rankRow(d,{prefix:'keyword',rank:i+1,score:d.keyword})).join('')}</div><div class="lane"><div class="lane-title"><i class="lane-dot"></i>语义召回 · 含义线索</div>${semantic.map((d,i)=>rankRow(d,{prefix:'semantic',rank:i+1,score:d.semantic})).join('')}</div></div><div class="merge-arrow" aria-hidden="true">↘ 合并同一文档 ID ↙</div><div class="fused">${fused.slice(0,state.topK).map((d,i)=>`<div class="rank-row hit" data-motion="fusion-${d.id}"><span class="rank-num">${i+1}</span><div class="rank-detail"><div class="rank-title">${d.title} <span class="badge">${d.id}</span></div><div class="contributions"><i style="width:${(state.mode==='semantic'?0:state.mode==='keyword'?1:w)*d.keyword*100}%"></i><i style="width:${(state.mode==='keyword'?0:state.mode==='semantic'?1:1-w)*d.semantic*100}%"></i></div><div class="contribution-label">关键词第 ${keyword.findIndex(x=>x.id===d.id)+1} 名 · 语义第 ${semantic.findIndex(x=>x.id===d.id)+1} 名</div></div><span class="rank-score">${d.score.toFixed(3)}</span></div>`).join('')}</div>`;
  return `<div class="workspace">${panel('双路召回 → 融合候选',lanes,`<span class="badge">Top ${state.topK}</span>`)}${stats([stat('当前首位',fused[0].id==='guide-2'?'规则':'进度',fused[0].title,'cyan'),stat('关键词权重',state.mode==='hybrid'?state.weight+'%':state.mode==='keyword'?'100%':'0%','青色与紫色条表示两路贡献','purple'),stat('合并后文档',docs.length,'同一文档只保留一个候选')])}</div>`+insight(`当前${state.mode==='hybrid'?`采用 ${state.weight}% 关键词 + ${100-state.weight}% 语义加权` : state.mode==='keyword'?'只采用关键词分数':'只采用语义分数'}，首位是“${fused[0].title}”。同一资料在两路中的名次不同；这里采用加权分数教学示例，不等于实际系统的排名融合方案。`);
}
function access() {
  const p=state.phase;
  const all=[...documents].sort((a,b)=>b.semantic-a.semantic);
  const accessible=all.filter(d=>state.staff||d.access==='public');
  const final=accessible.filter(isValid);
  const candidates=all.map((d,i)=>rankRow({...d,title:d.access==='staff'&&!state.staff?'受限内部资料':d.title},{prefix:'before',rank:i+1,score:d.semantic,cls:p>=2&&d.access==='staff'&&!state.staff?'blocked':'',note:d.access==='staff'&&!state.staff?'当前身份不可读取':d.access==='staff'?'内部 · 尚未生效':'公开'})).join('');
  const right=p<2?'<div class="empty">等待权限过滤</div>':(p<4?accessible:final).map((d,i)=>rankRow(d,{prefix:'after',rank:i+1,score:d.semantic,cls:'hit',body:p>=4,note:p<4?'权限通过':'生效规则 · 支持问题'})).join('') || '<div class="empty">没有有效证据</div>';
  const gate=p<2?'等待检查':p<4?'权限检查':'有效性检查';
  const body=`${pipeline(['召回候选','权限过滤','有效性重排','组织回答'],p===0?0:p===1?1:p<=3?2:p<=5?3:4)}<div class="gate-layout"><div class="gate-column"><h3>原始候选 · 分数排序</h3>${candidates}</div><div class="gate-center"><div class="gate-symbol ${p>=2?'':'pulse'}">◇</div><span>${gate}</span><span class="gate-note">${state.staff?'内部成员':'普通学员'}</span>${p>=2&&!state.staff?'<span class="gate-state">拦截 1 条</span>':''}${p>=4?'<span class="badge warn">排除无效依据</span>':''}<span aria-hidden="true">→</span></div><div class="gate-column"><h3>${p>=4?'可用于本问句的证据':'权限通过的候选'}</h3>${right}</div></div>${p>=5?message('evidence','装入上下文',escape(final[0].text),final[0].source,'gate-context'):''}${p>=6?message('answer','回答引用',escape(evidenceAnswer(final.map(d=>d.id))),'只使用生效且支持结论的证据','gate-answer'):''}`;
  return `<div class="workspace">${panel('候选穿过关卡，而不是直接消失',body)}${stats([stat('原始候选',all.length,'排序前包含受限资料','cyan'),stat('权限可读',p>=2?accessible.length:'—',state.staff?'内部成员可以读取草案':'普通学员不能读取内部资料','amber'),stat('有效证据',p>=4?final.length:'—','可访问 ≠ 已生效 ≠ 支持结论')])}</div>`+insight(p<2?'原始分数最高的是内部资料。播放到权限检查，观察它是否能通过当前身份的关卡。':p<4?(state.staff?'内部成员可以读取草案，但它尚未生效，下一步仍需检查有效性。':'受限资料已在进入上下文之前被拦截，较高的相似度不能越过权限。'):'权限通过后还要核对生效状态与问题支持度。本问句只保留 course-guide v2；重排不应让高分草案覆盖有效规则。');
}
function citations() {
  const docs=documents.filter(d=>d.access==='public'),selected=docs.filter(d=>state.included.includes(d.id));
  const supported=state.included.includes('guide-2')&&!state.missing;
  const sources=docs.map(d=>`<article class="source-card ${state.linked===d.id?'linked':''}" data-motion="source-${d.id}" data-source="${d.id}"><label class="source-head"><input type="checkbox" data-evidence="${d.id}" ${state.included.includes(d.id)?'checked':''}>${d.title}<span class="badge">${d.id}</span></label><p>${escape(d.text)}</p><div class="source-meta">${d.source}</div>${state.included.includes(d.id)?`<button class="citation ${state.linked===d.id?'active':''}" data-action="link" data-id="${d.id}" aria-pressed="${state.linked===d.id}">定位它支持的答案</button>`:''}</article>`).join('');
  const answer=supported ? `<div class="answer-line ${state.linked==='guide-2'?'linked':''}" data-motion="supported-answer">三题答对两题即可通过。<button class="citation ${state.linked==='guide-2'?'active':''}" data-action="link" data-id="guide-2" aria-label="定位通过条件的来源 guide-2">[guide-2]</button><br>之后未通过，不清除已有通过状态。<button class="citation" data-action="link" data-id="guide-2" aria-label="定位状态保留的来源 guide-2">[guide-2]</button></div>`:`<div class="refuse" data-motion="refusal"><b>资料不足 · 暂不作答</b><p>${escape(evidenceAnswer(state.included,state.missing))}</p></div>`;
  const context=`<div class="sub" style="margin-bottom:8px">实际进入上下文的片段</div><div class="context-slots">${selected.length?selected.map(d=>`<span class="context-chip" data-motion="context-${d.id}">${d.id}</span>`).join(''):'<span class="sub">空上下文</span>'}</div>`;
  return `<p class="sub" style="margin-bottom:14px">问题：${question()}</p><div class="dual">${panel('来源片段 · 选择证据',`<div class="sources">${sources}</div>`,'<span class="badge">勾选后送入上下文</span>')}${panel('组织答案 · 检查每项结论',context+answer+`<div class="evidence-link">${state.linked==='guide-2'&&supported?'guide-2 §3 ↔ 通过门槛 + 状态保留':state.linked?'该片段未直接支持本问句的回答':'点击引用，定位支持结论的来源'}</div><p class="sub">引用必须对应实际输入，并且原文确实支持结论。这里使用确定性摘录，不调用模型。</p>`,'<span class="badge answer">结论与来源对应</span>')}</div>`+insight(state.missing?'问题切换为补考次数上限；即使携带测验资料，其中也没有该规定，应说明信息缺口。':supported?'guide-2 同时支持两项结论。点击来源或引用，可观察二者的对应；移除 guide-2 后答案会转为拒答。':`当前选中 ${selected.length} 个片段，但没有有效规则 guide-2。资料数量不是证据充分性的保证。`);
}
function evaluation() {
  const relevant=state.evalQuery==='rules'?['guide-2','progress-1']:['install-1'];
  const corpus=documents.filter(d=>d.access==='public');
  const ordered=state.evalQuery==='rules'?[...corpus].sort((a,b)=>b.semantic-a.semantic):[corpus.find(d=>d.id==='install-1'),corpus.find(d=>d.id==='progress-1'),corpus.find(d=>d.id==='guide-2')];
  const selected=ordered.slice(0,state.topK),metrics=retrievalMetrics(selected.map(d=>d.id),relevant);
  const body=`<div class="sets"><div class="set"><div class="set-title green">标注相关集合 · ${relevant.length} 条</div>${relevant.map(docId=>rankRow(documents.find(d=>d.id===docId),{prefix:'truth',cls:metrics.hits.includes(docId)?'hit':'',note:metrics.hits.includes(docId)?'✓ 已命中':'○ 漏检'})).join('')}</div><div class="set retrieved"><div class="set-title cyan">Top ${state.topK} 返回集合 · ${selected.length} 条</div>${selected.map((d,i)=>rankRow(d,{prefix:'retrieved',rank:i+1,cls:metrics.hits.includes(d.id)?'hit':'noise',note:metrics.hits.includes(d.id)?'✓ 命中':'△ 噪声'})).join('')}</div></div><div class="metric-strip"><div class="metric-box"><div class="sub">Recall@${state.topK}</div><div class="metric-value green">${metrics.recall.toFixed(2)}</div><div class="metric-formula">命中 ${metrics.hits.length} / 相关总数 ${relevant.length}</div><div class="track"><i style="width:${metrics.recall*100}%"></i></div></div><div class="metric-box"><div class="sub">Precision@${state.topK}</div><div class="metric-value cyan">${metrics.precision.toFixed(2)}</div><div class="metric-formula">命中 ${metrics.hits.length} / 返回条数 ${selected.length}</div><div class="track"><i style="width:${metrics.precision*100}%;background:var(--cyan)"></i></div></div></div>`;
  return `<div class="workspace">${panel('问句：'+(state.evalQuery==='rules'?'测验通过与进度怎样记录？':'首次运行怎样安装依赖？'),body,'<span class="badge">固定人工标注</span>')}${stats([stat('命中',metrics.hits.length,'检索集合与相关集合的交集'),stat('漏检',metrics.missing.length,'相关但没有返回的资料','amber'),stat('噪声',metrics.noise.length,'返回但不在标注相关集合中','red')])}</div>`+insight(`${lastChange?lastChange+'。':''}当前返回 ${selected.length} 条，命中 ${metrics.hits.length} 条、漏检 ${metrics.missing.length} 条、噪声 ${metrics.noise.length} 条。${metrics.recall===1?'相关资料已找全，继续扩大 K 只会引入噪声。':'扩大 K 可能补齐漏检，但也可能带来无关资料。'}这只是单问句检索评测，不代表答案质量。`);
}
const projectSteps=[['接收问题','明确需要的两项规则'],['构造查询','身份与检索条件一起传入'],['召回候选','取回 Top K 相关片段'],['核对依据','过滤草案与无关片段'],['组装上下文','保留来源与完整条件'],['回答与引用','结论回到证据原文']];
function project() {
  const rows=pickedRows(),evidence=rows.filter(isValid),p=state.phase;
  const steps=`<aside class="panel steps" aria-label="执行阶段">${projectSteps.map(([title,desc],i)=>`<div class="step ${p===i+1?'current':p>i+1?'done':''}"><div class="step-number-col"><span class="step-number">${p>i+1?'✓':i+1}</span>${i<5?'<span class="step-line"></span>':''}</div><div class="step-content"><b>${title}</b><small>${desc}</small></div></div>`).join('')}</aside>`;
  const events=[
    message('query','用户问题',question(),'需要通过门槛与状态保留两项依据','project-query'),
    message('system','检索条件',`身份：${state.staff?'内部成员':'普通学员'}<br>召回：${state.mode==='hybrid'?'混合':state.mode==='keyword'?'关键词':'语义'} · Top K ${state.topK}`,'权限过滤在返回上下文前执行','project-plan'),
    message('evidence','召回候选',rows.map((d,i)=>`<div style="margin-bottom:7px"><span class="badge ${d.id==='draft-3'?'warn':''}">${i+1} · ${d.id}</span> ${d.title} <b>${d.score.toFixed(2)}</b></div>`).join(''),`实际返回 ${rows.length} 条；固定教学分数`,'project-hits'),
    message('system','证据筛选',rows.map(d=>`<div>${isValid(d)?'✓':'×'} ${d.title}：${isValid(d)?'生效规则，支持两项要求':d.id==='draft-3'?'草案未生效':'不直接支持本问题'}</div>`).join(''),`保留 ${evidence.length} 条有效依据`,'project-filter'),
    evidence.length?message('evidence','本次上下文',escape(evidence[0].text),evidence[0].source+' · '+evidence[0].id,'project-context'):message('system','上下文缺口','没有可支持完整回答的生效规则。','不把无关资料或未生效草案塞给答案','project-empty'),
    message('answer','最终回答',escape(evidenceAnswer(evidence.map(d=>d.id))),evidence.length?'[guide-2] → course-guide · v2 · §3':'信息缺口：请补充有效规则','project-answer'),
  ];
  return `<div class="timeline-layout">${steps}<section class="panel"><div class="panel-head"><h2>MESSAGE LIST · 实时追踪</h2><span class="badge ${p===6?'':'query'}">${p} / 6</span></div><div class="panel-body scene-area">${p?events.slice(0,p).join(''):'<div class="empty">播放或单步，观察问题如何经过检索成为有依据的回答</div>'}</div><div class="trace-stat"><span>候选 <b>${p>=3?rows.length:'—'}</b></span><span>有效依据 <b>${p>=4?evidence.length:'—'}</b></span><span>引用 <b>${p>=6?evidence.length:'—'}</b></span></div></section></div>`+insight(lastChange&&p===0?`${lastChange}。旧播放已取消，点击播放按新条件重新推演。`:p<4?'每条消息都对应一次状态变化。可暂停阅读，或单步核对同一片段如何进入后续流程。':evidence.length?'guide-2 从召回候选进入有效证据与上下文，最终承担两项结论的引用。':'当前候选没有有效规则。把 Top K 调大，或调整召回方式，再比较能否找回 guide-2；系统应拒答而不是用草案补齐。');
}
const renderers={'rag-boundary':boundary,chunking,vectors,hybrid,'rag-access':access,citations,'rag-eval':evaluation,'rag-project':project};
let motionReduced=reduced.matches;
document.documentElement.dataset.reduced=String(motionReduced);
function render(animate=true) {
  if(disposed) return;
  const old=new Map([...scene.querySelectorAll('[data-motion]')].map(el=>[el.dataset.motion,el.getBoundingClientRect()]));
  const active=document.activeElement, focusEvidence=scene.contains(active)?active.dataset.evidence:undefined;
  const focusAction=scene.contains(active)?{action:active.dataset.action,id:active.dataset.id,index:active.dataset.index,text:active.textContent}:undefined;
  scene.getAnimations({subtree:true}).forEach(a=>a.cancel());
  scene.innerHTML=renderers[id]();
  if(focusEvidence) scene.querySelector(`[data-evidence="${focusEvidence}"]`)?.focus({preventScroll:true});
  else if(focusAction?.action) [...scene.querySelectorAll('button[data-action]')].find(el=>el.dataset.action===focusAction.action&&el.dataset.id===focusAction.id&&el.dataset.index===focusAction.index&&el.textContent===focusAction.text)?.focus({preventScroll:true});
  if(animate&&!motionReduced) for(const el of scene.querySelectorAll('[data-motion]')) {
    const before=old.get(el.dataset.motion),after=el.getBoundingClientRect();
    if(before) { const dy=before.top-after.top,dx=before.left-after.left;
      if(Math.abs(dy)+Math.abs(dx)>1) el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:450,easing:'cubic-bezier(.2,.7,.2,1)'});
    } else el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'});
  }
  if(userPaused) settleScene();
  syncControls(); updatePlayback(); reportHeight();
}
function syncControls() {
  for(const input of document.querySelectorAll('[data-bind]')) input.value=String(state[input.dataset.bind]);
  for(const out of document.querySelectorAll('[data-output]')) { const key=out.dataset.output; out.textContent=String(state[key])+(['size','overlap'].includes(key)?' 字符':key==='angle'?'°':key==='weight'?'%':''); }
  for(const button of document.querySelectorAll('[data-set]')) button.setAttribute('aria-pressed',String(String(state[button.dataset.set])===button.dataset.value));
  $('#motion').textContent=motionReduced?'启用动态效果':'减少动态效果'; $('#motion').setAttribute('aria-pressed',String(motionReduced));
}
function mutate(key,value,label) {
  interacted=true; clock.reset(); userPaused=false; document.documentElement.dataset.paused='false';
  const previous=state[key]; state[key]=value;
  if(key==='size'||key==='overlap') { state.chunk=0; lastChange=`${label}从 ${previous} 调整为 ${value}`; }
  else lastChange=`${label}已调整`;
  if(timeline) state.phase=0;
  render();
}
function reset() { interacted=true;clock.reset();userPaused=false;state=initial();lastChange='';render(false); }
root.addEventListener('input',event=>{
  const target=event.target;
  if(target.matches('[data-bind]')) {
    const key=target.dataset.bind,value=target.tagName==='SELECT'?target.value:Number(target.value);
    mutate(key,value,target.getAttribute('aria-label'));
  }
});
root.addEventListener('change',event=>{
  const target=event.target;
  if(target.matches('[data-evidence]')) {
    interacted=true;state.included=target.checked?[...state.included,target.dataset.evidence]:state.included.filter(x=>x!==target.dataset.evidence);state.linked='';render();
  }
});
root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.set) { const key=b.dataset.set,value=['staff','missing'].includes(key)?b.dataset.value==='true':b.dataset.value;mutate(key,value,key==='staff'?'检索身份':key==='mode'?'召回方式':'问题');return; }
  if(b.id==='play') { interacted=true;userPaused=false;
    if(clock.running) {clock.pause();userPaused=true;settleScene();}
    else {if(state.phase===6){state.phase=0;clock.reset();render(false);}scene.getAnimations({subtree:true}).forEach(a=>a.play());clock.play();}
    document.documentElement.dataset.paused=String(userPaused);updatePlayback();return;
  }
  if(b.id==='next') {interacted=true;userPaused=false;document.documentElement.dataset.paused='false';clock.step();updatePlayback();return;}
  if(b.id==='motion') {interacted=true;motionReduced=!motionReduced;document.documentElement.dataset.reduced=String(motionReduced);clock.pause();userPaused=false;scene.getAnimations({subtree:true}).forEach(a=>a.cancel());syncControls();updatePlayback();return;}
  switch(b.dataset.action) {
    case 'reset': document.documentElement.dataset.paused='false';reset();break;
    case 'chunk':state.chunk=Number(b.dataset.index);render(false);break;
    case 'link':state.linked=state.linked===b.dataset.id?'':b.dataset.id;render(false);break;
    case 'same-direction':state.angle=0;state.length=2;lastChange='方向设为 0°，长度设为 2';render();break;
    case 'zero-vector':state.length=0;lastChange='长度设为 0';render();break;
  }
});
let dragging=false;
scene.addEventListener('pointerdown',event=>{if(event.target.closest('[data-drag="vector"]')) {dragging=true;scene.setPointerCapture(event.pointerId);event.preventDefault();}});
scene.addEventListener('pointermove',event=>{
  if(!dragging)return;
  const rect=scene.querySelector('svg').getBoundingClientRect(),scale=410/rect.width;
  const dx=(event.clientX-rect.left)*scale-205,dy=Math.max(0,245-(event.clientY-rect.top)*scale);
  state.angle=Math.round(Math.atan2(dy,dx)*180/Math.PI);state.length=Math.round(Math.min(2,Math.hypot(dx,dy)/85)*10)/10;
  lastChange='拖动文档向量端点';render(false);
});
scene.addEventListener('pointerup',()=>{dragging=false;});scene.addEventListener('pointercancel',()=>{dragging=false;});
let heightTimer;
function reportHeight() {
  clearTimeout(heightTimer);if(disposed||window.parent===window)return;
  heightTimer=setTimeout(()=> {if(disposed)return;const height=Math.ceil(document.querySelector('.footer').getBoundingClientRect().bottom+window.scrollY+16);window.parent.postMessage({type:'rag-demo-height',demoId:id,height},location.origin);},60);
}
const observer=new ResizeObserver(reportHeight);observer.observe(root);
window.addEventListener('resize',reportHeight);
document.addEventListener('visibilitychange',()=>{if(document.hidden){clock.pause();userPaused=true;document.documentElement.dataset.paused='true';settleScene();updatePlayback();}});
const onReduced=event=>{motionReduced=event.matches;document.documentElement.dataset.reduced=String(motionReduced);clock.pause();render(false);};reduced.addEventListener('change',onReduced);
const onView=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){onView.disconnect();if(timeline&&!motionReduced&&!interacted&&!document.hidden){clock.play();updatePlayback();}}},{threshold:.15});
window.addEventListener('pagehide',()=>{disposed=true;clock.dispose();clearTimeout(heightTimer);observer.disconnect();onView.disconnect();window.removeEventListener('resize',reportHeight);reduced.removeEventListener('change',onReduced);scene.getAnimations({subtree:true}).forEach(a=>a.cancel());});
render(false);onView.observe(scene);
