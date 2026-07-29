-- ============================================================
-- Multilingual vocabulary system
--
-- Extends the app to support unlimited languages (not just DE→RU/EN).
-- Maintains backward compatibility with existing data.
--
-- New structure:
-- - languages: registry of all supported languages
-- - language_pairs: which language pairs are available for learning
-- - word_translations: translations of a word into any language
-- - word_examples: examples in any language
-- - word_descriptions: descriptions in any language
--
-- Migration path: old columns (translation_ru, translation_en, etc)
-- remain intact but can be migrated to new tables when ready.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) Languages registry
-- ─────────────────────────────────────────────
create table public.languages (
  code text primary key, -- 'de', 'ru', 'en', 'uk', 'fr', 'es', etc
  name text not null, -- English name (German, Russian, English)
  native_name text not null, -- Name in the language itself (Deutsch, Русский)
  direction text not null default 'ltr', -- 'ltr' (left-to-right) or 'rtl' (right-to-left)
  created_at timestamptz not null default now()
);

-- Initial language data
insert into public.languages (code, name, native_name, direction) values
  ('de', 'German', 'Deutsch', 'ltr'),
  ('ru', 'Russian', 'Русский', 'ltr'),
  ('en', 'English', 'English', 'ltr'),
  ('uk', 'Ukrainian', 'Українська', 'ltr'),
  ('fr', 'French', 'Français', 'ltr'),
  ('es', 'Spanish', 'Español', 'ltr'),
  ('it', 'Italian', 'Italiano', 'ltr'),
  ('pt', 'Portuguese', 'Português', 'ltr'),
  ('pl', 'Polish', 'Polski', 'ltr'),
  ('ja', 'Japanese', '日本語', 'ltr'),
  ('zh', 'Chinese', '中文', 'ltr'),
  ('ko', 'Korean', '한국어', 'ltr');

alter table public.languages enable row level security;

create policy "languages_select_all"
  on public.languages for select
  using (true); -- Everyone can see available languages

-- ─────────────────────────────────────────────
-- 2) Language pairs (which pairs are available for learning)
-- ─────────────────────────────────────────────
create table public.language_pairs (
  id uuid primary key default gen_random_uuid(),
  language_from text not null references public.languages(code) on delete cascade,
  language_to text not null references public.languages(code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (language_from, language_to),
  check (language_from <> language_to)
);

-- Initial pairs: DE→RU, DE→EN, RU→EN, UK, etc (can be extended)
insert into public.language_pairs (language_from, language_to) values
  ('de', 'ru'),
  ('de', 'en'),
  ('de', 'uk'),
  ('en', 'ru'),
  ('en', 'uk'),
  ('en', 'de'),
  ('ru', 'en'),
  ('ru', 'uk'),
  ('ru', 'de'),
  ('uk', 'ru'),
  ('uk', 'en'),
  ('uk', 'de');

alter table public.language_pairs enable row level security;

create policy "language_pairs_select_all"
  on public.language_pairs for select
  using (true);

-- ─────────────────────────────────────────────
-- 3) Word translations (word in any language)
-- Allows storing translations of a card's word into multiple languages
-- ─────────────────────────────────────────────
create table public.word_translations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  language text not null references public.languages(code) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (card_id, language) -- One translation per language per card
);

create index word_translations_card_id_idx on public.word_translations(card_id);
create index word_translations_language_idx on public.word_translations(language);

alter table public.word_translations enable row level security;

-- Use same RLS as cards: accessible if you own the card or are linked as teacher
create policy "word_translations_select"
  on public.word_translations for select
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_translations_insert"
  on public.word_translations for insert
  with check (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_translations_update"
  on public.word_translations for update
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_translations_delete"
  on public.word_translations for delete
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and c.owner_id = auth.uid()
    )
    or public.is_superadmin(auth.uid())
  );

-- ─────────────────────────────────────────────
-- 4) Word examples (example sentences in any language)
-- ─────────────────────────────────────────────
create table public.word_examples (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  language text not null references public.languages(code) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (card_id, language) -- One example per language per card
);

create index word_examples_card_id_idx on public.word_examples(card_id);
create index word_examples_language_idx on public.word_examples(language);

alter table public.word_examples enable row level security;

-- Same RLS as word_translations
create policy "word_examples_select"
  on public.word_examples for select
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_examples_insert"
  on public.word_examples for insert
  with check (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_examples_update"
  on public.word_examples for update
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_examples_delete"
  on public.word_examples for delete
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and c.owner_id = auth.uid()
    )
    or public.is_superadmin(auth.uid())
  );

