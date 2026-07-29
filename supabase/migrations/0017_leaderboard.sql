-- Add leaderboard support
ALTER TABLE public.profiles
ADD COLUMN show_on_leaderboard boolean DEFAULT false,
ADD COLUMN flames_count integer DEFAULT 0;

-- Create leaderboard view (shows only opted-in users)
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.display_name,
  p.email,
  p.flames_count,
  ROW_NUMBER() OVER (ORDER BY p.flames_count DESC) as rank
FROM public.profiles p
WHERE p.show_on_leaderboard = true
  AND p.flames_count > 0
ORDER BY p.flames_count DESC;

-- Index for faster leaderboard queries
CREATE INDEX profiles_flames_idx ON public.profiles(flames_count DESC) WHERE show_on_leaderboard = true;

-- Function to add flames when marking a card as known
CREATE OR REPLACE FUNCTION public.add_flame_for_known_card()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add flames when status is 'known'
  IF NEW.status = 'known' THEN
    -- Use INSERT ... ON CONFLICT to avoid deadlocks
    INSERT INTO public.profiles (id, flames_count)
    VALUES (NEW.student_id, 1)
    ON CONFLICT (id) DO UPDATE
    SET flames_count = public.profiles.flames_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically add flames
DROP TRIGGER IF EXISTS trigger_add_flame_on_mark ON public.card_marks;
CREATE TRIGGER trigger_add_flame_on_mark
AFTER INSERT ON public.card_marks
FOR EACH ROW
EXECUTE FUNCTION public.add_flame_for_known_card();
