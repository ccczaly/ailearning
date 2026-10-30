import { getAgentReferenceDemo } from './agent-reference-demos.ts';
import type { AgentReferenceDemoId } from './agent-reference-demos.ts';

export type AgentOutcome = { label: string; effect: string; reason: string; when: string };
export type AgentStep = { label: string; context: string; action: string; observation: string; state: string };
export type AgentItem = AgentOutcome & { cost: number; recommended: boolean };
type Base = { title: string; prompt: string };
export type AgentCapabilityLab = Base & {
  kind: 'capability'; task: string;
  tools: { id: 'search' | 'read' | 'save'; label: string; description: string }[];
  report: string;
};
export type AgentInteraction = Base & (
  | { kind: 'intro-demo' }
  | { kind: 'reference-demo'; demoId: AgentReferenceDemoId }
  | { kind: 'workflow' }
  | { kind: 'trace'; steps: AgentStep[] }
  | { kind: 'branch' | 'compare'; options: AgentOutcome[] }
  | { kind: 'select'; capacity: number; items: AgentItem[]; summary: string }
  | AgentCapabilityLab
);

// Validate authored configuration before rendering interactive components.
export function parseAgentInteraction(source: string): AgentInteraction | undefined {
  const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  const fields = (v: unknown, keys: string[]): boolean => Boolean(v && typeof v === 'object'
    && keys.every(key => text((v as Record<string, unknown>)[key])));
  const outcomes = (v: unknown): v is AgentOutcome[] => Array.isArray(v) && v.length >= 2
    && v.every(item => fields(item, ['label', 'effect', 'reason', 'when']));
  try {
    const value = JSON.parse(source);
    if (!fields(value, ['title', 'prompt'])) return;
    if (value.kind === 'reference-demo') {
      if (getAgentReferenceDemo(value.demoId)
        && Object.keys(value).every(key => ['kind', 'title', 'prompt', 'demoId'].includes(key))) return value;
      return;
    }
    if (value.kind === 'workflow' || value.kind === 'intro-demo') return value;
    if (value.kind === 'capability' && fields(value, ['task','report'])
      && Array.isArray(value.tools) && value.tools.length === 3
      && new Set(value.tools.map((tool: { id?: unknown }) => tool?.id)).size === 3
      && value.tools.every((tool: { id?: unknown }) => fields(tool, ['label','description']) && ['search','read','save'].includes(String(tool.id)))) return value;
    if (value.kind === 'trace' && Array.isArray(value.steps) && value.steps.length >= 2
      && value.steps.every((step: unknown) => fields(step, ['label', 'context', 'action', 'observation', 'state']))) return value;
    if ((value.kind === 'branch' || value.kind === 'compare') && outcomes(value.options)) return value;
    if (value.kind === 'select' && Number.isInteger(value.capacity) && value.capacity > 0
      && text(value.summary) && outcomes(value.items) && value.items.every((item: AgentItem) =>
        Number.isInteger(item.cost) && item.cost > 0 && item.cost <= value.capacity && typeof item.recommended === 'boolean')) return value;
  } catch { /* The reading layout displays a friendly loading failure. */ }
}

export function selectionCost(items: AgentItem[], selected: number[]): number {
  return items.reduce((total, item, index) => total + (selected.includes(index) ? item.cost : 0), 0);
}
