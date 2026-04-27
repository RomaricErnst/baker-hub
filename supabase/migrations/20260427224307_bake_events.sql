-- ============================================================
-- Baker Hub: bake session tables
-- ============================================================

-- Central session object
create table if not exists bake_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users on delete cascade,
  bake_date         timestamptz not null,
  status            text not null default 'dough_planned'
                    check (status in ('dough_planned', 'pizza_planned', 'baked')),
  recipe_id         uuid references recipes(id) on delete set null,
  dough_snapshot    jsonb,
  pizza_party_id    uuid,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- One pizza party per bake event
create table if not exists pizza_party_sessions (
  id              uuid primary key default gen_random_uuid(),
  bake_event_id   uuid references bake_events(id) on delete cascade,
  quantity        int not null,
  style           text not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- FK back from bake_events → pizza_party_sessions (circular, resolved after)
alter table bake_events
  add constraint if not exists fk_pizza_party
  foreign key (pizza_party_id)
  references pizza_party_sessions(id)
  on delete set null;

-- One row per pizza slot
create table if not exists pizza_party_slots (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references pizza_party_sessions(id) on delete cascade,
  slot_index    int not null,
  preset_id     text,
  toppings      jsonb,
  notes         text,
  unique (session_id, slot_index)
);

-- Photos — universal, works for pizza slots AND bread bakes
-- slot_index null = bread bake or full group shot
create table if not exists bake_photos (
  id              uuid primary key default gen_random_uuid(),
  bake_event_id   uuid references bake_events(id) on delete cascade,
  slot_index      int,
  photo_url       text not null,
  taken_at        timestamptz default now(),
  notes           text
);

-- ── RLS ──────────────────────────────────────────────────────
alter table bake_events          enable row level security;
alter table pizza_party_sessions enable row level security;
alter table pizza_party_slots    enable row level security;
alter table bake_photos          enable row level security;

drop policy if exists "own events"  on bake_events;
drop policy if exists "own parties" on pizza_party_sessions;
drop policy if exists "own slots"   on pizza_party_slots;
drop policy if exists "own photos"  on bake_photos;

create policy "own events"
  on bake_events for all
  using (auth.uid() = user_id);

create policy "own parties"
  on pizza_party_sessions for all
  using (
    bake_event_id in (
      select id from bake_events where user_id = auth.uid()
    )
  );

create policy "own slots"
  on pizza_party_slots for all
  using (
    session_id in (
      select id from pizza_party_sessions
      where bake_event_id in (
        select id from bake_events where user_id = auth.uid()
      )
    )
  );

create policy "own photos"
  on bake_photos for all
  using (
    bake_event_id in (
      select id from bake_events where user_id = auth.uid()
    )
  );

-- ── updated_at trigger ───────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bake_events_updated on bake_events;
create trigger trg_bake_events_updated
  before update on bake_events
  for each row execute function touch_updated_at();

drop trigger if exists trg_pizza_party_sessions_updated on pizza_party_sessions;
create trigger trg_pizza_party_sessions_updated
  before update on pizza_party_sessions
  for each row execute function touch_updated_at();
