// Generated from src/rag-interaction.ts by scripts/generate-rag-pages.mjs.
export const ragDemoIds = ['rag-boundary', 'chunking', 'vectors', 'hybrid', 'rag-access', 'citations', 'rag-eval', 'rag-project'];
export const ragDemoTitles = {
    'rag-boundary': '跟随证据进入检索增强回答',
    chunking: '调整分块边界与重叠，核对完整条件',
    vectors: '调整向量方向与长度，观察余弦相似度',
    hybrid: '比较双路召回与融合排名',
    'rag-access': '跟随候选通过权限与有效性检查',
    citations: '选择证据并定位答案引用',
    'rag-eval': '观察命中、漏检与噪声怎样改变指标',
    'rag-project': '逐步追踪从查询到引用的完整流程',
};
export function parseRagInteraction(source) {
    try {
        const value = JSON.parse(source);
        if (value && value.kind === 'rag-demo' && ragDemoIds.includes(value.demoId)
            && typeof value.title === 'string' && value.title.trim()
            && Object.keys(value).every(key => ['kind', 'demoId', 'title'].includes(key)))
            return value;
    }
    catch { /* Invalid authored configuration is reported by the lesson renderer. */ }
}
export const documents = [
    { id: 'guide-2', title: '测验规则', source: 'course-guide · v2 · §3', text: '测验共三题，答对两题即可通过。之后未通过，不清除已有通过状态。', access: 'public', keyword: .92, semantic: .94 },
    { id: 'progress-1', title: '学习进度', source: 'progress-guide · v1 · §2', text: '已读记录与测验通过状态分别保存。阅读完成不代表测验通过。', access: 'public', keyword: .96, semantic: .81 },
    { id: 'draft-3', title: '内部规则草案', source: 'staff-draft · v3 · §1', text: '内部讨论稿：拟调整为三题全对才通过；尚未生效。', access: 'staff', keyword: .98, semantic: .97 },
    { id: 'install-1', title: '安装说明', source: 'setup · v1 · §1', text: '首次运行前安装依赖，确认服务启动后再打开课程。', access: 'public', keyword: .04, semantic: .18 },
];
export function retrieve(mode, staff, topK) {
    return documents.filter(d => staff || d.access === 'public').map(d => ({ ...d,
        score: mode === 'hybrid' ? (d.keyword + d.semantic) / 2 : d[mode],
    })).sort((a, b) => b.score - a.score).slice(0, topK);
}
export function splitText(text, size, overlap) {
    if (!Number.isInteger(size) || size < 1 || !Number.isInteger(overlap) || overlap < 0 || overlap >= size)
        throw Error('Invalid chunk window');
    const chunks = [];
    for (let start = 0; start < text.length; start += size - overlap) {
        chunks.push({ start, end: Math.min(start + size, text.length), text: text.slice(start, start + size) });
        if (start + size >= text.length)
            break;
    }
    return chunks;
}
export function evidenceAnswer(ids, unknown = false) {
    if (unknown)
        return '现有资料没有补考次数上限的规定，无法据此回答。请补充相关规则。';
    return ids.includes('guide-2') ? '三题答对两题即可通过；之后未通过，不清除已有通过状态。[guide-2]' : '当前证据未包含有效测验规则，无法确认通过条件。请补充 course-guide v2。';
}
export function cosine(a, b) {
    if (a.length !== b.length || !a.length || [...a, ...b].some(n => !Number.isFinite(n)))
        return;
    const normA = Math.hypot(...a), normB = Math.hypot(...b);
    if (!normA || !normB)
        return;
    return Math.max(-1, Math.min(1, a.reduce((sum, n, i) => sum + n * b[i], 0) / (normA * normB)));
}
export function retrievalMetrics(ids, relevantIds) {
    const retrieved = new Set(ids), relevant = new Set(relevantIds);
    const hits = [...retrieved].filter(id => relevant.has(id));
    return { hits, missing: [...relevant].filter(id => !retrieved.has(id)), noise: [...retrieved].filter(id => !relevant.has(id)),
        recall: relevant.size ? hits.length / relevant.size : 0, precision: retrieved.size ? hits.length / retrieved.size : 0 };
}
export function getRagDemo(value) {
    return typeof value === 'string' && ragDemoIds.includes(value)
        ? { demoId: value, title: ragDemoTitles[value], path: `/demos/rag/${value}/index.html` } : undefined;
}
