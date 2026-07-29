#!/usr/bin/env python3
"""
Преобразует плоский CSV (твой формат) в JSON для импорта в Supabase.

Поддерживаемые колонки:
- word (обязательно) - немецкое слово
- translation (RU) - русский перевод
- translation_en (EN) - английский перевод
- translation_uk (UK) - украинский перевод (опционально)
- group - группа/категория
- tags - теги (через запятую или JSON array)
- description - описание
- example_de - пример на немецком
- example_ru - пример на русском
- example_en - пример на английском
- example_uk - пример на украинском (опционально)

Использование:
  python csv_to_import.py input.csv output.json

  Потом в Supabase SQL:
  SELECT import_flat_csv_cards(
    'deck-uuid-here'::uuid,
    '[JSON содержимое output.json]'::jsonb
  );
"""

import csv
import json
import sys
from pathlib import Path

def parse_tags(tags_str):
    """Парсит теги из строки (разделены запятой) или JSON array"""
    if not tags_str:
        return []

    tags_str = tags_str.strip()

    # Если уже JSON array
    if tags_str.startswith('['):
        try:
            return json.loads(tags_str)
        except:
            pass

    # Иначе разделяем по запятой
    return [tag.strip() for tag in tags_str.split(',') if tag.strip()]

def csv_to_json(csv_file):
    """Преобразует CSV в JSON для импорта"""
    cards = []

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Пропускаем пустые строки
            if not row.get('word') or not row['word'].strip():
                continue

            card = {
                'word': row.get('word', '').strip(),
                'translation': row.get('translation', '').strip(),
                'translation_en': row.get('translation_en', '').strip(),
                'translation_uk': row.get('translation_uk', '').strip() or None,
                'group': row.get('group', '').strip(),
                'tags': parse_tags(row.get('tags', '')),
                'description': row.get('description', '').strip(),
                'example_de': row.get('example_de', '').strip(),
                'example_ru': row.get('example_ru', '').strip(),
                'example_en': row.get('example_en', '').strip(),
                'example_uk': row.get('example_uk', '').strip() or None,
            }

            # Удаляем пустые значения кроме None
            card = {k: v for k, v in card.items() if v is not None and v != ''}

            # Гарантируем наличие обязательных полей
            if 'word' in card:
                cards.append(card)

    return cards

def main():
    if len(sys.argv) < 2:
        print("Использование: python csv_to_import.py input.csv [output.json]")
        print("\nПримеры:")
        print("  python csv_to_import.py german.csv")
        print("  python csv_to_import.py german.csv import_data.json")
        sys.exit(1)

    csv_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else csv_file.replace('.csv', '_import.json')

    if not Path(csv_file).exists():
        print(f"❌ Файл не найден: {csv_file}")
        sys.exit(1)

    print(f"📖 Читаю {csv_file}...")
    cards = csv_to_json(csv_file)

    if not cards:
        print("❌ Не найдено карточек в CSV")
        sys.exit(1)

    print(f"✅ Преобразовано {len(cards)} карточек")

    # Сохраняем JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"💾 Сохранено в {output_file}")
    print(f"\n📋 JSON готов к загрузке в Supabase!")
    print(f"\n🔧 SQL команда для Supabase:")
    print(f"""
SELECT import_flat_csv_cards(
  'YOUR_DECK_UUID_HERE'::uuid,
  '{json.dumps(cards)}'::jsonb
);
""")

if __name__ == '__main__':
    main()
