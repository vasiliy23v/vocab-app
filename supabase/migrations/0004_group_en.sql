-- ============================================================
-- English topic-group names
--
-- Cards already have translation_ru / translation_en for the word
-- itself. The `group` column (topic, e.g. "Жильё и дом") only ever had
-- one language, so the group picker always showed Russian names even
-- when the interface language was English. This adds group_en,
-- mirroring translation_en: optional, falls back to `group` when blank.
-- ============================================================

alter table public.cards
  add column group_en text not null default '';

-- Recreate the view. Same rule as 0002/0003: CREATE OR REPLACE VIEW can
-- only append columns at the very end — keep every existing column in
-- its original position/name, add group_en last.
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
  c.group_en
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
-- to carry group_en along too or every assigned copy would lose it.
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
      "group", group_en, tags, description, example_de, example_ru, created_by, sort_order
    )
    select
      v_new_deck.id, v_student, c.word_de, c.translation_ru, c.translation_en,
      c."group", c.group_en, c.tags, c.description, c.example_de, c.example_ru, auth.uid(), c.sort_order
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

-- ─────────────────────────────────────────────
-- Backfill: English names for the standard topic groups shipped in the
-- German B1 vocabulary set. Safe to run more than once. Matches purely
-- on the Russian group text, so it applies across every deck/user that
-- used these exact topic names — no need to know deck IDs.
-- Any group not in this list (e.g. a custom one you typed yourself)
-- is left as '', which just falls back to showing the Russian name.
-- ─────────────────────────────────────────────
update public.cards c set group_en = v.group_en
from (values
  ('Повседневные действия', 'Everyday actions'),
  ('Жильё и дом', 'Housing and home'),
  ('Работа и профессия', 'Work and profession'),
  ('Телефон и коммуникация', 'Phone and communication'),
  ('Покупки, сервис, жалобы', 'Shopping, services, complaints'),
  ('Транспорт и путешествия', 'Transport and travel'),
  ('Автомобиль и правила движения', 'Cars and traffic rules'),
  ('Еда и питание', 'Food and eating'),
  ('Учёба, курсы, документы', 'Studies, courses, documents'),
  ('Время и абстрактные понятия', 'Time and abstract concepts'),
  ('Характер, чувства, поведение', 'Character, feelings, behavior'),
  ('Одежда и внешний вид', 'Clothing and appearance'),
  ('Местоимения и пары слов', 'Pronouns and word pairs'),
  ('Возвратные глаголы', 'Reflexive verbs'),
  ('Глаголы с предлогами', 'Verbs with prepositions'),
  ('Сильные глаголы (A1)', 'Strong verbs (A1)'),
  ('Сильные глаголы (A2)', 'Strong verbs (A2)'),
  ('Сильные глаголы (B1)', 'Strong verbs (B1)'),
  ('Сильные глаголы (B2)', 'Strong verbs (B2)'),
  ('Сильные глаголы (C1)', 'Strong verbs (C1)'),
  ('Сильные глаголы (C2)', 'Strong verbs (C2)'),
  ('Глаголы с предлогами (A1)', 'Verbs with prepositions (A1)'),
  ('Глаголы с предлогами (A2)', 'Verbs with prepositions (A2)'),
  ('Глаголы с предлогами (B1)', 'Verbs with prepositions (B1)'),
  ('Глаголы с предлогами (B2)', 'Verbs with prepositions (B2)'),
  ('Глаголы с предлогами (C1)', 'Verbs with prepositions (C1)'),
  ('Глаголы с предлогами (C2)', 'Verbs with prepositions (C2)'),
  ('Goethe B1: Человек и отношения', 'Goethe B1: People and relationships'),
  ('Goethe B1: Жильё', 'Goethe B1: Housing'),
  ('Goethe B1: Здоровье и тело', 'Goethe B1: Health and body'),
  ('Goethe B1: Работа и образование', 'Goethe B1: Work and education'),
  ('Goethe B1: Путешествия и транспорт', 'Goethe B1: Travel and transport'),
  ('Goethe B1: Еда и покупки', 'Goethe B1: Food and shopping'),
  ('Goethe B1: Госучреждения и услуги', 'Goethe B1: Government offices and services'),
  ('Goethe B1: Природа и окружающая среда', 'Goethe B1: Nature and environment'),
  ('Goethe B1: Культура и медиа', 'Goethe B1: Culture and media'),
  ('Goethe B1: Чувства и качества', 'Goethe B1: Feelings and qualities'),
  ('Goethe B1: Общение и язык', 'Goethe B1: Communication and language'),
  ('Goethe B1: Абстрактные понятия', 'Goethe B1: Abstract concepts'),
  ('База A1–A2: Семья и люди', 'Basics A1–A2: Family and people'),
  ('База A1–A2: Тело', 'Basics A1–A2: Body'),
  ('База A1–A2: Дом и мебель', 'Basics A1–A2: Home and furniture'),
  ('База A1–A2: Еда и напитки', 'Basics A1–A2: Food and drinks'),
  ('База A1–A2: Одежда', 'Basics A1–A2: Clothing'),
  ('База A1–A2: Город и места', 'Basics A1–A2: City and places'),
  ('База A1–A2: Транспорт (база)', 'Basics A1–A2: Transport (basic)'),
  ('База A1–A2: Время и календарь', 'Basics A1–A2: Time and calendar'),
  ('База A1–A2: Погода', 'Basics A1–A2: Weather'),
  ('База A1–A2: Цвета', 'Basics A1–A2: Colors'),
  ('База A1–A2: Животные', 'Basics A1–A2: Animals'),
  ('База A1–A2: Школа и офис', 'Basics A1–A2: School and office'),
  ('База A1–A2: Профессии', 'Basics A1–A2: Professions'),
  ('База A1–A2: Базовые глаголы', 'Basics A1–A2: Basic verbs'),
  ('База A1–A2: Прилагательные', 'Basics A1–A2: Adjectives'),
  ('База A1–A2: Фразы и вежливость', 'Basics A1–A2: Phrases and politeness'),
  ('База A1–A2: Вопросительные слова', 'Basics A1–A2: Question words'),
  ('База A1–A2: Числа и количество', 'Basics A1–A2: Numbers and quantity'),
  ('База A1–A2: Свободное время', 'Basics A1–A2: Free time'),
  ('База A1–A2: Люди и общество', 'Basics A1–A2: People and society'),
  ('База A1–A2: Ещё глаголы', 'Basics A1–A2: More verbs'),
  ('База A1–A2: Наречия и частицы', 'Basics A1–A2: Adverbs and particles')
) as v(group_ru, group_en)
where c."group" = v.group_ru and (c.group_en is null or c.group_en = '');
