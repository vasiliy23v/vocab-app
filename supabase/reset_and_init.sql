-- ============================================================
-- ONE-TIME RECOVERY SCRIPT — run this once in the Supabase SQL
-- Editor for a project that already has a *different*, unrelated
-- schema in it (e.g. an old prototype with cards/tags/card_tags/
-- cards_with_tags/teacher_share_links).
--
-- This is NOT part of the supabase/migrations/ chain — it is not
-- meant to run automatically via `supabase db push`. It:
--   1) wipes the public schema completely (DESTRUCTIVE — only run
--      this if you've confirmed the existing data can be lost)
--   2) re-creates it with the standard Supabase grants
--   3) runs migrations 0001, 0002 and 0003 in order, building the
--      schema this app's code expects
--
-- After running this once, see the bottom of this file for how to
-- reconcile the Supabase CLI's migration history so that future
-- `supabase db push` runs work normally.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) WIPE the public schema
-- ─────────────────────────────────────────────
drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ============================================================
-- 2) 0001_init.sql
-- ============================================================

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.teacher_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null
);

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  word_de text not null,
  translation_ru text not null,
  "group" text default '',
  tags text[] default '{}',
  description text default '',
  example_de text default '',
  example_ru text default '',
  created_by uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create type public.mark_status as enum ('known', 'unknown', 'repeat');

create table public.card_marks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  marked_by uuid not null references public.profiles(id) on delete cascade,
  is_teacher_mark boolean not null default false,
  status public.mark_status not null,
  updated_at timestamptz not null default now(),
  unique (card_id, marked_by)
);

create index cards_deck_id_idx on public.cards(deck_id);
create index cards_owner_id_idx on public.cards(owner_id);
create index card_marks_card_id_idx on public.card_marks(card_id);
create index card_marks_student_id_idx on public.card_marks(student_id);

alter table public.profiles enable row level security;
alter table public.teacher_links enable row level security;
alter table public.invites enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.card_marks enable row level security;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

create function public.create_invite()
returns public.invites
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_invite public.invites;
begin
  v_code := public.generate_invite_code();
  insert into public.invites (code, student_id)
  values (v_code, auth.uid())
  returning * into v_invite;
  return v_invite;
end;
$$;

create function public.redeem_invite(p_code text)
returns public.teacher_links
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite public.invites;
  v_link public.teacher_links;
begin
  select * into v_invite from public.invites
    where code = upper(p_code)
    and redeemed_at is null
    and expires_at > now()
  limit 1;

  if v_invite is null then
    raise exception 'Invite code is invalid or expired';
  end if;

  if v_invite.student_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;

  insert into public.teacher_links (student_id, teacher_id)
  values (v_invite.student_id, auth.uid())
  on conflict (student_id, teacher_id) do nothing
  returning * into v_link;

  update public.invites
    set redeemed_at = now(), redeemed_by = auth.uid()
    where id = v_invite.id;

  if v_link is null then
    select * into v_link from public.teacher_links
      where student_id = v_invite.student_id and teacher_id = auth.uid();
  end if;

  return v_link;
end;
$$;

create function public.set_card_mark(
  p_card_id uuid,
  p_status public.mark_status
)
returns public.card_marks
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_is_teacher boolean;
  v_mark public.card_marks;
begin
  select owner_id into v_owner from public.cards where id = p_card_id;
  if v_owner is null then
    raise exception 'Card not found';
  end if;

  v_is_teacher := (v_owner <> auth.uid());

  if v_is_teacher then
    if not exists (
      select 1 from public.teacher_links
      where student_id = v_owner and teacher_id = auth.uid()
    ) then
      raise exception 'Not authorized for this student';
    end if;
  end if;

  insert into public.card_marks (card_id, student_id, marked_by, is_teacher_mark, status, updated_at)
  values (p_card_id, v_owner, auth.uid(), v_is_teacher, p_status, now())
  on conflict (card_id, marked_by)
  do update set status = excluded.status, updated_at = now()
  returning * into v_mark;

  return v_mark;
end;
$$;

create function public.clear_card_mark(p_card_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.card_marks
  where card_id = p_card_id and marked_by = auth.uid();
end;
$$;

create view public.cards_with_marks as
select
  c.*,
  tm.status as teacher_status,
  tm.marked_by as teacher_marked_by,
  tm.updated_at as teacher_marked_at,
  om.status as own_status,
  om.updated_at as own_marked_at
from public.cards c
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

create policy "profiles_select_own_or_linked"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where (tl.teacher_id = auth.uid() and tl.student_id = profiles.id)
         or (tl.student_id = auth.uid() and tl.teacher_id = profiles.id)
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "teacher_links_select"
  on public.teacher_links for select
  using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "teacher_links_delete"
  on public.teacher_links for delete
  using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "teacher_links_insert_self"
  on public.teacher_links for insert
  with check (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "invites_select_own"
  on public.invites for select
  using (auth.uid() = student_id);

create policy "invites_insert_own"
  on public.invites for insert
  with check (auth.uid() = student_id);

create policy "invites_delete_own"
  on public.invites for delete
  using (auth.uid() = student_id);

create policy "decks_select_owner_or_teacher"
  on public.decks for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = decks.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "decks_insert_owner_or_teacher"
  on public.decks for insert
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = decks.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "decks_update_owner_or_teacher"
  on public.decks for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = decks.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "decks_delete_owner"
  on public.decks for delete
  using (owner_id = auth.uid());

create policy "cards_select_owner_or_teacher"
  on public.cards for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = cards.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "cards_insert_owner_or_teacher"
  on public.cards for insert
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = cards.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "cards_update_owner_or_teacher"
  on public.cards for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = cards.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "cards_delete_owner_or_teacher"
  on public.cards for delete
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = cards.owner_id and tl.teacher_id = auth.uid()
    )
  );

