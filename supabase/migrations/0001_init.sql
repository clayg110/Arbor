-- Arbor — initial schema
-- Apply via Supabase SQL editor or `supabase db push`.

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type sector_enum as enum (
    'chemicals','industrials','agriculture','specialty_materials',
    'energy_fuels','pharma_inputs','consumer_coatings'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_type_enum as enum ('carveout','private_asset');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stage_enum as enum ('in_market','monitor_for_exit','on_hold','pulled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_enum as enum ('high','medium','low','needs_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type changed_by_enum as enum ('system_auto','analyst_manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_type_enum as enum (
    'sec_filing','earnings_transcript','google_news','rss_feed','manual'
  );
exception when duplicate_object then null; end $$;

-- ---------- companies ----------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector sector_enum,
  deal_type deal_type_enum,
  sponsor_firm text,
  parent_company text,
  description text,
  confidence confidence_enum default 'medium',
  current_stage stage_enum default 'in_market',
  current_stage_since timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- deal_stage_history ----------
create table if not exists public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  stage stage_enum not null,
  changed_at timestamptz default now(),
  changed_by changed_by_enum default 'system_auto',
  source_url text,
  source_type source_type_enum default 'manual',
  notes text,
  confidence confidence_enum
);
create index if not exists idx_dsh_company on public.deal_stage_history(company_id);
create index if not exists idx_dsh_changed_at on public.deal_stage_history(changed_at desc);

-- ---------- signals_raw ----------
create table if not exists public.signals_raw (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  raw_text text,
  source_url text,
  source_type source_type_enum default 'manual',
  ingested_at timestamptz default now(),
  processed boolean default false,
  llm_output jsonb,
  matched_company_id uuid
);
create index if not exists idx_signals_company on public.signals_raw(company_id);

-- ---------- watchlist ----------
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, company_id)
);

-- ---------- analyst_notes ----------
create table if not exists public.analyst_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text,
  created_at timestamptz default now()
);
create index if not exists idx_notes_company on public.analyst_notes(company_id);

-- ---------- llm_usage (referenced by extract-signal util, deferred) ----------
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  source_type source_type_enum,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz default now()
);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Keep current_stage_since fresh when stage changes.
create or replace function public.bump_stage_since()
returns trigger as $$
begin
  if new.current_stage is distinct from old.current_stage then
    new.current_stage_since = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_stage_since on public.companies;
create trigger trg_companies_stage_since
  before update on public.companies
  for each row execute function public.bump_stage_since();

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.companies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.deal_stage_history;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.signals_raw;
exception when duplicate_object then null; end $$;

-- ---------- RLS ----------
alter table public.companies enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.signals_raw enable row level security;
alter table public.watchlist enable row level security;
alter table public.analyst_notes enable row level security;
alter table public.llm_usage enable row level security;

-- Authenticated users can read shared intelligence tables.
do $$ begin
  create policy "auth read companies" on public.companies
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth read history" on public.deal_stage_history
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth read signals" on public.signals_raw
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Authenticated analysts can update companies (review queue confirm/override).
do $$ begin
  create policy "auth update companies" on public.companies
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth insert history" on public.deal_stage_history
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

-- Watchlist + notes are scoped to the owner.
do $$ begin
  create policy "own watchlist read" on public.watchlist
    for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own watchlist write" on public.watchlist
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notes read" on public.analyst_notes
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own notes write" on public.analyst_notes
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Note: service role bypasses RLS; ingestion pipelines (deferred) use it.
