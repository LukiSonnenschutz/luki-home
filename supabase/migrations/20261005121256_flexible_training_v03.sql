-- Luki Home 0.3: additive training tables; no existing production rows are updated.
alter table luki_home.work_sessions add column planned_seconds integer check(planned_seconds between 1 and 14400), add column completed_by_timer boolean not null default false, add column was_reset boolean not null default false;
create table luki_home.training_plans(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id));
alter table luki_home.training_plans enable row level security;
revoke all on luki_home.training_plans from public,anon;
grant select,insert,update,delete on luki_home.training_plans to authenticated;
create policy own_rows on luki_home.training_plans to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index training_plans_owner_idx on luki_home.training_plans(user_id);
create table luki_home.workout_templates(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),training_plan_id uuid ,foreign key(user_id,training_plan_id) references luki_home.training_plans(user_id,id),check((data->>'training_plan_id')::uuid is not distinct from training_plan_id));
alter table luki_home.workout_templates enable row level security;
revoke all on luki_home.workout_templates from public,anon;
grant select,insert,update,delete on luki_home.workout_templates to authenticated;
create policy own_rows on luki_home.workout_templates to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index workout_templates_owner_idx on luki_home.workout_templates(user_id);
create index workout_templates_training_plan_id_idx on luki_home.workout_templates(user_id,training_plan_id);
create table luki_home.workout_template_items(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),workout_template_id uuid not null,foreign key(user_id,workout_template_id) references luki_home.workout_templates(user_id,id),check((data->>'workout_template_id')::uuid is not distinct from workout_template_id));
alter table luki_home.workout_template_items enable row level security;
revoke all on luki_home.workout_template_items from public,anon;
grant select,insert,update,delete on luki_home.workout_template_items to authenticated;
create policy own_rows on luki_home.workout_template_items to authenticated using(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_templates p where p.id=workout_template_id and p.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_templates p where p.id=workout_template_id and p.user_id=(select auth.uid())));
create index workout_template_items_owner_idx on luki_home.workout_template_items(user_id);
create index workout_template_items_workout_template_id_idx on luki_home.workout_template_items(user_id,workout_template_id);
create table luki_home.scheduled_workouts(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),workout_template_id uuid not null,foreign key(user_id,workout_template_id) references luki_home.workout_templates(user_id,id),check((data->>'workout_template_id')::uuid is not distinct from workout_template_id));
alter table luki_home.scheduled_workouts enable row level security;
revoke all on luki_home.scheduled_workouts from public,anon;
grant select,insert,update,delete on luki_home.scheduled_workouts to authenticated;
create policy own_rows on luki_home.scheduled_workouts to authenticated using(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_templates p where p.id=workout_template_id and p.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_templates p where p.id=workout_template_id and p.user_id=(select auth.uid())));
create index scheduled_workouts_owner_idx on luki_home.scheduled_workouts(user_id);
create index scheduled_workouts_workout_template_id_idx on luki_home.scheduled_workouts(user_id,workout_template_id);
create table luki_home.workout_sessions(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),workout_template_id uuid ,foreign key(user_id,workout_template_id) references luki_home.workout_templates(user_id,id),check((data->>'workout_template_id')::uuid is not distinct from workout_template_id),scheduled_workout_id uuid ,foreign key(user_id,scheduled_workout_id) references luki_home.scheduled_workouts(user_id,id),check((data->>'scheduled_workout_id')::uuid is not distinct from scheduled_workout_id),status text not null check(status in ('active','completed','cancelled')),completed_at timestamptz,check(data->>'status'=status),check((data->>'completed_at')::timestamptz is not distinct from completed_at),check((status='completed')=(completed_at is not null)));
alter table luki_home.workout_sessions enable row level security;
revoke all on luki_home.workout_sessions from public,anon;
grant select,insert,update,delete on luki_home.workout_sessions to authenticated;
create policy own_rows on luki_home.workout_sessions to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index workout_sessions_owner_idx on luki_home.workout_sessions(user_id);
create index workout_sessions_workout_template_id_idx on luki_home.workout_sessions(user_id,workout_template_id);
create index workout_sessions_scheduled_workout_id_idx on luki_home.workout_sessions(user_id,scheduled_workout_id);
create table luki_home.workout_session_items(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),workout_session_id uuid not null,foreign key(user_id,workout_session_id) references luki_home.workout_sessions(user_id,id),check((data->>'workout_session_id')::uuid is not distinct from workout_session_id),template_item_id uuid ,foreign key(user_id,template_item_id) references luki_home.workout_template_items(user_id,id),check((data->>'template_item_id')::uuid is not distinct from template_item_id));
alter table luki_home.workout_session_items enable row level security;
revoke all on luki_home.workout_session_items from public,anon;
grant select,insert,update,delete on luki_home.workout_session_items to authenticated;
create policy own_rows on luki_home.workout_session_items to authenticated using(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_sessions p where p.id=workout_session_id and p.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_sessions p where p.id=workout_session_id and p.user_id=(select auth.uid())));
create index workout_session_items_owner_idx on luki_home.workout_session_items(user_id);
create index workout_session_items_workout_session_id_idx on luki_home.workout_session_items(user_id,workout_session_id);
create index workout_session_items_template_item_id_idx on luki_home.workout_session_items(user_id,template_item_id);
create table luki_home.workout_sets(id uuid primary key,user_id uuid not null references luki_home.profiles(user_id),data jsonb not null check(jsonb_typeof(data)='object'),unique(user_id,id),check((data->>'id')::uuid is not distinct from id),check((data->>'user_id')::uuid is not distinct from user_id),session_item_id uuid not null,foreign key(user_id,session_item_id) references luki_home.workout_session_items(user_id,id),check((data->>'session_item_id')::uuid is not distinct from session_item_id));
alter table luki_home.workout_sets enable row level security;
revoke all on luki_home.workout_sets from public,anon;
grant select,insert,update,delete on luki_home.workout_sets to authenticated;
create policy own_rows on luki_home.workout_sets to authenticated using(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_session_items p where p.id=session_item_id and p.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from luki_home.workout_session_items p where p.id=session_item_id and p.user_id=(select auth.uid())));
create index workout_sets_owner_idx on luki_home.workout_sets(user_id);
create index workout_sets_session_item_id_idx on luki_home.workout_sets(user_id,session_item_id);
create unique index workout_sessions_one_active on luki_home.workout_sessions(user_id) where status='active';
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
create or replace function public.luki_home_save_state_v2(p_state jsonb,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
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
 if p_state->'settings' ? 'preferences' then update luki_home.user_settings set preferences=preferences || (p_state->'settings'->'preferences') where user_id=uid; end if;
end $$;
create function public.luki_home_get_state_v3() returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid();s jsonb;
begin
s:=public.luki_home_get_state_v2();
s:=s||jsonb_build_object('training_plans',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.training_plans where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('workout_templates',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.workout_templates where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('workout_template_items',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.workout_template_items where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('scheduled_workouts',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.scheduled_workouts where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('workout_sessions',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.workout_sessions where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('workout_session_items',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.workout_session_items where user_id=uid),'[]'::jsonb));
s:=s||jsonb_build_object('workout_sets',coalesce((select jsonb_agg(data order by data->>'created_at',id) from luki_home.workout_sets where user_id=uid),'[]'::jsonb));
return s;end $$;
create function public.luki_home_save_state_v3(p_state jsonb,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid();revision_now bigint;
begin
if uid is null or (p_state->'profile'->>'user_id')::uuid is distinct from uid then raise exception 'Authentication required' using errcode='42501';end if;
select revision into revision_now from luki_home.profiles where user_id=uid for update;
if not found or revision_now is distinct from p_revision then raise exception 'Revision conflict' using errcode='40001';end if;
if jsonb_typeof(p_state->'training_plans') is distinct from 'array' then raise exception 'Missing training collection training_plans' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'training_plans') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.training_plans(id,user_id,data) select (x->>'id')::uuid,uid,x from jsonb_array_elements(p_state->'training_plans') x on conflict(id) do update set data=excluded.data;
if jsonb_typeof(p_state->'workout_templates') is distinct from 'array' then raise exception 'Missing training collection workout_templates' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_templates') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.workout_templates(id,user_id,data,training_plan_id) select (x->>'id')::uuid,uid,x,(x->>'training_plan_id')::uuid from jsonb_array_elements(p_state->'workout_templates') x on conflict(id) do update set data=excluded.data,training_plan_id=excluded.training_plan_id;
if jsonb_typeof(p_state->'workout_template_items') is distinct from 'array' then raise exception 'Missing training collection workout_template_items' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_template_items') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.workout_template_items(id,user_id,data,workout_template_id) select (x->>'id')::uuid,uid,x,(x->>'workout_template_id')::uuid from jsonb_array_elements(p_state->'workout_template_items') x on conflict(id) do update set data=excluded.data,workout_template_id=excluded.workout_template_id;
if jsonb_typeof(p_state->'scheduled_workouts') is distinct from 'array' then raise exception 'Missing training collection scheduled_workouts' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'scheduled_workouts') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.scheduled_workouts(id,user_id,data,workout_template_id) select (x->>'id')::uuid,uid,x,(x->>'workout_template_id')::uuid from jsonb_array_elements(p_state->'scheduled_workouts') x on conflict(id) do update set data=excluded.data,workout_template_id=excluded.workout_template_id;
if jsonb_typeof(p_state->'workout_sessions') is distinct from 'array' then raise exception 'Missing training collection workout_sessions' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_sessions') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_sessions') x join luki_home.workout_sessions w on w.id=(x->>'id')::uuid and w.user_id=uid where w.status='completed' and w.data is distinct from x) then raise exception 'Completed training history is immutable' using errcode='23514';end if;
insert into luki_home.workout_sessions(id,user_id,data,workout_template_id,scheduled_workout_id,status,completed_at) select (x->>'id')::uuid,uid,x||jsonb_build_object('status',case when x->>'status'='completed' then 'cancelled' else x->>'status' end,'completed_at',null),(x->>'workout_template_id')::uuid,(x->>'scheduled_workout_id')::uuid,case when x->>'status'='completed' then 'cancelled' else x->>'status' end,null::timestamptz from jsonb_array_elements(p_state->'workout_sessions') x on conflict(id) do update set data=excluded.data,workout_template_id=excluded.workout_template_id,scheduled_workout_id=excluded.scheduled_workout_id,status=excluded.status,completed_at=excluded.completed_at where workout_sessions.status<>'completed';
if jsonb_typeof(p_state->'workout_session_items') is distinct from 'array' then raise exception 'Missing training collection workout_session_items' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_session_items') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.workout_session_items(id,user_id,data,workout_session_id,template_item_id) select (x->>'id')::uuid,uid,x,(x->>'workout_session_id')::uuid,(x->>'template_item_id')::uuid from jsonb_array_elements(p_state->'workout_session_items') x on conflict(id) do update set data=excluded.data,workout_session_id=excluded.workout_session_id,template_item_id=excluded.template_item_id;
if jsonb_typeof(p_state->'workout_sets') is distinct from 'array' then raise exception 'Missing training collection workout_sets' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_state->'workout_sets') x where (x->>'user_id')::uuid is distinct from uid) then raise exception 'Invalid training owner' using errcode='42501';end if;
insert into luki_home.workout_sets(id,user_id,data,session_item_id) select (x->>'id')::uuid,uid,x,(x->>'session_item_id')::uuid from jsonb_array_elements(p_state->'workout_sets') x on conflict(id) do update set data=excluded.data,session_item_id=excluded.session_item_id;
update luki_home.workout_sessions w set data=x,status=x->>'status',completed_at=(x->>'completed_at')::timestamptz from jsonb_array_elements(p_state->'workout_sessions') x where w.id=(x->>'id')::uuid and w.user_id=uid and w.status<>'completed';
if exists(select 1 from luki_home.training_plans p cross join lateral jsonb_array_elements(p.data->'week') x where p.user_id=uid and not exists(select 1 from luki_home.workout_templates t where t.id=(x->>'template_id')::uuid and t.user_id=uid and t.training_plan_id=p.id)) then raise exception 'Invalid weekly template parent' using errcode='23514';end if;
perform public.luki_home_save_state_v2(p_state,p_revision);
update luki_home.work_sessions w set planned_seconds=coalesce((x->>'planned_seconds')::integer,w.planned_seconds),completed_by_timer=coalesce((x->>'completed_by_timer')::boolean,w.completed_by_timer),was_reset=coalesce((x->>'was_reset')::boolean,w.was_reset) from jsonb_array_elements(p_state->'work_sessions') x where w.id=(x->>'id')::uuid and w.user_id=uid;
end $$;
revoke all on function public.luki_home_get_state_v3() from public,anon;
revoke all on function public.luki_home_save_state_v3(jsonb,bigint) from public,anon;
grant execute on function public.luki_home_get_state_v3() to authenticated;
grant execute on function public.luki_home_save_state_v3(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
