# Demo deployment

Живой web-MVP доступен по адресу **https://crm.aishka.su/**.

Для тестового стенда FastAPI запущен отдельным процессом, а HTTPS публикуется через отдельный Cloudflare Tunnel. Туннель не является частью бизнес-логики: приложение одинаково работает на `localhost`, в Docker Compose и за reverse proxy.

## Production-like вариант

В репозитории есть `Dockerfile` и `docker-compose.yml`: PostgreSQL + API + опциональный Telegram worker. Секрет `BOT_TOKEN` передаётся только через environment и не хранится в Git.

```bash
docker compose up --build
BOT_TOKEN='<token>' docker compose --profile telegram up --build
```

Для полноценного production после MVP добавил бы отдельный secret store, healthcheck worker-а, Alembic migrations, SSO/RBAC и observability.
