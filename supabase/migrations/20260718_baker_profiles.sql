-- Baker profile sync (post-launch follow-up; app is local-first via bh_profile_v1).
-- Apply manually when enabling cross-device profile sync.
create table if not exists public.baker_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.baker_profiles enable row level security;
create policy "own profile" on public.baker_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
