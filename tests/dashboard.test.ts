import test from "node:test";
import assert from "node:assert/strict";
import { newState } from "../src/lib/model";
import { applyCommand } from "../src/lib/domain";
import { projectDashboard } from "../src/lib/dashboard";

test("GET projection prepares a day without changing stored data or revision", () => {
  const source = newState("00000000-0000-4000-8000-000000000001");
  const original = JSON.stringify(source);
  const result = projectDashboard(
    source,
    "2026-10-27",
    new Date("2026-10-27T10:00:00Z"),
  );
  assert.equal(result.needsSync, true);
  assert.equal(result.state.day_plans.length, 1);
  assert.equal(JSON.stringify(source), original);
  assert.equal(result.state.revision, source.revision);
});

test("expired timer projects done and alarm once, explicit sync persists it idempotently", () => {
  const source = newState("00000000-0000-4000-8000-000000000001");
  const start = new Date("2026-10-27T08:00:00Z"),
    date = "2026-10-27";
  applyCommand(
    source,
    { type: "work", date, action: "start", minutes: 1 },
    start,
  );
  const original = JSON.stringify(source),
    now = new Date("2026-10-27T08:02:00Z");
  const result = projectDashboard(source, date, now);
  assert.equal(result.state.work_sessions[0].status, "done");
  assert.equal(
    result.state.work_sessions[0].ended_at,
    "2026-10-27T08:01:00.000Z",
  );
  assert.equal(JSON.stringify(source), original);
  assert.equal(result.needsSync, true);
  const stable = projectDashboard(result.state, date, now);
  assert.equal(stable.needsSync, false);
});
