import type { State } from "./model";
import { ensureDay, evaluateRules } from "./domain";
import { expireWork } from "./stability";

// Project the current day without writing a snapshot during GET/polling.
// IDs created here are only presented by the new client after one explicit sync.
export function projectDashboard(source: State, date: string, now: Date) {
  const state = structuredClone(source);
  ensureDay(state, date);
  expireWork(state, now);
  const activeRule = evaluateRules(state, date, now);
  return {
    state,
    activeRule,
    needsSync: JSON.stringify(source) !== JSON.stringify(state),
  };
}
