-- Luki Home 0.2: additive migration, no business tables or production rows changed.
-- v1 RPCs remain available; their snapshot writes preserve v2 extension columns.
create table luki_home.goals (id uuid primary key, user_id uuid not null references luki_home.profiles(user_id), title text not null check(length(trim(title)) between 1 and 200), why text not null check(length(why)<=2000), success_criteria text not null check(length(success_criteria)<=2000), category text not null check(category in ('Gesundheit & Körper','Beziehung & Familie','Firma','Abenteuer','Persönliche Entwicklung','Sonstiges')), priority smallint not null check(priority between 1 and 3), status text not null check(status in ('active','paused','achieved','discarded')), is_focus boolean not null, start_date date, target_date date, completed_at timestamptz, created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id), check(start_date is null or target_date is null or start_date<=target_date), check((status='achieved')=(completed_at is not null)));
alter table luki_home.goals enable row level security;
revoke all on luki_home.goals from public,anon;
grant select,insert,update,delete on luki_home.goals to authenticated;
create policy own_rows on luki_home.goals to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create index goals_owner_idx on luki_home.goals(user_id);
create table luki_home.goal_milestones (id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),goal_id uuid not null,title text not null check(length(trim(title)) between 1 and 200),description text not null check(length(description)<=2000),status text not null check(status in ('open','done')),due_date date,sort_order integer not null check(sort_order>=0),completed_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null,foreign key(user_id,goal_id) references luki_home.goals(user_id,id),check((status='done')=(completed_at is not null)));
alter table luki_home.goal_milestones enable row level security;
revoke all on luki_home.goal_milestones from public,anon;
grant select,insert,update,delete on luki_home.goal_milestones to authenticated;
create policy own_rows on luki_home.goal_milestones to authenticated using (user_id=(select auth.uid()) and exists(select 1 from luki_home.goals g where g.id=goal_id and g.user_id=(select auth.uid()))) with check (user_id=(select auth.uid()) and exists(select 1 from luki_home.goals g where g.id=goal_id and g.user_id=(select auth.uid())));
create index goal_milestones_owner_idx on luki_home.goal_milestones(user_id);
create table luki_home.coffee_entries (id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),consumed_at timestamptz not null,created_at timestamptz not null);
alter table luki_home.coffee_entries enable row level security;
revoke all on luki_home.coffee_entries from public,anon;
grant select,insert,update,delete on luki_home.coffee_entries to authenticated;
create policy own_rows on luki_home.coffee_entries to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create index coffee_entries_owner_idx on luki_home.coffee_entries(user_id);
create table luki_home.work_sessions (id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),local_date date not null,started_at timestamptz not null,ended_at timestamptz,planned_minutes integer not null check(planned_minutes between 5 and 240),planned_break_minutes integer not null check(planned_break_minutes between 5 and 60),actual_minutes double precision not null check(actual_minutes>=0 and actual_minutes<'Infinity'::float8),elapsed_seconds double precision not null check(elapsed_seconds>=0 and elapsed_seconds<'Infinity'::float8),focus_started_at timestamptz,status text not null check(status in ('active','paused','break','done')),break_started_at timestamptz,break_ended_at timestamptz,break_taken boolean not null,break_overrun boolean not null,created_at timestamptz not null,updated_at timestamptz not null,check((status='active')=(focus_started_at is not null)),check(status<>'break' or break_started_at is not null),check(status<>'done' or ended_at is not null));
alter table luki_home.work_sessions enable row level security;
revoke all on luki_home.work_sessions from public,anon;
grant select,insert,update,delete on luki_home.work_sessions to authenticated;
create policy own_rows on luki_home.work_sessions to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create index work_sessions_owner_idx on luki_home.work_sessions(user_id);
create table luki_home.daily_metrics (id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),date date not null,metric_type text not null check(metric_type in ('calories','protein','movement_minutes','caffeine_count')),value double precision not null check(value between 0 and 20000),target double precision check(target between 0 and 20000),unit text not null check(length(unit)<=20),source text not null check(source in ('manual','health','external')),created_at timestamptz not null,updated_at timestamptz not null,unique(user_id,date,metric_type));
alter table luki_home.daily_metrics enable row level security;
revoke all on luki_home.daily_metrics from public,anon;
grant select,insert,update,delete on luki_home.daily_metrics to authenticated;
create policy own_rows on luki_home.daily_metrics to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create index daily_metrics_owner_idx on luki_home.daily_metrics(user_id);
create index milestones_goal_idx on luki_home.goal_milestones(user_id,goal_id,sort_order);
create unique index work_one_running on luki_home.work_sessions(user_id) where status<>'done';
alter table luki_home.tasks add column goal_id uuid;
alter table luki_home.tasks add constraint task_goal_owner foreign key(user_id,goal_id) references luki_home.goals(user_id,id);
create index tasks_goal_idx on luki_home.tasks(user_id,goal_id);
alter table luki_home.user_settings add column preferences jsonb not null default '{}'::jsonb check(jsonb_typeof(preferences)='object');
alter table luki_home.day_plans add column training_status text not null default 'open' check(training_status in ('open','planned','done'));
alter table luki_home.checkins add column movement_done boolean not null default false;
alter table luki_home.checkins add column training_done boolean not null default false;
alter table luki_home.checkins add column work_end_kept boolean not null default false;
create or replace function public.luki_home_save_state(p_state jsonb,p_revision bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint; previous_tasks jsonb; previous_days jsonb; previous_checkins jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select revision into current_revision from luki_home.profiles where user_id=uid for update;
  if not found or current_revision is distinct from p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if p_state->>'schema_version' is distinct from '1' or (p_state->'profile'->>'user_id')::uuid is distinct from uid then raise exception 'Invalid owner or schema' using errcode='42501'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_state->'profile'->>'timezone') then raise exception 'Invalid timezone' using errcode='22023'; end if;
  if jsonb_array_length(p_state->'anchor_definitions') is distinct from 5 then raise exception 'Invalid anchor definitions' using errcode='22023'; end if;
  if not ((p_state->'settings'->'rules') ?& array['wake_up_late','movement_missing','work_end_due']) or
    jsonb_typeof(p_state->'settings'->'rules'->'wake_up_late') <> 'boolean' or
    jsonb_typeof(p_state->'settings'->'rules'->'movement_missing') <> 'boolean' or
    jsonb_typeof(p_state->'settings'->'rules'->'work_end_due') <> 'boolean' then raise exception 'Invalid rules' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into previous_tasks from luki_home.tasks t where t.user_id=uid;
  select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into previous_days from luki_home.day_plans d where d.user_id=uid;
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into previous_checkins from luki_home.checkins c where c.user_id=uid;
  -- Full user snapshot replacement is atomic and guarded by a locked revision.
  -- The small personal core has no pagination-dependent writes.
  delete from luki_home.day_task_highlights where user_id=uid;
  delete from luki_home.day_plans where user_id=uid;
  delete from luki_home.anchor_entries where user_id=uid;
  delete from luki_home.anchor_definitions where user_id=uid;
  delete from luki_home.tasks where user_id=uid;
  delete from luki_home.checkins where user_id=uid;
  delete from luki_home.intervention_events where user_id=uid;

  insert into luki_home.tasks(id,user_id,title,notes,due_date,status,completed_at,created_at,updated_at)
    select id,uid,title,notes,due_date,status,completed_at,created_at,updated_at from jsonb_to_recordset(p_state->'tasks') as x(id uuid,title text,notes text,due_date date,status text,completed_at timestamptz,created_at timestamptz,updated_at timestamptz);
  insert into luki_home.day_plans(id,user_id,local_date,focus_text,focus_task_id,training_note,training_time)
    select id,uid,local_date,focus_text,focus_task_id,training_note,training_time from jsonb_to_recordset(p_state->'day_plans') as x(id uuid,local_date date,focus_text text,focus_task_id uuid,training_note text,training_time time);
  insert into luki_home.day_task_highlights(user_id,day_plan_id,task_id,position)
    select uid,(d->>'id')::uuid,h.value::uuid,h.ordinality::smallint from jsonb_array_elements(p_state->'day_plans') d cross join lateral jsonb_array_elements_text(d->'highlights') with ordinality h(value,ordinality);
  insert into luki_home.anchor_definitions(id,user_id,key,label,description,target_time,enabled,position)
    select id,uid,key,label,description,target_time,enabled,position from jsonb_to_recordset(p_state->'anchor_definitions') as x(id uuid,key text,label text,description text,target_time time,enabled boolean,position smallint);
  insert into luki_home.anchor_entries(id,user_id,anchor_id,local_date,status,actual_local_time,recorded_at,note,label_snapshot,description_snapshot)
    select id,uid,anchor_id,local_date,status,actual_local_time,recorded_at,note,label_snapshot,description_snapshot from jsonb_to_recordset(p_state->'anchor_entries') as x(id uuid,anchor_id uuid,local_date date,status text,actual_local_time time,recorded_at timestamptz,note text,label_snapshot text,description_snapshot text);
  insert into luki_home.checkins(id,user_id,local_date,energy,mood,stress,helped_text,tomorrow_text,submitted_at,updated_at,created_at)
    select id,uid,local_date,energy,mood,stress,helped_text,tomorrow_text,submitted_at,updated_at,coalesce(created_at,updated_at) from jsonb_to_recordset(p_state->'checkins') as x(id uuid,local_date date,energy smallint,mood smallint,stress smallint,helped_text text,tomorrow_text text,submitted_at timestamptz,updated_at timestamptz,created_at timestamptz);
  insert into luki_home.intervention_events(id,user_id,local_date,rule_id,rule_version,message_snapshot,first_shown_at,snoozed_until,dismissed_at)
    select id,uid,local_date,rule_id,rule_version,message_snapshot,first_shown_at,snoozed_until,dismissed_at from jsonb_to_recordset(p_state->'intervention_events') as x(id uuid,local_date date,rule_id text,rule_version integer,message_snapshot text,first_shown_at timestamptz,snoozed_until timestamptz,dismissed_at timestamptz);
  update luki_home.tasks t set goal_id=(case when x ? 'goal_id' then x->>'goal_id' else (select q->>'goal_id' from jsonb_array_elements(previous_tasks) q where q->>'id'=x->>'id') end)::uuid from jsonb_array_elements(p_state->'tasks') x where t.user_id=uid and t.id=(x->>'id')::uuid;
  update luki_home.day_plans d set training_status=coalesce(x->>'training_status',(select q->>'training_status' from jsonb_array_elements(previous_days) q where q->>'id'=x->>'id'),'open') from jsonb_array_elements(p_state->'day_plans') x where d.user_id=uid and d.id=(x->>'id')::uuid;
  update luki_home.checkins c set movement_done=coalesce((x->>'movement_done')::boolean,(select (q->>'movement_done')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false), training_done=coalesce((x->>'training_done')::boolean,(select (q->>'training_done')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false), work_end_kept=coalesce((x->>'work_end_kept')::boolean,(select (q->>'work_end_kept')::boolean from jsonb_array_elements(previous_checkins) q where q->>'id'=x->>'id'),false) from jsonb_array_elements(p_state->'checkins') x where c.user_id=uid and c.id=(x->>'id')::uuid;
  update luki_home.profiles set display_name=p_state->'profile'->>'display_name', timezone=p_state->'profile'->>'timezone', revision=current_revision+1, updated_at=now() where user_id=uid;
  update luki_home.user_settings set work_end_target=(p_state->'settings'->>'work_end_target')::time, movement_time=(p_state->'settings'->>'movement_time')::time, checkin_time=(p_state->'settings'->>'checkin_time')::time, rule_settings=p_state->'settings'->'rules', updated_at=now() where user_id=uid;
end $$;

create function public.luki_home_get_state_v2() returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); s jsonb;
begin
 s:=public.luki_home_get_state();
 s:=jsonb_set(s,'{settings,preferences}',(select preferences from luki_home.user_settings where user_id=uid));
 s:=s || jsonb_build_object('goals',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.goals t where user_id=uid),'[]'::jsonb));
 s:=s || jsonb_build_object('goal_milestones',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.goal_milestones t where user_id=uid),'[]'::jsonb));
 s:=s || jsonb_build_object('coffee_entries',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.coffee_entries t where user_id=uid),'[]'::jsonb));
 s:=s || jsonb_build_object('work_sessions',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.work_sessions t where user_id=uid),'[]'::jsonb));
 s:=s || jsonb_build_object('daily_metrics',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.daily_metrics t where user_id=uid),'[]'::jsonb));
 return s; end $$;
