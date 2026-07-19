-- ============================================================
-- Add English translation column to cards
--
-- The app UI can be switched between Russian and English. Card
-- content follows the same switch: `translation_ru` is shown when
-- the interface is in Russian, `translation_en` when it's in
-- English (falling back to `translation_ru` if no English
-- translation has been entered for a given card).
-- ============================================================

alter table public.cards
  add column translation_en text not null default '';

-- Recreate the view. Postgres only allows CREATE OR REPLACE VIEW to
-- *append* columns at the end of the output list — it cannot change
-- the name of a column that already exists at a given position. So
-- instead of `c.*` (which would now silently include translation_en
-- in the middle of the list and shift teacher_status/etc. over by
-- one, which Postgres rejects), we spell out the original columns in
-- their original order and add translation_en at the very end.
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
