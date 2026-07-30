-- ============================================================
-- Fix "check_language_from" rejecting valid languages
--
-- profiles.language_from/language_to still carried the check
-- constraint from before the multilingual system existed (0013),
-- hardcoded to ('ru', 'en', 'de'). 0015 introduced a proper
-- `languages` registry (12 languages, including 'uk') and used it
-- as a foreign key for language_pairs — but nobody updated profiles
-- to match, so picking e.g. Ukrainian as a study language in
-- Settings failed with a 23514 check-constraint violation.
--
-- Replace the fixed whitelist with foreign keys into `languages`,
-- the same pattern language_pairs already uses — new languages
-- added to the registry work here automatically.
-- ============================================================

alter table public.profiles
  drop constraint if exists check_language_from,
  drop constraint if exists check_language_to;

alter table public.profiles
  add constraint profiles_language_from_fkey
    foreign key (language_from) references public.languages(code),
  add constraint profiles_language_to_fkey
    foreign key (language_to) references public.languages(code);
