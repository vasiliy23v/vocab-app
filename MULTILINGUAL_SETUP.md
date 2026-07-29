# Multilingual Vocabulary System Setup

## Overview

The new multilingual system supports unlimited languages (not just German→Russian/English). It maintains backward compatibility while providing a flexible architecture for adding new languages and language pairs.

## Architecture

### Database Schema

**New Tables:**
- `languages` - Registry of supported languages (de, ru, en, uk, fr, es, etc.)
- `language_pairs` - Defines which language pairs are available for learning
- `word_translations` - Translations of a word into any language
- `word_examples` - Example sentences in any language
- `word_descriptions` - Detailed descriptions in any language

**Backward Compatible:**
- Existing `cards` table still contains `word_de`, `translation_ru`, `translation_en`, `example_*`, `description_*` columns
- Existing cards continue to work without modification
- New multilingual data stored in separate tables

### Language Codes

Supported language codes:
- `de` - German (Deutsch)
- `ru` - Russian (Русский)
- `en` - English
- `uk` - Ukrainian (Українська)
- `fr` - French (Français)
- `es` - Spanish (Español)
- `it` - Italian (Italiano)
- `pt` - Portuguese (Português)
- `pl` - Polish (Polski)
- `ja` - Japanese (日本語)
- `zh` - Chinese (中文)
- `ko` - Korean (한국어)

Add more as needed via `admin_add_language()` RPC.

## Setup Steps

### 1. Apply Migrations

Run these migrations in order in your Supabase SQL Editor:

```bash
# Option A: Via Supabase Dashboard
# SQL Editor → Run each migration file in order:
# 1. supabase/migrations/0015_multilingual_system.sql
# 2. supabase/migrations/0016_multilingual_import.sql

# Option B: Via CLI
supabase db push
```

### 2. Create Language Pairs

Define which language pairs are available for learning:

```sql
-- Add new language pair for Ukrainian
SELECT public.admin_add_language_pair('de', 'uk');
SELECT public.admin_add_language_pair('ru', 'uk');

-- List all available pairs
SELECT * FROM public.language_pairs;
```

Or use the Admin Dashboard to add them programmatically.

## CSV Import Format

### Legacy Format (Backward Compatible)

Your existing CSV format continues to work:

```
word,translation,translation_en,group,tags,description,example_de,example_ru,example_en
auspacken,распаковывать,to unpack,Повседневные действия,verb;action,Отделяемый глагол,...
```

### New Multilingual Format

For importing multiple languages at once:

```
word,translation,translation_en,translation_uk,group,tags,description,description_uk,example_de,example_ru,example_uk
das Haus,дом,house,дім,Жилищо,noun;home,существительное,іменник,Das Haus ist groß,Дом большой,Дім великий
```

**Column naming conventions:**
- `translation` or `translation_ru` → Russian translation
- `translation_en` → English translation
- `translation_uk` → Ukrainian translation
- `translation_fr` → French translation
- Add any language: `translation_XX` where XX is the language code
- Same pattern for `example_XX`, `description_XX`, `group_XX`

### Using Your CSV File

Your file already has the perfect structure:

```
word,translation,translation_en,group,tags,description,example_de,example_ru,example_en
auspacken (hat ausgepackt),распаковывать,to unpack,Повседневные действия,verb;action;separable,...
```

To add Ukrainian translation, just add a `translation_uk` column:

```
word,translation,translation_en,translation_uk,group,tags,description,example_de,example_ru,example_uk
auspacken (hat ausgepackt),распаковывать,to unpack,розпаковувати,Повседневні дії,verb;action;separable,...
```

## Admin Dashboard

### Upload Cards with Multiple Languages

1. **Admin Panel → Vocabulary Tab**
2. Select a student
3. Select/create a deck for that student
4. Click **"Add words"**
5. Upload CSV with multilingual data
6. System automatically detects languages and stores translations

### Add New Language

```typescript
// Via Supabase Dashboard or programmatically
const { data } = await supabase.rpc('admin_add_language', {
  p_code: 'pt',
  p_name: 'Portuguese',
  p_native_name: 'Português',
  p_direction: 'ltr'
})
```

### Add Language Pair

```typescript
const { data } = await supabase.rpc('admin_add_language_pair', {
  p_language_from: 'en',
  p_language_to: 'pt'
})
```

## TypeScript Usage

### Load Available Languages

