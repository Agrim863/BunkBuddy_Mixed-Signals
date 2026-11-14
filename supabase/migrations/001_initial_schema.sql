-- BunkWise Initial PostgreSQL Schema & Row Level Security Policies
-- Compatible with Supabase Auth (auth.users)

create extension if not exists "pgcrypto";

-- 1. Public Users Profile Table (mirrors auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Student',
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger to auto-create public.users profile on Supabase Auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Student'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Semesters
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  institution_name text,
  mode text not null check (mode in ('fresh', 'ongoing')),
  start_date date not null,
  end_date date not null,
  tracking_start_date date not null,
  minimum_attendance numeric(5,4) not null default 0.7500
    check (minimum_attendance > 0 and minimum_attendance < 1),
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chk_semester_dates check (end_date >= start_date),
  constraint chk_tracking_date check (
    tracking_start_date >= start_date and tracking_start_date <= end_date
  )
);

create index if not exists idx_semesters_user on public.semesters(user_id);

alter table public.semesters enable row level security;

create policy "Users can manage their own semesters"
  on public.semesters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Subjects
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  code text not null,
  color text not null default '#6366F1',
  historical_conducted integer not null default 0 check (historical_conducted >= 0),
  historical_attended integer not null default 0 check (
    historical_attended >= 0 and historical_attended <= historical_conducted
  ),
  created_at timestamptz not null default now(),
  constraint uq_subject_code_per_semester unique (semester_id, code)
);

create index if not exists idx_subjects_semester on public.subjects(semester_id);

alter table public.subjects enable row level security;

create policy "Users can manage subjects in their semesters"
  on public.subjects for all
  using (
    exists (
      select 1 from public.semesters s
      where s.id = subjects.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.semesters s
      where s.id = subjects.semester_id and s.user_id = auth.uid()
    )
  );

-- 4. Timetable Entries
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  teaching_duration_minutes integer not null check (teaching_duration_minutes >= 1),
  attendance_units integer not null default 1 check (attendance_units >= 1 and attendance_units <= 12),
  session_type text not null default 'lecture' check (session_type in ('lecture', 'lab', 'tutorial')),
  constraint chk_timetable_times check (end_time > start_time)
);

create index if not exists idx_timetable_semester on public.timetable_entries(semester_id);
create index if not exists idx_timetable_subject on public.timetable_entries(subject_id);

alter table public.timetable_entries enable row level security;

create policy "Users can manage timetable entries in their semesters"
  on public.timetable_entries for all
  using (
    exists (
      select 1 from public.semesters s
      where s.id = timetable_entries.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.semesters s
      where s.id = timetable_entries.semester_id and s.user_id = auth.uid()
    )
  );

-- 5. Attendance Records (actual tracked + optional historical logs; simulations never touch this table)
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  timetable_entry_id uuid references public.timetable_entries(id) on delete set null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'cancelled', 'holiday', 'mass_bunk')),
  attendance_units integer not null default 1 check (attendance_units >= 1 and attendance_units <= 12),
  source text not null default 'tracked' check (source in ('tracked', 'historical_log')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_records_semester_date on public.attendance_records(semester_id, date);
create index if not exists idx_records_subject_date on public.attendance_records(subject_id, date);

-- Prevent duplicate tracked attendance records for the same slot & date
create unique index if not exists uq_tracked_slot_record
  on public.attendance_records(subject_id, date, timetable_entry_id)
  where source = 'tracked' and timetable_entry_id is not null;

alter table public.attendance_records enable row level security;

create policy "Users can manage attendance records in their semesters"
  on public.attendance_records for all
  using (
    exists (
      select 1 from public.semesters s
      where s.id = attendance_records.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.semesters s
      where s.id = attendance_records.semester_id and s.user_id = auth.uid()
    )
  );

-- 6. Academic Calendar Events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  date date not null,
  end_date date,
  event_type text not null check (
    event_type in (
      'teaching_day',
      'official_holiday',
      'semester_break',
      'examination',
      'college_event',
      'non_teaching_day',
      'cancelled_class'
    )
  ),
  title text not null,
  description text,
  affects_classes boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_calendar_end_date check (end_date is null or end_date >= date)
);

create index if not exists idx_calendar_semester_date on public.calendar_events(semester_id, date);

alter table public.calendar_events enable row level security;

create policy "Users can manage calendar events in their semesters"
  on public.calendar_events for all
  using (
    exists (
      select 1 from public.semesters s
      where s.id = calendar_events.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.semesters s
      where s.id = calendar_events.semester_id and s.user_id = auth.uid()
    )
  );
