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
- Интерфейс на русском и английском (переключатель в шапке), выбор сохраняется в браузере
- У каждой карточки два перевода: `translation` (русский) и `translation_en` (английский,
  необязательный) — при английском интерфейсе показывается `translation_en`
- Роль **суперадмина**: админ-панель (`/admin`) со списком всех пользователей
  (роль, кол-во наборов/карточек, связи учитель↔ученик), сброс пароля пользователю,
  повышение/понижение роли, удаление аккаунта
- Библиотека шаблонов карточек — суперадмин собирает набор один раз и назначает
  его конкретным ученикам (каждому создаётся собственная копия)
- Сброс пароля по email (ссылка на `/reset-password`) — и для себя со страницы входа,
  и по кнопке из админ-панели для любого пользователя

## Технологии

- React 19 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui (Radix primitives)
- Supabase (Postgres, Auth, Row Level Security, Realtime)
- React Router

## Настройка Supabase

Миграции (`supabase/migrations/0001_init.sql`, `0002_add_translation_en.sql`,
`0003_superadmin.sql`) применяются через Supabase CLI — так они гарантированно
выполняются по порядку и в правильной транзакции.

1. Создайте проект на [supabase.com](https://supabase.com) (или используйте существующий)
2. Установите CLI и авторизуйтесь:
   ```bash
   npx supabase login
   ```
3. Свяжите репозиторий с проектом (Project ref — в Project Settings → General):
   ```bash
   npx supabase link --project-ref <ваш-project-ref>
   ```
   CLI попросит database password проекта (Project Settings → Database).
4. Примените все миграции разом:
   ```bash
   npx supabase db push
   ```
5. В Project Settings → API скопируйте `Project URL` и `anon public key` в `.env.local`
6. В Authentication → Providers убедитесь что Email включён
   (для разработки можно отключить "Confirm email" в Auth settings, чтобы не настраивать SMTP)
7. В Authentication → URL Configuration добавьте `<ваш-домен>/reset-password`
   в Redirect URLs — иначе ссылка для сброса пароля не сработает
8. В Database → Replication включите `supabase_realtime` для таблиц
   `cards`, `card_marks`, `teacher_links`, `decks` (миграция делает это автоматически,
   но проверьте, что Realtime включён на уровне проекта)
9. Назначьте себя суперадмином (единственный шаг, который делается вручную —
   первого суперадмина некому назначить кроме вас) — в SQL Editor:
   ```sql
   update public.profiles set role = 'superadmin' where email = 'you@example.com';
   ```

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
| `decks`         | Наборы карточек (принадлежат ученику; `is_template = true` — шаблон суперадмина) |
| `cards`         | Отдельные слова в наборе                                       |
| `card_marks`    | Отметки на карточке (знает/не знает/повторить), от ученика или учителя |
| `deck_assignments` | Какой шаблон какому ученику назначен и какой набор ему скопирован |

`profiles.role` — `'user'` или `'superadmin'`. Вид `cards_with_marks` объединяет
карточку с последней отметкой учителя (любого из привязанных учителей) и
собственной отметкой ученика.

Вся логика доступа реализована через Row Level Security — учитель видит и
редактирует только карточки/отметки тех учеников, с которыми у него есть
активная связь в `teacher_links`; суперадмин (`is_superadmin()`) видит и
редактирует всё. Действия админ-панели (список пользователей, смена роли,
удаление аккаунта, назначение шаблона) идут через RPC
(`admin_list_profiles`, `admin_set_role`, `admin_delete_user`, `admin_assign_deck`) —
всё проверяется на стороне базы, без сервисного ключа Supabase.

## Структура проекта

```
src/
  components/ui/       — shadcn/ui компоненты (button, card, dialog, table, sheet, ...)
  components/           — Flashcard, QuizSession, LevelPicker, UploadDialog, AppLayout,
                            LanguageSwitcher
  hooks/                 — useAuth (+ сброс/смена пароля), useTeacherLinks,
                            useCards (decks/cards/marks), useAdmin (список
                            пользователей, роли, шаблоны и их назначение)
  lib/                   — supabase client, parseVocab, quizEngine, levels, utils,
                            cardTranslation (выбор translation/translation_en по языку)
  i18n/                  — инициализация i18next + locales/ru.json, locales/en.json
                            (переводы интерфейса, независимо от переводов слов в карточках)
  pages/                 — AuthPage, HomePage, PeoplePage, InvitePage,
                            StudentDashboard, TeacherStudentPage, AdminDashboard,
                            ResetPasswordPage
  types/db.ts            — TypeScript типы, соответствующие схеме БД
supabase/migrations/    — SQL миграции (0001 схема, 0002 английский перевод,
                            0003 роли/суперадмин/шаблоны)
```

## Локализация (i18n)

Интерфейс переведён на русский и английский язык через `i18next` / `react-i18next`
(`src/i18n/`). Переключатель языка в шапке приложения (и на странице входа) меняет
язык и сохраняет выбор в `localStorage`.

Это отдельная система от перевода **содержимого карточек**: у каждой карточки есть
столбцы `translation` (русский) и `translation_en` (английский, необязательный).
Какой из них показывать на карточках, в тесте и в таблице слов, определяется текущим
языком интерфейса — `src/lib/cardTranslation.ts`. Если для карточки не заполнен
`translation_en`, при английском интерфейсе используется `translation` как запасной
вариант.

При загрузке TSV/CSV можно добавить необязательный столбец `translation_en`.
