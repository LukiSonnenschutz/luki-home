"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImportBackup from "./import-backup";
import Goals from "./goals";
import {
  WorkTracker,
  DailyValues,
  FocusGoals,
  StabilityHints,
  PreferenceFields,
} from "./stability";
import { preferences, wakeTarget } from "@/lib/stability";
import { APP_VERSION } from "@/lib/version";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Coffee,
  Flag,
  Footprints,
  Home as HomeIcon,
  LayoutList,
  LogOut,
  Moon,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Trash2,
  Utensils,
  X,
  History,
  Pencil,
  LoaderCircle,
} from "lucide-react";
import type {
  AnchorEntry,
  Checkin,
  Command,
  Dashboard,
  DayPlan,
  State,
  Task,
} from "@/lib/model";
import { localClock, shiftDate } from "@/lib/time";
type Save = (command: Command) => Promise<boolean>;
type Tab = "today" | "tasks" | "goals" | "history" | "settings";
const Feedback = createContext("");

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(Feedback);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
function SectionTitle({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <span>
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
const anchorIcons = [Sun, Footprints, Coffee, Utensils, Sunset];

export default function Home({
  initialGoalId,
  initialTab = "today",
}: {
  initialGoalId?: string;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const dataRef = useRef<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [date, setDate] = useState("");
  const dateRef = useRef("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [now, setNow] = useState(new Date());
  const timeOffset = useRef(0);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorEntry | null>(null);
  const seq = useRef(0);
  const dirty = useRef(false);
  const receive = useCallback((value: Dashboard) => {
    document.documentElement.dataset.theme = preferences(value.state).theme;
    dataRef.current = value;
    setData(value);
    timeOffset.current = new Date(value.serverTime).getTime() - Date.now();
    setNow(new Date(Date.now() + timeOffset.current));
  }, []);
  const load = useCallback(
    async (selected = dateRef.current, quiet = false) => {
      const ticket = ++seq.current;
      try {
        const r = await fetch(
          `/api/state${selected ? `?date=${selected}` : ""}`,
          { cache: "no-store" },
        );
        if (r.status === 401) {
          window.location.assign(
            new URL("/login", window.location.origin).href,
          );
          return;
        }
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        if (ticket === seq.current && !busyRef.current) receive(value);
      } catch (e) {
        if (!quiet || !dataRef.current)
          setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
      }
    },
    [receive],
  );
  useEffect(() => {
    dateRef.current = date;
    void load(date);
  }, [date, load]);
  useEffect(() => {
    // Refresh the selected day. With no explicit selection, the API follows today's date.
    const selectedRefresh = () => {
      if (
        document.visibilityState === "visible" &&
        !busyRef.current &&
        !dirty.current &&
        !document.querySelector("dialog[open]")
      )
        void load(dateRef.current, true);
    };
    const poll = setInterval(selectedRefresh, 60_000);
    const tick = setInterval(
      () => setNow(new Date(Date.now() + timeOffset.current)),
      1000,
    );
    document.addEventListener("visibilitychange", selectedRefresh);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", selectedRefresh);
    };
  }, [load]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const save: Save = async (command) => {
    if (busyRef.current || !dataRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSaved("");
    ++seq.current;
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...command,
          revision: dataRef.current.state.revision,
        }),
      });
      if (r.status === 401) {
        window.location.assign(new URL("/login", window.location.origin).href);
        return false;
      }
      const value = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          busyRef.current = false;
          await load(dateRef.current);
        }
        throw new Error(value.error);
      }
      receive(value);
      setSaved("Gespeichert");
      dirty.current = false;
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      dirty.current = true;
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  async function logout() {
    const r = await fetch("/api/auth", { method: "DELETE" });
    if (r.ok)
      window.location.assign(new URL("/login", window.location.origin).href);
    else setError("Abmelden fehlgeschlagen.");
  }
  async function importBackup(file: File) {
    if (busyRef.current || !dataRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSaved("");
    ++seq.current;
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("revision", String(dataRef.current.state.revision));
      const r = await fetch("/api/import", { method: "POST", body: form });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      dirty.current = false;
      busyRef.current = false;
      setDate("");
      await load("");
      setSaved("Daten übernommen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernahme fehlgeschlagen.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const navigate = (target: Tab) => {
    if (dirty.current && !window.confirm("Ungespeicherte Eingaben verwerfen?"))
      return;
    dirty.current = false;
    setTab(target);
    router.replace(target === "today" ? "/" : `/?view=${target}`, {
      scroll: false,
    });
  };
  if (!data)
    return (
      <main className="loading">
        <LoaderCircle className="spin" />
        <p>{error || "Dein Tag wird geladen …"}</p>
        {error && <button onClick={() => load()}>Erneut laden</button>}
      </main>
    );
  const s = data.state;
  const plan = s.day_plans.find((d) => d.local_date === data.date)!;
  const focusTitle =
    plan.focus_text || s.tasks.find((t) => t.id === plan.focus_task_id)?.title;
  const entries = s.anchor_entries.filter((e) => e.local_date === data.date);
  const checkin = s.checkins.find((c) => c.local_date === data.date);
  const clock = localClock(now, s.profile.timezone);
  const hour = Number(clock.time.slice(0, 2));
  const greeting =
    hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${data.date}T12:00:00Z`));
  const done = entries.filter((e) => e.status === "done").length;
  const isToday = data.date === data.today;
  const pinned = plan.highlights
    .map((id) => s.tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);
  const visibleTasks = pinned.length
    ? pinned
    : s.tasks
        .filter((t) => t.due_date === data.date && t.status === "open")
        .slice(0, 3);
  const overdue = s.tasks.filter(
    (t) => t.status === "open" && t.due_date && t.due_date < data.date,
  ).length;
  return (
    <Feedback.Provider value={error}>
      <div
        className="app-shell"
        onChangeCapture={(e) => {
          if ((e.target as HTMLElement).closest("form")) dirty.current = true;
        }}
      >
        <aside className="sidebar">
          <Link href="/" className="brand">
            luki<span className="brand-dot">●</span>
            <span className="brand-home">home</span>
          </Link>
          <div className="sidebar-sub">DEIN PERSÖNLICHER RAUM</div>
          <nav aria-label="Hauptnavigation">
            {(
              [
                { id: "today", label: "Heute", icon: HomeIcon },
                { id: "tasks", label: "Aufgaben", icon: LayoutList },
                { id: "goals", label: "Ziele", icon: Flag },
                { id: "settings", label: "Einstellungen", icon: SettingsIcon },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "nav-item active" : "nav-item"}
                onClick={() => navigate(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
              >
                <item.icon size={19} />
                {item.label}
                {item.id === "today" && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="little-line" />
            <p>
              Du musst nicht alles schaffen.
              <br />
              <strong>Nur den nächsten Schritt.</strong>
            </p>
          </div>
          <div className="sidebar-bottom">
            <button className="nav-item" onClick={() => navigate("history")}>
              <History size={18} />
              Rückblick
            </button>
            <a href="/api/export" className="nav-item">
              <ArrowDownToLine size={18} />
              Daten exportieren
            </a>
            <div className="account">
              <span className="avatar">
                {s.profile.display_name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{s.profile.display_name}</strong>
                <span>
                  {data.mode === "local" ? "Lokal" : "Online"} · v{APP_VERSION}
                </span>
              </div>
              <button
                className="icon-button"
                title="Abmelden"
                aria-label="Abmelden"
                onClick={() => {
                  if (
                    !dirty.current ||
                    window.confirm(
                      "Ungespeicherte Eingaben verwerfen und abmelden?",
                    )
                  )
                    void logout();
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <header className="topbar">
            <button
              className="text-button mobile-history"
              onClick={() => navigate("history")}
            >
              Rückblick
            </button>
            <span className="breadcrumb">
              Dein Raum <span>/</span>{" "}
              <strong>
                {
                  {
                    today: "Heute",
                    tasks: "Aufgaben",
                    goals: "Ziele",
                    history: "Rückblick",
                    settings: "Einstellungen",
                  }[tab]
                }
              </strong>
            </span>
            <div className="save-status" aria-live="polite">
              {busy ? (
                <>
                  <LoaderCircle size={14} className="spin" />
                  Speichert …
                </>
              ) : saved ? (
                <>
                  <Check size={14} />
                  {saved}
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  {data.mode === "local"
                    ? "Auf diesem Rechner"
                    : "Sicher online"}
                </>
              )}
            </div>
            <button
              className="icon-button mobile-logout"
              aria-label="Abmelden"
              onClick={() => {
                if (
                  !dirty.current ||
                  window.confirm(
                    "Ungespeicherte Eingaben verwerfen und abmelden?",
                  )
                )
                  void logout();
              }}
            >
              <LogOut size={17} />
            </button>
          </header>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Fehlermeldung schließen"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "today" ? "EIN NEUER TAG. DEIN TEMPO." : "LUKI HOME"}
              </div>
              <h1>
                {tab === "today" ? (
                  <>
                    {isToday ? greeting : "Dein Rückblick"},{" "}
                    <span>{s.profile.display_name}.</span>
                  </>
                ) : (
                  {
                    tasks: "Platz für das Wichtige.",
                    goals: "Eine Richtung, die dir wichtig ist.",
                    history: "Ein Blick zurück.",
                    settings: "Dein eigener Rhythmus.",
                  }[tab as Exclude<Tab, "today">]
                )}
              </h1>
              <p className="muted">
                {tab === "today"
                  ? "Ein klarer Fokus. Kleine Anker. Ein bewusster Abschluss."
                  : tab === "tasks"
                    ? "Sammeln, auswählen, Schritt für Schritt erledigen."
                    : tab === "history"
                      ? "Deine Tage bleiben hier. Ohne Wertung."
                      : "Passe Luki Home an deinen Alltag an."}
              </p>
            </div>
            {tab === "today" && (
              <div className="clock">
                <span>{clock.time}</span>
                <span>{s.profile.timezone}</span>
              </div>
            )}
          </div>
          {(tab === "today" || tab === "history") && (
            <div className="date-bar">
              <div>
                <span className="date-dot" />
                {isToday ? "HEUTE" : "RÜCKBLICK"}
                <span className="date-label">{dateLabel}</span>
              </div>
              <div className="date-controls">
                <button
                  className="icon-button"
                  aria-label="Vorheriger Tag"
                  onClick={() => setDate(shiftDate(data.date, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  aria-label="Tag auswählen"
                  type="date"
                  value={data.date}
                  max={data.today}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
                <button
                  className="icon-button"
                  aria-label="Nächster Tag"
                  disabled={isToday}
                  onClick={() => setDate(shiftDate(data.date, 1))}
                >
                  <ChevronRight size={18} />
                </button>
                {!isToday && (
                  <button className="text-button" onClick={() => setDate("")}>
                    Heute
                  </button>
                )}
              </div>
            </div>
          )}
          {tab === "today" && (
            <div className="dashboard-grid">
              <div className="column">
                <section className="card focus-card">
                  <SectionTitle
                    label="DEIN TAGESFOKUS"
                    icon={<Flag size={16} />}
                  >
                    <button
                      className="icon-button"
                      aria-label="Tagesfokus bearbeiten"
                      onClick={() => setDayOpen(true)}
                    >
                      <Pencil size={16} />
                    </button>
                  </SectionTitle>
                  <h2>{focusTitle || "Was ist heute wichtig?"}</h2>
                  <p>
                    {focusTitle
                      ? "Das ist dein roter Faden für heute."
                      : "Gib deinem Tag eine Richtung. Ein Satz reicht."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setDayOpen(true)}
                  >
                    {focusTitle ? "Fokus anpassen" : "Fokus setzen"}
                    <ArrowUpRight size={16} />
                  </button>
                  <div className="focus-art" aria-hidden="true">
                    <div />
                    <div />
                    <div />
                  </div>
                </section>
                <section className="card">
                  <SectionTitle
                    label="WICHTIGE AUFGABEN"
                    icon={<LayoutList size={16} />}
                  >
                    <span className="counter">
                      {visibleTasks.filter((t) => t.status === "done").length} /{" "}
                      {visibleTasks.length}
                    </span>
                  </SectionTitle>
                  {visibleTasks.length ? (
                    <div className="task-list">
                      {visibleTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          date={data.date}
                          plan={plan}
                          save={save}
                          busy={busy}
                          simple
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Plus size={22} />
                      </span>
                      <strong>Platz für deine drei Prioritäten.</strong>
                      <p>Füge Aufgaben hinzu und wähle aus, was heute zählt.</p>
                    </div>
                  )}
                  {overdue > 0 && (
                    <p className="overdue-note">
                      {overdue} offene{" "}
                      {overdue === 1 ? "Aufgabe liegt" : "Aufgaben liegen"} vor
                      diesem Tag.
                    </p>
                  )}
                  <button
                    className="card-link"
                    onClick={() => navigate("tasks")}
                  >
                    <Plus size={16} />
                    Aufgaben verwalten
                    <ArrowRight size={16} />
                  </button>
                </section>
                <FocusGoals state={s} />
                <section className="card training-card">
                  <div className="training-icon">
                    <Footprints size={22} />
                  </div>
                  <div>
                    <span className="eyebrow">TRAINING HEUTE</span>
                    <h3>{plan.training_note || "Raum für Bewegung."}</h3>
                    <p className="muted">
                      {plan.training_time
                        ? `${plan.training_time} Uhr · Tagesnotiz`
                        : "Optional: Was hast du heute vor?"}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Trainingsnotiz bearbeiten"
                    onClick={() => setDayOpen(true)}
                  >
                    <ArrowUpRight size={20} />
                  </button>
                  <label>
                    Training-Status
                    <select
                      disabled={busy}
                      value={plan.training_status || "open"}
                      onChange={(e) =>
                        save({
                          type: "training-status",
                          date: data.date,
                          status: e.target.value as "open" | "planned" | "done",
                        })
                      }
                    >
                      <option value="open">offen</option>
                      <option value="planned">geplant</option>
                      <option value="done">erledigt</option>
                    </select>
                  </label>
                </section>
                <WorkTracker
                  state={s}
                  date={data.date}
                  now={now}
                  save={save}
                  busy={busy}
                />
                <StabilityHints state={s} date={data.date} now={now} />
                {data.activeRule && (
                  <section className="card intervention">
                    <SectionTitle
                      label="EIN KLEINER IMPULS"
                      icon={<Sparkles size={16} />}
                    />
                    <p>{data.activeRule.message_snapshot}</p>
                    <div className="button-row">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          save({
                            type: "intervention",
                            date: data.date,
                            id: data.activeRule!.id,
                            action: "snooze",
                          })
                        }
                      >
                        In 30 Minuten
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          save({
                            type: "intervention",
                            date: data.date,
                            id: data.activeRule!.id,
                            action: "dismiss",
                          })
                        }
                      >
                        Für heute schließen
                      </button>
                    </div>
                  </section>
                )}
              </div>
              <div className="column">
                <DailyValues
                  state={s}
                  date={data.date}
                  now={now}
                  save={save}
                  busy={busy}
                />
                <section className="card anchors-card">
                  <SectionTitle
                    label="DEINE STABILITÄTSANKER"
                    icon={<Sun size={17} />}
                  >
                    <span className="counter">
                      {done} / {entries.length}
                    </span>
                  </SectionTitle>
                  <div className="anchor-intro">
                    Kleine Dinge. Eine stabile Basis.
                  </div>
                  <div className="anchor-list">
                    {entries
                      .filter(
                        (e) =>
                          !s.anchor_definitions.some(
                            (a) =>
                              a.id === e.anchor_id &&
                              (a.key === "coffee_rule" || a.key === "meal"),
                          ),
                      )
                      .map((e) => {
                        const a = s.anchor_definitions.find(
                          (a) => a.id === e.anchor_id,
                        )!;
                        const Icon = anchorIcons[a.position] || Circle;
                        const target =
                          a.key === "wake_up"
                            ? wakeTarget(s, data.date)
                            : a.target_time;
                        return (
                          <div className={`anchor-row ${e.status}`} key={e.id}>
                            <button
                              className="anchor-check"
                              disabled={busy}
                              aria-label={`${e.label_snapshot}: ${e.status === "done" ? "wieder öffnen" : "erledigen"}`}
                              onClick={() =>
                                save({
                                  type: "anchor",
                                  date: data.date,
                                  id: e.id,
                                  status:
                                    e.status === "done" ? "pending" : "done",
                                  actual_local_time:
                                    e.status === "done"
                                      ? null
                                      : isToday
                                        ? clock.time
                                        : e.actual_local_time,
                                  note: e.note,
                                })
                              }
                            >
                              {e.status === "done" ? (
                                <Check size={17} />
                              ) : e.status === "skipped" ? (
                                <span>–</span>
                              ) : (
                                <Icon size={17} />
                              )}
                            </button>
                            <button
                              className="anchor-detail"
                              onClick={() => setAnchor(e)}
                            >
                              <strong>{e.label_snapshot}</strong>
                              <span>
                                {e.status === "done"
                                  ? `Erledigt${e.actual_local_time ? ` · ${e.actual_local_time}` : ""}`
                                  : e.status === "skipped"
                                    ? "Heute ausgelassen"
                                    : target
                                      ? `Ziel ${target}`
                                      : "In deinem Tempo"}
                              </span>
                            </button>
                            <span className={`status-dot ${e.status}`} />
                          </div>
                        );
                      })}
                  </div>
                  <div className="anchor-progress">
                    <span
                      style={{
                        width: `${entries.length ? (done / entries.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="small muted">
                    {done === entries.length && entries.length > 0
                      ? "Deine Basis steht für heute."
                      : "Jeder kleine Schritt zählt."}
                  </p>
                </section>
                <section className="card checkin-card">
                  <div className="moon-art">
                    <Moon size={28} />
                    <span />
                  </div>
                  <span className="eyebrow">DEIN ABEND-CHECK-IN</span>
                  <h2>
                    {checkin?.submitted_at
                      ? "Dein Tag ist festgehalten."
                      : "Wie war dein Tag?"}
                  </h2>
                  <p className="muted">
                    {checkin?.submitted_at
                      ? "Du kannst deine Antworten jederzeit bearbeiten."
                      : "Kurz innehalten. Energie, Stimmung und Stress festhalten."}
                  </p>
                  <button
                    className="primary"
                    onClick={() => setCheckinOpen(true)}
                  >
                    {checkin?.submitted_at
                      ? "Check-in ansehen"
                      : checkin
                        ? "Entwurf fortsetzen"
                        : "Check-in öffnen"}
                    <ArrowUpRight size={17} />
                  </button>
                  <span className="small muted">
                    {isToday
                      ? `Dein geplanter Moment · ${s.settings.checkin_time} Uhr`
                      : dateLabel}
                  </span>
                </section>
              </div>
            </div>
          )}
          {tab === "tasks" && (
            <TaskManager
              state={s}
              date={data.date}
              plan={plan}
              save={save}
              busy={busy}
              discard={() => {
                if (
                  dirty.current &&
                  !window.confirm("Ungespeicherte Eingaben verwerfen?")
                )
                  return false;
                dirty.current = false;
                return true;
              }}
            />
          )}
          {tab === "goals" && (
            <Goals
              state={s}
              date={data.date}
              save={save}
              busy={busy}
              initialGoalId={initialGoalId}
              renderTasks={(goalId) => (
                <TaskManager
                  state={{
                    ...s,
                    tasks: s.tasks.filter((t) => t.goal_id === goalId),
                  }}
                  date={data.date}
                  plan={plan}
                  save={save}
                  busy={busy}
                  defaultGoalId={goalId}
                  discard={() =>
                    !dirty.current ||
                    window.confirm("Ungespeicherte Eingaben verwerfen?")
                  }
                />
              )}
            />
          )}
          {tab === "settings" && (
            <SettingsForm
              key={s.profile.user_id}
              state={s}
              date={data.date}
              save={save}
              busy={busy}
              onDirty={() => {
                dirty.current = true;
              }}
              mode={data.mode}
              onImport={importBackup}
            />
          )}
          {tab === "history" && (
            <section className="card history-card">
              <SectionTitle
                label="DEIN TAG IM RÜCKBLICK"
                icon={<History size={17} />}
              />
              <h2>{plan.focus_text || "Kein Tagesfokus hinterlegt."}</h2>
              <div className="history-stats">
                <div>
                  <strong>
                    {done}/{entries.length}
                  </strong>
                  <span>Anker erledigt</span>
                </div>
                <div>
                  <strong>{checkin?.energy ?? "—"}</strong>
                  <span>Energie / 5</span>
                </div>
                <div>
                  <strong>{checkin?.mood ?? "—"}</strong>
                  <span>Stimmung / 5</span>
                </div>
                <div>
                  <strong>{checkin?.stress ?? "—"}</strong>
                  <span>Stress / 5</span>
                </div>
              </div>
              {checkin?.helped_text && (
                <p>
                  <strong>Das hat geholfen</strong>
                  <br />
                  {checkin.helped_text}
                </p>
              )}
              {checkin?.tomorrow_text && (
                <p>
                  <strong>Für morgen</strong>
                  <br />
                  {checkin.tomorrow_text}
                </p>
              )}
              <p className="muted">
                {checkin?.submitted_at
                  ? "Check-in abgeschlossen."
                  : checkin
                    ? "Check-in als Entwurf gespeichert."
                    : "Für diesen Tag gibt es noch keinen Check-in."}
              </p>
              <button className="secondary" onClick={() => navigate("today")}>
                Tag öffnen
                <ArrowUpRight size={16} />
              </button>
              <h3 className="history-days-title">Gespeicherte Tage</h3>
              <div className="history-days">
                {[...s.day_plans]
                  .sort((a, b) => b.local_date.localeCompare(a.local_date))
                  .map((d) => (
                    <button
                      className={d.local_date === data.date ? "selected" : ""}
                      key={d.id}
                      onClick={() => setDate(d.local_date)}
                    >
                      {d.local_date}
                      <span>{d.focus_text || "Ohne Fokus"}</span>
                    </button>
                  ))}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <span className="date-dot" />
              Ein Schritt nach dem anderen.
            </span>
            <span>Luki Home · {APP_VERSION}</span>
          </footer>
        </main>
        {dayOpen && (
          <Modal
            title="Dein Plan für heute"
            onClose={() => {
              if (
                !dirty.current ||
                window.confirm("Ungespeicherte Eingaben verwerfen?")
              ) {
                dirty.current = false;
                setDayOpen(false);
              }
            }}
          >
            <DayForm
              key={data.date}
              plan={plan}
              tasks={s.tasks}
              busy={busy}
              save={save}
              onDone={() => setDayOpen(false)}
            />
          </Modal>
        )}
        {anchor && (
          <Modal
            title={anchor.label_snapshot}
            onClose={() => {
              if (
                !dirty.current ||
                window.confirm("Ungespeicherte Eingaben verwerfen?")
              ) {
                dirty.current = false;
                setAnchor(null);
              }
            }}
          >
            <AnchorForm
              entry={anchor}
              date={data.date}
              busy={busy}
              save={save}
              onDone={() => setAnchor(null)}
            />
          </Modal>
        )}
        {checkinOpen && (
          <Modal
            title="Ein Moment für deinen Tag"
            onClose={() => {
              if (
                !dirty.current ||
                window.confirm("Ungespeicherte Eingaben verwerfen?")
              ) {
                dirty.current = false;
                setCheckinOpen(false);
              }
            }}
          >
            <CheckinForm
              key={data.date}
              checkin={checkin}
              date={data.date}
              busy={busy}
              save={save}
              onDone={() => setCheckinOpen(false)}
            />
          </Modal>
        )}
      </div>
    </Feedback.Provider>
  );
}

function DayForm({
  plan,
  tasks,
  busy,
  save,
  onDone,
}: {
  plan: DayPlan;
  tasks: Task[];
  busy: boolean;
  save: Save;
  onDone: () => void;
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await save({
        type: "day",
        date: plan.local_date,
        focus_text: String(f.get("focus")),
        focus_task_id: String(f.get("task")) || null,
        training_note: String(f.get("training")),
        training_time: String(f.get("time")) || null,
      })
    )
      onDone();
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>
          Tagesfokus
          <input
            name="focus"
            maxLength={200}
            defaultValue={plan.focus_text}
            placeholder="Was ist heute wichtig?"
            autoFocus
          />
        </label>
        <label>
          Mit einer Aufgabe verknüpfen
          <select name="task" defaultValue={plan.focus_task_id || ""}>
            <option value="">Keine Verknüpfung</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Training · optionale Tagesnotiz
          <input
            name="training"
            maxLength={200}
            defaultValue={plan.training_note}
            placeholder="Zum Beispiel Upper A"
          />
        </label>
        <label>
          Uhrzeit · optional
          <input
            type="time"
            name="time"
            defaultValue={plan.training_time || ""}
          />
        </label>
        <button className="primary">
          Plan speichern
          <Check size={16} />
        </button>
      </fieldset>
    </form>
  );
}
function AnchorForm({
  entry,
  date,
  busy,
  save,
  onDone,
}: {
  entry: AnchorEntry;
  date: string;
  busy: boolean;
  save: Save;
  onDone: () => void;
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await save({
        type: "anchor",
        date,
        id: entry.id,
        status: f.get("status") as AnchorEntry["status"],
        actual_local_time: String(f.get("time")) || null,
        note: String(f.get("note")),
      })
    )
      onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="muted">{entry.description_snapshot}</p>
      <fieldset disabled={busy}>
        <label>
          Status
          <select name="status" defaultValue={entry.status}>
            <option value="pending">Offen</option>
            <option value="done">Erledigt</option>
            <option value="skipped">Heute ausgelassen</option>
          </select>
        </label>
        <label>
          Tatsächliche Uhrzeit · optional
          <input
            type="time"
            name="time"
            defaultValue={entry.actual_local_time || ""}
          />
        </label>
        <label>
          Notiz
          <textarea name="note" maxLength={2000} defaultValue={entry.note} />
        </label>
        <button className="primary">
          Anker speichern
          <Check size={16} />
        </button>
      </fieldset>
    </form>
  );
}
function CheckinForm({
  checkin,
  date,
  busy,
  save,
  onDone,
}: {
  checkin?: Checkin;
  date: string;
  busy: boolean;
  save: Save;
  onDone: () => void;
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    const score = (name: string) => (f.get(name) ? Number(f.get(name)) : null);
    if (
      await save({
        type: "checkin",
        date,
        energy: score("energy"),
        mood: score("mood"),
        stress: score("stress"),
        helped_text: String(f.get("helped")),
        movement_done: f.has("movement_done"),
        training_done: f.has("training_done"),
        work_end_kept: f.has("work_end_kept"),
        tomorrow_text: String(f.get("tomorrow")),
        submit: submitter.value === "submit",
      })
    )
      onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="muted">{date} · Es gibt kein richtig oder falsch.</p>
      <fieldset disabled={busy}>
        {(
          [
            { name: "energy", label: "Energie", from: "Niedrig", to: "Hoch" },
            { name: "mood", label: "Stimmung", from: "Niedrig", to: "Hoch" },
            { name: "stress", label: "Stress", from: "Wenig", to: "Stark" },
          ] as const
        ).map((item) => (
          <fieldset className="score-field" key={item.name}>
            <legend>{item.label}</legend>
            <div className="scores">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input
                    type="radio"
                    name={item.name}
                    value={n}
                    defaultChecked={checkin?.[item.name] === n}
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <div className="scale-labels">
              <span>1 · {item.from}</span>
              <span>5 · {item.to}</span>
            </div>
          </fieldset>
        ))}
        <label>
          Was hat heute geholfen?
          <textarea
            name="helped"
            maxLength={2000}
            defaultValue={checkin?.helped_text || ""}
          />
        </label>
        <label className="checkbox-label">
          <input
            name="movement_done"
            type="checkbox"
            defaultChecked={checkin?.movement_done || false}
          />
          Bewegung erledigt
        </label>
        <label className="checkbox-label">
          <input
            name="training_done"
            type="checkbox"
            defaultChecked={checkin?.training_done || false}
          />
          Training erledigt
        </label>
        <label className="checkbox-label">
          <input
            name="work_end_kept"
            type="checkbox"
            defaultChecked={checkin?.work_end_kept || false}
          />
          Feierabend eingehalten
        </label>
        <label>
          Was brauche ich morgen?
          <textarea
            name="tomorrow"
            maxLength={2000}
            defaultValue={checkin?.tomorrow_text || ""}
          />
        </label>
        <div className="button-row">
          <button className="secondary" value="draft" type="submit">
            Entwurf speichern
          </button>
          <button className="primary" value="submit" type="submit">
            Check-in abschließen
            <Check size={16} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function TaskRow({
  task,
  date,
  plan,
  save,
  busy,
  simple = false,
  onEdit,
}: {
  task: Task;
  date: string;
  plan: DayPlan;
  save: Save;
  busy: boolean;
  simple?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className={`task-row ${task.status === "done" ? "completed" : ""}`}>
      <button
        className="task-check"
        disabled={busy}
        aria-label={`${task.title}: ${task.status === "done" ? "wieder öffnen" : "erledigen"}`}
        onClick={() =>
          save({
            type: "task-status",
            date,
            id: task.id,
            status: task.status === "done" ? "open" : "done",
          })
        }
      >
        {task.status === "done" && <Check size={15} />}
      </button>
      <div className="task-text">
        <strong>{task.title}</strong>
        {!simple && (
          <span>
            {task.due_date || "Inbox"}
            {task.notes ? ` · ${task.notes}` : ""}
          </span>
        )}
      </div>
      {!simple && (
        <>
          <button
            className={`icon-button ${plan.highlights.includes(task.id) ? "starred" : ""}`}
            aria-label={`${task.title}: ${plan.highlights.includes(task.id) ? "Priorität entfernen" : "hervorheben"}`}
            disabled={busy}
            onClick={() =>
              save({
                type: "highlight",
                date,
                id: task.id,
                enabled: !plan.highlights.includes(task.id),
              })
            }
          >
            <Star size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={`${task.title} bearbeiten`}
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
        </>
      )}
    </div>
  );
}
function TaskManager({
  state,
  date,
  plan,
  save,
  busy,
  discard,
  defaultGoalId,
}: {
  state: State;
  date: string;
  plan: DayPlan;
  save: Save;
  busy: boolean;
  discard: () => boolean;
  defaultGoalId?: string;
}) {
  const [edit, setEdit] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const groups = [
    {
      label: "Für diesen Tag",
      tasks: state.tasks.filter(
        (t) => t.status === "open" && t.due_date === date,
      ),
    },
    {
      label: "Überfällig",
      tasks: state.tasks.filter(
        (t) => t.status === "open" && t.due_date && t.due_date < date,
      ),
    },
    {
      label: "Inbox",
      tasks: state.tasks.filter((t) => t.status === "open" && !t.due_date),
    },
    {
      label: "Später",
      tasks: state.tasks.filter(
        (t) => t.status === "open" && t.due_date && t.due_date > date,
      ),
    },
    {
      label: "Erledigt",
      tasks: state.tasks.filter((t) => t.status === "done"),
    },
  ];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fields = {
      date,
      title: String(f.get("title")),
      notes: String(f.get("notes")),
      due_date: String(f.get("due")) || null,
      goal_id: String(f.get("goal")) || null,
    };
    const command: Command =
      edit === "new"
        ? { type: "task-create", ...fields }
        : { type: "task-edit", id: (edit as Task).id, ...fields };
    if (await save(command)) setEdit(null);
  }
  return (
    <>
      <div className="task-toolbar">
        <p className="muted">
          Mit dem Stern wählst du bis zu drei Prioritäten für {date}.
        </p>
        <button className="primary" onClick={() => setEdit("new")}>
          <Plus size={17} />
          Neue Aufgabe
        </button>
      </div>
      {groups.map((g) => (
        <section className="card task-group" key={g.label}>
          <SectionTitle
            label={g.label.toUpperCase()}
            icon={<LayoutList size={16} />}
          >
            <span className="counter">{g.tasks.length}</span>
          </SectionTitle>
          {g.tasks.length ? (
            g.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                date={date}
                plan={plan}
                save={save}
                busy={busy}
                onEdit={() => setEdit(t)}
              />
            ))
          ) : (
            <p className="muted small">Hier ist gerade nichts offen.</p>
          )}
        </section>
      ))}
      {edit && (
        <Modal
          title={edit === "new" ? "Neue Aufgabe" : "Aufgabe bearbeiten"}
          onClose={() => {
            if (discard()) setEdit(null);
          }}
        >
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Was möchtest du erledigen?
                <input
                  name="title"
                  autoFocus
                  required
                  maxLength={200}
                  defaultValue={edit === "new" ? "" : edit.title}
                />
              </label>
              <label>
                Datum · leer für Inbox
                <input
                  type="date"
                  name="due"
                  defaultValue={edit === "new" ? date : edit.due_date || ""}
                />
              </label>
              <label>
                Zugehöriges Ziel · optional
                <select
                  name="goal"
                  defaultValue={
                    edit === "new" ? defaultGoalId || "" : edit.goal_id || ""
                  }
                >
                  <option value="">Kein Ziel</option>
                  {state.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notiz
                <textarea
                  name="notes"
                  maxLength={2000}
                  defaultValue={edit === "new" ? "" : edit.notes}
                />
              </label>
              <div className="button-row">
                <button className="primary">
                  Aufgabe speichern
                  <Check size={16} />
                </button>
                {edit !== "new" && (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => {
                      setDeleting(edit);
                      setEdit(null);
                    }}
                  >
                    <Trash2 size={16} />
                    Löschen
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Aufgabe löschen?" onClose={() => setDeleting(null)}>
          <p>
            „{deleting.title}“ wird mit allen Prioritätsverknüpfungen gelöscht.
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => setDeleting(null)}>
              Abbrechen
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (await save({ type: "task-delete", date, id: deleting.id }))
                  setDeleting(null);
              }}
            >
              Endgültig löschen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function SettingsForm({
  state,
  date,
  save,
  busy,
  onDirty,
  mode,
  onImport,
}: {
  state: State;
  date: string;
  save: Save;
  busy: boolean;
  onDirty: () => void;
  mode: "local" | "supabase";
  onImport: (file: File) => Promise<void>;
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await save({
      type: "settings",
      date,
      display_name: String(f.get("name")),
      timezone: String(f.get("timezone")),
      work_end_target: String(f.get("end")),
      movement_time: String(f.get("movement")),
      checkin_time: String(f.get("checkin")),
      preferences: {
        wake_weekday: String(f.get("wake_weekday")),
        wake_weekend: String(f.get("wake_weekend")),
        coffee_cutoff: String(f.get("coffee_cutoff")),
        coffee_limit: Number(f.get("coffee_limit")),
        focus_minutes: Number(f.get("focus_minutes")),
        break_minutes: Number(f.get("break_minutes")),
        calories_target: Number(f.get("calories_target")),
        protein_target: f.get("protein_target")
          ? Number(f.get("protein_target"))
          : null,
        theme: String(f.get("theme")) as "dark" | "light" | "system",
        coffee_rule: f.has("coffee_rule"),
        work_rule: f.has("work_rule"),
      },
      rules: {
        wake_up_late: f.has("wake_up_late"),
        movement_missing: f.has("movement_missing"),
        work_end_due: f.has("work_end_due"),
      },
      anchors: state.anchor_definitions.map((a) => ({
        id: a.id,
        enabled: f.has(`enabled-${a.id}`),
        description: String(f.get(`description-${a.id}`)),
        target_time:
          a.key === "wake_up"
            ? String(f.get("wake_weekday"))
            : a.key === "work_end"
              ? String(f.get("end"))
              : String(f.get(`target-${a.id}`)) || null,
      })),
    });
  }
  return (
    <form className="settings-form" onSubmit={submit} onChange={onDirty}>
      <fieldset disabled={busy}>
        <section className="card">
          <SectionTitle label="DEIN PROFIL" icon={<SettingsIcon size={16} />} />
          <div className="form-grid">
            <label>
              Name
              <input
                name="name"
                defaultValue={state.profile.display_name}
                required
                maxLength={200}
              />
            </label>
            <label>
              Zeitzone
              <select name="timezone" defaultValue={state.profile.timezone}>
                {Array.from(
                  new Set([
                    state.profile.timezone,
                    "Europe/Berlin",
                    "Europe/London",
                    "Europe/Vienna",
                    "Europe/Zurich",
                    "America/New_York",
                    "Asia/Bangkok",
                    "UTC",
                  ]),
                ).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="card">
          <PreferenceFields settings={preferences(state)} />
          <SectionTitle label="DEIN TAGESRHYTHMUS" icon={<Sun size={16} />} />
          <p className="muted small">
            Startvorschläge: Passe die Zeiten an deinen Alltag an. Hinweise
            erscheinen, während die App geöffnet ist.
          </p>
          <div className="form-grid">
            <label>
              Bewegungs-Hinweis
              <input
                name="movement"
                type="time"
                required
                defaultValue={state.settings.movement_time}
              />
            </label>
            <label>
              Feierabendziel
              <input
                name="end"
                type="time"
                required
                defaultValue={state.settings.work_end_target}
              />
            </label>
            <label>
              Abend-Check-in
              <input
                name="checkin"
                type="time"
                required
                defaultValue={state.settings.checkin_time}
              />
            </label>
          </div>
          <div className="rule-toggles">
            {[
              {
                key: "wake_up_late" as const,
                text: "Hinweis bei spätem Aufstehen",
              },
              {
                key: "movement_missing" as const,
                text: "Hinweis bei offener Bewegung",
              },
              { key: "work_end_due" as const, text: "Hinweis zum Feierabend" },
            ].map((r) => (
              <label className="checkbox-label" key={r.key}>
                <input
                  type="checkbox"
                  name={r.key}
                  defaultChecked={state.settings.rules[r.key]}
                />
                {r.text}
              </label>
            ))}
          </div>
        </section>
        <section className="card">
          <SectionTitle label="DEINE ANKER" icon={<Flag size={16} />} />
          <p className="muted small">
            Beschreibungen und aktive Anker gelten ab dem nächsten neuen Tag.
            Hinweiszeiten und Regel-Schalter gelten sofort.
          </p>
          {state.anchor_definitions.map((a) => (
            <div className="anchor-setting" key={a.id}>
              <label className="checkbox-label">
                <input
                  name={`enabled-${a.id}`}
                  type="checkbox"
                  defaultChecked={a.enabled}
                />
                <strong>{a.label}</strong>
              </label>
              <label>
                Persönliche Regel / Beschreibung
                <textarea
                  name={`description-${a.id}`}
                  maxLength={2000}
                  defaultValue={a.description}
                />
              </label>
              {a.key === "wake_up" ? (
                <p className="small muted">
                  Aufstehzeiten für Werktage und Wochenende stehen oben unter
                  „Deine Stabilität“.
                </p>
              ) : a.key === "work_end" ? (
                <p className="small muted">
                  Die Zielzeit wird oben unter „Feierabendziel“ festgelegt.
                </p>
              ) : (
                <label>
                  Zielzeit · optional
                  <input
                    name={`target-${a.id}`}
                    type="time"
                    defaultValue={a.target_time || ""}
                  />
                </label>
              )}
            </div>
          ))}
        </section>
        <button className="primary">
          Einstellungen speichern
          <Check size={16} />
        </button>
      </fieldset>
      <section className="card data-card">
        <SectionTitle
          label="DEINE DATEN GEHÖREN DIR"
          icon={<ShieldCheck size={16} />}
        />
        <p className="muted">
          Der ZIP-Export enthält alle gespeicherten Tage und Einträge. Ein
          vollständiges Systembackup wird separat erstellt.
        </p>
        <a className="secondary" href="/api/export">
          <ArrowDownToLine size={17} />
          Daten exportieren
        </a>
        {mode === "supabase" && (
          <ImportBackup state={state} busy={busy} onImport={onImport} />
        )}
      </section>
    </form>
  );
}
