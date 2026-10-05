create table luki_home.anchor_definitions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references luki_home.profiles(user_id) on delete cascade,
  key text not null check(key in ('wake_up','morning_movement','coffee_rule','meal','work_end')),
  label text not null, description text not null default '' check(length(description) <= 2000), target_time time,
  enabled boolean not null default true, position smallint not null check(position between 0 and 4),
  unique(user_id,key), unique(user_id,id), unique(user_id,position)
);
create table luki_home.anchor_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, anchor_id uuid not null, local_date date not null,
  status text not null default 'pending' check(status in ('pending','done','skipped')), actual_local_time time, recorded_at timestamptz,
  note text not null default '' check(length(note) <= 2000), label_snapshot text not null, description_snapshot text not null,
  unique(user_id,anchor_id,local_date),
  foreign key(user_id,anchor_id) references luki_home.anchor_definitions(user_id,id) on delete restrict,
  check ((status = 'pending') = (recorded_at is null))
);
create index anchor_entries_day_idx on luki_home.anchor_entries(user_id,local_date);
