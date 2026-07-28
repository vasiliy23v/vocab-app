-- Seed a one-time "starter" deck for every brand-new user, right inside
-- the same trigger that already creates their profile row — this is
-- where new signups actually get their profile (public.handle_new_user
-- on auth.users), not the client-side fallback in useAuth.tsx (that only
-- ever runs if this trigger is missing, e.g. a fresh local setup).
-- Just something to click through; fully the student's own deck —
-- they can edit or delete it like any other.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_deck_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.decks (name, name_en, owner_id, created_by)
  values ('Первые слова', 'First words', new.id, new.id)
  returning id into v_deck_id;

  insert into public.cards (
    deck_id, owner_id, created_by, sort_order,
    word_de, translation_ru, translation_en, "group", group_en, tags,
    description, description_en, example_de, example_ru, example_en
  )
  values
    (v_deck_id, new.id, new.id, 0, 'Hallo', 'привет', 'hello', 'Приветствия', 'Greetings', array['greeting'],
      'Неформальное приветствие', 'Informal greeting', 'Hallo, wie geht''s?', 'Привет, как дела?', 'Hello, how are you?'),
    (v_deck_id, new.id, new.id, 1, 'Tschüss', 'пока', 'bye', 'Приветствия', 'Greetings', array['greeting'],
      'Неформальное прощание', 'Informal goodbye', 'Tschüss, bis morgen!', 'Пока, до завтра!', 'Bye, see you tomorrow!'),
    (v_deck_id, new.id, new.id, 2, 'danke', 'спасибо', 'thank you', 'Вежливые слова', 'Polite words', array[]::text[],
      '', '', 'Danke für deine Hilfe.', 'Спасибо за твою помощь.', 'Thanks for your help.'),
    (v_deck_id, new.id, new.id, 3, 'bitte', 'пожалуйста', 'please / you''re welcome', 'Вежливые слова', 'Polite words', array[]::text[],
      '', '', 'Ein Kaffee, bitte.', 'Один кофе, пожалуйста.', 'One coffee, please.'),
    (v_deck_id, new.id, new.id, 4, 'ja', 'да', 'yes', 'Основы', 'Basics', array[]::text[],
      '', '', 'Ja, das stimmt.', 'Да, это верно.', 'Yes, that''s right.'),
    (v_deck_id, new.id, new.id, 5, 'nein', 'нет', 'no', 'Основы', 'Basics', array[]::text[],
      '', '', 'Nein, danke.', 'Нет, спасибо.', 'No, thank you.'),
    (v_deck_id, new.id, new.id, 6, 'das Wasser', 'вода', 'water', 'Еда и напитки', 'Food & drink', array['noun'],
      'Сущ. ср. рода', 'Neuter noun', 'Ich trinke gern Wasser.', 'Я люблю пить воду.', 'I like drinking water.'),
    (v_deck_id, new.id, new.id, 7, 'gut', 'хорошо', 'good', 'Основы', 'Basics', array['adjective'],
      '', '', 'Mir geht es gut.', 'У меня всё хорошо.', 'I''m doing well.');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
