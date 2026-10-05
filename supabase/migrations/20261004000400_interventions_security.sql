create table luki_home.intervention_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references luki_home.profiles(user_id) on delete cascade,
  local_date date not null, rule_id text not null check(rule_id in ('wake_up_late','movement_missing','work_end_due')),
  rule_version integer not null default 1, message_snapshot text not null,
  first_shown_at timestamptz, snoozed_until timestamptz, dismissed_at timestamptz,
  unique(user_id,local_date,rule_id)
);
do $$
declare tab text;
begin
  foreach tab in array array['profiles','user_settings','tasks','day_plans','day_task_highlights','anchor_definitions','anchor_entries','checkins','intervention_events'] loop
    execute format('alter table luki_home.%I enable row level security',tab);
    execute format('create policy own_rows on luki_home.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',tab);
    execute format('grant select, insert, update, delete on luki_home.%I to authenticated',tab);
    execute format('revoke all on luki_home.%I from anon',tab);
  end loop;
end $$;

grant usage on schema luki_home to authenticated;
