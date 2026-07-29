# Полный План Применения Миграций

## 📋 Шаг 0: Проверка Текущего Состояния

**⚠️ СНАЧАЛА СДЕЛАЙТЕ ЭТО:**

1. Откройте **Supabase Dashboard**
2. Перейдите в **SQL Editor**
3. Скопируйте содержимое `CHECK_DATABASE_STATE.sql`
4. Запустите запрос
5. Посмотрите результаты:

**Что вы увидите:**
```
DECKS              | count: X  (количество колод)
CARDS              | count: Y  (количество карточек)
USERS              | count: Z  (количество пользователей)
LANGUAGES          | count: 0  (пока не существует - это нормально!)
```

---

## 🔧 Шаг 1: Применение Миграций (В Порядке!)

### Вариант A: Через Supabase Dashboard (Рекомендуется)

#### 1.1 Откройте SQL Editor
- Supabase Dashboard → **SQL Editor** → **New query**

#### 1.2 Примените миграцию #0014 (Admin управление колодами)
```
Файл: supabase/migrations/0014_admin_manage_user_decks.sql
Статус: ✅ Уже применена (была создана в начале)
Проверка: Запустите это
```

Скопируйте и запустите:
```sql
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'admin_list_user_decks'
);
```

Если результат `true` - миграция уже применена! ✅

#### 1.3 Примените миграцию #0015 (Многоязычная система)

Файл: `supabase/migrations/0015_multilingual_system.sql`

1. Откройте файл
2. Скопируйте весь текст
3. В SQL Editor → **New query**
4. Вставьте текст
5. Запустите (**Ctrl+Enter** или кнопка Run)

**Что произойдёт:**
- Создана таблица `languages` (12 языков)
- Создана таблица `language_pairs`
- Создана таблица `word_translations`
- Создана таблица `word_examples`
- Создана таблица `word_descriptions`
- Созданы RPC функции
- Включены RLS политики

**Проверка:**
```sql
SELECT COUNT(*) as language_count FROM public.languages;
-- Результат должен быть: 12
```

#### 1.4 Примените миграцию #0016 (Импорт и управление)

Файл: `supabase/migrations/0016_multilingual_import.sql`

Повторите шаги 1.3 (новый запрос, вставьте текст, запустите)

**Что произойдёт:**
- RPC функция `import_multilingual_cards()`
- RPC функция `admin_add_language()`
- RPC функция `admin_add_language_pair()`
- RPC функция `migrate_cards_to_multilingual()`

**Проверка:**
```sql
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'import_multilingual_cards'
);
-- Результат должен быть: true
```

---

## ✅ Шаг 2: Проверка Что Всё Работает

Запустите этот скрипт:

```sql
-- 1. Проверка таблиц
SELECT 'languages' as table_name, COUNT(*) as rows FROM public.languages
UNION ALL
SELECT 'language_pairs', COUNT(*) FROM public.language_pairs
UNION ALL
SELECT 'word_translations', COUNT(*) FROM public.word_translations
UNION ALL
SELECT 'word_examples', COUNT(*) FROM public.word_examples
UNION ALL
SELECT 'word_descriptions', COUNT(*) FROM public.word_descriptions;

-- 2. Проверка RPC функций
SELECT routine_name 
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE 'admin_%' OR routine_name LIKE 'import_%')
ORDER BY routine_name;

-- 3. Проверка языков
SELECT code, name, native_name FROM public.languages ORDER BY code;

-- 4. Проверка пар языков
SELECT l1.native_name || ' → ' || l2.native_name as pair
FROM public.language_pairs lp
JOIN public.languages l1 ON l1.code = lp.language_from
JOIN public.languages l2 ON l2.code = lp.language_to
ORDER BY l1.code, l2.code;
```

