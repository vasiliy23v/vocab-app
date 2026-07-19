-- ============================================================
-- English example sentences
--
-- Flashcards always showed example_ru on the back, even when the
-- interface language was English. This adds example_en, following the
-- same pattern as translation_en / group_en: optional, falls back to
-- example_ru when blank.
--
-- Schema only — see backfill_example_en.sql for a one-time script that
-- fills in example_en for cards uploaded before this column existed.
-- ============================================================

alter table public.cards
  add column example_en text not null default '';

-- Recreate the view. Same rule as 0002/0003/0004: CREATE OR REPLACE VIEW
-- can only append columns at the very end.
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

-- admin_assign_deck copies template cards column-by-column, so it needs
-- to carry example_en along too.
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