-- ─────────────────────────────────────────────
-- 5) Word descriptions (detailed info in any language)
-- ─────────────────────────────────────────────
create table public.word_descriptions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  language text not null references public.languages(code) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (card_id, language) -- One description per language per card
);

create index word_descriptions_card_id_idx on public.word_descriptions(card_id);
create index word_descriptions_language_idx on public.word_descriptions(language);

alter table public.word_descriptions enable row level security;

-- Same RLS as above
create policy "word_descriptions_select"
  on public.word_descriptions for select
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_descriptions_insert"
  on public.word_descriptions for insert
  with check (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_descriptions_update"
  on public.word_descriptions for update
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.teacher_links tl
          where tl.student_id = c.owner_id and tl.teacher_id = auth.uid()
        )
      )
    )
    or public.is_superadmin(auth.uid())
  );

create policy "word_descriptions_delete"
  on public.word_descriptions for delete
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and c.owner_id = auth.uid()
    )
    or public.is_superadmin(auth.uid())
  );

-- ─────────────────────────────────────────────
-- 6) RPC: Get card with all translations for a language pair
-- ─────────────────────────────────────────────
create or replace function public.get_card_multilingual(
  p_card_id uuid,
  p_language_from text,
  p_language_to text
)
returns table (
  id uuid,
  deck_id uuid,
  owner_id uuid,
  word text,
  translation text,
  group_name text,
  description text,
  example text,
  tags text[],
  teacher_status text,
  own_status text
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select
      c.id,
      c.deck_id,
      c.owner_id,
      coalesce(
        (select text from public.word_translations where card_id = c.id and language = p_language_from limit 1),
        c.word_de
      ) as word,
      coalesce(
        (select text from public.word_translations where card_id = c.id and language = p_language_to limit 1),
        case
          when p_language_to = 'ru' then c.translation_ru
          when p_language_to = 'en' then c.translation_en
          else ''
        end
      ) as translation,
      c."group" as group_name,
      coalesce(
        (select text from public.word_descriptions where card_id = c.id and language = p_language_to limit 1),
        c.description
      ) as description,
      coalesce(
        (select text from public.word_examples where card_id = c.id and language = p_language_from limit 1),
        c.example_de
      ) as example,
      c.tags,
      (select status from public.card_marks where card_id = c.id and is_teacher_mark = true order by updated_at desc limit 1)::text,
      (select status from public.card_marks where card_id = c.id and marked_by = auth.uid() limit 1)::text
    from public.cards c
    where c.id = p_card_id
      and (
        c.owner_id = auth.uid()
        or exists (select 1 from public.teacher_links tl where tl.student_id = c.owner_id and tl.teacher_id = auth.uid())
      );
end;
$$;

-- ─────────────────────────────────────────────
-- 7) RPC: Bulk add translations (for CSV import)
-- ─────────────────────────────────────────────
create or replace function public.add_word_translations_batch(
  p_card_id uuid,
  p_translations jsonb -- {"ru": "слово", "en": "word", "uk": "слово"}
)
returns table (
  inserted_count integer,
  error_message text
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_language text;
  v_text text;
  v_count integer := 0;
  v_error_msg text := null;
begin
  -- Verify card exists and user has access
  if not exists (
    select 1 from public.cards c
    where c.id = p_card_id and (
      c.owner_id = auth.uid()
      or exists (select 1 from public.teacher_links tl where tl.student_id = c.owner_id and tl.teacher_id = auth.uid())
    )
  ) and not public.is_superadmin(auth.uid()) then
    raise exception 'Card not found or no access';
  end if;

  begin
    for v_language, v_text in
      select key, value ->> 0
      from jsonb_each(p_translations)
    loop
      if v_text is not null and v_text != '' then
        insert into public.word_translations (card_id, language, text)
        values (p_card_id, v_language, v_text)
        on conflict (card_id, language)
        do update set text = excluded.text;
        v_count := v_count + 1;
      end if;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_count, v_error_msg;
end;
$$;

-- ─────────────────────────────────────────────
-- 8) RPC: List available language pairs
-- ─────────────────────────────────────────────
create or replace function public.list_language_pairs()
returns table (
  language_from text,
  language_from_name text,
  language_to text,
  language_to_name text
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  return query
    select
      lp.language_from,
      lf.native_name,
      lp.language_to,
      lt.native_name
    from public.language_pairs lp
    join public.languages lf on lf.code = lp.language_from
    join public.languages lt on lt.code = lp.language_to
    order by lf.name, lt.name;
end;
$$;

-- ─────────────────────────────────────────────
-- 9) Enable realtime for new tables
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.word_translations;
alter publication supabase_realtime add table public.word_examples;
alter publication supabase_realtime add table public.word_descriptions;
