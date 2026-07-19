-- ============================================================
-- English deck names
--
-- Deck names are free text typed by whoever created the deck (a
-- student naming their own deck, or a superadmin naming a template).
-- There was no English variant, so a deck named e.g. "Повторение" in
-- Russian always showed as "Повторение" even in the English interface.
-- This adds name_en, following the same optional/falls-back-when-blank
-- pattern as translation_en / group_en / example_en / description_en.
--
-- No view recreation needed here: cards_with_marks only reads
-- d.is_template from decks, never d.name, so it's unaffected.
-- ============================================================

alter table public.decks
  add column name_en text not null default '';

-- admin_assign_deck copies the template's name when creating a
-- student's own copy of the deck — carry name_en along too.
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

-- Lets any superadmin rename a deck (its own decks/templates, or one
-- created by a different superadmin) — a plain client-side update
-- would only work for the deck's own owner under the existing RLS
-- policies, and template decks are meant to be manageable by every
-- superadmin, not just whoever originally uploaded them.
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
