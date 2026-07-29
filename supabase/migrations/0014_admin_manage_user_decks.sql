-- ============================================================
-- Admin management of user decks
--
-- Allows superadmins to:
-- 1. List all decks of any specific user (student)
-- 2. Add/update cards in any user's deck
-- 3. Create a new deck for a specific user
--
-- This enables bulk vocabulary management for students and
-- solving issues like "add 1000+ words to student's deck"
-- ============================================================

-- RPC: List all decks (template + non-template) for a specific user
-- Used by admin to select which deck to add cards to
create or replace function public.admin_list_user_decks(p_user_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  name_en text,
  is_template boolean,
  created_at timestamptz,
  card_count bigint,
  created_by text
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can list user decks';
  end if;

  return query
    select
      d.id,
      d.owner_id,
      d.name,
      d.name_en,
      d.is_template,
      d.created_at,
      (select count(*) from public.cards c where c.deck_id = d.id)::bigint,
      coalesce(p.display_name, p.email)
    from public.decks d
    left join public.profiles p on p.id = d.created_by
    where d.owner_id = p_user_id
    order by d.created_at desc;
end;
$$;

-- RPC: Create a new deck for a specific user
-- Used by admin to create decks for students if they don't exist
create function public.admin_create_deck_for_user(
  p_user_id uuid,
  p_name text,
  p_name_en text default ''
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_deck_id uuid;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can create decks for users';
  end if;

  insert into public.decks (owner_id, name, name_en, created_by)
  values (p_user_id, p_name, p_name_en, auth.uid())
  returning id into v_deck_id;

  return v_deck_id;
end;
$$;

-- RPC: Add cards to any user's deck (superadmin only)
-- Designed to handle large batches (1000+) via client-side batch calls
-- Returns the number of cards added
create function public.admin_add_cards_to_deck(
  p_deck_id uuid,
  p_cards jsonb
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
  v_inserted integer := 0;
  v_start_order integer;
  v_index integer := 0;
  v_error_msg text := null;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can add cards to user decks';
  end if;

  -- Verify deck exists
  select * into v_deck from public.decks where id = p_deck_id;
  if v_deck is null then
    raise exception 'Deck not found';
  end if;

  -- Get the max sort_order to append new cards
  select coalesce(max(sort_order), -1) + 1 into v_start_order
    from public.cards where deck_id = p_deck_id;

  -- Insert each card from the JSON array
  begin
    for v_card_data in
      select
        (item->>'word_de')::text as word_de,
        (item->>'translation_ru')::text as translation_ru,
        (item->>'translation_en')::text as translation_en,
        (item->>'group')::text as group_val,
        (item->>'group_en')::text as group_en,
        (item->'tags')::text[] as tags,
        (item->>'description')::text as description,
        (item->>'description_en')::text as description_en,
        (item->>'example_de')::text as example_de,
        (item->>'example_ru')::text as example_ru,
        (item->>'example_en')::text as example_en
      from jsonb_array_elements(p_cards) as item
    loop
      insert into public.cards (
        deck_id, owner_id, word_de, translation_ru, translation_en,
        "group", group_en, tags, description, description_en,
        example_de, example_ru, example_en, created_by, sort_order
      )
      values (
        p_deck_id,
        v_deck.owner_id,
        v_card_data.word_de,
        v_card_data.translation_ru,
        v_card_data.translation_en,
        coalesce(v_card_data.group_val, ''),
        coalesce(v_card_data.group_en, ''),
        coalesce(v_card_data.tags, '{}'),
        coalesce(v_card_data.description, ''),
        coalesce(v_card_data.description_en, ''),
        coalesce(v_card_data.example_de, ''),
        coalesce(v_card_data.example_ru, ''),
        coalesce(v_card_data.example_en, ''),
        auth.uid(),
        v_start_order + v_index
      );
      v_inserted := v_inserted + 1;
      v_index := v_index + 1;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_inserted, v_error_msg;
end;
$$;
