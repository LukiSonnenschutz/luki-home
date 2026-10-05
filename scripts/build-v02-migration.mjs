// Reproducible migration authoring helper. Does not connect to any database.
import { readFileSync, writeFileSync } from "node:fs";
const path = "supabase/migrations/20261005063711_goals_stability_v02.sql";
const schemas = {
  goals: `id uuid primary key, user_id uuid not null references luki_home.profiles(user_id), title text not null check(length(trim(title)) between 1 and 200), why text not null check(length(why)<=2000), success_criteria text not null check(length(success_criteria)<=2000), category text not null check(category in ('Gesundheit & Körper','Beziehung & Familie','Firma','Abenteuer','Persönliche Entwicklung','Sonstiges')), priority smallint not null check(priority between 1 and 3), status text not null check(status in ('active','paused','achieved','discarded')), is_focus boolean not null, start_date date, target_date date, completed_at timestamptz, created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id), check(start_date is null or target_date is null or start_date<=target_date), check((status='achieved')=(completed_at is not null))`,
  goal_milestones: `id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),goal_id uuid not null,title text not null check(length(trim(title)) between 1 and 200),description text not null check(length(description)<=2000),status text not null check(status in ('open','done')),due_date date,sort_order integer not null check(sort_order>=0),completed_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null,foreign key(user_id,goal_id) references luki_home.goals(user_id,id),check((status='done')=(completed_at is not null))`,
  coffee_entries: `id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),consumed_at timestamptz not null,created_at timestamptz not null`,
  work_sessions: `id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),local_date date not null,started_at timestamptz not null,ended_at timestamptz,planned_minutes integer not null check(planned_minutes between 5 and 240),planned_break_minutes integer not null check(planned_break_minutes between 5 and 60),actual_minutes double precision not null check(actual_minutes>=0 and actual_minutes<'Infinity'::float8),elapsed_seconds double precision not null check(elapsed_seconds>=0 and elapsed_seconds<'Infinity'::float8),focus_started_at timestamptz,status text not null check(status in ('active','paused','break','done')),break_started_at timestamptz,break_ended_at timestamptz,break_taken boolean not null,break_overrun boolean not null,created_at timestamptz not null,updated_at timestamptz not null,check((status='active')=(focus_started_at is not null)),check(status<>'break' or break_started_at is not null),check(status<>'done' or ended_at is not null)`,
  daily_metrics: `id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),date date not null,metric_type text not null check(metric_type in ('calories','protein','movement_minutes','caffeine_count')),value double precision not null check(value between 0 and 20000),target double precision check(target between 0 and 20000),unit text not null check(length(unit)<=20),source text not null check(source in ('manual','health','external')),created_at timestamptz not null,updated_at timestamptz not null,unique(user_id,date,metric_type)`,
};
let sql = `-- Luki Home 0.2: additive migration, no business tables or production rows changed.
-- v1 RPCs remain available; their snapshot writes preserve v2 extension columns.
`;
for (const [table, columns] of Object.entries(schemas)) {
  sql += `create table luki_home.${table} (${columns});\nalter table luki_home.${table} enable row level security;\nrevoke all on luki_home.${table} from public,anon;\ngrant select,insert,update,delete on luki_home.${table} to authenticated;\n`;
  const owner = `user_id=(select auth.uid())`;
  const parent =
    table === "goal_milestones"
      ? ` and exists(select 1 from luki_home.goals g where g.id=goal_id and g.user_id=(select auth.uid()))`
      : "";
  sql += `create policy own_rows on luki_home.${table} to authenticated using (${owner}${parent}) with check (${owner}${parent});\ncreate index ${table}_owner_idx on luki_home.${table}(user_id);\n`;
}
sql += `create index milestones_goal_idx on luki_home.goal_milestones(user_id,goal_id,sort_order);
create unique index work_one_running on luki_home.work_sessions(user_id) where status<>'done';
alter table luki_home.tasks add column goal_id uuid;
alter table luki_home.tasks add constraint task_goal_owner foreign key(user_id,goal_id) references luki_home.goals(user_id,id);
create index tasks_goal_idx on luki_home.tasks(user_id,goal_id);
alter table luki_home.user_settings add column preferences jsonb not null default '{}'::jsonb check(jsonb_typeof(preferences)='object');
alter table luki_home.day_plans add column training_status text not null default 'open' check(training_status in ('open','planned','done'));
alter table luki_home.checkins add column movement_done boolean not null default false;
alter table luki_home.checkins add column training_done boolean not null default false;
alter table luki_home.checkins add column work_end_kept boolean not null default false;
`;
let core = readFileSync(
  "supabase/migrations/20261004000500_cloud_rpc.sql",
  "utf8",
);
core = core.slice(
  core.indexOf("create function public.luki_home_save_state"),
  core.indexOf("revoke all on function"),
);
core = core
  .replace("create function", "create or replace function")
  .replace(
    "current_revision bigint;",
    "current_revision bigint; previous_tasks jsonb; previous_days jsonb; previous_checkins jsonb;",
  );
