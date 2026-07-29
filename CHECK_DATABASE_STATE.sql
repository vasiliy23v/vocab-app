-- ============================================================
-- DATABASE STATE CHECK
-- Run this in Supabase SQL Editor to see what you have
-- ============================================================

-- 1. Check existing decks
SELECT
  'DECKS' as check_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM public.decks;

-- 2. Check existing cards
SELECT
  'CARDS' as check_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM public.cards;

-- 3. Check existing users
SELECT
  'USERS (Profiles)' as check_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM public.profiles;

-- 4. Check if NEW multilingual tables exist (will error if not - that's normal)
SELECT
  'LANGUAGES' as check_type,
  COUNT(*) as count
FROM public.languages;

-- 5. Show migration history (if using Supabase CLI)
SELECT version, name FROM public.schema_migrations ORDER BY version DESC LIMIT 10;

-- 6. List all tables in public schema
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 7. Show all RPC functions
SELECT
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
