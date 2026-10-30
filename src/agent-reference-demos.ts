// Authored lessons choose an identifier; iframe URLs always come from this local registry.
const mappings = [
  ['tool-call', 'tool-schema'],
  ['tool-messages', 'tool-messages'],
  ['tool-design', 'tool-design'],
  ['orchestration', 'tool-orchestration'],
  ['react', 'agent-loop'],
  ['context-window', 'context-budget'],
  ['compression', 'context-retrieval'],
  ['vector-search', 'agent-embedding'],
  ['skill', 'agent-skill'],
  ['skill-file', 'agent-skill-file'],
  ['mcp', 'agent-mcp'],
  ['failures', 'idempotency'],
  ['approval', 'approval-state'],
  ['tracing', 'agent-trace'],
  ['multi-agent', 'agent-organization'],
  ['harness', 'system-design'],
] as const;

export type AgentReferenceDemoId = typeof mappings[number][0];
export const agentReferenceDemos = Object.freeze(mappings.map(([demoId, lessonKey]) => Object.freeze({
  demoId,
  lessonKey,
  path: `/demos/agent-reference/${demoId}/index.html`,
})));

export function getAgentReferenceDemo(value: unknown) {
  return typeof value === 'string' ? agentReferenceDemos.find(demo => demo.demoId === value) : undefined;
}