core = core.replace(
  "  -- Full user snapshot replacement",
  `  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into previous_tasks from luki_home.tasks t where t.user_id=uid;
  select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into previous_days from luki_home.day_plans d where d.user_id=uid;
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into previous_checkins from luki_home.checkins c where c.user_id=uid;
  -- Full user snapshot replacement`,
);
core = core.replace(
  "  update luki_home.profiles set",
  `  update luki_home.tasks t set goal_id=(case when x ? 'goal_id' then x->>'goal_id' else (select q->>'goal_id' from jsonb_array_elements(previous_tasks) q where q->>'id'=x->>'id') end)::uuid from jsonb_array_elements(p_state->'tasks') x where t.user_id=uid and t.id=(x->>'id')::uuid;
  update luki_home.day_plans d set training_status=coalesce(x->>'training_status',(select q->>'training_status' from jsonb_array_elements(previous_days) q where q->>'id'=x->>'id'),'open') from jsonb_array_elements(p_state->'day_plans') x where d.user_id=uid and d.id=(x->>'id')::uuid;
  update luki_home.checkins c set movement_done=coalesce((x->>'movement_done')::boolean,(select (q->>'movement_done')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false), training_done=coalesce((x->>'training_done')::boolean,(select (q->>'training_done')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false), work_end_kept=coalesce((x->>'work_end_kept')::boolean,(select (q->>'work_end_kept')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false) from jsonb_array_elements(p_state->'checkins') x where c.user_id=uid and c.id=(x->>'id')::uuid;
  update luki_home.profiles set`,
);
sql += core;
sql += `create function public.luki_home_get_state_v2() returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); s jsonb;
begin
 s:=public.luki_home_get_state();
 s:=jsonb_set(s,'{settings,preferences}',(select preferences from luki_home.user_settings where user_id=uid));
`;
for (const table of Object.keys(schemas))
  sql += ` s:=s || jsonb_build_object('${table}',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.${table} t where user_id=uid),'[]'::jsonb));\n`;
sql += ` return s; end $$;
create function public.luki_home_save_state_v2(p_state jsonb,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); revision_now bigint;
begin
 if uid is null or (p_state->'profile'->>'user_id')::uuid is distinct from uid then raise exception 'Authentication required' using errcode='42501'; end if;
 select revision into revision_now from luki_home.profiles where user_id=uid for update;
 if not found or revision_now is distinct from p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
`;
// Append-only/upsert extensions: a v1 caller cannot erase unseen v2 data.
for (const [table, columns] of Object.entries(schemas)) {
  const names = columns
    .split(",")
    .map((x) => x.trim().split(" ")[0])
    .filter(
      (x) =>
        ![
          "unique(user_id",
          "id)",
          "foreign",
          "goal_id)",
          "check((status=",
        ].some((y) => x.startsWith(y)),
    );
  // Parse columns using the explicit leading name/type pairs only.
  const cols = [
    ...columns.matchAll(
      /(?:^|,)\s*(\w+)\s+(uuid|text|smallint|integer|boolean|date|timestamptz|double precision)\b/g,
    ),
  ].map((m) => m[1]);
  sql += ` if jsonb_typeof(p_state->'${table}') is distinct from 'array' then raise exception 'Missing extension ${table}' using errcode='22023'; end if;\n`;
  sql += ` if exists(select 1 from jsonb_array_elements(p_state->'${table}') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;\n`;
  sql += ` insert into luki_home.${table}(${cols.join(",")}) select ${cols.map((c) => (c === "user_id" ? "uid" : c)).join(",")} from jsonb_populate_recordset(null::luki_home.${table},p_state->'${table}') on conflict(id) do update set ${cols
    .filter((c) => !["id", "user_id"].includes(c))
    .map((c) => `${c}=excluded.${c}`)
    .join(",")};\n`;
  void names;
}
sql += ` perform public.luki_home_save_state(p_state,p_revision);
 if p_state->'settings' ? 'preferences' then update luki_home.user_settings set preferences=p_state->'settings'->'preferences' where user_id=uid; end if;
end $$;
revoke all on function public.luki_home_get_state_v2() from public,anon;
revoke all on function public.luki_home_save_state_v2(jsonb,bigint) from public,anon;
grant execute on function public.luki_home_get_state_v2() to authenticated;
grant execute on function public.luki_home_save_state_v2(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
`;
writeFileSync(path, sql);
console.log(path);
