create schema if not exists luki_home;
-- Prepared cloud schema. Local 0.1 uses the authenticated SQLite adapter.
create table luki_home.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check(revision >= 0), display_name text not null check (length(display_name) between 1 and 200),
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table luki_home.user_settings (
  user_id uuid primary key references luki_home.profiles(user_id) on delete cascade,
  work_end_target time not null default '17:00', movement_time time not null default '14:00', checkin_time time not null default '20:30',
  rule_settings jsonb not null default '{"wake_up_late":true,"movement_missing":true,"work_end_due":true}',
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(rule_settings) = 'object')
);
create table luki_home.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references luki_home.profiles(user_id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200), notes text not null default '' check (length(notes) <= 2000), due_date date,
  status text not null default 'open' check (status in ('open','done')), completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,id), check ((status = 'done') = (completed_at is not null))
);
create table luki_home.day_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references luki_home.profiles(user_id) on delete cascade,
  local_date date not null, focus_text text not null default '' check(length(focus_text) <= 200), focus_task_id uuid,
  training_note text not null default '' check(length(training_note) <= 200), training_time time,
  unique(user_id, local_date), unique(user_id,id),
  foreign key(user_id, focus_task_id) references luki_home.tasks(user_id,id) on delete set null (focus_task_id)
);
create table luki_home.day_task_highlights (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  day_plan_id uuid not null, task_id uuid not null, position smallint not null check(position between 1 and 3),
  foreign key(user_id, day_plan_id) references luki_home.day_plans(user_id,id) on delete cascade,
  foreign key(user_id, task_id) references luki_home.tasks(user_id,id) on delete cascade,
  unique(day_plan_id,task_id), unique(day_plan_id,position)
);
create index tasks_open_due_idx on luki_home.tasks(user_id,due_date) where status = 'open';
