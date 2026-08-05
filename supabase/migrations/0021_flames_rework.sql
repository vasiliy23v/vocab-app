-- Rework 🔥 flames: make the count derived from mastered words instead of
-- an append-only tally.
--
-- 0017 awarded flames from an AFTER INSERT trigger on card_marks, which was
-- wrong in every direction:
--   * worst of all, the trigger body could not run: profiles.email is NOT
--     NULL and its INSERT ... ON CONFLICT (id) DO UPDATE listed only (id,
--     flames_count). Postgres checks NOT NULL before it resolves the
--     conflict, so the statement raised "null value in column email
--     violates not-null constraint" every time — which aborted the whole
--     set_card_mark() call. Marking a brand-new word 'known' therefore
--     failed outright and the client's optimistic tick rolled back on the
--     next load, which is what "the progress keeps resetting" was;
--   * clearing a mark, unmarking a word, deleting a card or a whole deck —
--     including Settings → "Reset progress", which wipes card_marks —
--     left the flames behind, so the counter only ever grew;
--   * re-marking a cleared card awarded a second flame for the same word;
--   * a teacher mark and the student's own mark are two rows, both with
--     student_id = the student, so one word could pay out twice.
--
-- The rules now, once and for all:
--   1 flame = 1 word the student currently has mastered.
--   * A word is mastered when its effective mark is 'known' — the teacher's
--     mark if there is one, otherwise the student's own (same precedence as
--     effectiveMarkStatus() on the client and the cards_with_marks view).
--   * Each card counts at most once, no matter how many marks it carries.
--   * Only the student's own cards in real (non-template) decks count.
--   * Un-marking, re-marking or deleting the word moves the count with it.
-- flames_count is therefore always exactly count_mastered_words(id) — it is
-- recomputed, never incremented, so it can never drift.

-- ─────────────────────────────────────────────
-- COLUMN HYGIENE
-- ─────────────────────────────────────────────
-- 0017 added both columns nullable; a NULL reads as a missing balance in the
-- UI, which is one of the ways the counter appeared to reset itself.
update public.profiles set flames_count = 0 where flames_count is null;
update public.profiles set show_on_leaderboard = false where show_on_leaderboard is null;

alter table public.profiles
  alter column flames_count set default 0,
  alter column flames_count set not null,
  alter column show_on_leaderboard set default false,
  alter column show_on_leaderboard set not null;

