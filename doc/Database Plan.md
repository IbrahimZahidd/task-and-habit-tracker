# Database Schema and Functions for Habit Tracker

## 0. Enable Required Extensions

```sql
create extension if not exists "uuid-ossp";

create or replace function plpgsql_trigger_update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type task_status as enum ('pending', 'in_progress', 'completed');
create type goal_type_enum as enum ('daily', 'weekly', 'monthly');

create or replace function is_owner(uid uuid, owner_id uuid)
returns boolean as $$
  select uid = owner_id;
$$ language sql immutable;

create table profiles (
  id uuid primary key references auth.users not null,
  full_name text,
  timezone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create trigger trigger_update_profiles_timestamp
  before update on profiles
  for each row execute procedure plpgsql_trigger_update_timestamp();

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'pending',
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create trigger trigger_update_tasks_timestamp
  before update on tasks
  for each row execute procedure plpgsql_trigger_update_timestamp();

create table habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  goal_type goal_type_enum not null default 'daily',
  goal_target int check (goal_target > 0) default 1,
  color varchar(7),
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create trigger trigger_update_habits_timestamp
  before update on habits
  for each row execute procedure plpgsql_trigger_update_timestamp();

create table habit_events (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  event_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null,
  unique (habit_id, event_date)
);

create trigger trigger_update_habit_events_timestamp
  before update on habit_events
  for each row execute procedure plpgsql_trigger_update_timestamp();

create table app_metadata (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trigger_update_app_metadata_timestamp
  before update on app_metadata
  for each row execute procedure plpgsql_trigger_update_timestamp();

create or replace function public.handle_new_user()
returns trigger as $$
declare
  full_name text;
  avatar_url text;
begin
  full_name := new.raw_user_meta_data->>'full_name';
  if full_name is null then
    full_name := new.raw_user_meta_data->>'name';
  end if;

  avatar_url := new.raw_user_meta_data->>'avatar_url';
  if avatar_url is null then
    avatar_url := new.raw_user_meta_data->>'picture';
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, full_name, avatar_url);

  return new;
end;
$$ language plpgsql security definer;

-- Create Trigger on auth.users
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table habits enable row level security;
alter table habit_events enable row level security;
alter table app_metadata enable row level security;

create policy select_profiles on profiles
  for select using (auth.uid() = id);
create policy update_profiles on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy select_tasks on tasks
  for select using (is_owner(auth.uid(), user_id));
create policy insert_tasks on tasks
  for insert with check (is_owner(auth.uid(), user_id));
create policy update_tasks on tasks
  for update using (is_owner(auth.uid(), user_id)) with check (is_owner(auth.uid(), user_id));
create policy delete_tasks on tasks
  for delete using (is_owner(auth.uid(), user_id));

create policy select_habits on habits
  for select using (is_owner(auth.uid(), user_id));
create policy insert_habits on habits
  for insert with check (is_owner(auth.uid(), user_id));
create policy update_habits on habits
  for update using (is_owner(auth.uid(), user_id)) with check (is_owner(auth.uid(), user_id));
create policy delete_habits on habits
  for delete using (is_owner(auth.uid(), user_id));

create policy select_habit_events on habit_events
  for select using (is_owner(auth.uid(), user_id));
create policy insert_habit_events on habit_events
  for insert with check (is_owner(auth.uid(), user_id));
create policy update_habit_events on habit_events
  for update using (is_owner(auth.uid(), user_id)) with check (is_owner(auth.uid(), user_id));
create policy delete_habit_events on habit_events
  for delete using (is_owner(auth.uid(), user_id));

create index idx_tasks_user_status on tasks(user_id, status) where deleted_at is null;
create index idx_active_habits_user on habits(user_id) where deleted_at is null;
create index idx_habit_events_user_date on habit_events(user_id, event_date) where deleted_at is null;
create index idx_habit_events_habit_date on habit_events(habit_id, event_date) where deleted_at is null;

CREATE OR REPLACE FUNCTION get_habit_streak(habit_id uuid)
RETURNS TABLE (
  current_streak integer,
  longest_streak integer,
  total_completions bigint,
  last_completion_date date,
  streak_start_date date
) AS $$
DECLARE
  completed_dates date[];
  current_streak_count integer := 0;
  longest_streak_count integer := 0;
  temp_streak integer := 0;
  last_date date;
  streak_start date;
BEGIN
  -- Get all completed dates for this habit, ordered by date
  SELECT ARRAY_AGG(event_date ORDER BY event_date) INTO completed_dates
  FROM habit_events
  WHERE habit_events.habit_id = $1
    AND deleted_at IS NULL;

  -- If no completions, return zeros
  IF completed_dates IS NULL OR array_length(completed_dates, 1) = 0 THEN
    RETURN QUERY SELECT 0, 0, 0::bigint, NULL::date, NULL::date;
    RETURN;
  END IF;

  -- Calculate current streak (from most recent date backwards)
  last_date := completed_dates[array_length(completed_dates, 1)];
  current_streak_count := 1;
  streak_start := last_date;

  FOR i IN REVERSE array_length(completed_dates, 1)-1..1 LOOP
    IF completed_dates[i] = (last_date - INTERVAL '1 day')::date THEN
      current_streak_count := current_streak_count + 1;
      streak_start := completed_dates[i];
      last_date := completed_dates[i];
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Calculate longest streak
  temp_streak := 1;
  FOR i IN 2..array_length(completed_dates, 1) LOOP
    IF completed_dates[i] = (completed_dates[i-1] + INTERVAL '1 day')::date THEN
      temp_streak := temp_streak + 1;
    ELSE
      longest_streak_count := GREATEST(longest_streak_count, temp_streak);
      temp_streak := 1;
    END IF;
  END LOOP;
  longest_streak_count := GREATEST(longest_streak_count, temp_streak);

  RETURN QUERY SELECT
    current_streak_count,
    longest_streak_count,
    array_length(completed_dates, 1)::bigint,
    completed_dates[array_length(completed_dates, 1)],
    streak_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_completion_rate(
  habit_id uuid,
  period_start date,
  period_end date
)
RETURNS TABLE (
  completion_rate numeric,
  total_days integer,
  completed_days bigint,
  period_start_date date,
  period_end_date date
) AS $$
DECLARE
  total_days_in_period integer;
  completed_days_count bigint;
BEGIN
  -- Calculate total days in period
  total_days_in_period := (period_end - period_start + 1)::integer;

  -- Count completed days in period
  SELECT COUNT(*) INTO completed_days_count
  FROM habit_events
  WHERE habit_events.habit_id = $1
    AND event_date BETWEEN period_start AND period_end
    AND deleted_at IS NULL;

  RETURN QUERY SELECT
    CASE
      WHEN total_days_in_period > 0 THEN
        ROUND((completed_days_count::numeric / total_days_in_period::numeric) * 100, 2)
      ELSE 0
    END,
    total_days_in_period,
    completed_days_count,
    period_start,
    period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_analytics_summary(user_id uuid)
RETURNS TABLE (
  total_habits bigint,
  active_habits bigint,
  average_completion_rate numeric,
  total_current_streaks integer,
  longest_overall_streak integer,
  most_consistent_habit_id uuid,
  most_consistent_habit_name text,
  most_consistent_habit_rate numeric
) AS $$
DECLARE
  total_habits_count bigint;
  active_habits_count bigint;
  avg_completion_rate numeric;
  total_streaks integer := 0;
  longest_streak integer := 0;
  best_habit_id uuid;
  best_habit_name text;
  best_habit_rate numeric;
  habit_record RECORD;
BEGIN
  -- Count total and active habits
  SELECT COUNT(*) INTO total_habits_count
  FROM habits
  WHERE habits.user_id = $1 AND habits.deleted_at IS NULL;

  SELECT COUNT(*) INTO active_habits_count
  FROM habits
  WHERE habits.user_id = $1 AND habits.is_active = true AND habits.deleted_at IS NULL;

  -- Calculate average completion rate and find most consistent habit
  avg_completion_rate := 0;
  best_habit_rate := 0;

  FOR habit_record IN
    SELECT h.id, h.name, cr.completion_rate
    FROM habits h
    JOIN LATERAL get_completion_rate(h.id, (CURRENT_DATE - INTERVAL '30 days')::date, CURRENT_DATE)
 cr ON true
    WHERE h.user_id = $1 AND h.is_active = true AND h.deleted_at IS NULL
  LOOP
    avg_completion_rate := avg_completion_rate + COALESCE(habit_record.completion_rate, 0);

    IF COALESCE(habit_record.completion_rate, 0) > best_habit_rate THEN
      best_habit_rate := habit_record.completion_rate;
      best_habit_id := habit_record.id;
      best_habit_name := habit_record.name;
    END IF;
  END LOOP;

  -- Calculate average
  IF active_habits_count > 0 THEN
    avg_completion_rate := avg_completion_rate / active_habits_count;
  END IF;

  -- Calculate total current streaks and longest overall streak
  FOR habit_record IN
    SELECT gs.current_streak, gs.longest_streak
    FROM habits h
    CROSS JOIN LATERAL get_habit_streak(h.id) AS gs
    WHERE h.user_id = $1 AND h.is_active = true AND h.deleted_at IS NULL
  LOOP
    total_streaks := total_streaks + COALESCE(habit_record.current_streak, 0);
    longest_streak := GREATEST(longest_streak, COALESCE(habit_record.longest_streak, 0));
  END LOOP;

  RETURN QUERY SELECT
    total_habits_count,
    active_habits_count,
    ROUND(avg_completion_rate, 2),
    total_streaks,
    longest_streak,
    best_habit_id,
    best_habit_name,
    ROUND(best_habit_rate, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_habit_trends(
  user_id uuid,
  days_back integer DEFAULT 30
)
RETURNS TABLE (
  habit_id uuid,
  habit_name text,
  habit_color text,
  event_date date,
  completed boolean,
  streak_count integer -- Note: This is the current streak as of today, repeated per date
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id as habit_id,
    h.name as habit_name,
    h.color::text as habit_color,
    d.date as event_date,
    CASE WHEN he.event_date IS NOT NULL THEN true ELSE false END as completed,
    gs.current_streak as streak_count
  FROM habits h
  CROSS JOIN (
    SELECT generate_series(
      CURRENT_DATE - (days_back - 1) * INTERVAL '1 day',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date as date
  ) d
  LEFT JOIN habit_events he ON h.id = he.habit_id
    AND he.event_date = d.date
    AND he.deleted_at IS NULL
  CROSS JOIN LATERAL get_habit_streak(h.id) gs
  WHERE h.user_id = $1
    AND h.is_active = true
    AND h.deleted_at IS NULL
  ORDER BY h.name, d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE habits;
ALTER PUBLICATION supabase_realtime ADD TABLE habit_events;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```
