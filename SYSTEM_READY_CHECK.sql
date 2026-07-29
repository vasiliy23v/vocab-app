-- ============================================================
-- SYSTEM READINESS CHECK
-- Run this to see what's ready and what needs to be done
-- ============================================================

\echo '======================================'
\echo '📊 SYSTEM STATE ANALYSIS'
\echo '======================================'

-- 1. EXISTING DATA
\echo ''
\echo '1️⃣ EXISTING DATA:'
\echo '---'

SELECT
  'Profiles (Users)' as entity,
  COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 'Decks', COUNT(*) FROM public.decks
UNION ALL
SELECT 'Cards', COUNT(*) FROM public.cards
UNION ALL
SELECT 'Teacher Links', COUNT(*) FROM public.teacher_links
ORDER BY entity;

-- 2. MIGRATION STATUS
\echo ''
\echo '2️⃣ MIGRATION STATUS:'
\echo '---'

-- Check old admin functions
SELECT 'admin_list_user_decks (0014)' as migration,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_list_user_decks') THEN '✅ DONE' ELSE '❌ PENDING' END as status
UNION ALL
SELECT 'admin_create_deck_for_user (0014)',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_create_deck_for_user') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'admin_add_cards_to_deck (0014)',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_add_cards_to_deck') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'Languages table (0015)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'languages') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'Language Pairs table (0015)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'language_pairs') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'Word Translations table (0015)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'word_translations') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'Word Examples table (0015)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'word_examples') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'Word Descriptions table (0015)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'word_descriptions') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'import_multilingual_cards (0016)',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'import_multilingual_cards') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'admin_add_language (0016)',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_add_language') THEN '✅ DONE' ELSE '❌ PENDING' END
UNION ALL
SELECT 'admin_add_language_pair (0016)',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_add_language_pair') THEN '✅ DONE' ELSE '❌ PENDING' END;

-- 3. LANGUAGES
\echo ''
\echo '3️⃣ LANGUAGES AVAILABLE:'
\echo '---'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'languages') THEN
    EXECUTE 'SELECT code, native_name FROM public.languages ORDER BY code';
  ELSE
    RAISE NOTICE 'Languages table not yet created (0015 migration pending)';
  END IF;
END $$;

-- 4. LANGUAGE PAIRS
\echo ''
\echo '4️⃣ LANGUAGE PAIRS CONFIGURED:'
\echo '---'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'language_pairs') THEN
    EXECUTE 'SELECT l1.native_name || '' → '' || l2.native_name as pair
      FROM public.language_pairs lp
      JOIN public.languages l1 ON l1.code = lp.language_from
      JOIN public.languages l2 ON l2.code = lp.language_to
      ORDER BY l1.code, l2.code';
  ELSE
    RAISE NOTICE 'Language Pairs table not yet created (0015 migration pending)';
  END IF;
END $$;

-- 5. ADMIN USERS
\echo ''
\echo '5️⃣ ADMIN USERS:'
\echo '---'

SELECT
  display_name as name,
  email,
  role as permission_level
FROM public.profiles
WHERE role = 'superadmin'
ORDER BY created_at DESC;

-- 6. READY STATUS
\echo ''
\echo '6️⃣ SYSTEM READY STATUS:'
\echo '---'

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_list_user_decks')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'languages')
    AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'import_multilingual_cards')
  THEN '✅ ALL MIGRATIONS APPLIED - SYSTEM READY!'
  ELSE '❌ SOME MIGRATIONS PENDING - SEE ABOVE'
END as system_status;

-- 7. ACTION ITEMS
\echo ''
\echo '7️⃣ NEXT STEPS:'
\echo '---'
\echo 'If any ❌ above:'
\echo '  1. Open supabase/migrations/ folder'
\echo '  2. Run pending migrations in SQL Editor'
\echo '  3. Run this check again to verify'
\echo ''
\echo 'If all ✅:'
\echo '  1. Download examples_multilingual_ukrainian.csv'
\echo '  2. Go to Admin Panel → Vocabulary (new tab)'
\echo '  3. Select Student → Select Deck → "Add words"'
\echo '  4. Upload CSV'
\echo '  5. Done! 🎉'
\echo '======================================';
