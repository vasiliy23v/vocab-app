-- ============================================================
-- Superadmin role, global content library, user management
--
-- Adds:
--  - profiles.role ('user' | 'superadmin') + is_superadmin() helper
--  - RLS: superadmin can see/manage every profile, deck, card
--  - "template" decks (decks.is_template): content the superadmin
--    builds once and assigns to specific students. Assigning makes
--    a real per-student copy (cards + deck), so the existing
--    per-student ownership/marks model is unchanged.
--  - deck_assignments: which template went to which student
--  - admin_* RPCs used by the admin dashboard
--
-- After running this migration, promote your own account once,
-- from the SQL Editor (nothing else can do this — see README):
--   update public.profiles set role = 'superadmin' where email = 'you@example.com';
-- ============================================================

-- ─────────────────────────────────────────────
-- profiles.role
-- ─────────────────────────────────────────────
alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'superadmin'));

-- security definer + stable so it can be used inside RLS policies
-- without recursing back into the profiles RLS it's used to check.
create function public.is_superadmin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = p_uid), false);
$$;

-- ─────────────────────────────────────────────
-- decks: template flag
-- ─────────────────────────────────────────────
alter table public.decks
  add column is_template boolean not null default false;

-- Recreate the view so student dashboards can filter out any cards
-- that (in theory) sit on a template deck. Same rule as in 0002: only
-- append new columns at the very end, keep everything else in the
-- exact order/names the previous view definition used.
create or replace view public.cards_with_marks as
select
  c.id, c.deck_id, c.owner_id, c.word_de, c.translation_ru, c."group", c.tags,
  c.description, c.example_de, c.example_ru, c.created_by, c.sort_order, c.created_at,
  tm.status as teacher_status,
  tm.marked_by as teacher_marked_by,
  tm.updated_at as teacher_marked_at,
  om.status as own_status,
  om.updated_at as own_marked_at,
  c.translation_en,
  d.is_template as deck_is_template
from public.cards c
join public.decks d on d.id = c.deck_id
left join lateral (
  select status, marked_by, updated_at
  from public.card_marks
  where card_id = c.id and is_teacher_mark = true
  order by updated_at desc
  limit 1
) tm on true
left join public.card_marks om
  on om.card_id = c.id and om.marked_by = c.owner_id;

alter view public.cards_with_marks set (security_invoker = true);

-- ─────────────────────────────────────────────
-- deck_assignments: which template a student received, and the
-- resulting deck that was copied into their own account
-- ─────────────────────────────────────────────
create table public.deck_assignments (
  id uuid primary key default gen_random_uuid(),
  template_deck_id uuid not null references public.decks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_deck_id uuid references public.decks(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (template_deck_id, student_id)
);

alter table public.deck_assignments enable row level security;

create policy "deck_assignments_select"
  on public.deck_assignments for select
  using (
    student_id = auth.uid()
    or assigned_by = auth.uid()
    or public.is_superadmin(auth.uid())
  );

-- ─────────────────────────────────────────────
-- RPC: superadmin assigns a template deck to specific students.
-- Copies the template's cards into a brand-new deck owned by each
-- student (idempotent: re-assigning the same template to the same
-- student returns the deck already created for them).
-- ─────────────────────────────────────────────
create function public.admin_assign_deck(p_template_deck_id uuid, p_student_ids uuid[])
returns setof uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_student uuid;
  v_template public.decks;
  v_existing uuid;
  v_new_deck public.decks;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can assign decks';
  end if;

  select * into v_template from public.decks
    where id = p_template_deck_id and is_template = true;
  if v_template is null then
    raise exception 'Template deck not found';
  end if;

  foreach v_student in array p_student_ids loop
    select assigned_deck_id into v_existing
      from public.deck_assignments
      where template_deck_id = p_template_deck_id and student_id = v_student;

    if v_existing is not null then
      return next v_existing;
      continue;
    end if;

    insert into public.decks (owner_id, name, created_by)
    values (v_student, v_template.name, auth.uid())
    returning * into v_new_deck;

    insert into public.cards (
      deck_id, owner_id, word_de, translation_ru, translation_en,
      "group", tags, description, example_de, example_ru, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.tags, c.description, c.example_de, c.example_ru, auth.uid(), c.sort_order
    from public.cards c
    where c.deck_id = p_template_deck_id
    order by c.sort_order;

    insert into public.deck_assignments (template_deck_id, student_id, assigned_deck_id, assigned_by)
    values (p_template_deck_id, v_student, v_new_deck.id, auth.uid());

    return next v_new_deck.id;
  end loop;
  return;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: list every user + a few stats, for the admin dashboard
-- ─────────────────────────────────────────────
create function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  deck_count bigint,
  card_count bigint,
  teacher_count bigint,
  student_count bigint
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can list users';
  end if;

  return query
    select
      p.id, p.email, p.display_name, p.role, p.created_at,
      (select count(*) from public.decks d where d.owner_id = p.id and d.is_template = false)::bigint,
      (select count(*) from public.cards c where c.owner_id = p.id)::bigint,
      (select count(*) from public.teacher_links tl where tl.student_id = p.id)::bigint,
      (select count(*) from public.teacher_links tl where tl.teacher_id = p.id)::bigint
    from public.profiles p
    order by p.created_at desc;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: promote/demote a user. A superadmin cannot demote themselves
-- (guards against locking everyone out by accident).
-- ─────────────────────────────────────────────
create function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can change roles';
  end if;
  if p_role not in ('user', 'superadmin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  if p_role = 'user' and p_user_id = auth.uid() then
    raise exception 'You cannot remove your own superadmin role';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: superadmin removes a user's account entirely (auth + profile,
-- cascades to their decks/cards/marks/links via FK on delete cascade)
-- ─────────────────────────────────────────────
create function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can delete users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account here';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- ─────────────────────────────────────────────
-- POLICIES: superadmin sees/manages everything
-- (added as extra permissive policies — combined with the existing
-- ones from 0001 via OR, so nothing already granted is taken away)
-- ─────────────────────────────────────────────

create policy "profiles_all_superadmin"
  on public.profiles for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "teacher_links_select_superadmin"
  on public.teacher_links for select
  using (public.is_superadmin(auth.uid()));

create policy "decks_all_superadmin"
  on public.decks for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "cards_all_superadmin"
  on public.cards for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "card_marks_select_superadmin"
  on public.card_marks for select
  using (public.is_superadmin(auth.uid()));
