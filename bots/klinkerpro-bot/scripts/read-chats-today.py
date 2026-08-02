#!/usr/bin/env python3
"""Диалоги за сегодня (МСК). Запуск из любой папки на VPS."""
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

MSK = timezone(timedelta(hours=3))
BOT_DIR = Path(__file__).resolve().parent.parent
CHATS = BOT_DIR / 'data' / 'chats'


def main():
    today = datetime.now(MSK).strftime('%Y-%m-%d')
    day_file = CHATS / f'{today}.jsonl'

    if not day_file.exists():
        print(f'Пока нет записей за сегодня ({today} МСК):')
        print(f'  {day_file}')
        if CHATS.is_dir():
            recent = sorted(CHATS.glob('*.jsonl'), reverse=True)[:5]
            if recent:
                print('\nПоследние файлы логов:')
                for f in recent:
                    print(f'  {f.name}')
        else:
            print('\nКаталог логов не найден — бот ещё не писал чаты или нет прав.')
        sys.exit(0)

    for line in day_file.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        e = json.loads(line)
        at = e.get('at') or ''
        try:
            at_msk = (
                datetime.fromisoformat(at.replace('Z', '+00:00'))
                .astimezone(MSK)
                .strftime('%Y-%m-%d %H:%M:%S МСК')
            )
        except Exception:
            at_msk = at
        print('─' * 60)
        print(at_msk, '|', e.get('source'), '|', e.get('sessionId'))
        if e.get('username'):
            print('кто:', e['username'])
        print('клиент:', e.get('user') or '—')
        print('бот:   ', e.get('reply') or '—')
        print()


if __name__ == '__main__':
    main()
