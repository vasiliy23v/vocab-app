-- Fix lost flames when words are marked in a burst.
--
-- Finishing a session fires one set_card_mark() per word in parallel (see
-- StudentDashboard's "for (const c of known) onMark(...)"), so N separate
-- transactions race to recount the same profile. 0021's recount had no
-- serialisation point:
--
--   T1: insert mark A → count = 1 → update profiles set flames_count = 1
--   T2: insert mark B → count = 1  (T1 has not committed; its mark is
--                                   invisible to T2's snapshot)
--                     → update profiles … where flames_count is distinct
--                       from 1  → blocks on T1's row lock
--   T1: commit (flames_count = 1)
--   T2: re-checks the qual against the new row: 1 is not distinct from 1,
--       so the update matches nothing and T2 silently writes nothing.
--
-- Every transaction that loses the race drops its word. Marking 20 words
-- quickly reproduced as 14 flames locally; on a real session it showed up
-- as 20 mastered words against 10 flames.
--
-- The recount has to be serialised per student, and it has to happen after
-- the wait — READ COMMITTED gives each statement in a volatile function a
-- fresh snapshot, so a recount that runs once the lock is granted sees
-- every mark the transactions ahead of it committed.
--
-- The lock has to be advisory rather than "select … from profiles for
-- update": card_marks.student_id references profiles(id), so inserting a
-- mark already holds FOR KEY SHARE on that profile row. Upgrading it to
-- FOR UPDATE while another transaction holds the same KEY SHARE and wants
-- the same upgrade is a textbook deadlock — 16 of 20 workers died on it
-- when this was tried. Advisory locks do not conflict with FK row locks.
-- Keys are taken in sorted order so multi-student syncs (a deck changing
-- owner) cannot deadlock against each other either.
create or replace function public.sync_flames_for_students(p_students uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_students is null or cardinality(p_students) = 0 then
    return;
  end if;

  for v_id in
    select distinct u.id
    from unnest(p_students) as u(id)
    where u.id is not null
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtext('flames_sync'), hashtext(v_id::text));
  end loop;

  perform set_config('app.flames_sync', 'on', true);

  update public.profiles p
  set flames_count = fresh.n
  from (
    select s.id, public.count_mastered_words(s.id) as n
    from unnest(p_students) as s(id)
    where s.id is not null
  ) fresh
  where p.id = fresh.id
    and p.flames_count is distinct from fresh.n;

  perform set_config('app.flames_sync', 'off', true);
end;
$$;

revoke all on function public.sync_flames_for_students(uuid[]) from public;

-- Repair the balances the race already ate.
select public.sync_flames_for_students(array(select id from public.profiles));
