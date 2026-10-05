-- Only Luki Home data is touched. No Luki OS table, auth setting, or user is changed.
create function public.luki_home_get_state() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into luki_home.profiles(user_id,display_name) values(uid,'Lukas') on conflict do nothing;
  perform 1 from luki_home.profiles where user_id=uid for update;
  insert into luki_home.user_settings(user_id) values(uid) on conflict do nothing;
  -- Seed only on first use; disabled anchors must never be re-enabled.
  insert into luki_home.anchor_definitions(user_id,key,label,description,target_time,position)
    select uid,key,label,description,target_time::time,position from (values
      ('wake_up','Aufstehen','Bewusst in den Tag starten.','08:00',0),
      ('morning_movement','Morgenbewegung','Eine kleine Bewegungseinheit, die heute zu dir passt.',null,1),
      ('coffee_rule','Kaffee-Regel','Trage deine persönliche Kaffee-Regel in den Einstellungen ein.',null,2),
      ('meal','Essen','Zeit für eine bewusste Mahlzeit.',null,3),
      ('work_end','Feierabend','Arbeit sichern und den Tag abschließen.','17:00',4)
    ) as defaults(key,label,description,target_time,position)
    where not exists(select 1 from luki_home.anchor_definitions where user_id=uid);
  select jsonb_build_object(
    'schema_version',1,'revision',p.revision,
    'profile',jsonb_build_object('user_id',uid,'display_name',p.display_name,'timezone',p.timezone),
    'settings',jsonb_build_object('work_end_target',to_char(s.work_end_target,'HH24:MI'),'movement_time',to_char(s.movement_time,'HH24:MI'),'checkin_time',to_char(s.checkin_time,'HH24:MI'),'rules',s.rule_settings),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from luki_home.tasks t where t.user_id=uid),'[]'::jsonb),
    'day_plans',coalesce((select jsonb_agg((to_jsonb(d)-'training_time') || jsonb_build_object('training_time',to_char(d.training_time,'HH24:MI'),'highlights',coalesce((select jsonb_agg(h.task_id order by h.position) from luki_home.day_task_highlights h where h.day_plan_id=d.id and h.user_id=uid),'[]'::jsonb)) order by d.local_date) from luki_home.day_plans d where d.user_id=uid),'[]'::jsonb),
    'anchor_definitions',coalesce((select jsonb_agg((to_jsonb(a)-'target_time') || jsonb_build_object('target_time',to_char(a.target_time,'HH24:MI')) order by a.position) from luki_home.anchor_definitions a where a.user_id=uid),'[]'::jsonb),
    'anchor_entries',coalesce((select jsonb_agg((to_jsonb(e)-'actual_local_time') || jsonb_build_object('actual_local_time',to_char(e.actual_local_time,'HH24:MI')) order by e.local_date,e.id) from luki_home.anchor_entries e where e.user_id=uid),'[]'::jsonb),
    'checkins',coalesce((select jsonb_agg(to_jsonb(c) order by c.local_date) from luki_home.checkins c where c.user_id=uid),'[]'::jsonb),
    'intervention_events',coalesce((select jsonb_agg(to_jsonb(i) order by i.local_date,i.rule_id) from luki_home.intervention_events i where i.user_id=uid),'[]'::jsonb)
  ) into result from luki_home.profiles p join luki_home.user_settings s using(user_id) where p.user_id=uid;
  return result;
end $$;

create function public.luki_home_save_state(p_state jsonb,p_revision bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint;
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
  update luki_home.profiles set display_name=p_state->'profile'->>'display_name', timezone=p_state->'profile'->>'timezone', revision=current_revision+1, updated_at=now() where user_id=uid;
  update luki_home.user_settings set work_end_target=(p_state->'settings'->>'work_end_target')::time, movement_time=(p_state->'settings'->>'movement_time')::time, checkin_time=(p_state->'settings'->>'checkin_time')::time, rule_settings=p_state->'settings'->'rules', updated_at=now() where user_id=uid;
end $$;

revoke all on function public.luki_home_get_state() from public,anon;
revoke all on function public.luki_home_save_state(jsonb,bigint) from public,anon;
grant execute on function public.luki_home_get_state() to authenticated;
grant execute on function public.luki_home_save_state(jsonb,bigint) to authenticated;
