-- ============================================================
-- Euro Detailing — database schema
-- Run this once in Supabase → SQL Editor → New query → Run
-- ============================================================
create extension if not exists "pgcrypto";

-- ---- Tables ----
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  phone text, email text, location text, notes text,
  last_seen date,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid references clients on delete cascade,
  year text, make text, model text, color text, plate text, vin text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid references clients on delete set null,
  vehicle_id uuid references vehicles on delete set null,
  source text default 'manual',
  cal_uid text,
  service_type text,
  addons jsonb default '[]',
  scheduled_at timestamptz,
  status text default 'upcoming',
  price numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  booking_id uuid references bookings on delete cascade,
  client_id uuid references clients on delete set null,
  started_at timestamptz, finished_at timestamptz,
  duration_seconds int,
  checklist jsonb default '{}',
  sop jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid references clients on delete cascade,
  booking_id uuid references bookings on delete set null,
  amount numeric not null,
  paid_at date not null default current_date,
  method text default 'cash',
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid references clients on delete cascade,
  vehicle_id uuid references vehicles on delete set null,
  job_id uuid references jobs on delete set null,
  kind text default 'profile',
  path text not null,
  created_at timestamptz not null default now()
);

-- ---- Row-Level Security: each account sees only its own data ----
alter table clients  enable row level security;
alter table vehicles enable row level security;
alter table bookings enable row level security;
alter table jobs     enable row level security;
alter table payments enable row level security;
alter table photos   enable row level security;

create policy "own rows" on clients  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows" on vehicles for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows" on bookings for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows" on jobs     for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows" on payments for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows" on photos   for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- ---- Photo storage bucket ----
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

create policy "photos authed" on storage.objects for all to authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');
