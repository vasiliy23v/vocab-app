-- Daily study streak: encourages the student to come back every day.
-- last_study_date drives the streak math client-side (see useStudyStreak);
-- current_streak/longest_streak are only written when a study session
-- finishes, via the same profiles_update_own RLS policy vibrate_on_correct uses.

alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_study_date date;