create policy "card_marks_select"
  on public.card_marks for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.teacher_links tl
      where tl.student_id = card_marks.student_id and tl.teacher_id = auth.uid()
    )
  );

create policy "card_marks_insert"
  on public.card_marks for insert
  with check (
    marked_by = auth.uid()
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.teacher_links tl
        where tl.student_id = card_marks.student_id and tl.teacher_id = auth.uid()
      )
    )
  );

create policy "card_marks_update"
  on public.card_marks for update
  using (marked_by = auth.uid());

create policy "card_marks_delete"
  on public.card_marks for delete
  using (marked_by = auth.uid());

alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.card_marks;
alter publication supabase_realtime add table public.teacher_links;
alter publication supabase_realtime add table public.decks;

-- ============================================================
-- 3) 0002_add_translation_en.sql
-- ============================================================

alter table public.cards
  add column translation_en text not null default '';

create or replace view public.cards_with_marks as
select
  c.id, c.deck_id, c.owner_id, c.word_de, c.translation_ru, c."group", c.tags,
  c.description, c.example_de, c.example_ru, c.created_by, c.sort_order, c.created_at,
  tm.status as teacher_status,
  tm.marked_by as teacher_marked_by,
  tm.updated_at as teacher_marked_at,
  om.status as own_status,
  om.updated_at as own_marked_at,
  c.translation_en
from public.cards c
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

-- ============================================================
-- 4) 0003_superadmin.sql
-- ============================================================

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'superadmin'));

create function public.is_superadmin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = p_uid), false);
$$;

alter table public.decks
  add column is_template boolean not null default false;

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

-- ============================================================
-- 4) 0004_group_en.sql
-- ============================================================

alter table public.cards
  add column group_en text not null default '';

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
  d.is_template as deck_is_template,
  c.group_en
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

create or replace function public.admin_assign_deck(p_template_deck_id uuid, p_student_ids uuid[])
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
      "group", group_en, tags, description, example_de, example_ru, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.group_en, c.tags, c.description, c.example_de, c.example_ru, auth.uid(), c.sort_order
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

-- ============================================================
-- 5) 0005_example_en.sql
-- ============================================================

alter table public.cards
  add column example_en text not null default '';

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
  d.is_template as deck_is_template,
  c.group_en,
  c.example_en
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

create or replace function public.admin_assign_deck(p_template_deck_id uuid, p_student_ids uuid[])
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
      "group", group_en, tags, description, example_de, example_ru, example_en, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.group_en, c.tags, c.description, c.example_de, c.example_ru, c.example_en, auth.uid(), c.sort_order
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

-- ============================================================
-- 6) 0006_description_en.sql
-- ============================================================

alter table public.cards
  add column description_en text not null default '';

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
  d.is_template as deck_is_template,
  c.group_en,
  c.example_en,
  c.description_en
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

create or replace function public.admin_assign_deck(p_template_deck_id uuid, p_student_ids uuid[])
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
      "group", group_en, tags, description, description_en, example_de, example_ru, example_en, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.group_en, c.tags, c.description, c.description_en, c.example_de, c.example_ru, c.example_en, auth.uid(), c.sort_order
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

-- ============================================================
-- 7) 0007_deck_name_en.sql
-- ============================================================

alter table public.decks
  add column name_en text not null default '';

create or replace function public.admin_assign_deck(p_template_deck_id uuid, p_student_ids uuid[])
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

    insert into public.decks (owner_id, name, name_en, created_by)
    values (v_student, v_template.name, v_template.name_en, auth.uid())
    returning * into v_new_deck;

    insert into public.cards (
      deck_id, owner_id, word_de, translation_ru, translation_en,
      "group", group_en, tags, description, description_en, example_de, example_ru, example_en, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.group_en, c.tags, c.description, c.description_en, c.example_de, c.example_ru, c.example_en, auth.uid(), c.sort_order
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

create or replace function public.admin_update_deck_name(p_deck_id uuid, p_name text, p_name_en text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can rename decks this way';
  end if;

  update public.decks
  set name = p_name, name_en = p_name_en
  where id = p_deck_id;
end;
$$;

-- ============================================================
-- DONE. Your database now has exactly the schema this app expects.
--
-- Next: make yourself a superadmin (replace with your email):
--   update public.profiles set role = 'superadmin' where email = 'you@example.com';
--
-- Optional, to make `supabase db push` usable going forward without
-- CLI errors, run this from your own terminal (reconciles the CLI's
-- migration-history bookkeeping — it does not touch the database):
--   supabase migration repair --status reverted 20260530 202605301939 202605301955 202605302000 202605302012 202605302030 202605302045
--   supabase migration repair --status applied 0001 0002 0003
-- ============================================================
