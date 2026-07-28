-- Add language_from and language_to columns to profiles table
-- to allow users to select which language pair they want to learn

alter table public.profiles
add column language_from text default 'en' not null,
add column language_to text default 'de' not null;

-- Add constraint to ensure language_from and language_to are valid language codes
alter table public.profiles
add constraint check_language_from check (language_from in ('ru', 'en', 'de')),
add constraint check_language_to check (language_to in ('ru', 'en', 'de')),
add constraint check_different_languages check (language_from != language_to);
