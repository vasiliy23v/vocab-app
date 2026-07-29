-- ============================================================
-- Multilingual vocabulary import
--
-- RPC functions to bulk import vocabulary from CSV with support
-- for unlimited languages. Maintains backward compatibility with
-- legacy single-language imports.
-- ============================================================

-- RPC: Import cards from CSV with multilingual support
-- Input: jsonb array of cards with structure:
-- [
--   {
--     "word_de": "das Haus",
--     "translations": {"ru": "дом", "en": "house", "uk": "дім"},
--     "examples": {"de": "Das Haus ist groß", "ru": "Дом большой"},
--     "descriptions": {"de": "Substantiv", "en": "Noun"},
--     "group": "Möbel",
--     "tags": ["noun", "home"]
--   },
--   ...
-- ]
create or replace function public.import_multilingual_cards(
  p_deck_id uuid,
  p_cards jsonb,
  p_language_from text default 'de',
  p_language_to text default 'ru'
)
returns table (
  inserted_count integer,
  error_message text
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_deck public.decks;
  v_card_data record;
  v_card public.cards;
  v_inserted integer := 0;
  v_start_order integer;
  v_index integer := 0;
  v_error_msg text := null;
  v_translations jsonb;
  v_examples jsonb;
  v_descriptions jsonb;
  v_language text;
  v_text text;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can import cards';
  end if;

  -- Verify deck exists
  select * into v_deck from public.decks where id = p_deck_id;
  if v_deck is null then
    raise exception 'Deck not found';
  end if;

  -- Get the max sort_order to append new cards
  select coalesce(max(sort_order), -1) + 1 into v_start_order
    from public.cards where deck_id = p_deck_id;

  -- Insert or update each card from the JSON array
  begin
    for v_card_data in
      select
        (item->>'word_de')::text as word_de,
        (item->'translations')::jsonb as translations,
        (item->'examples')::jsonb as examples,
        (item->'descriptions')::jsonb as descriptions,
        (item->>'group')::text as group_val,
        (item->'tags')::text[] as tags
      from jsonb_array_elements(p_cards) as item
    loop
      -- Skip if no word
      if v_card_data.word_de is null or v_card_data.word_de = '' then
        continue;
      end if;

      -- Try to update existing card (same word in same deck)
      update public.cards
      set
        translation_ru = coalesce((v_card_data.translations->>'ru'), translation_ru),
        translation_en = coalesce((v_card_data.translations->>'en'), translation_en),
        "group" = coalesce(v_card_data.group_val, "group"),
        tags = coalesce(v_card_data.tags, tags),
        description = coalesce((v_card_data.descriptions->>'de'), description),
        example_de = coalesce((v_card_data.examples->>'de'), example_de),
        example_ru = coalesce((v_card_data.examples->>'ru'), example_ru),
        example_en = coalesce((v_card_data.examples->>'en'), example_en)
      where deck_id = p_deck_id and word_de = v_card_data.word_de
      returning * into v_card;

      -- If no existing card was updated, insert a new one
      if v_card is null then
        insert into public.cards (
          deck_id, owner_id, word_de, translation_ru, translation_en,
          "group", tags, description, example_de, example_ru, example_en,
          created_by, sort_order
        )
        values (
          p_deck_id,
          v_deck.owner_id,
          v_card_data.word_de,
          coalesce((v_card_data.translations->>'ru'), ''),
          coalesce((v_card_data.translations->>'en'), ''),
          coalesce(v_card_data.group_val, ''),
          coalesce(v_card_data.tags, '{}'),
          coalesce((v_card_data.descriptions->>'de'), ''),
          coalesce((v_card_data.examples->>'de'), ''),
          coalesce((v_card_data.examples->>'ru'), ''),
          coalesce((v_card_data.examples->>'en'), ''),
          auth.uid(),
          v_start_order + v_index
        )
        returning * into v_card;
      end if;

      -- Insert additional translations (beyond ru, en) using new multilingual system
      if v_card_data.translations is not null then
        for v_language, v_text in
          select key, value ->> 0
          from jsonb_each(v_card_data.translations)
          where key not in ('ru', 'en') -- Skip legacy columns
        loop
          if v_text is not null and v_text != '' then
            insert into public.word_translations (card_id, language, text)
            values (v_card.id, v_language, v_text)
            on conflict (card_id, language) do update set text = excluded.text;
          end if;
        end loop;
      end if;

      -- Insert examples in additional languages
      if v_card_data.examples is not null then
        for v_language, v_text in
          select key, value ->> 0
          from jsonb_each(v_card_data.examples)
          where key not in ('de', 'ru', 'en') -- Skip legacy columns
        loop
          if v_text is not null and v_text != '' then
            insert into public.word_examples (card_id, language, text)
            values (v_card.id, v_language, v_text)
            on conflict (card_id, language) do update set text = excluded.text;
          end if;
        end loop;
      end if;

      -- Insert descriptions in additional languages
      if v_card_data.descriptions is not null then
        for v_language, v_text in
          select key, value ->> 0
          from jsonb_each(v_card_data.descriptions)
          where key not in ('de', 'ru', 'en') -- Skip legacy columns
        loop
          if v_text is not null and v_text != '' then
            insert into public.word_descriptions (card_id, language, text)
            values (v_card.id, v_language, v_text)
            on conflict (card_id, language) do update set text = excluded.text;
          end if;
        end loop;
      end if;

      v_inserted := v_inserted + 1;
      v_index := v_index + 1;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_inserted, v_error_msg;
end;
$$;

-- RPC: Add a new language to the system (superadmin only)
create or replace function public.admin_add_language(
  p_code text,
  p_name text,
  p_native_name text,
  p_direction text default 'ltr'
)
returns public.languages
language plpgsql
security definer set search_path = public
as $$
declare
  v_language public.languages;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can add languages';
  end if;

  insert into public.languages (code, name, native_name, direction)
  values (p_code, p_name, p_native_name, p_direction)
  returning * into v_language;

  return v_language;
end;
$$;

-- RPC: Add a new language pair (superadmin only)
create or replace function public.admin_add_language_pair(
  p_language_from text,
  p_language_to text
)
returns public.language_pairs
language plpgsql
security definer set search_path = public
as $$
declare
  v_pair public.language_pairs;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can add language pairs';
  end if;

  if p_language_from = p_language_to then
    raise exception 'Language pair must be different languages';
  end if;

  insert into public.language_pairs (language_from, language_to)
  values (p_language_from, p_language_to)
  on conflict (language_from, language_to) do nothing
  returning * into v_pair;

  return v_pair;
end;
$$;

-- RPC: Import from flat CSV format (backward compatible)
-- Handles both complete and partial multilingual data
-- Input: jsonb array of cards with flat structure:
-- [
--   {
--     "word": "das Haus",
--     "translation": "дом",
--     "translation_en": "house",
--     "translation_uk": "дім",
--     "group": "Möbel",
--     "tags": ["noun", "home"],
--     "description": "Substantiv",
--     "example_de": "Das Haus ist groß",
--     "example_ru": "Дом большой",
--     "example_en": "The house is big",
--     "example_uk": "Будинок великий"
--   }
-- ]
create or replace function public.import_flat_csv_cards(
  p_deck_id uuid,
  p_cards jsonb
)
returns table (
  inserted_count integer,
  updated_count integer,
  error_message text
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_deck public.decks;
  v_card_data record;
  v_card public.cards;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_start_order integer;
  v_index integer := 0;
  v_error_msg text := null;
  v_word text;
  v_language text;
  v_text text;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can import cards';
  end if;

  -- Verify deck exists
  select * into v_deck from public.decks where id = p_deck_id;
  if v_deck is null then
    raise exception 'Deck not found';
  end if;

  -- Get the max sort_order to append new cards
  select coalesce(max(sort_order), -1) + 1 into v_start_order
    from public.cards where deck_id = p_deck_id;

  begin
    for v_card_data in
      select
        (item->>'word')::text as word_de,
        (item->>'translation')::text as translation_ru,
        (item->>'translation_en')::text as translation_en,
        (item->>'translation_uk')::text as translation_uk,
        (item->>'group')::text as group_val,
        (item->'tags')::text[] as tags,
        (item->>'description')::text as description,
        (item->>'example_de')::text as example_de,
        (item->>'example_ru')::text as example_ru,
        (item->>'example_en')::text as example_en,
        (item->>'example_uk')::text as example_uk
      from jsonb_array_elements(p_cards) as item
    loop
      -- Skip if no word
      if v_card_data.word_de is null or v_card_data.word_de = '' then
        continue;
      end if;

      -- Try to update existing card
      update public.cards
      set
        translation_ru = coalesce(v_card_data.translation_ru, translation_ru),
        translation_en = coalesce(v_card_data.translation_en, translation_en),
        "group" = coalesce(v_card_data.group_val, "group"),
        tags = coalesce(v_card_data.tags, tags),
        description = coalesce(v_card_data.description, description),
        example_de = coalesce(v_card_data.example_de, example_de),
        example_ru = coalesce(v_card_data.example_ru, example_ru),
        example_en = coalesce(v_card_data.example_en, example_en)
      where deck_id = p_deck_id and word_de = v_card_data.word_de
      returning * into v_card;

      if v_card is not null then
        v_updated := v_updated + 1;
      else
        -- Insert new card
        insert into public.cards (
          deck_id, owner_id, word_de, translation_ru, translation_en,
          "group", tags, description, example_de, example_ru, example_en,
          created_by, sort_order
        )
        values (
          p_deck_id,
          v_deck.owner_id,
          v_card_data.word_de,
          coalesce(v_card_data.translation_ru, ''),
          coalesce(v_card_data.translation_en, ''),
          coalesce(v_card_data.group_val, ''),
          coalesce(v_card_data.tags, '{}'),
          coalesce(v_card_data.description, ''),
          coalesce(v_card_data.example_de, ''),
          coalesce(v_card_data.example_ru, ''),
          coalesce(v_card_data.example_en, ''),
          auth.uid(),
          v_start_order + v_index
        )
        returning * into v_card;
        v_inserted := v_inserted + 1;
      end if;

      -- Add Ukrainian translation if provided
      if v_card_data.translation_uk is not null and v_card_data.translation_uk != '' then
        insert into public.word_translations (card_id, language, text)
        values (v_card.id, 'uk', v_card_data.translation_uk)
        on conflict (card_id, language) do update set text = excluded.text;
      end if;

      -- Add Ukrainian example if provided
      if v_card_data.example_uk is not null and v_card_data.example_uk != '' then
        insert into public.word_examples (card_id, language, text)
        values (v_card.id, 'uk', v_card_data.example_uk)
        on conflict (card_id, language) do update set text = excluded.text;
      end if;

      v_index := v_index + 1;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_inserted, v_updated, v_error_msg;
end;
$$;

-- RPC: Migrate legacy card data to new multilingual system
-- This is optional and handles cases where old data needs to be
-- reorganized into the new structure
create or replace function public.migrate_cards_to_multilingual(
  p_deck_id uuid default null
)
returns table (
  migrated_count integer,
  error_message text
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_card public.cards;
  v_count integer := 0;
  v_error_msg text := null;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can migrate data';
  end if;

  begin
    -- Migrate translation_en to word_translations if not already present
    for v_card in
      select c.* from public.cards c
      where c.translation_en != ''
        and (p_deck_id is null or c.deck_id = p_deck_id)
    loop
      insert into public.word_translations (card_id, language, text)
      values (v_card.id, 'en', v_card.translation_en)
      on conflict (card_id, language) do update set text = excluded.text;

      if v_card.example_en != '' then
        insert into public.word_examples (card_id, language, text)
        values (v_card.id, 'en', v_card.example_en)
        on conflict (card_id, language) do update set text = excluded.text;
      end if;

      if v_card.description_en != '' then
        insert into public.word_descriptions (card_id, language, text)
        values (v_card.id, 'en', v_card.description_en)
        on conflict (card_id, language) do update set text = excluded.text;
      end if;

      v_count := v_count + 1;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_count, v_error_msg;
end;
$$;
