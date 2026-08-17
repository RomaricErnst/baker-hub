-- ============================================================
-- Baker Hub: shareable shopping-list checklist
-- ============================================================
-- Anyone with the link can view AND check off items — no login
-- required. Security model is "possession of the URL", same as a
-- Google Docs share link. Do not put anything sensitive in here;
-- this is a grocery list, not user account data.

create table if not exists shopping_list_shares (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  items         jsonb not null default '[]'::jsonb,
  dough_items   jsonb not null default '[]'::jsonb,
  checked       jsonb not null default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────
-- Public read + insert + update by design (link-based sharing).
-- No public delete policy — rows just go stale, nobody can wipe
-- someone else's list via a guessed/leaked id.
alter table shopping_list_shares enable row level security;

drop policy if exists "public read"   on shopping_list_shares;
drop policy if exists "public insert" on shopping_list_shares;
drop policy if exists "public update" on shopping_list_shares;

create policy "public read"
  on shopping_list_shares for select
  using (true);

create policy "public insert"
  on shopping_list_shares for insert
  with check (true);

create policy "public update"
  on shopping_list_shares for update
  using (true)
  with check (true);

-- ── updated_at trigger ───────────────────────────────────────
-- Reuses touch_updated_at() from the bake_events migration.
drop trigger if exists trg_shopping_list_shares_updated on shopping_list_shares;
create trigger trg_shopping_list_shares_updated
  before update on shopping_list_shares
  for each row execute function touch_updated_at();

-- ── Realtime ─────────────────────────────────────────────────
-- Lets multiple people checking the list at once (e.g. two people
-- shopping together) see each other's ticks live.
alter publication supabase_realtime add table shopping_list_shares;
