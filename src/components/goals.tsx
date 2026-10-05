"use client";
import Link from "next/link";
import { useState } from "react";
import {
  categories,
  statusLabels,
  goalStatuses,
  nextStep,
  type Goal,
} from "@/lib/stability";
import type { State, Command } from "@/lib/model";
type Save = (c: Command) => Promise<boolean>;
export default function Goals({
  state: s,
  date,
  save,
  busy,
  initialGoalId,
  renderTasks,
}: {
  state: State;
  date: string;
  save: Save;
  busy: boolean;
  initialGoalId?: string;
  renderTasks: (id: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const g = s.goals.find((g) => g.id === initialGoalId);
  const [milestoneEdit, setMilestoneEdit] = useState<string | null>(null);
  const milestones = g
    ? s.goal_milestones
        .filter((m) => m.goal_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const milestone = milestones.find((m) => m.id === milestoneEdit);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await save({
        type: "goal-save",
        date,
        id: editing === "new" ? null : (editing as Goal).id,
        title: String(f.get("title")),
        why: String(f.get("why")),
        success_criteria: String(f.get("criteria")),
        category: String(f.get("category")) as Goal["category"],
        priority: Number(f.get("priority")),
        status: String(f.get("status")) as Goal["status"],
        is_focus: f.has("focus"),
        start_date: String(f.get("start")) || null,
        target_date: String(f.get("target")) || null,
      })
    )
      setEditing(null);
  }
  const edit = editing && editing !== "new" ? editing : null;
  const sorted = [...s.goals].sort((a, b) => {
    const rank = (g: Goal) =>
      g.status === "active"
        ? g.is_focus
          ? 0
          : 1
        : g.status === "paused"
          ? 2
          : g.status === "achieved"
            ? 3
            : 4;
    return (
      rank(a) - rank(b) ||
      a.priority - b.priority ||
      a.title.localeCompare(b.title)
    );
  });
  return (
    <div className="goals-space">
      {editing ? (
        <section className="card">
          <h2>{editing === "new" ? "Ein neues Ziel" : "Ziel bearbeiten"}</h2>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Titel
                <input
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={edit?.title || ""}
                />
              </label>
              <label>
                Warum ist dir das wichtig?
                <textarea
                  name="why"
                  required
                  maxLength={2000}
                  defaultValue={edit?.why || ""}
                />
              </label>
              <label>
                Woran erkennst du den Erfolg?
                <textarea
                  name="criteria"
                  required
                  maxLength={2000}
                  defaultValue={edit?.success_criteria || ""}
                />
              </label>
              <div className="form-grid">
                <label>
                  Kategorie
                  <select
                    name="category"
                    defaultValue={edit?.category || categories[0]}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priorität
                  <select name="priority" defaultValue={edit?.priority || 2}>
                    <option value={1}>Hoch</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Niedrig</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={edit?.status || "active"}>
                    {goalStatuses.map((st) => (
                      <option key={st} value={st}>
                        {statusLabels[st]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Startdatum · optional
                  <input
                    name="start"
                    type="date"
                    defaultValue={edit?.start_date || ""}
                  />
                </label>
                <label>
                  Zieldatum · optional
                  <input
                    name="target"
                    type="date"
                    defaultValue={edit?.target_date || ""}
                  />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="focus"
                  defaultChecked={edit?.is_focus || false}
                />
                Fokus-Ziel
              </label>
              <div className="button-row">
                <button className="primary">Ziel speichern</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (window.confirm("Ungespeicherte Eingaben verwerfen?"))
                      setEditing(null);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      ) : g ? (
        <>
          <Link href="/?view=goals" className="text-button">
            ← Alle Ziele
          </Link>
          <section className="card goal-detail">
            <span className="eyebrow">
              {g.category} · {statusLabels[g.status]} · Priorität {g.priority}
            </span>
            <h2>{g.title}</h2>
            <div className="button-row">
              <button className="secondary" onClick={() => setEditing(g)}>
                Ziel bearbeiten
              </button>
              <button
                disabled={busy}
                className="secondary"
                onClick={() =>
                  save({
                    type: "goal-focus",
                    date,
                    id: g.id,
                    enabled: !g.is_focus,
                  })
                }
              >
                {g.is_focus ? "Fokus entfernen" : "Als Fokus markieren"}
              </button>
            </div>
            <dl>
              <dt>Warum</dt>
              <dd>{g.why}</dd>
              <dt>Erfolgskriterium</dt>
              <dd>{g.success_criteria}</dd>
              <dt>Zeitraum</dt>
              <dd>
                {g.start_date || "Offener Start"} →{" "}
                {g.target_date || "Ohne Zieldatum"}
              </dd>
            </dl>
            <label>
              Zielstatus
              <select
                disabled={busy}
                aria-label="Zielstatus"
                value={g.status}
                onChange={(e) =>
                  save({
                    type: "goal-status",
                    date,
                    id: g.id,
                    status: e.target.value as Goal["status"],
                  })
                }
              >
                {goalStatuses.map((st) => (
                  <option key={st} value={st}>
                    {statusLabels[st]}
                  </option>
                ))}
              </select>
            </label>
            {g.status === "active" && (
              <div className="next-step">
                <span className="eyebrow">NÄCHSTER KONKRETER SCHRITT</span>
                <p>
                  {nextStep(s, g.id)?.title ||
                    "Welche kleine Aufgabe bringt dich weiter?"}
                </p>
              </div>
            )}
          </section>
          <section className="card">
            <h3>Meilensteine</h3>
            {milestones.map((m, i) => (
              <div className="milestone-row" key={m.id}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={m.status === "done"}
                    onChange={(e) =>
                      save({
                        type: "milestone-status",
                        date,
                        id: m.id,
                        status: e.target.checked ? "done" : "open",
                      })
                    }
                  />
                  <span>
                    <strong>{m.title}</strong>
                    <small>
                      {m.description}
                      {m.due_date ? ` · ${m.due_date}` : ""}
                    </small>
                  </span>
                </label>
                <div className="button-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setMilestoneEdit(m.id)}
                    aria-label={`${m.title} bearbeiten`}
                  >
                    Bearbeiten
                  </button>
                  {[-1, 1].map((delta) => (
                    <button
                      className="icon-button"
                      key={delta}
                      aria-label={`${m.title} ${delta === -1 ? "nach oben" : "nach unten"}`}
                      disabled={
                        busy || i + delta < 0 || i + delta >= milestones.length
                      }
                      onClick={() => {
                        const ids = milestones.map((m) => m.id);
                        [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
                        void save({
                          type: "milestone-order",
                          date,
                          goal_id: g.id,
                          ids,
                        });
                      }}
                    >
                      {delta === -1 ? "↑" : "↓"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <form
              key={milestoneEdit || "new"}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                if (
                  await save({
                    type: "milestone-save",
                    date,
                    id: milestone?.id || null,
                    goal_id: g.id,
                    title: String(f.get("milestone")),
                    description: String(f.get("description")),
                    due_date: String(f.get("due")) || null,
                  })
                ) {
                  form.reset();
                  setMilestoneEdit(null);
                }
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Meilenstein-Titel
                  <input
                    name="milestone"
                    required
                    maxLength={200}
                    defaultValue={milestone?.title || ""}
                  />
                </label>
                <label>
                  Beschreibung · optional
                  <textarea
                    name="description"
                    maxLength={2000}
                    defaultValue={milestone?.description || ""}
                  />
                </label>
                <label>
                  Fälligkeitsdatum · optional
                  <input
                    name="due"
                    type="date"
                    defaultValue={milestone?.due_date || ""}
                  />
                </label>
                <button className="secondary">
                  {milestone
                    ? "Meilenstein speichern"
                    : "Meilenstein hinzufügen"}
                </button>
              </fieldset>
            </form>
          </section>
          {renderTasks(g.id)}
        </>
      ) : initialGoalId ? (
        <section className="card">
          <h2>Ziel nicht gefunden.</h2>
          <Link href="/?view=goals">Zur Zielübersicht</Link>
        </section>
      ) : (
        <>
          <div className="task-toolbar">
            <p className="muted">Was möchtest du möglich machen?</p>
            <button className="primary" onClick={() => setEditing("new")}>
              Neues Ziel
            </button>
          </div>
          {s.goals.filter((g) => g.is_focus && g.status === "active").length >
            5 && (
            <p className="notice" role="status">
              Mehr als fünf Fokus-Ziele sind aktiv. Drei bis fünf können helfen,
              den Blick klar zu halten.
            </p>
          )}
          <div className="goal-grid">
            {sorted.map((g) => (
              <section className="card goal-card" key={g.id}>
                <span className="eyebrow">
                  {g.is_focus && g.status === "active" ? "FOKUS · " : ""}
                  {statusLabels[g.status]} · {g.category}
                </span>
                <Link href={`/goals/${g.id}`}>
                  <h2>{g.title}</h2>
                </Link>
                <p>{g.why}</p>
                {g.status === "active" && (
                  <p className="next-step">
                    <small>Nächster Schritt</small>
                    <br />
                    {nextStep(s, g.id)?.title || "Noch keine offene Aufgabe"}
                  </p>
                )}
                <Link className="text-button" href={`/goals/${g.id}`}>
                  Ziel öffnen →
                </Link>
              </section>
            ))}
          </div>
          {!sorted.length && (
            <section className="card empty-state">
              <h2>Ein Ziel. Ein nächster Schritt.</h2>
              <p>Beginne mit etwas, das dir persönlich wichtig ist.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
