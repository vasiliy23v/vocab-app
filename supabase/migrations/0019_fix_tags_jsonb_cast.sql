-- ============================================================
-- Fix "cannot cast type jsonb to text[]" in admin_upsert_cards_to_deck
--
-- `(item->'tags')::text[]` is not a valid Postgres cast — jsonb can't
-- be cast directly to text[]. It has to go through
-- jsonb_array_elements_text() + array_agg(). This bug was copied from
-- the older admin_add_cards_to_deck (0014), which never surfaced it
-- because nothing exercising it ever sent a non-empty `tags` array
-- through that RPC — this CSV import is the first to hit it.
-- ============================================================

create or replace function public.admin_upsert_cards_to_deck(
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
  v_updated_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_start_order integer;
  v_index integer := 0;
  v_error_msg text := null;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Only a superadmin can add cards to user decks';
  end if;

  select * into v_deck from public.decks where id = p_deck_id;
  if v_deck is null then
    raise exception 'Deck not found';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_start_order
    from public.cards where deck_id = p_deck_id;

  begin
    for v_card_data in
      select
        (item->>'word_de')::text as word_de,
        (item->>'translation_ru')::text as translation_ru,
        (item->>'translation_en')::text as translation_en,
        (item->>'translation_uk')::text as translation_uk,
        (item->>'group')::text as group_val,
        (item->>'group_en')::text as group_en,
        (item->>'group_uk')::text as group_uk,
        (
          select coalesce(array_agg(t), '{}'::text[])
          from jsonb_array_elements_text(coalesce(item->'tags', '[]'::jsonb)) t
        ) as tags,
        (item->>'description')::text as description,
        (item->>'description_en')::text as description_en,
        (item->>'description_uk')::text as description_uk,
        (item->>'example_de')::text as example_de,
        (item->>'example_ru')::text as example_ru,
        (item->>'example_en')::text as example_en,
        (item->>'example_uk')::text as example_uk
      from jsonb_array_elements(p_cards) as item
    loop
      if v_card_data.word_de is null or v_card_data.word_de = '' then
        continue;
      end if;

      update public.cards set
        translation_ru = coalesce(v_card_data.translation_ru, translation_ru),
        translation_en = coalesce(v_card_data.translation_en, translation_en),
        translation_uk = coalesce(v_card_data.translation_uk, translation_uk),
        "group" = coalesce(v_card_data.group_val, "group"),
        group_en = coalesce(v_card_data.group_en, group_en),
        group_uk = coalesce(v_card_data.group_uk, group_uk),
        tags = coalesce(v_card_data.tags, tags),
        description = coalesce(v_card_data.description, description),
        description_en = coalesce(v_card_data.description_en, description_en),
        description_uk = coalesce(v_card_data.description_uk, description_uk),
        example_de = coalesce(v_card_data.example_de, example_de),
        example_ru = coalesce(v_card_data.example_ru, example_ru),
        example_en = coalesce(v_card_data.example_en, example_en),
        example_uk = coalesce(v_card_data.example_uk, example_uk)
      where deck_id = p_deck_id and word_de = v_card_data.word_de
      returning id into v_updated_id;

      if v_updated_id is not null then
        v_updated := v_updated + 1;
      else
        insert into public.cards (
          deck_id, owner_id, word_de,
          translation_ru, translation_en, translation_uk,
          "group", group_en, group_uk,
          tags,
          description, description_en, description_uk,
          example_de, example_ru, example_en, example_uk,
          created_by, sort_order
        )
        values (
          p_deck_id,
          v_deck.owner_id,
          v_card_data.word_de,
          coalesce(v_card_data.translation_ru, ''),
          coalesce(v_card_data.translation_en, ''),
          coalesce(v_card_data.translation_uk, ''),
          coalesce(v_card_data.group_val, ''),
          coalesce(v_card_data.group_en, ''),
          coalesce(v_card_data.group_uk, ''),
          coalesce(v_card_data.tags, '{}'),
          coalesce(v_card_data.description, ''),
          coalesce(v_card_data.description_en, ''),
          coalesce(v_card_data.description_uk, ''),
          coalesce(v_card_data.example_de, ''),
          coalesce(v_card_data.example_ru, ''),
          coalesce(v_card_data.example_en, ''),
          coalesce(v_card_data.example_uk, ''),
          auth.uid(),
          v_start_order + v_index
        );
        v_inserted := v_inserted + 1;
      end if;

      v_index := v_index + 1;
    end loop;
  exception when others then
    v_error_msg := sqlerrm;
  end;

  return query select v_inserted, v_updated, v_error_msg;
end;
$$;
