-- ============================================================
-- Ukrainian card columns + admin upsert-on-import
--
-- Problem 1: cards had no Ukrainian columns (only translation_ru /
-- translation_en), even though the UI now offers uk as a learning
-- language. Following the existing flat-column pattern (translation_en,
-- group_en, description_en, example_en), add the _uk equivalents.
--
-- Problem 2: admin_add_cards_to_deck only ever INSERTed cards, so
-- re-uploading a CSV to refresh an existing student's deck just
-- duplicated every word instead of updating it. admin_upsert_cards_to_deck
-- replaces it: matches existing cards by (deck_id, word_de) and updates
-- them in place, only inserting when no match is found.
-- ============================================================

alter table public.cards
  add column translation_uk text not null default '',
  add column group_uk text not null default '',
  add column description_uk text not null default '',
  add column example_uk text not null default '';

-- Recreate the view — CREATE OR REPLACE VIEW can only append columns
-- at the very end, same rule as every prior cards_with_marks migration.
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
  c.description_en,
  c.translation_uk,
  c.group_uk,
  c.description_uk,
  c.example_uk
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

-- RPC: upsert cards into any user's deck (superadmin only).
-- Matches on (deck_id, word_de): updates the row if found, otherwise
-- inserts a new one. Returns separate inserted/updated counts so the
-- admin UI can show "12 added, 340 updated".
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
        (item->'tags')::text[] as tags,
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

-- admin_assign_deck copies template cards column-by-column (see 0006),
-- so it needs to carry the new _uk columns along too, or assigning a
-- template with Ukrainian content to a student would silently drop it.
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
      deck_id, owner_id, word_de,
      translation_ru, translation_en, translation_uk,
      "group", group_en, group_uk,
      tags,
      description, description_en, description_uk,
      example_de, example_ru, example_en, example_uk,
      created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de,
      c.translation_ru, c.translation_en, c.translation_uk,
      c."group", c.group_en, c.group_uk,
      c.tags,
      c.description, c.description_en, c.description_uk,
      c.example_de, c.example_ru, c.example_en, c.example_uk,
      auth.uid(), c.sort_order
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