-- ─────────────────────────────────────────────
-- SOURCE OF TRUTH
-- ─────────────────────────────────────────────
-- Mirrors cards_with_marks: latest teacher mark wins, else the owner's own.
create or replace function public.count_mastered_words(p_student uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.cards c
  join public.decks d on d.id = c.deck_id
  left join lateral (
    select cm.status
    from public.card_marks cm
    where cm.card_id = c.id and cm.is_teacher_mark = true
    order by cm.updated_at desc
    limit 1
  ) tm on true
  left join public.card_marks om
    on om.card_id = c.id and om.marked_by = c.owner_id
  where c.owner_id = p_student
    and d.is_template = false
    and coalesce(tm.status, om.status) = 'known';
$$;

comment on function public.count_mastered_words(uuid) is
  'Number of words the student currently has mastered — the definition of their flame balance.';

-- Recompute the stored balance for a set of students. Writes only rows that
-- actually change, so a study session does not spam realtime with no-op
-- profile updates. The transaction-local app.flames_sync flag tells the
-- guard trigger below that this write is the trusted one.
create or replace function public.sync_flames_for_students(p_students uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_students is null or cardinality(p_students) = 0 then
    return;
  end if;

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

-- ─────────────────────────────────────────────
-- KEEPING IT IN SYNC
-- ─────────────────────────────────────────────
-- Statement-level triggers with transition tables: deleting a 1000-card deck
-- cascades into card_marks as one statement and costs one recount per
-- affected student, not one per row.
create or replace function public.sync_flames_on_marks_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.sync_flames_for_students(array(select distinct student_id from new_marks));
  return null;
end;
$$;

create or replace function public.sync_flames_on_marks_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.sync_flames_for_students(array(
    select distinct student_id from new_marks
    union
    select distinct student_id from old_marks
  ));
  return null;
end;
$$;

create or replace function public.sync_flames_on_marks_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.sync_flames_for_students(array(select distinct student_id from old_marks));
  return null;
end;
$$;

-- The 0017 trigger and its function are replaced wholesale.
drop trigger if exists trigger_add_flame_on_mark on public.card_marks;
drop function if exists public.add_flame_for_known_card();

drop trigger if exists card_marks_flames_insert on public.card_marks;
create trigger card_marks_flames_insert
  after insert on public.card_marks
  referencing new table as new_marks
  for each statement execute function public.sync_flames_on_marks_insert();

drop trigger if exists card_marks_flames_update on public.card_marks;
create trigger card_marks_flames_update
  after update on public.card_marks
  referencing new table as new_marks old table as old_marks
  for each statement execute function public.sync_flames_on_marks_update();

drop trigger if exists card_marks_flames_delete on public.card_marks;
create trigger card_marks_flames_delete
  after delete on public.card_marks
  referencing old table as old_marks
  for each statement execute function public.sync_flames_on_marks_delete();

-- Deleting a card cascades into card_marks and is covered by the triggers
-- above, but a card can also stop counting without its marks changing —
-- when its deck is flipped to a template. Cheap to cover, so cover it.
create or replace function public.sync_flames_on_deck_template_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_template is distinct from old.is_template
     or new.owner_id is distinct from old.owner_id then
    perform public.sync_flames_for_students(array[new.owner_id, old.owner_id]);
  end if;
  return null;
end;
$$;

drop trigger if exists decks_flames_sync on public.decks;
create trigger decks_flames_sync
  after update on public.decks
  for each row execute function public.sync_flames_on_deck_template_change();

-- ─────────────────────────────────────────────
-- TAMPER GUARD
-- ─────────────────────────────────────────────
-- profiles_update_own restricts which ROW a user may touch, not which
-- columns, so a client could hand itself any balance with a direct
-- profiles.update({ flames_count: 9999 }). Same shape as the role guard in
-- 0010: silently revert, only the sync path may write this column.
create or replace function public.profiles_guard_flames()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.flames_count is distinct from old.flames_count
     and coalesce(current_setting('app.flames_sync', true), 'off') <> 'on' then
    new.flames_count := old.flames_count;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_flames_trigger on public.profiles;
create trigger profiles_guard_flames_trigger
  before update on public.profiles
  for each row execute function public.profiles_guard_flames();

-- ─────────────────────────────────────────────
-- LEADERBOARD
-- ─────────────────────────────────────────────
-- Recreated rather than replaced: 0017 exposed p.email to every signed-in
-- user, and dropping a column needs a real DROP. rank() (not row_number())
-- so that equal scores share a place instead of being ordered arbitrarily.
--
-- Deliberately left as a security-definer view: profiles' RLS only exposes
-- your own row plus linked teachers/students, and a leaderboard everyone can
-- read is the entire point. Only the display name and the score leak, which
-- is exactly what the opt-in asks for.
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  p.id,
  p.display_name,
  p.flames_count,
  rank() over (order by p.flames_count desc, p.id) as rank
from public.profiles p
where p.show_on_leaderboard = true
  and p.flames_count > 0;

grant select on public.leaderboard to anon, authenticated;

-- Own standing, including when the student sits below the top-100 cut the
-- client fetches. Returns no row when they are not on the board at all.
create or replace function public.my_leaderboard_rank()
returns table (rank bigint, flames_count integer, total bigint)
language sql
stable
security definer set search_path = public
as $$
  with board as (
    select
      p.id,
      p.flames_count,
      rank() over (order by p.flames_count desc, p.id) as rank
    from public.profiles p
    where p.show_on_leaderboard = true
      and p.flames_count > 0
  )
  select b.rank, b.flames_count, (select count(*) from board) as total
  from board b
  where b.id = auth.uid();
$$;

grant execute on function public.my_leaderboard_rank() to authenticated;

-- The internals stay internal: both are security-definer and would happily
-- report on (or rewrite) any student's balance if a client could call them.
revoke all on function public.count_mastered_words(uuid) from public;
revoke all on function public.sync_flames_for_students(uuid[]) from public;

-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
-- profiles was never published, so the client's subscriptions on it (the
-- leaderboard's, and now the signed-in profile's) silently received nothing
-- and the flame counter in the menu/shop only moved on a full reload.
-- RLS still applies: a user only receives their own row and linked ones.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- BACKFILL
-- ─────────────────────────────────────────────
-- Every existing balance is whatever 0017's broken tally happened to leave
-- behind; recompute all of them from the marks that actually exist.
select public.sync_flames_for_students(array(select id from public.profiles));
