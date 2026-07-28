-- Study preference: buzz the device on each "I know it!" / correct answer.
-- Default on so new users get the stimulatory feedback out of the box.

alter table public.profiles
  add column if not exists vibrate_on_correct boolean not null default true;
