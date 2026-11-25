-- ============================================================
-- Baker Hub: durable rate limit for the model routes (round 20)
-- ============================================================
-- Maestro and the flour scanner run on Vercel, where a count in one
-- instance's memory does not hold (24 calls in 2 minutes were all
-- answered in the round-19 test). Each call is one row keyed by a
-- salted hash of the caller's address (computed on the server; the
-- address itself is never stored). The table has RLS on and NO policy:
-- nobody reads or writes it directly. The anon key may only execute
-- bh_rate_hit, which counts and inserts atomically.

create table if not exists api_rate_hits (
  bucket  text        not null,
  at      timestamptz not null default now()
);
create index if not exists api_rate_hits_bucket_at on api_rate_hits (bucket, at);

alter table api_rate_hits enable row level security;
revoke all on api_rate_hits from anon, authenticated;

-- true = the call may go ahead (and is counted); false = the bucket is full.
create or replace function bh_rate_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_bucket is null or length(p_bucket) > 128 or p_limit < 1 or p_limit > 5000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;
  -- One caller's calls are counted one at a time.
  perform pg_advisory_xact_lock(hashtext(p_bucket));
  delete from api_rate_hits where bucket = p_bucket and at < now() - make_interval(secs => p_window_seconds);
  select count(*) into n from api_rate_hits where bucket = p_bucket;
  if n >= p_limit then
    return false;
  end if;
  insert into api_rate_hits (bucket) values (p_bucket);
  -- Now and then, forget idle callers so the table stays small.
  if random() < 0.02 then
    delete from api_rate_hits where at < now() - interval '1 day';
  end if;
  return true;
end;
$$;

revoke all on function bh_rate_hit(text, int, int) from public;
grant execute on function bh_rate_hit(text, int, int) to anon, authenticated;
