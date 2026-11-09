# Развёртывание на VPS

Стек состоит из двух runtime-контейнеров: `backend` (Spring Boot на внутреннем порту 8080) и `caddy` (статический frontend и reverse proxy). Наружу публикуются только порты Caddy `80` и `443`.

## Подготовка VPS

Установите Docker Engine и Compose v2, склонируйте репозиторий и перейдите в его каталог:

```sh
git clone <repository-url> relationer
cd relationer
cp .env.example .env
```

Для локальной проверки без домена оставьте `DOMAIN=:80`. Для production укажите домен, например `DOMAIN=relationer.example.com`. DNS-записи `A` (и при наличии `AAAA`) этого имени должны указывать на публичный IP VPS. Откройте TCP-порты 80 и 443 в firewall/security group.

Когда домен уже указывает на VPS, Caddy автоматически запросит и продлит сертификат Let's Encrypt. Отдельно выпускать сертификаты или прокидывать `/api` через внешний web-сервер не нужно.

## Сборка и запуск

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Для локального HTTP-режима:

```sh
DOMAIN=:80 docker compose up -d --build
curl -I http://127.0.0.1/
```

В production запускайте с `.env`, содержащим публичный домен:

```sh
docker compose --env-file .env up -d --build
```

## Проверка API и справочника

SPA должна загрузиться через Caddy:

```sh
curl -fsS http://127.0.0.1/ | head
```

Проверка POST через тот же reverse proxy использует реальный каталог backend:

```sh
curl -fsS -H 'Content-Type: application/json' \
  --data-binary @docs/examples/day9/common-parent.json \
  http://127.0.0.1/api/v1/references/search
```

В ответе ожидаются записи из текущего справочника (для `common-parent.json` — пять `FORBIDDEN` совпадений). Для production замените URL на `https://relationer.example.com`.

## Обновление и логи

```sh
git pull
docker compose build
docker compose up -d
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 caddy
```

Остановка стека:

```sh
docker compose down
```

Именованные volumes `caddy_data` и `caddy_config` сохраняют сертификаты и состояние Caddy между обновлениями. Для удаления этих данных используйте `docker compose down -v` только намеренно: это потребует повторной выдачи сертификата.

## Локальная разработка без Docker

Рабочие команды Vite и Spring Boot описаны в [инструкции Дня 9](day9-integration.md). В production frontend всегда отправляет запросы на относительный `/api`; Caddy сохраняет этот префикс при проксировании в backend.
