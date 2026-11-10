import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const titles = { 'rag-boundary':'检索与生成：证据怎样进入回答', chunking:'分块与元数据：把完整条件保留下来', vectors:'向量与相似度：方向比长度更重要', hybrid:'混合召回：两条线索怎样合并', 'rag-access':'权限与重排：从候选到有效证据', citations:'引用与拒答：每句话都能找到依据', 'rag-eval':'检索评测：看见命中、漏检与噪声', 'rag-project':'完整 RAG：跟随一条证据走到答案' };
const files = new Map();
for (const [id, title] of Object.entries(titles)) {
  const folder = new URL(`public/demos/rag/${id}/`, root);
  mkdirSync(folder, {recursive:true});
  files.set(new URL('index.html', folder), `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · LearnAI</title><link rel="stylesheet" href="../../agent-reference/shared/lesson.css"><link rel="stylesheet" href="../shared/lab.css"><script type="module" src="../shared/lab.js"></script></head><body data-demo="${id}"><main id="lab" aria-label="${title}"></main><noscript>请启用 JavaScript 以操作教学演示。</noscript></body></html>\n`);
}
files.set(new URL('public/demos/rag/shared/model.js', root), '// Generated from src/rag-interaction.ts by scripts/generate-rag-pages.mjs.\n' + ts.transpileModule(readFileSync(new URL('src/rag-interaction.ts', root),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
for (const [file, content] of files) {
  if (process.argv.includes('--check')) { if (readFileSync(file,'utf8') !== content) throw Error('Generated RAG asset differs: ' + file.pathname); }
  else writeFileSync(file,content);
}
console.log('Eight RAG pages and shared teaching model ' + (process.argv.includes('--check') ? 'verified.' : 'generated.'));
