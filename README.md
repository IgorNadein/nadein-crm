# Nadein CRM

**Живой MVP:** https://crm.aishka.su/  
**GitHub:** https://github.com/IgorNadein/nadein-crm
**Telegram-бот:** https://t.me/nadein_crm_bot

> Demo-instance доступен по отдельному HTTPS-хосту через Cloudflare Tunnel. Код не зависит от туннеля и запускается локально или через Docker Compose.

Свежий мини-MVP для тестового задания: лиды из Telegram-бота и ручного ввода собираются в одной CRM, получают теги и фильтруются по ним.

## Что работает

- Telegram bot: имя → контакт → запрос → лид в CRM.
- Ручное создание лида.
- Теги: назначение и фильтрация.
- Поиск по имени, контакту и запросу.
- Статусы и метрики как небольшой бонус.
- Idempotency для повторной доставки Telegram-заявки через `external_id`.

## Быстрый запуск без Docker

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload
```

CRM: http://localhost:8000

Для Telegram-бота:

```bash
export BOT_TOKEN='<token>'
export API_URL='http://localhost:8000'
python -m bot.main
```

## Docker / PostgreSQL

```bash
docker compose up --build
```

Бот запускается отдельным profile, когда есть токен:

```bash
BOT_TOKEN='<token>' docker compose --profile telegram up --build
```

## Документация тестового

- [Набросок продукта](docs/product.md)
- [Короткий разбор реализации и AI-инструментов](docs/implementation.md)

## API

После запуска интерактивная документация доступна в `/docs`.

Основные методы:

- `POST /api/leads` — создать лид;
- `GET /api/leads?tag=hot` — список/фильтрация;
- `PUT /api/leads/{id}/tags` — заменить теги;
- `PATCH /api/leads/{id}/status` — сменить статус;
- `GET /api/tags` — доступные теги;
- `GET /api/metrics` — счётчики.

## Проверки

```bash
pytest
```
