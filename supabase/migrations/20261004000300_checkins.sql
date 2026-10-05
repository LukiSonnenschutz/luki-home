create table luki_home.checkins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references luki_home.profiles(user_id) on delete cascade, local_date date not null,
  energy smallint check(energy between 1 and 5), mood smallint check(mood between 1 and 5), stress smallint check(stress between 1 and 5),
  helped_text text not null default '' check(length(helped_text) <= 2000), tomorrow_text text not null default '' check(length(tomorrow_text) <= 2000),
  submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,local_date), check(submitted_at is null or (energy is not null and mood is not null and stress is not null))
);
