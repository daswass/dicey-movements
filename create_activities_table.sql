create extension if not exists "uuid-ossp";

create table activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  timestamp timestamptz not null default now(),
  exercise_id integer not null,
  exercise_name text not null,
  reps integer not null,
  multiplier integer not null,
  dice_roll jsonb
); 