```typescript
import { useLanguages } from '@/hooks/useMultilingualSystem'

function MyComponent() {
  const { languages, loading } = useLanguages()
  
  return (
    <ul>
      {languages.map(lang => (
        <li key={lang.code}>{lang.native_name}</li>
      ))}
    </ul>
  )
}
```

### Load Language Pairs

```typescript
import { useLanguagePairs } from '@/hooks/useMultilingualSystem'

function LanguagePairSelector() {
  const { pairs, loading } = useLanguagePairs()
  
  return (
    <select>
      {pairs.map(pair => (
        <option key={pair.id}>
          {pair.language_from_name} → {pair.language_to_name}
        </option>
      ))}
    </select>
  )
}
```

### Manage Word Translations

```typescript
import { useWordTranslations } from '@/hooks/useMultilingualSystem'

function CardEditor({ cardId }) {
  const { translations, addTranslation, updateTranslation } = useWordTranslations(cardId)
  
  const handleAddRussian = async () => {
    await addTranslation('ru', 'новое слово')
  }
  
  const handleUpdateUkrainian = async () => {
    await updateTranslation('uk', 'оновлене слово')
  }
  
  return (
    // Edit translations for all languages
  )
}
```

### Import Multilingual Cards

```typescript
import { useAdminUserDecks } from '@/hooks/useAdminUserDecks'
import { parseMultilingualVocab } from '@/lib/parseVocab'

function ImportMultilingual() {
  const { addMultilingualCards } = useAdminUserDecks(studentId)
  
  const handleImport = async (csvContent) => {
    const { cards, detectedLanguages } = parseMultilingualVocab(csvContent)
    
    console.log('Detected languages:', detectedLanguages)
    // Output: ['de', 'ru', 'en', 'uk']
    
    await addMultilingualCards(
      deckId,
      cards,
      'de',  // language_from
      'ru',  // language_to
      (done, total) => console.log(`${done}/${total}`)
    )
  }
}
```

## Query Language Pairs

The system provides RPC function to query available pairs:

```typescript
const { data } = await supabase.rpc('list_language_pairs')
// Returns:
// [
//   { language_from: 'de', language_from_name: 'Deutsch', language_to: 'ru', language_to_name: 'Русский' },
//   { language_from: 'de', language_from_name: 'Deutsch', language_to: 'en', language_to_name: 'English' },
//   ...
// ]
```

## Scaling Guide

### Add More Languages

1. **Add to CSV file:**
   ```
   word,translation,translation_en,translation_uk,translation_fr,translation_pt
   ```

2. **System auto-detects** during import

3. **Or pre-register language** (if not in CSV):
   ```sql
   SELECT public.admin_add_language('pt', 'Portuguese', 'Português', 'ltr');
   ```

### Add More Language Pairs

```sql
-- Teachers can now use these pairs
SELECT public.admin_add_language_pair('en', 'pt');
SELECT public.admin_add_language_pair('uk', 'en');
```

## Migration from Legacy System

### Keep Existing Data

All existing cards work as-is. No migration needed.

### Optionally Migrate to New Tables

```sql
-- Migrate existing translation_en/example_en/description_en to new system
SELECT public.migrate_cards_to_multilingual(NULL);

-- Or for a specific deck
SELECT public.migrate_cards_to_multilingual('deck-id-here');
```

This is **optional** - existing data remains compatible.

## Performance Notes

- ✅ Indexes on `(card_id, language)` for fast lookups
- ✅ Realtime subscriptions enabled for collaboration
- ✅ RLS policies maintain security across all tables
- ⚠️ Large bulk imports use batching (250 cards per request)

## Troubleshooting

### CSV not parsing correctly

Check column order:
```
word | translation | translation_en | translation_uk | group | tags | ...
```

The parser looks for exact column names (case-insensitive).

### Language code not recognized

Make sure language code is in the `languages` table:
```sql
SELECT code, name FROM public.languages;
```

Add missing language:
```sql
SELECT public.admin_add_language('xx', 'Language Name', 'Название', 'ltr');
```

### No translations appearing

Check `word_translations` table:
```sql
SELECT * FROM public.word_translations WHERE card_id = 'card-id';
```

If empty, make sure import function successfully ran and returned `inserted_count > 0`.

## Next Steps

1. ✅ Apply migrations (0015 and 0016)
2. ✅ Define language pairs you need
3. ✅ Add Ukrainian column to your CSV
4. ✅ Import via Admin Dashboard → Vocabulary
5. ✅ Add more languages as needed

Your system is now infinitely scalable! 🚀
