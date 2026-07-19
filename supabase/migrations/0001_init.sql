-- ============================================================
-- Vocab App — Initial schema
-- Tables are created first (no forward refs in DDL columns),
-- then types/functions, then ALL policies at the end so that
-- cross-table policies never reference a not-yet-created table.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index cards_deck_id_idx on public.cards(deck_id);
create index cards_owner_id_idx on public.cards(owner_id);
create index card_marks_card_id_idx on public.card_marks(card_id);
create index card_marks_student_id_idx on public.card_marks(student_id);

-- ─────────────────────────────────────────────
-- ENABLE RLS (policies added at the bottom)
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.teacher_links enable row level security;
alter table public.invites enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.card_marks enable row level security;

-- ─────────────────────────────────────────────
-- FUNCTIONS / TRIGGERS
-- ─────────────────────────────────────────────

-- auto-create profile row on signup
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

-- generate a short readable invite code
create function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

-- RPC: student creates invite
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

-- RPC: teacher redeems invite code
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

-- RPC: set/update a card mark (knows / doesn't know / repeat)
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

-- RPC: remove a teacher's own mark on a card (used by "clear mark" UI action)
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

-- ─────────────────────────────────────────────
-- VIEW: cards merged with teacher-mark + own-mark
-- "teacher mark" = most recently updated mark left by ANY linked teacher
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- POLICIES (all tables now exist, safe to cross-reference)
-- ─────────────────────────────────────────────

-- profiles
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

-- teacher_links
create policy "teacher_links_select"
  on public.teacher_links for select
  using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "teacher_links_delete"
  on public.teacher_links for delete
  using (auth.uid() = student_id or auth.uid() = teacher_id);

create policy "teacher_links_insert_self"
  on public.teacher_links for insert
  with check (auth.uid() = student_id or auth.uid() = teacher_id);

-- invites
create policy "invites_select_own"
  on public.invites for select
  using (auth.uid() = student_id);

create policy "invites_insert_own"
  on public.invites for insert
  with check (auth.uid() = student_id);

create policy "invites_delete_own"
  on public.invites for delete
  using (auth.uid() = student_id);

-- decks
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

-- cards
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

-- card_marks
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

-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.card_marks;
alter publication supabase_realtime add table public.teacher_links;
alter publication supabase_realtime add table public.decks;