**Ожидаемые результаты:**
```
languages:              12 rows
language_pairs:         9+ rows (DE→RU, DE→EN, DE→UK, RU→EN, RU→UK, EN→UK, EN→RU, UK→RU, UK→EN)
word_translations:      0 rows (пока пусто - добавим после импорта)
word_examples:          0 rows
word_descriptions:      0 rows
```

---

## 📊 Шаг 3: Добавление Украинского Языка (Опционально)

Если вы хотите убедиться, что всё работает:

```sql
-- Язык уже есть, но проверьте пары:
SELECT * FROM public.language_pairs 
WHERE language_from = 'de' AND language_to = 'uk'
   OR language_from = 'uk' AND language_to = 'de';

-- Если результат пуст, добавьте пару:
SELECT public.admin_add_language_pair('de', 'uk');
SELECT public.admin_add_language_pair('uk', 'ru');
SELECT public.admin_add_language_pair('uk', 'en');
```

---

## 🎓 Шаг 4: Готов ли Приложение?

### Проверьте компиляцию:
```bash
# Terminal в папке проекта
npm run build
```

Если есть ошибки - дайте мне знать.

### Проверьте в браузере:
1. Запустите: `npm run dev`
2. Откройте http://localhost:5173
3. Войдите как суперадмин
4. Перейдите в **Admin Panel → Vocabulary** (новая вкладка)
5. Попробуйте загрузить CSV с `examples_multilingual_ukrainian.csv`

---

## 🚨 Если Что-то Не Работает

### Миграция не применилась?
```sql
-- Проверьте ошибку
SELECT * FROM public.schema_migrations ORDER BY version DESC LIMIT 5;

-- Попробуйте запустить миграцию снова (команды идемпотентны)
-- Скопируйте текст миграции и запустите ещё раз
```

### Таблица не создалась?
```sql
-- Проверьте существование
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'languages' 
  AND table_schema = 'public'
);
-- true = таблица есть, false = нет
```

### RPC функция не работает?
```sql
-- Проверьте права доступа
SELECT pg_get_functiondef('public.import_multilingual_cards'::regprocedure);

-- Попробуйте вызвать как superuser
SELECT public.admin_add_language('test_de', 'Test', 'Test', 'ltr');
```

---

## 📝 Полная Последовательность Действий

```
1. ✅ Проверка БД (CHECK_DATABASE_STATE.sql)
   ↓
2. ✅ Миграция 0014 (уже должна быть)
   ↓
3. ✅ Миграция 0015 (многоязычная система)
   ↓
4. ✅ Миграция 0016 (импорт и управление)
   ↓
5. ✅ Проверка всё ли создалось
   ↓
6. ✅ Добавление пар языков (опционально)
   ↓
7. ✅ Тестирование в браузере
   ↓
8. ✅ Готово! Загружайте CSV
```

---

## 🎉 Что Делать После Миграций

### Вариант 1: Загрузить Пример
1. Скачайте `examples_multilingual_ukrainian.csv`
2. Admin Panel → Vocabulary
3. Select Student → Select Deck
4. Click "Add words" → Upload CSV
5. Готово! ✅

### Вариант 2: Используйте Свой CSV
1. Добавьте колонку `translation_uk` к вашему файлу
2. Загрузите через Admin Panel → Vocabulary
3. Система автоматически обнаружит все языки
4. Готово! ✅

### Вариант 3: Добавить Другие Языки
```sql
-- Добавить французский
SELECT public.admin_add_language_pair('de', 'fr');
SELECT public.admin_add_language_pair('en', 'fr');

-- Добавить португальский
SELECT public.admin_add_language_pair('de', 'pt');
SELECT public.admin_add_language_pair('en', 'pt');
```

Потом добавьте колонки `translation_fr`, `translation_pt` в CSV и загрузите.

---

## ❓ Вопросы?

Если что-то не понятно или не работает:
1. Дайте мне результат запроса из **Шага 2**
2. Дайте скопированный текст ошибки
3. Скажите какой шаг не получился

Я буду помогать! 🚀
