"use client";
import { useState, useRef, type ReactNode } from "react";
import type { State, Command } from "@/lib/model";
import {
  alive,
  ordered,
  itemTypes,
  itemLabels,
  emptyTargets,
  sessionSets,
  previousPerformance,
  type TrainingPlan,
  type WorkoutTemplate,
  type TemplateItem,
  type SessionItem,
  type WorkoutSet,
  type WorkoutSession,
  type Targets,
} from "@/lib/training";
type Save = (c: Command) => Promise<boolean>;
export type TrainingView = "manage" | "schedule" | "workout" | "history";
type Props = {
  state: State;
  date: string;
  save: Save;
  busy: boolean;
  onDirty?: () => void;
  discard?: () => boolean;
  initialView?: TrainingView;
};
const number = (f: FormData, key: string) =>
  f.get(key) === "" || f.get(key) === null ? null : Number(f.get(key));
const value = (f: FormData, key: string) => String(f.get(key) || "");
const dateLabel = (date: string) => new Date(date).toLocaleDateString("de-DE");
function Fields({ children, busy }: { children: ReactNode; busy: boolean }) {
  return <fieldset disabled={busy}>{children}</fieldset>;
}
function Reorder({
  rows,
  id,
  move,
  disabled,
}: {
  rows: Array<{ id: string }>;
  id: string;
  move: (ids: string[]) => void;
  disabled: boolean;
}) {
  const i = rows.findIndex((x) => x.id === id);
  const swap = (offset: number) => {
    const ids = rows.map((x) => x.id);
    [ids[i], ids[i + offset]] = [ids[i + offset], ids[i]];
    move(ids);
  };
  return (
    <span
      className="reorder-buttons"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        const source = e.dataTransfer.getData("text/plain");
        const ids = rows.map((r) => r.id);
        if (source === id || !ids.includes(source)) return;
        ids.splice(ids.indexOf(source), 1);
        ids.splice(i, 0, source);
        move(ids);
      }}
    >
      <button
        type="button"
        className="secondary"
        aria-label="Reihenfolge ziehen"
        title="Ziehen und auf einen anderen Sortiergriff ablegen"
        disabled={disabled}
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        }}
      >
        ↕
      </button>
      <button
        type="button"
        className="secondary"
        disabled={disabled || i === 0}
        aria-label="Nach oben"
        onClick={() => swap(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="secondary"
        disabled={disabled || i === rows.length - 1}
        aria-label="Nach unten"
        onClick={() => swap(1)}
      >
        ↓
      </button>
    </span>
  );
}
function TargetsText({ item }: { item: TemplateItem | SessionItem }) {
  const t = item.targets;
  return (
    <p className="muted">
      {item.item_type === "strength"
        ? `${t.sets || 1} Sätze · ${t.reps_min ?? "—"}${t.reps_max !== null && t.reps_max !== t.reps_min ? "–" + t.reps_max : ""} Wdh.`
        : `${t.rounds || 1} Runden`}
      {t.weight !== null ? ` · ${t.weight} ${t.unit}` : ""}
      {t.distance !== null ? ` · ${t.distance} m` : ""}
      {t.duration !== null ? ` · ${t.duration} s` : ""}
      {t.rpe !== null ? ` · RPE ${t.rpe}` : ""}
      {t.rir !== null ? ` · RIR ${t.rir}` : ""}
    </p>
  );
}
function SetSummary({ row, unit }: { row: WorkoutSet; unit: string }) {
  const performance = [
    row.weight !== null && row.reps !== null
      ? `${row.weight} ${unit} × ${row.reps} Wdh.`
      : row.weight !== null
        ? `${row.weight} ${unit}`
        : row.reps !== null
          ? `${row.reps} Wdh.`
          : "",
    row.distance !== null ? `${row.distance} m` : "",
    row.duration !== null ? `${row.duration} s` : "",
    row.rpe !== null ? `RPE ${row.rpe}` : "",
    row.rir !== null ? `RIR ${row.rir}` : "",
    row.notes,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span>
      {performance || "Keine Leistung eingetragen"}
      {row.completed ? " ✓" : ""}
    </span>
  );
}
function ItemForm({
  item,
  targetId,
  scope,
  hasTemplate,
  save,
  date,
  busy,
  onClose,
  onDirty,
}: {
  item?: TemplateItem | SessionItem;
  targetId: string;
  scope: "template" | "session";
  hasTemplate?: boolean;
  save: Save;
  date: string;
  busy: boolean;
  onClose: () => void;
  onDirty?: () => void;
}) {
  const [kind, setKind] = useState(item?.item_type || "strength"),
    [destination, setDestination] = useState<"template" | "session" | "both">(
      scope,
    );
  const t = item?.targets || emptyTargets;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const targets: Targets = {
      sets: number(f, "sets"),
      reps_min: number(f, "reps_min"),
      reps_max: number(f, "reps_max"),
      weight: number(f, "weight"),
      unit: value(f, "unit") as Targets["unit"],
      distance: number(f, "distance"),
      duration: number(f, "duration"),
      rounds: number(f, "rounds"),
      rpe: number(f, "rpe"),
      rir: number(f, "rir"),
    };
    if (
      await save({
        type: "training-item-save",
        date,
        id: item?.id || null,
        target_id: targetId,
        scope: destination,
        item_type: kind,
        name: value(f, "name"),
        description: value(f, "description"),
        notes: value(f, "notes"),
        targets,
      })
    )
      onClose();
  }
  return (
    <section className="card training-editor">
      <h2>{item ? "Übung / Station ändern" : "Übung / Station hinzufügen"}</h2>
      <form onSubmit={submit} onChange={onDirty}>
        <Fields busy={busy}>
          <label>
            Übungsname
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={item?.name || ""}
            />
          </label>
          <label>
            Komponente
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {itemTypes.map((k) => (
                <option key={k} value={k}>
                  {itemLabels[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Beschreibung
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={item?.description || ""}
            />
          </label>
          <div className="form-grid">
            {(kind === "strength"
              ? [
                  ["sets", "Zielsätze", 1, 50],
                  ["reps_min", "Wiederholungen von", 0, 10000],
                  ["reps_max", "Wiederholungen bis", 0, 10000],
                ]
              : [
                  ["rounds", "Zielrunden", 1, 100],
                  ["distance", "Zieldistanz · m", 0, 1000000],
                  ["duration", "Zieldauer · Sekunden", 0, 86400],
                  ["reps_min", "Zielwiederholungen", 0, 10000],
                ]
            ).map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  name={String(key)}
                  min={Number(min)}
                  max={Number(max)}
                  step="any"
                  defaultValue={t[key as keyof Targets] ?? ""}
                />
              </label>
            ))}
            <label>
              Zielgewicht
              <input
                name="weight"
                type="number"
                min="0"
                max="2000"
                step="any"
                defaultValue={t.weight ?? ""}
              />
            </label>
            <label>
              Gewichtseinheit
              <select name="unit" defaultValue={t.unit}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
                <option value="bodyweight">Körpergewicht</option>
              </select>
            </label>
            <label>
              Ziel-RPE
              <input
                name="rpe"
                type="number"
                min="0"
                max="10"
                step="0.5"
                defaultValue={t.rpe ?? ""}
              />
            </label>
            <label>
              Ziel-RIR
              <input
                name="rir"
                type="number"
                min="0"
                max="20"
                step="0.5"
                defaultValue={t.rir ?? ""}
              />
            </label>
          </div>
          <label>
            Übungsnotiz
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={item?.notes || ""}
            />
          </label>
          {scope === "session" && (
            <label>
              Änderung anwenden
              <select
                value={destination}
                onChange={(e) =>
                  setDestination(e.target.value as typeof destination)
                }
              >
                <option value="session">Nur für dieses Training ändern</option>
                <option value="both" disabled={!hasTemplate}>
                  Trainingsvorlage dauerhaft ändern
                </option>
              </select>
            </label>
          )}
          <div className="button-row">
            <button className="primary">Übung speichern</button>
            <button type="button" className="secondary" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </Fields>
      </form>
    </section>
  );
}
function SetForm({
  row,
  item,
  save,
  date,
  busy,
  onDirty,
}: {
  row: WorkoutSet;
  item: SessionItem;
  save: Save;
  date: string;
  busy: boolean;
  onDirty?: () => void;
}) {
  const [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaved(
      await save({
        type: "training-set",
        date,
        id: row.id,
        weight: number(f, "weight"),
        reps: number(f, "reps"),
        distance: number(f, "distance"),
        duration: number(f, "duration"),
        rpe: number(f, "rpe"),
        rir: number(f, "rir"),
        notes: value(f, "notes"),
        completed: f.has("completed"),
      }),
    );
  }
  return (
    <form
      className="workout-set"
      onSubmit={submit}
      data-set-id={row.id}
      onChange={(e) => {
        e.currentTarget.dataset.dirty = "true";
        setSaved(false);
        onDirty?.();
      }}
    >
      <h4>
        {item.item_type === "strength" ? "Satz" : "Runde"} {row.set_number}
      </h4>
      <Fields busy={busy}>
        <div className="set-grid">
          <label>
            Gewicht · {item.targets.unit}
            <input
              aria-label={`Satz ${row.set_number} Gewicht`}
              name="weight"
              type="number"
              min="0"
              max="2000"
              step="any"
              defaultValue={row.weight ?? ""}
            />
          </label>
          <label>
            Wiederholungen
            <input
              aria-label={`Satz ${row.set_number} Wiederholungen`}
              name="reps"
              type="number"
              min="0"
              max="10000"
              defaultValue={row.reps ?? ""}
            />
          </label>
          {item.item_type !== "strength" && (
            <>
              <label>
                Distanz · m
                <input
                  aria-label={`Runde ${row.set_number} Distanz`}
                  name="distance"
                  type="number"
                  min="0"
                  max="1000000"
                  step="any"
                  defaultValue={row.distance ?? ""}
                />
              </label>
              <label>
                Dauer · Sekunden
                <input
                  aria-label={`Runde ${row.set_number} Dauer`}
                  name="duration"
                  type="number"
                  min="0"
                  max="86400"
                  step="any"
                  defaultValue={row.duration ?? ""}
                />
              </label>
            </>
          )}
          <label>
            RPE
            <input
              name="rpe"
              aria-label={`Satz ${row.set_number} RPE`}
              type="number"
              min="0"
              max="10"
              step="0.5"
              defaultValue={row.rpe ?? ""}
            />
          </label>
          <label>
            RIR
            <input
              name="rir"
              aria-label={`Satz ${row.set_number} RIR`}
              type="number"
              min="0"
              max="20"
              step="0.5"
              defaultValue={row.rir ?? ""}
            />
          </label>
        </div>
        <label>
          Satznotiz
          <input name="notes" maxLength={2000} defaultValue={row.notes} />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="completed"
            defaultChecked={row.completed}
          />
          Erledigt
        </label>
        <button className="secondary">Satz {row.set_number} speichern</button>
        {saved && (
          <span className="small" role="status">
            {" "}
            Gespeichert
          </span>
        )}
      </Fields>
    </form>
  );
}
export default function Training({
  state: s,
  date,
  save: persist,
  busy,
  onDirty: notifyDirty,
  discard,
  initialView = "manage",
}: Props) {
  const draft = useRef(false);
  const onDirty = () => {
    draft.current = true;
    notifyDirty?.();
  };
  const save: Save = async (c) => {
    const otherDrafts = [
      ...document.querySelectorAll<HTMLFormElement>(
        ".workout-set[data-dirty='true']",
      ),
    ].some((f) => c.type !== "training-set" || f.dataset.setId !== c.id);
    if (c.type !== "training-set" && otherDrafts && !leave()) return false;
    const ok = await persist(c);
    if (ok) {
      draft.current = c.type === "training-set" && otherDrafts;
      if (draft.current) notifyDirty?.();
    }
    return ok;
  };
  const leave = () => {
    if (
      discard
        ? !discard()
        : draft.current && !window.confirm("Ungespeicherte Eingaben verwerfen?")
    )
      return false;
    draft.current = false;
    return true;
  };
  const running = s.workout_sessions.find((x) => x.status === "active");
  const [view, setView] = useState<
      "manage" | "schedule" | "workout" | "history"
    >(running ? "workout" : initialView),
    [planId, setPlanId] = useState<string | null>(null),
    [templateId, setTemplateId] = useState<string | null>(null),
    [planEdit, setPlanEdit] = useState<TrainingPlan | "new" | null>(null),
    [templateEdit, setTemplateEdit] = useState<WorkoutTemplate | "new" | null>(
      null,
    ),
    [itemEdit, setItemEdit] = useState<{
      item?: TemplateItem | SessionItem;
      scope: "template" | "session";
      targetId: string;
    } | null>(null),
    [position, setPosition] = useState(0),
    [historyTemplate, setHistoryTemplate] = useState(""),
    [historyExercise, setHistoryExercise] = useState("");
  const plans = ordered(alive(s.training_plans)),
    templates = ordered(alive(s.workout_templates)),
    selected = templates.find((x) => x.id === templateId),
    items = selected
      ? ordered(
          alive(s.workout_template_items).filter(
            (x) => x.workout_template_id === selected.id,
          ),
        )
      : [],
    activeItems = running
      ? ordered(
          alive(s.workout_session_items).filter(
            (x) => x.workout_session_id === running.id,
          ),
        )
      : [],
    index = Math.max(0, Math.min(position, activeItems.length - 1)),
    current = activeItems[index];
  const start = async (
    template_id: string | null,
    scheduled_id: string | null = null,
  ) => {
    if (
      await save({
        type: "training-start",
        date,
        template_id,
        scheduled_id,
        name: "Spontanes Training",
      })
    ) {
      setPosition(0);
      setView("workout");
    }
  };
  const order = (
    collection:
      | "training_plans"
      | "workout_templates"
      | "workout_template_items"
      | "workout_session_items",
    parent_id: string | null,
    ids: string[],
  ) => {
    void save({ type: "training-order", date, collection, parent_id, ids });
  };
  const remove = (
    kind: "plan" | "template" | "item",
    id: string,
    scope: "template" | "session" = "template",
  ) => {
    if (
      !window.confirm(
        "Ausblenden? Bereits gespeicherte Historien bleiben erhalten.",
      )
    )
      return;
    if (kind === "plan")
      void save({ type: "training-plan-action", date, id, action: "delete" });
    else if (kind === "template")
      void save({
        type: "training-template-action",
        date,
        id,
        action: "delete",
      });
    else
      void save({
        type: "training-item-action",
        date,
        id,
        scope,
        action: "delete",
      });
  };
  const changeView = (next: typeof view) => {
    if (!leave()) return;
    setPlanEdit(null);
    setTemplateEdit(null);
    setItemEdit(null);
    setView(next);
  };
  return (
    <div className="training-module">
      <nav className="button-row" aria-label="Trainingsbereiche">
        <button className="secondary" onClick={() => changeView("manage")}>
          Pläne & Vorlagen
        </button>
        <button className="secondary" onClick={() => changeView("schedule")}>
          Planung
        </button>
        <button className="secondary" onClick={() => changeView("history")}>
          Trainingshistorie
        </button>
        {running && (
          <button className="primary" onClick={() => changeView("workout")}>
            Workout fortsetzen
          </button>
        )}
      </nav>
      {itemEdit ? (
        <ItemForm
          key={itemEdit.item?.id || itemEdit.targetId}
          {...itemEdit}
          hasTemplate={!!running?.workout_template_id}
          save={save}
          date={date}
          busy={busy}
          onClose={() => {
            if (leave()) setItemEdit(null);
          }}
          onDirty={onDirty}
        />
      ) : planEdit ? (
        <section className="card training-editor">
          <h2>
            {planEdit === "new"
              ? "Neuer Trainingsplan"
              : "Trainingsplan bearbeiten"}
          </h2>
          <form
            onChange={onDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const p = planEdit === "new" ? null : planEdit;
              const week = p
                ? [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) =>
                    value(f, `week_${weekday}`)
                      ? [{ weekday, template_id: value(f, `week_${weekday}`) }]
                      : [],
                  )
                : [];
              if (
                await save({
                  type: "training-plan-save",
                  date,
                  id: p?.id || null,
                  name: value(f, "name"),
                  description: value(f, "description"),
                  week,
                })
              )
                setPlanEdit(null);
            }}
          >
            <Fields busy={busy}>
              <label>
                Planname
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={
                    planEdit === "new"
                      ? plans.length === 0
                        ? "Plan A"
                        : plans.length === 1
                          ? "Plan B"
                          : ""
                      : planEdit.name
                  }
                />
              </label>
              <label>
                Planbeschreibung
                <textarea
                  name="description"
                  maxLength={2000}
                  defaultValue={planEdit === "new" ? "" : planEdit.description}
                />
              </label>
              {planEdit !== "new" && (
                <details>
                  <summary>Optionale Wochenstruktur</summary>
                  {[
                    "Montag",
                    "Dienstag",
                    "Mittwoch",
                    "Donnerstag",
                    "Freitag",
                    "Samstag",
                    "Sonntag",
                  ].map((day, i) => (
                    <label key={day}>
                      {day}
                      <select
                        name={`week_${i + 1}`}
                        defaultValue={
                          planEdit.week.find((w) => w.weekday === i + 1)
                            ?.template_id || ""
                        }
                      >
                        <option value="">Frei lassen</option>
                        {templates
                          .filter(
                            (t) =>
                              t.training_plan_id === planEdit.id && !t.archived,
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </details>
              )}
              <div className="button-row">
                <button className="primary">Plan speichern</button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    if (leave()) setPlanEdit(null);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </Fields>
          </form>
        </section>
      ) : templateEdit ? (
        <section className="card training-editor">
          <h2>
            {templateEdit === "new"
              ? "Neue Trainingsvorlage"
              : "Trainingsvorlage bearbeiten"}
          </h2>
          <form
            onChange={onDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await save({
                  type: "training-template-save",
                  date,
                  id: templateEdit === "new" ? null : templateEdit.id,
                  name: value(f, "name"),
                  description: value(f, "description"),
                  training_plan_id: value(f, "plan") || null,
                  workout_type: value(
                    f,
                    "kind",
                  ) as WorkoutTemplate["workout_type"],
                })
              )
                setTemplateEdit(null);
            }}
          >
            <Fields busy={busy}>
              <label>
                Workoutname
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={templateEdit === "new" ? "" : templateEdit.name}
                />
              </label>
              <label>
                Workoutbeschreibung
                <textarea
                  name="description"
                  maxLength={2000}
                  defaultValue={
                    templateEdit === "new" ? "" : templateEdit.description
                  }
                />
              </label>
              <label>
                Trainingsplan
                <select
                  name="plan"
                  defaultValue={
                    templateEdit === "new"
                      ? planId || ""
                      : templateEdit.training_plan_id || ""
                  }
                >
                  <option value="">Ohne Plan</option>
                  {plans.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trainingsart
                <select
                  name="kind"
                  defaultValue={
                    templateEdit === "new"
                      ? "strength"
                      : templateEdit.workout_type
                  }
                >
                  <option value="strength">Kraft</option>
                  <option value="conditioning">HYROX / Conditioning</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="mobility">Mobility</option>
                  <option value="free">Frei</option>
                </select>
              </label>
              <div className="button-row">
                <button className="primary">Vorlage speichern</button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    if (leave()) setTemplateEdit(null);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </Fields>
          </form>
        </section>
      ) : view === "manage" ? (
        <>
          <section className="card">
            <h2>Deine Trainingspläne</h2>
            <p className="muted">
              Plan A, Plan B oder dein eigener Aufbau. Du entscheidest.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => setPlanEdit("new")}
            >
              Neuer Plan
            </button>
            {plans.map((p) => (
              <article key={p.id} className="training-row">
                <div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setPlanId(p.id);
                      setTemplateId(null);
                    }}
                  >
                    {p.name}
                  </button>
                  <p className="small muted">
                    {p.description}
                    {!p.is_active ? " · inaktiv" : ""}
                  </p>
                </div>
                <div className="button-row">
                  <Reorder
                    rows={plans}
                    id={p.id}
                    disabled={busy}
                    move={(ids) => order("training_plans", null, ids)}
                  />
                  <button
                    className="secondary"
                    aria-label={`${p.name} bearbeiten`}
                    onClick={() => setPlanEdit(p)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      void save({
                        type: "training-plan-action",
                        date,
                        id: p.id,
                        action: "duplicate",
                      });
                    }}
                  >
                    Plan duplizieren
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      void save({
                        type: "training-plan-action",
                        date,
                        id: p.id,
                        action: p.is_active ? "deactivate" : "activate",
                      });
                    }}
                  >
                    {p.is_active ? "Plan deaktivieren" : "Plan aktivieren"}
                  </button>
                  <button
                    className="secondary"
                    aria-label={`${p.name} löschen`}
                    onClick={() => remove("plan", p.id)}
                  >
                    Löschen
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="card">
            <h2>Trainingsvorlagen</h2>
            <label>
              Planfilter
              <select
                value={planId || "all"}
                onChange={(e) => {
                  setPlanId(e.target.value === "all" ? null : e.target.value);
                  setTemplateId(null);
                }}
              >
                <option value="all">Alle Vorlagen</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => setTemplateEdit("new")}
              >
                Neue Vorlage
              </button>
              <button
                className="secondary"
                disabled={busy || !!running}
                onClick={() => {
                  void start(null);
                }}
              >
                Leeres Workout starten
              </button>
            </div>
            {templates
              .filter((t) => !planId || t.training_plan_id === planId)
              .map((t) => (
                <article key={t.id} className="training-row">
                  <div>
                    <button
                      className="text-button"
                      onClick={() => setTemplateId(t.id)}
                    >
                      {t.name}
                    </button>
                    <p className="small muted">
                      {t.description}
                      {t.archived ? " · archiviert" : ""}
                    </p>
                  </div>
                  <div className="button-row">
                    <Reorder
                      rows={templates.filter(
                        (x) => x.training_plan_id === t.training_plan_id,
                      )}
                      id={t.id}
                      disabled={busy}
                      move={(ids) =>
                        order("workout_templates", t.training_plan_id, ids)
                      }
                    />
                    <button
                      className="secondary"
                      aria-label={`${t.name} Vorlage bearbeiten`}
                      onClick={() => setTemplateEdit(t)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="secondary"
                      aria-label={`${t.name} duplizieren`}
                      disabled={busy}
                      onClick={() => {
                        void save({
                          type: "training-template-action",
                          date,
                          id: t.id,
                          action: "duplicate",
                        });
                      }}
                    >
                      Duplizieren
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        void save({
                          type: "training-template-action",
                          date,
                          id: t.id,
                          action: t.archived ? "restore" : "archive",
                        });
                      }}
                    >
                      {t.archived ? "Reaktivieren" : "Archivieren"}
                    </button>
                    <button
                      className="secondary"
                      aria-label={`${t.name} Vorlage löschen`}
                      onClick={() => remove("template", t.id)}
                    >
                      Löschen
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !!running || t.archived}
                      aria-label={`${t.name} Workout starten`}
                      onClick={() => {
                        void start(t.id);
                      }}
                    >
                      Workout starten
                    </button>
                  </div>
                </article>
              ))}
          </section>
          {selected && (
            <section className="card">
              <h2>{selected.name} · Aufbau</h2>
              <button
                className="primary"
                onClick={() =>
                  setItemEdit({ targetId: selected.id, scope: "template" })
                }
              >
                Übung hinzufügen
              </button>
              {items.map((item) => (
                <article key={item.id} className="training-row">
                  <div>
                    <h3>{item.name}</h3>
                    <TargetsText item={item} />
                    <p className="small">
                      {item.description} {item.notes}
                    </p>
                  </div>
                  <div className="button-row">
                    <Reorder
                      rows={items}
                      id={item.id}
                      disabled={busy}
                      move={(ids) =>
                        order("workout_template_items", selected.id, ids)
                      }
                    />
                    <button
                      className="secondary"
                      aria-label={`${item.name} bearbeiten`}
                      onClick={() =>
                        setItemEdit({
                          item,
                          targetId: selected.id,
                          scope: "template",
                        })
                      }
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="secondary"
                      aria-label={`${item.name} duplizieren`}
                      disabled={busy}
                      onClick={() => {
                        void save({
                          type: "training-item-action",
                          date,
                          id: item.id,
                          scope: "template",
                          action: "duplicate",
                        });
                      }}
                    >
                      Duplizieren
                    </button>
                    <button
                      className="secondary"
                      aria-label={`${item.name} entfernen`}
                      onClick={() => remove("item", item.id)}
                    >
                      Entfernen
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      ) : view === "schedule" ? (
        <section className="card">
          <h2>Flexible Planung</h2>
          <form
            className="training-editor"
            onChange={onDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (
                await save({
                  type: "training-schedule",
                  date,
                  id: null,
                  workout_template_id: value(f, "template"),
                  planned_date: value(f, "planned"),
                  action: "save",
                })
              )
                form.reset();
            }}
          >
            <Fields busy={busy}>
              <label>
                Training wählen
                <select name="template" required>
                  <option value="">Bitte wählen</option>
                  {templates
                    .filter((t) => !t.archived)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Trainingstag
                <input
                  name="planned"
                  type="date"
                  required
                  defaultValue={date}
                />
              </label>
              <button className="primary">Training einplanen</button>
            </Fields>
          </form>
          {plans
            .filter((p) => p.week.length && p.is_active)
            .map((p) => (
              <form
                key={p.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save({
                    type: "training-week",
                    date,
                    plan_id: p.id,
                    week_start: value(new FormData(e.currentTarget), "week"),
                  });
                }}
              >
                <label>
                  {p.name} · Woche ab Montag
                  <input name="week" type="date" required />
                </label>
                <button className="secondary" disabled={busy}>
                  Woche aus Plan einplanen
                </button>
              </form>
            ))}
          {alive(s.scheduled_workouts)
            .filter((w) => w.status !== "cancelled")
            .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
            .map((w) => (
              <ScheduleRow
                key={w.id + ":" + w.updated_at}
                entry={w}
                templates={templates}
                date={date}
                save={save}
                busy={busy}
                start={start}
              />
            ))}
        </section>
      ) : view === "workout" ? (
        <>
          {running ? (
            <>
              <section className="card">
                <h2>{running.name_snapshot}</h2>
                <p className="muted">
                  Gestartet{" "}
                  {new Date(running.started_at).toLocaleTimeString("de-DE")} ·{" "}
                  {activeItems.length} Komponenten
                </p>
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      setItemEdit({ targetId: running.id, scope: "session" })
                    }
                  >
                    Übung / Station hinzufügen
                  </button>
                  <button
                    className="secondary"
                    onClick={() => changeView("manage")}
                  >
                    Vorlagen ansehen
                  </button>
                </div>
                <nav className="exercise-index" aria-label="Workout-Übungen">
                  {activeItems.map((item, i) => (
                    <button
                      key={item.id}
                      aria-current={i === index ? "step" : undefined}
                      onClick={() => {
                        if (leave()) setPosition(i);
                      }}
                    >
                      {i + 1}. {item.name}
                    </button>
                  ))}
                </nav>
              </section>
              {current && (
                <section className="card active-exercise">
                  <span className="eyebrow">
                    {itemLabels[current.item_type]} · {position + 1} /{" "}
                    {activeItems.length}
                  </span>
                  <h2>{current.name}</h2>
                  <TargetsText item={current} />
                  <p>
                    {current.description} {current.notes}
                  </p>
                  <PreviousValues state={s} item={current} />
                  <div className="button-row">
                    <Reorder
                      rows={activeItems}
                      id={current.id}
                      disabled={busy}
                      move={(ids) =>
                        order("workout_session_items", running.id, ids)
                      }
                    />
                    <button
                      className="secondary"
                      aria-label={`${current.name} ändern`}
                      onClick={() =>
                        setItemEdit({
                          item: current,
                          targetId: running.id,
                          scope: "session",
                        })
                      }
                    >
                      Übung ändern
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        void save({
                          type: "training-item-action",
                          date,
                          id: current.id,
                          scope: "session",
                          action: "duplicate",
                        });
                      }}
                    >
                      Übung duplizieren
                    </button>
                    <button
                      className="secondary"
                      onClick={() => remove("item", current.id, "session")}
                    >
                      Übung entfernen
                    </button>
                  </div>
                  {sessionSets(s, current.id).map((row) => (
                    <SetForm
                      key={row.id + ":" + row.updated_at}
                      row={row}
                      item={current}
                      save={save}
                      date={date}
                      busy={busy}
                      onDirty={onDirty}
                    />
                  ))}
                  <div className="workout-controls">
                    <button
                      className="secondary"
                      disabled={index === 0}
                      onClick={() => {
                        if (leave())
                          setPosition(
                            Math.min(position, activeItems.length - 1) - 1,
                          );
                      }}
                    >
                      Vorherige Übung
                    </button>
                    <button
                      className="primary"
                      disabled={index >= activeItems.length - 1}
                      onClick={() => {
                        if (leave()) setPosition(index + 1);
                      }}
                    >
                      Nächste Übung
                    </button>
                  </div>
                </section>
              )}
              <section className="card">
                <h3>Workout abschließen</h3>
                <form
                  onChange={onDirty}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      await save({
                        type: "training-finish",
                        date,
                        id: running.id,
                        notes: value(f, "notes"),
                        rating: number(f, "rating"),
                      })
                    )
                      setView("history");
                  }}
                >
                  <Fields busy={busy}>
                    <label>
                      Session-Notiz
                      <textarea name="notes" maxLength={2000} />
                    </label>
                    <label>
                      Wie war das Training? · optional
                      <select name="rating">
                        <option value="">Keine Bewertung</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="primary">Training beenden</button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Workout abbrechen? Gespeicherte Eingaben bleiben erhalten.",
                          )
                        )
                          void save({
                            type: "training-finish",
                            date,
                            id: running.id,
                            notes: "Abgebrochen",
                            rating: null,
                            cancel: true,
                          }).then((ok) => {
                            if (ok) setView("manage");
                          });
                      }}
                    >
                      Workout abbrechen
                    </button>
                  </Fields>
                </form>
              </section>
            </>
          ) : (
            <section className="card">
              <h2>Kein laufendes Workout</h2>
              <button className="primary" onClick={() => changeView("manage")}>
                Training wählen
              </button>
            </section>
          )}
        </>
      ) : (
        <section className="card training-history">
          <h2>Deine Trainingshistorie</h2>
          <div className="form-grid">
            <label>
              Vorlagen-Historie
              <select
                value={historyTemplate}
                onChange={(e) => setHistoryTemplate(e.target.value)}
              >
                <option value="">Alle Trainings</option>
                {s.workout_templates.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                    {t.deleted_at ? " · gelöscht" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Übungshistorie
              <input
                value={historyExercise}
                onChange={(e) => setHistoryExercise(e.target.value)}
                placeholder="Übungsname filtern"
              />
            </label>
          </div>
          {s.workout_sessions
            .filter(
              (w) =>
                w.status === "completed" &&
                (!historyTemplate || w.workout_template_id === historyTemplate),
            )
            .sort((a, b) =>
              (b.completed_at || "").localeCompare(a.completed_at || ""),
            )
            .map((w) => (
              <HistorySession
                key={w.id}
                state={s}
                session={w}
                filter={historyExercise}
              />
            ))}
          {!s.workout_sessions.some((w) => w.status === "completed") && (
            <p className="muted">
              Deine abgeschlossenen Workouts erscheinen hier.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
function PreviousValues({ state, item }: { state: State; item: SessionItem }) {
  const previous = previousPerformance(state, item);
  return (
    <aside className="previous-values">
      <h3>Letzte Einheit</h3>
      {previous ? (
        <>
          <p>
            {dateLabel(previous.session.completed_at!)} ·{" "}
            {previous.session.name_snapshot}
          </p>
          {previous.sets.map((row) => (
            <p key={row.id}>
              Satz / Runde {row.set_number}:{" "}
              <SetSummary row={row} unit={previous.item.targets.unit} />
            </p>
          ))}
        </>
      ) : (
        <p>Noch keine frühere Leistung für diese Übung.</p>
      )}
    </aside>
  );
}
function HistorySession({
  state: s,
  session: w,
  filter,
}: {
  state: State;
  session: WorkoutSession;
  filter: string;
}) {
  const rows = ordered(
    alive(s.workout_session_items).filter(
      (i) =>
        i.workout_session_id === w.id &&
        i.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    ),
  );
  if (filter && !rows.length) return null;
  return (
    <article className="history-session">
      <h3>
        {w.name_snapshot} · {dateLabel(w.completed_at!)}
      </h3>
      <p className="muted">
        Dauer {Math.round(w.duration_seconds / 60)} min · {w.notes}
        {w.rating ? ` · Bewertung ${w.rating}/5` : ""}
      </p>
      {rows.map((item) => (
        <div key={item.id}>
          <h4>{item.name}</h4>
          <TargetsText item={item} />
          <p className="small">{item.notes}</p>
          {sessionSets(s, item.id).map((row) => (
            <p key={row.id}>
              Satz / Runde {row.set_number}:{" "}
              <SetSummary row={row} unit={item.targets.unit} />
            </p>
          ))}
        </div>
      ))}
    </article>
  );
}
function ScheduleRow({
  entry: w,
  templates,
  date,
  save,
  busy,
  start,
}: {
  entry: State["scheduled_workouts"][number];
  templates: WorkoutTemplate[];
  date: string;
  save: Save;
  busy: boolean;
  start: (id: string | null, scheduledId?: string | null) => Promise<void>;
}) {
  const t = templates.find((t) => t.id === w.workout_template_id);
  return (
    <article className="training-row">
      <div>
        <h3>{t?.name || "Gespeicherte Vorlage"}</h3>
        <p>
          {dateLabel(w.planned_date)} ·{" "}
          {w.status === "done" ? "erledigt" : "geplant"}
        </p>
      </div>
      {w.status === "planned" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void save({
              type: "training-schedule",
              date,
              id: w.id,
              workout_template_id: value(f, "template"),
              planned_date: value(f, "planned"),
              action: "save",
            });
          }}
        >
          <Fields busy={busy}>
            <label>
              Verschieben auf
              <input
                name="planned"
                type="date"
                required
                defaultValue={w.planned_date}
              />
            </label>
            <label>
              Alternatives Training
              <select name="template" defaultValue={w.workout_template_id}>
                {templates
                  .filter((t) => !t.archived)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="button-row">
              <button className="secondary">Termin speichern</button>
              <button
                className="primary"
                type="button"
                disabled={!t || t.archived}
                onClick={() => {
                  void start(w.workout_template_id, w.id);
                }}
              >
                Training starten
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  void save({
                    type: "training-schedule",
                    date,
                    id: w.id,
                    workout_template_id: w.workout_template_id,
                    planned_date: w.planned_date,
                    action: "cancel",
                  });
                }}
              >
                Planung entfernen
              </button>
            </div>
          </Fields>
        </form>
      )}
    </article>
  );
}
export function TrainingToday({
  state: s,
  date,
  save,
  busy,
  open,
}: {
  state: State;
  date: string;
  save: Save;
  busy: boolean;
  open: (view?: TrainingView) => void;
}) {
  const active = s.workout_sessions.find((w) => w.status === "active"),
    entries = alive(s.scheduled_workouts).filter(
      (w) => w.planned_date === date && w.status !== "cancelled",
    );
  return (
    <section className="card">
      <span className="eyebrow">TRAINING · DEIN PLAN BLEIBT FLEXIBEL</span>
      {active ? (
        <>
          <h3>{active.name_snapshot}</h3>
          <button className="primary" onClick={() => open("workout")}>
            Workout fortsetzen
          </button>
        </>
      ) : entries.length ? (
        entries.map((w) => {
          const t = s.workout_templates.find(
              (t) => t.id === w.workout_template_id,
            ),
            last = [...s.workout_sessions]
              .filter(
                (x) =>
                  x.workout_template_id === w.workout_template_id &&
                  x.status === "completed",
              )
              .sort((a, b) =>
                (b.completed_at || "").localeCompare(a.completed_at || ""),
              )[0];
          return (
            <div key={w.id}>
              <h3>{t?.name}</h3>
              <p>
                {w.status === "done" ? "Heute erledigt" : "Heute geplant"}
                {last
                  ? ` · Letzte Einheit ${dateLabel(last.completed_at!)}`
                  : ""}
              </p>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    w.status === "done" ||
                    !!t?.archived ||
                    !!t?.deleted_at
                  }
                  onClick={() => {
                    void save({
                      type: "training-start",
                      date,
                      template_id: w.workout_template_id,
                      scheduled_id: w.id,
                    }).then((ok) => {
                      if (ok) open();
                    });
                  }}
                >
                  Training starten
                </button>
                <button className="secondary" onClick={() => open("schedule")}>
                  Verschieben / bearbeiten
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <>
          <h3>Raum für dein Training</h3>
          <p className="muted">
            Vorlage wählen, spontan starten oder den Trainingstag verschieben.
          </p>
        </>
      )}
      <button className="text-button" onClick={() => open("manage")}>
        Training öffnen →
      </button>
    </section>
  );
}