create function public.luki_home_save_state_v2(p_state jsonb,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); revision_now bigint;
begin
 if uid is null or (p_state->'profile'->>'user_id')::uuid is distinct from uid then raise exception 'Authentication required' using errcode='42501'; end if;
 select revision into revision_now from luki_home.profiles where user_id=uid for update;
 if not found or revision_now is distinct from p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if jsonb_typeof(p_state->'goals') is distinct from 'array' then raise exception 'Missing extension goals' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'goals') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;
 insert into luki_home.goals(id,user_id,title,why,success_criteria,category,priority,status,is_focus,start_date,target_date,completed_at,created_at,updated_at) select id,uid,title,why,success_criteria,category,priority,status,is_focus,start_date,target_date,completed_at,created_at,updated_at from jsonb_populate_recordset(null::luki_home.goals,p_state->'goals') on conflict(id) do update set title=excluded.title,why=excluded.why,success_criteria=excluded.success_criteria,category=excluded.category,priority=excluded.priority,status=excluded.status,is_focus=excluded.is_focus,start_date=excluded.start_date,target_date=excluded.target_date,completed_at=excluded.completed_at,created_at=excluded.created_at,updated_at=excluded.updated_at;
 if jsonb_typeof(p_state->'goal_milestones') is distinct from 'array' then raise exception 'Missing extension goal_milestones' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'goal_milestones') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;
 insert into luki_home.goal_milestones(id,user_id,goal_id,title,description,status,due_date,sort_order,completed_at,created_at,updated_at) select id,uid,goal_id,title,description,status,due_date,sort_order,completed_at,created_at,updated_at from jsonb_populate_recordset(null::luki_home.goal_milestones,p_state->'goal_milestones') on conflict(id) do update set goal_id=excluded.goal_id,title=excluded.title,description=excluded.description,status=excluded.status,due_date=excluded.due_date,sort_order=excluded.sort_order,completed_at=excluded.completed_at,created_at=excluded.created_at,updated_at=excluded.updated_at;
 if jsonb_typeof(p_state->'coffee_entries') is distinct from 'array' then raise exception 'Missing extension coffee_entries' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'coffee_entries') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;
 insert into luki_home.coffee_entries(id,user_id,consumed_at,created_at) select id,uid,consumed_at,created_at from jsonb_populate_recordset(null::luki_home.coffee_entries,p_state->'coffee_entries') on conflict(id) do update set consumed_at=excluded.consumed_at,created_at=excluded.created_at;
 if jsonb_typeof(p_state->'work_sessions') is distinct from 'array' then raise exception 'Missing extension work_sessions' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'work_sessions') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;
 insert into luki_home.work_sessions(id,user_id,local_date,started_at,ended_at,planned_minutes,planned_break_minutes,actual_minutes,elapsed_seconds,focus_started_at,status,break_started_at,break_ended_at,break_taken,break_overrun,created_at,updated_at) select id,uid,local_date,started_at,ended_at,planned_minutes,planned_break_minutes,actual_minutes,elapsed_seconds,focus_started_at,status,break_started_at,break_ended_at,break_taken,break_overrun,created_at,updated_at from jsonb_populate_recordset(null::luki_home.work_sessions,p_state->'work_sessions') on conflict(id) do update set local_date=excluded.local_date,started_at=excluded.started_at,ended_at=excluded.ended_at,planned_minutes=excluded.planned_minutes,planned_break_minutes=excluded.planned_break_minutes,actual_minutes=excluded.actual_minutes,elapsed_seconds=excluded.elapsed_seconds,focus_started_at=excluded.focus_started_at,status=excluded.status,break_started_at=excluded.break_started_at,break_ended_at=excluded.break_ended_at,break_taken=excluded.break_taken,break_overrun=excluded.break_overrun,created_at=excluded.created_at,updated_at=excluded.updated_at;
 if jsonb_typeof(p_state->'daily_metrics') is distinct from 'array' then raise exception 'Missing extension daily_metrics' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'daily_metrics') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid row owner' using errcode='42501'; end if;
 insert into luki_home.daily_metrics(id,user_id,date,metric_type,value,target,unit,source,created_at,updated_at) select id,uid,date,metric_type,value,target,unit,source,created_at,updated_at from jsonb_populate_recordset(null::luki_home.daily_metrics,p_state->'daily_metrics') on conflict(id) do update set date=excluded.date,metric_type=excluded.metric_type,value=excluded.value,target=excluded.target,unit=excluded.unit,source=excluded.source,created_at=excluded.created_at,updated_at=excluded.updated_at;
 perform public.luki_home_save_state(p_state,p_revision);
 if p_state->'settings' ? 'preferences' then update luki_home.user_settings set preferences=p_state->'settings'->'preferences' where user_id=uid; end if;
end $$;
revoke all on function public.luki_home_get_state_v2() from public,anon;
revoke all on function public.luki_home_save_state_v2(jsonb,bigint) from public,anon;
grant execute on function public.luki_home_get_state_v2() to authenticated;
grant execute on function public.luki_home_save_state_v2(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
