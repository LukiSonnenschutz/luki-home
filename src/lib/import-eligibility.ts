import type { State } from "./model";
export function isEmptyForImport(s: State) {
  return (
    !s.goals?.length &&
    !s.goal_milestones?.length &&
    !s.coffee_entries?.length &&
    !s.work_sessions?.length &&
    !s.daily_metrics?.length &&
    s.tasks.length === 0 &&
    s.checkins.length === 0 &&
    s.day_plans.every(
      (d) =>
        !d.focus_text &&
        !d.training_note &&
        !d.training_time &&
        !d.focus_task_id &&
        !d.highlights.length,
    ) &&
    s.anchor_entries.every(
      (e) => e.status === "pending" && !e.actual_local_time && !e.note,
    )
  );
}
