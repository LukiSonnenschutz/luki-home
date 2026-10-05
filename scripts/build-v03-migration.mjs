// Offline authoring helper; the migration file was created by Supabase CLI.
import { readFileSync, writeFileSync } from "node:fs";
const path = "supabase/migrations/20261005110734_flexible_training_v03.sql";
const tables = {
  training_plans: [],
  workout_templates: [["training_plan_id", "training_plans", true]],
  workout_template_items: [["workout_template_id", "workout_templates", false]],
  scheduled_workouts: [["workout_template_id", "workout_templates", false]],
  workout_sessions: [
    ["workout_template_id", "workout_templates", true],
    ["scheduled_workout_id", "scheduled_workouts", true],
  ],
  workout_session_items: [
    ["workout_session_id", "workout_sessions", false],
    ["template_item_id", "workout_template_items", true],
  ],
  workout_sets: [["session_item_id", "workout_session_items", false]],
};
let sql = `-- Luki Home 0.3: additive training tables; no existing production rows are updated.
alter table luki_home.work_sessions add column planned_seconds integer check(planned_seconds between 1 and 14400), add column completed_by_timer boolean not null default false, add column was_reset boolean not null default false;
`;
for (const [name, parents] of Object.entries(tables)) {
  const cols = parents
    .map(
      ([col, parent, nullable]) =>
        `${col} uuid ${nullable ? "" : "not null"},foreign key(user_id,${col}) references luki_home.${parent}(user_id,id),check((data->>'${col}')::uuid is not distinct from ${col})`,
    )
    .join(",");
  const session =
    name === "workout_sessions"
      ? `,status text not null check(status in ('active','completed','cancelled')),completed_at timestamptz,check(data->>'status'=status),check((data->>'completed_at')::timestamptz is not distinct from completed_at),check((status='completed')=(completed_at is not null))`
      : "";
  sql += `create table luki_home.${name}(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id)${cols ? "," + cols : ""}${session});
alter table luki_home.${name} enable row level security;
revoke all on luki_home.${name} from public,anon;
grant select,insert,update,delete on luki_home.${name} to authenticated;
create policy own_rows on luki_home.${name} to authenticated using(user_id=(select auth.uid())${parents
    .filter((p) => !p[2])
    .map(
      ([col, parent]) =>
        ` and exists(select 1 from luki_home.${parent} p where p.id=${col} and p.user_id=(select auth.uid()))`,
    )
    .join("")}) with check(user_id=(select auth.uid())${parents
    .filter((p) => !p[2])
    .map(
      ([col, parent]) =>
        ` and exists(select 1 from luki_home.${parent} p where p.id=${col} and p.user_id=(select auth.uid()))`,
    )
    .join("")});
create index ${name}_owner_idx on luki_home.${name}(user_id);
`;
  for (const [col] of parents)
    sql += `create index ${name}_${col}_idx on luki_home.${name}(user_id,${col});\n`;
}
sql += `create unique index workout_sessions_one_active on luki_home.workout_sessions(user_id) where status='active';
create index scheduled_workouts_date_idx on luki_home.scheduled_workouts(user_id,(data->>'planned_date'));
create index workout_sets_number_idx on luki_home.workout_sets(user_id,session_item_id,((data->>'set_number')::integer));
-- Completed history is immutable even for direct authenticated API access.
create function luki_home.guard_training_history() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent_completed boolean;
begin
 if tg_table_name='workout_sessions' then
   parent_completed:=old.status='completed';
 elsif tg_table_name='workout_session_items' then
   select status='completed' into parent_completed from luki_home.workout_sessions where id in (new.workout_session_id,old.workout_session_id) and user_id=coalesce(new.user_id,old.user_id) order by (status='completed') desc limit 1;
 else
   select w.status='completed' into parent_completed from luki_home.workout_session_items i join luki_home.workout_sessions w on w.id=i.workout_session_id and w.user_id=i.user_id where i.id in (new.session_item_id,old.session_item_id) and i.user_id=coalesce(new.user_id,old.user_id) order by (w.status='completed') desc limit 1;
 end if;
 -- INSERT triggers also run before ON CONFLICT. Only an identical existing
 -- snapshot may reach its unchanged UPDATE; adding a new historical row fails.
 if parent_completed and tg_op='INSERT' then
   if tg_table_name='workout_session_items' and exists(select 1 from luki_home.workout_session_items where id=new.id and user_id=new.user_id and data=new.data) then return new;end if;
   if tg_table_name='workout_sets' and exists(select 1 from luki_home.workout_sets where id=new.id and user_id=new.user_id and data=new.data) then return new;end if;
 end if;
 if parent_completed and (tg_op='DELETE' or tg_op='INSERT' or new.data is distinct from old.data) then raise exception 'Completed training history is immutable' using errcode='23514';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function luki_home.guard_training_history() from public,anon;
grant execute on function luki_home.guard_training_history() to authenticated;
create trigger immutable_session before update or delete on luki_home.workout_sessions for each row execute function luki_home.guard_training_history();
create trigger immutable_session_item before insert or update or delete on luki_home.workout_session_items for each row execute function luki_home.guard_training_history();
create trigger immutable_workout_set before insert or update or delete on luki_home.workout_sets for each row execute function luki_home.guard_training_history();
`;
// Existing v2 writes preserve newer preference keys when an old client submits settings.
let v2 = readFileSync(
  "supabase/migrations/20261005073432_goals_stability_v02.sql",
  "utf8",
);
v2 = v2.slice(
  v2.indexOf("create function public.luki_home_save_state_v2"),
  v2.indexOf("revoke all on function public.luki_home_get_state_v2"),
);
sql += v2
  .replace("create function", "create or replace function")
  .replace(
    "set preferences=p_state->'settings'->'preferences'",
    "set preferences=preferences || (p_state->'settings'->'preferences')",
  );
