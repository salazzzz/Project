-- ===== Euro Detailing — full backend build =====
-- Owner: Eric (09d272a6-815d-4a83-a835-d4c653512b85)

-- ---- Extend bookings for Cal.com data ----
alter table bookings add column if not exists attendee_name text;
alter table bookings add column if not exists attendee_phone text;
alter table bookings add column if not exists attendee_email text;
alter table bookings add column if not exists service text;      -- interior | exterior | bundle
alter table bookings add column if not exists tier text;         -- basic | premium | maintenance | membership
alter table bookings add column if not exists size text;         -- sedan | suv | xl
alter table bookings add column if not exists est_minutes int;
alter table bookings add column if not exists ends_at timestamptz;
alter table bookings add column if not exists cal_status text;
alter table bookings add column if not exists title text;
create unique index if not exists bookings_cal_uid_uidx on bookings(cal_uid) where cal_uid is not null;

-- ---- Extend jobs for Start Detail flow ----
alter table jobs add column if not exists before_photos jsonb not null default '[]'::jsonb;
alter table jobs add column if not exists after_photos jsonb not null default '[]'::jsonb;
alter table jobs add column if not exists damage_photos jsonb not null default '[]'::jsonb;
alter table jobs add column if not exists est_minutes int;
alter table jobs add column if not exists charge_amount numeric;
alter table jobs add column if not exists status text default 'in_progress';
alter table jobs add column if not exists notes text;

-- ---- Services (editable pricing) ----
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  service text not null, tier text not null, size text not null,
  price numeric not null, est_minutes int not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner, service, tier, size)
);

-- ---- Add-ons ----
create table if not exists addons (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, price numeric not null default 0, active boolean not null default true
);

-- ---- SOP templates ----
create table if not exists sops (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  service text not null, tier text not null default 'all',
  steps jsonb not null default '[]'::jsonb,
  unique(owner, service, tier)
);

-- ---- Settings (one row per owner) ----
create table if not exists settings (
  owner uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb
);

-- ---- RLS ----
alter table services enable row level security;
alter table addons   enable row level security;
alter table sops     enable row level security;
alter table settings enable row level security;
do $$ begin create policy "own rows" on services for all to authenticated using (owner=auth.uid()) with check (owner=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own rows" on addons   for all to authenticated using (owner=auth.uid()) with check (owner=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own rows" on sops     for all to authenticated using (owner=auth.uid()) with check (owner=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own row"  on settings for all to authenticated using (owner=auth.uid()) with check (owner=auth.uid()); exception when duplicate_object then null; end $$;

-- ---- Realtime ----
do $$ begin alter publication supabase_realtime add table bookings; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table jobs;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table vehicles; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table services; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table sops;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table addons;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table settings; exception when others then null; end $$;

-- ===== Seed data =====
-- Services (real Euro Detailing prices)
insert into services (owner, service, tier, size, price, est_minutes) values
('09d272a6-815d-4a83-a835-d4c653512b85','interior','basic','sedan',90,120),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','basic','suv',105,120),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','basic','xl',120,150),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','premium','sedan',140,180),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','premium','suv',160,180),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','premium','xl',180,210),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','maintenance','sedan',115,180),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','maintenance','suv',135,180),
('09d272a6-815d-4a83-a835-d4c653512b85','interior','maintenance','xl',155,210),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','basic','sedan',60,60),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','basic','suv',75,60),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','basic','xl',85,70),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','premium','sedan',85,80),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','premium','suv',95,80),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','premium','xl',105,90),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','maintenance','sedan',70,80),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','maintenance','suv',80,80),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','maintenance','xl',90,90),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','basic','sedan',135,180),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','basic','suv',165,180),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','basic','xl',190,210),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','premium','sedan',210,240),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','premium','suv',240,270),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','premium','xl',270,300),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','maintenance','sedan',185,150),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','maintenance','suv',215,165),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','maintenance','xl',245,180)
on conflict (owner, service, tier, size) do nothing;

-- Add-ons
insert into addons (owner, name, price) values
('09d272a6-815d-4a83-a835-d4c653512b85','Engine Bay Detail',49.99),
('09d272a6-815d-4a83-a835-d4c653512b85','Seat Extraction',49.99),
('09d272a6-815d-4a83-a835-d4c653512b85','Pet Hair Removal',35),
('09d272a6-815d-4a83-a835-d4c653512b85','Plastic Mat Restoration',25),
('09d272a6-815d-4a83-a835-d4c653512b85','Headlight Restoration',34.99)
on conflict do nothing;

-- SOPs (editable defaults)
insert into sops (owner, service, tier, steps) values
('09d272a6-815d-4a83-a835-d4c653512b85','interior','all','[{"label":"Remove trash & personal items","minutes":5},{"label":"Blow out & vacuum seats, carpets, mats","minutes":20},{"label":"Shampoo & scrub carpets and mats","minutes":20},{"label":"Steam & extract seats","minutes":20},{"label":"Wipe down dash, console & panels","minutes":15},{"label":"Clean door jambs","minutes":5},{"label":"Interior glass","minutes":10},{"label":"Dress plastics/leather + fragrance","minutes":10},{"label":"Final inspection + after photos","minutes":5}]'::jsonb),
('09d272a6-815d-4a83-a835-d4c653512b85','exterior','all','[{"label":"Pre-rinse","minutes":5},{"label":"Foam cannon + wheels & tires","minutes":10},{"label":"Hand wash (contact)","minutes":15},{"label":"Decon / clay (premium)","minutes":15},{"label":"Dry with microfiber","minutes":10},{"label":"Sealant / wax","minutes":10},{"label":"Tire shine + trim dressing","minutes":5},{"label":"Final inspection + after photos","minutes":5}]'::jsonb),
('09d272a6-815d-4a83-a835-d4c653512b85','bundle','all','[{"label":"Exterior: pre-rinse, foam, wheels","minutes":15},{"label":"Exterior: hand wash + dry","minutes":25},{"label":"Exterior: sealant + tire shine","minutes":15},{"label":"Interior: vacuum seats, carpets, mats","minutes":20},{"label":"Interior: shampoo & steam","minutes":30},{"label":"Interior: wipe down + glass","minutes":20},{"label":"Dress + fragrance","minutes":10},{"label":"Final inspection + after photos","minutes":10}]'::jsonb)
on conflict (owner, service, tier) do nothing;

-- Settings (messages, business info)
insert into settings (owner, data) values
('09d272a6-815d-4a83-a835-d4c653512b85',
'{"messages":{"on_my_way":"Hey, this is Eric from Euro Detailing 🚗 — just letting you know I''m on my way to detail your car! See you soon.","wrapping_up":"Hey! We''re just wrapping up your detail 🧼✨ Your car will be ready shortly. Thanks for choosing Euro Detailing!"},"business":{"name":"Euro Detailing","owner":"Eric Salas","phone":"781-290-3040","area":"Newton, MA + surrounding","payments":["Cash","Venmo","Zelle","Cash App","Checks"]},"membership":{"price":209,"visits_per_month":2}}'::jsonb)
on conflict (owner) do nothing;

select 'done' as status;
