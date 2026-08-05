-- Study any language pair, not just the four the columns happen to name.
--
-- The card table hardcodes its languages: word_de, translation_ru,
-- translation_en, translation_uk (plus _en/_uk example and description
-- twins). getCardFront/getCardBack on the client switch over exactly those
-- codes, so of the 132 ordered pairs across the twelve languages in
-- public.languages, 12 work — and the other 120 fail *silently*: asking for
-- French front returns the Russian column, French back returns the German
-- word. Nothing tells the student they are not studying what they picked.
--
-- 0015/0016 already built the way out — languages, word_translations,
-- word_examples, word_descriptions, keyed by language code — and the app
-- has never read a single row from any of them. This migration makes those
-- tables the source of truth and gives the client one bulk read for a pair,
-- so adding a fifth language becomes a row in the database plus a CSV
-- column, with no frontend change.
--
-- The legacy columns stay put and stay authoritative as a fallback: they
-- are what every existing card actually holds, and the import path still
-- writes them.

-- ─────────────────────────────────────────────
-- WHICH LANGUAGES ARE ON OFFER
-- ─────────────────────────────────────────────
-- public.languages ships twelve rows, but only four have any content, and
-- listing the other eight in a picker is how you get a student staring at
-- an empty deck. Gate them explicitly instead: enabling a language is an
-- UPDATE, not a deploy.
alter table public.languages
  add column if not exists is_enabled boolean not null default false;

update public.languages set is_enabled = true where code in ('de', 'ru', 'en', 'uk');

comment on column public.languages.is_enabled is
  'Offered in the learning-pair picker. Flip on once cards carry text in this language.';

-- ─────────────────────────────────────────────
-- BACKFILL
-- ─────────────────────────────────────────────
-- 0016's migrate_cards_to_multilingual() only ever copied English — ru, de
-- and uk were left behind, which is why the new tables look empty even
-- after it has been run. Copy all four, treating the German headword as
-- just another language rather than a special column.
insert into public.word_translations (card_id, language, text)
select c.id, v.lang, v.txt
from public.cards c
cross join lateral (values
  ('de', c.word_de),
  ('ru', c.translation_ru),
  ('en', c.translation_en),
  ('uk', c.translation_uk)
) as v(lang, txt)
where coalesce(trim(v.txt), '') <> ''
on conflict (card_id, language) do nothing;

insert into public.word_examples (card_id, language, text)
select c.id, v.lang, v.txt
from public.cards c
cross join lateral (values
  ('de', c.example_de),
  ('ru', c.example_ru),
  ('en', c.example_en),
  ('uk', c.example_uk)
) as v(lang, txt)
where coalesce(trim(v.txt), '') <> ''
on conflict (card_id, language) do nothing;

insert into public.word_descriptions (card_id, language, text)
select c.id, v.lang, v.txt
from public.cards c
cross join lateral (values
  ('ru', c.description),
  ('en', c.description_en),
  ('uk', c.description_uk)
) as v(lang, txt)
where coalesce(trim(v.txt), '') <> ''
on conflict (card_id, language) do nothing;