sql += `create function public.luki_home_get_state_v3() returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid();s jsonb;
begin
s:=public.luki_home_get_state_v2();
`;
for (const name of Object.keys(tables))
  sql += `s:=s||jsonb_build_object('${name}',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.${name} where user_id=uid),'[]'::jsonb));\n`;
sql += `return s;end $$;
create function public.luki_home_save_state_v3(p_state jsonb,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid();revision_now bigint;
begin
if uid is null or (p_state->'profile'->>'user_id')::uuid is distinct from uid then raise exception 'Authentication required' using errcode='42501';end if;
select revision into revision_now from luki_home.profiles where user_id=uid for update;
if not found or revision_now is distinct from p_revision then raise exception 'Revision conflict' using errcode='40001';end if;
`;
for (const [name, parents] of Object.entries(tables)) {
  sql += `if jsonb_typeof(p_state->'${name}') is distinct from 'array' then raise exception 'Missing training collection ${name}' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'${name}') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
`;
  if (name === "workout_sessions")
    sql += `if exists(select 1 from jsonb_array_elements(p_state->'workout_sessions') x join luki_home.workout_sessions w on w.id=(x->>'id')::uuid and w.user_id=uid where w.status='completed' and w.data is distinct from x) then raise exception 'Completed training history is immutable' using errcode='23514';end if;\n`;
  const columns = [
    "id",
    "user_id",
    "data",
    ...parents.map((p) => p[0]),
    ...(name === "workout_sessions" ? ["status", "completed_at"] : []),
  ];
  const rowdata =
    name === "workout_sessions"
      ? `x||jsonb_build_object('status',case when x->>'status'='completed' then 'cancelled' else x->>'status' end,'completed_at',null)`
      : "x";
  const values = [
    `(x->>'id')::uuid`,
    "uid",
    rowdata,
    ...parents.map((p) => `(x->>'${p[0]}')::uuid`),
    ...(name === "workout_sessions"
      ? [
          `case when x->>'status'='completed' then 'cancelled' else x->>'status' end`,
          "null::timestamptz",
        ]
      : []),
  ];
  sql += `insert into luki_home.${name}(${columns.join(",")}) select ${values.join(",")} from jsonb_array_elements(p_state->'${name}') x on conflict(id) do update set ${columns
    .slice(2)
    .map((c) => `${c}=excluded.${c}`)
    .join(
      ",",
    )}${name === "workout_sessions" ? ` where ${name}.status<>'completed'` : ""};\n`;
}
sql += `update luki_home.workout_sessions w set data=x,status=x->>'status',completed_at=(x->>'completed_at')::timestamptz from jsonb_array_elements(p_state->'workout_sessions') x where w.id=(x->>'id')::uuid and w.user_id=uid and w.status<>'completed';
if exists(select 1 from luki_home.training_plans p cross join lateral jsonb_array_elements(p.data->'week') x where p.user_id=uid and not exists(select 1 from luki_home.workout_templates t where t.id=(x->>'template_id')::uuid and t.user_id=uid and t.training_plan_id=p.id)) then raise exception 'Invalid weekly template parent' using errcode='23514';end if;
perform public.luki_home_save_state_v2(p_state,p_revision);
update luki_home.work_sessions w set planned_seconds=coalesce((x->>'planned_seconds')::integer,w.planned_seconds),completed_by_timer=coalesce((x->>'completed_by_timer')::boolean,w.completed_by_timer),was_reset=coalesce((x->>'was_reset')::boolean,w.was_reset) from jsonb_array_elements(p_state->'work_sessions') x where w.id=(x->>'id')::uuid and w.user_id=uid;
end $$;
revoke all on function public.luki_home_get_state_v3() from public,anon;
revoke all on function public.luki_home_save_state_v3(jsonb,bigint) from public,anon;
grant execute on function public.luki_home_get_state_v3() to authenticated;
grant execute on function public.luki_home_save_state_v3(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
`;
writeFileSync(path, sql);
