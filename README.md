# Карточки · Немецкий

React + TypeScript + Vite + shadcn/ui + Supabase приложение для изучения немецких слов
с поддержкой учителей и учеников.

## Возможности

- Email/пароль авторизация (Supabase Auth)
- Загрузка карточек (TSV/CSV, файл или вставка текста)
- Карточки с переворотом (русский → немецкий, описание и примеры на немецкой стороне)
- Тест: выбор перевода, поиск правильного написания, ввод слова
- Разбивка на уровни по 20/25/30 слов
- Приглашение учителя по коду/ссылке (многие-ко-многим: у ученика может быть
  несколько учителей, у учителя — несколько учеников)
- Учитель видит таблицу слов ученика с тремя кнопками: **Знает / Не знает / Повторить**
- У ученика отдельно показываются:
  - **Повторение** — слова без отметки учителя или отмеченные «не знает» / «повторить»
  - **Выученное** — слова, отмеченные учителем «знает»
- Realtime-обновления (Supabase Realtime) — изменения видны без перезагрузки

## Технологии

- React 19 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui (Radix primitives)
- Supabase (Postgres, Auth, Row Level Security, Realtime)
- React Router

## Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. В SQL Editor выполните миграцию из `supabase/migrations/0001_init.sql`
3. В Project Settings → API скопируйте `Project URL` и `anon public key`
4. В Authentication → Providers убедитесь что Email включён
   (для разработки можно отключить "Confirm email" в Auth settings, чтобы не настраивать SMTP)
5. В Database → Replication включите `supabase_realtime` для таблиц
   `cards`, `card_marks`, `teacher_links`, `decks` (миграция делает это автоматически,
   но проверьте, что Realtime включён на уровне проекта)

## Локальная разработка

```bash
npm install
cp .env.example .env.local
# впишите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local
npm run dev
```

## Деплой (Vercel/Netlify)

1. Запушьте проект в Git-репозиторий
2. На Vercel/Netlify создайте новый проект из репозитория
3. Build command: `npm run build`, Output directory: `dist`
4. Добавьте переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
   в настройках проекта (Environment Variables)
5. Деплой

## Структура базы данных

| Таблица         | Назначение                                                    |
|-----------------|----------------------------------------------------------------|
| `profiles`      | Профиль пользователя (1:1 с `auth.users`)                      |
| `teacher_links` | Связь ученик↔учитель, многие-ко-многим                        |
| `invites`       | Коды-приглашения (генерирует ученик, принимает учитель)        |
| `decks`         | Наборы карточек (принадлежат ученику)                          |
| `cards`         | Отдельные слова в наборе                                       |
| `card_marks`    | Отметки на карточке (знает/не знает/повторить), от ученика или учителя |

Вид `cards_with_marks` объединяет карточку с последней отметкой учителя
(любого из привязанных учителей) и собственной отметкой ученика.

Вся логика доступа реализована через Row Level Security — учитель видит и
редактирует только карточки/отметки тех учеников, с которыми у него есть
активная связь в `teacher_links`.

## Структура проекта

```
src/
  components/ui/       — shadcn/ui компоненты (button, card, dialog, ...)
  components/           — Flashcard, QuizSession, LevelPicker, UploadDialog, AppLayout
  hooks/                 — useAuth, useTeacherLinks, useCards (decks/cards/marks)
  lib/                   — supabase client, parseVocab, quizEngine, levels, utils
  pages/                 — AuthPage, HomePage, PeoplePage, InvitePage,
                            StudentDashboard, TeacherStudentPage
  types/db.ts            — TypeScript типы, соответствующие схеме БД
supabase/migrations/    — SQL миграции
```