-- ─────────────────────────────────────────────
-- BULK READ FOR ONE PAIR
-- ─────────────────────────────────────────────
-- get_card_multilingual() from 0015 resolves a single card, which is no use
-- to a client that loads every card it owns in one query (and pages through
-- thousands of them). This is the same idea for a whole student at once,
-- returning the columns cards_with_marks already returns plus the pair
-- resolved into text_from / text_to, so existing consumers keep working
-- while the study screens switch over to the resolved fields.
--
-- text_from / text_to are NULL when the card has nothing in that language —
-- deliberately, so the UI can say "this deck has no French" instead of
-- quietly showing Russian. The legacy columns are consulted first for the
-- four languages they cover, since older cards may predate the backfill.
create or replace function public.cards_for_pair(
  p_owner uuid,
  p_from text,
  p_to text
)
returns table (
  id uuid,
  deck_id uuid,
  owner_id uuid,
  deck_is_template boolean,
  sort_order integer,
  tags text[],
  "group" text,
  group_en text,
  group_uk text,
  word_de text,
  translation_ru text,
  translation_en text,
  translation_uk text,
  text_from text,
  text_to text,
  example_from text,
  example_to text,
  description_to text,
  teacher_status text,
  own_status text
)
language sql
stable
security invoker
as $$
  select
    c.id,
    c.deck_id,
    c.owner_id,
    d.is_template as deck_is_template,
    c.sort_order,
    c.tags,
    c."group",
    c.group_en,
    c.group_uk,
    c.word_de,
    c.translation_ru,
    c.translation_en,
    c.translation_uk,
    nullif(trim(coalesce(
      case p_from
        when 'de' then c.word_de
        when 'ru' then c.translation_ru
        when 'en' then c.translation_en
        when 'uk' then c.translation_uk
      end,
      tf.text
    )), '') as text_from,
    nullif(trim(coalesce(
      case p_to
        when 'de' then c.word_de
        when 'ru' then c.translation_ru
        when 'en' then c.translation_en
        when 'uk' then c.translation_uk
      end,
      tt.text
    )), '') as text_to,
    nullif(trim(coalesce(
      case p_from
        when 'de' then c.example_de
        when 'ru' then c.example_ru
        when 'en' then c.example_en
        when 'uk' then c.example_uk
      end,
      ef.text
    )), '') as example_from,
    nullif(trim(coalesce(
      case p_to
        when 'de' then c.example_de
        when 'ru' then c.example_ru
        when 'en' then c.example_en
        when 'uk' then c.example_uk
      end,
      et.text
    )), '') as example_to,
    nullif(trim(coalesce(
      case p_to
        when 'ru' then c.description
        when 'en' then c.description_en
        when 'uk' then c.description_uk
      end,
      dt.text
    )), '') as description_to,
    tm.status::text,
    om.status::text
  from public.cards c
  join public.decks d on d.id = c.deck_id
  left join public.word_translations tf on tf.card_id = c.id and tf.language = p_from
  left join public.word_translations tt on tt.card_id = c.id and tt.language = p_to
  left join public.word_examples     ef on ef.card_id = c.id and ef.language = p_from
  left join public.word_examples     et on et.card_id = c.id and et.language = p_to
  left join public.word_descriptions dt on dt.card_id = c.id and dt.language = p_to
  left join lateral (
    select cm.status
    from public.card_marks cm
    where cm.card_id = c.id and cm.is_teacher_mark = true
    order by cm.updated_at desc
    limit 1
  ) tm on true
  left join public.card_marks om
    on om.card_id = c.id and om.marked_by = c.owner_id
  where c.owner_id = p_owner
    and d.is_template = false;
$$;

comment on function public.cards_for_pair(uuid, text, text) is
  'Every card a student owns, resolved into one learning pair. NULL text_from/text_to means the card has no content in that language.';

-- security invoker, so the caller's RLS on cards/decks/card_marks still
-- decides what comes back — a teacher reading a linked student, a student
-- reading only their own.
grant execute on function public.cards_for_pair(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- WHICH PAIRS A STUDENT CAN ACTUALLY STUDY
-- ─────────────────────────────────────────────
-- Drives the picker's honesty: a language is worth offering to this student
-- only if their own cards carry text in it. Cheap — one grouped scan of the
-- translations they own.
create or replace function public.available_languages_for(p_owner uuid)
returns table (language text, card_count bigint)
language sql
stable
security invoker
as $$
  select wt.language, count(*) as card_count
  from public.word_translations wt
  join public.cards c on c.id = wt.card_id
  join public.decks d on d.id = c.deck_id
  where c.owner_id = p_owner
    and d.is_template = false
    and coalesce(trim(wt.text), '') <> ''
  group by wt.language
  order by card_count desc;
$$;

grant execute on function public.available_languages_for(uuid) to authenticated;
