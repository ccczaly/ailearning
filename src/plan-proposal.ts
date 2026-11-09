import { shallowRef } from 'vue';
import type { Preferences } from './learning-plan';

// In-memory handoff only: a proposal is never an activated plan.
export const pendingPlanProposal = shallowRef<{ userId: number; preferences: Preferences } | null>(null);
