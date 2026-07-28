-- Daily word goal: fixed level size for the student's learning path.
-- Null means "not chosen yet" — the app asks once and then remembers it.
alter table public.profiles
  add column if not exists words_per_day integer;
