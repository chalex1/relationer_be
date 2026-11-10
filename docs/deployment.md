# Развёртывание: Docker Compose и Caddy

Инструкция соответствует текущим `compose.yaml`, `compose.prod.yaml` и Dockerfile.
Она не подтверждает доступность уже запущенного удалённого сервера. Техническая
часть Дня 10 принята ранее; публичный релиз остаётся задачей
[Дня 12](roadmap.md#день-12--публичный-релиз).

## Схема

Два runtime-сервиса: backend (Spring Boot, внутренний 8080) и caddy
(статический dist и reverse proxy). На хост опубликованы только TCP 80/443.
Caddy направляет `/api/*` в `backend:8080`, сохраняя префикс. Остальные пути
обслуживаются из `/srv` с SPA fallback на index.html, включая `/references`.
Базы данных нет. Volumes caddy_data/caddy_config содержат состояние Caddy,
а не пользовательские графы. [Архитектура и Dockerfile](architecture/overview.md#docker-compose-и-сеть).

Нужны Docker Engine и Compose v2, копия репозитория и доступ к зависимостям/образам
при сборке. Из корня:

```sh
cp .env.example .env
```

Для локального HTTP оставьте `DOMAIN=:80`. Для HTTPS укажите DNS-имя, например
`DOMAIN=relationer.example.com`; A/AAAA должны вести на сервер, TCP 80/443 должны
быть доступны. При корректной DNS/сетевой настройке Caddy управляет сертификатом
автоматически. Домен-пример не является адресом опубликованного приложения.

## Вариант 1: сборка из исходников

`compose.yaml` содержит build-секции backend и caddy:

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Команды читают `.env` автоматически. Для явного файла:

```sh
docker compose --env-file .env up -d --build
```

Локальный HTTP без домена:

```sh
DOMAIN=:80 docker compose up -d --build
```

При изменении `references.json` пересоберите backend; при изменении frontend —
образ caddy. Штатная Docker-сборка использует same-origin `/api`. Серверный
DOMAIN задаётся при запуске, а VITE_API_BASE_URL является build-time настройкой
frontend и в Compose не передаётся.

## Вариант 2: готовые образы

`compose.prod.yaml` не содержит build-секций и ожидает локально доступные образы
`relationer_be_backend:latest` и `relationer_be_caddy:latest`.
При необходимости соберите их с этими точными именами на машине сборки:

```sh
docker build -t relationer_be_backend:latest backend
docker build -f caddy/Dockerfile -t relationer_be_caddy:latest .
docker save -o relationer-images.tar relationer_be_backend:latest relationer_be_caddy:latest
```

Образы должны соответствовать платформе целевого хоста. Передайте архив на сервер,
а также compose.prod.yaml, .env и при необходимости примеры для smoke-теста.
На сервере:

```sh
docker load -i relationer-images.tar
docker compose -f compose.prod.yaml --env-file .env config
docker compose -f compose.prod.yaml --env-file .env up -d
docker compose -f compose.prod.yaml ps
```

Эта конфигурация не включает registry, публикацию образов или CI/CD. Тег latest
изменяемый; принятую версию/commit и идентификаторы образов фиксируют при релизе.

## Smoke: frontend, каталог и поиск

Для HTTP-режима из корня репозитория:

```sh
curl -fsS http://127.0.0.1/ >/dev/null
curl -fsS http://127.0.0.1/references >/dev/null
curl -fsS http://127.0.0.1/api/v1/references
curl -fsS http://127.0.0.1/api/v1/references/blood-03
curl -fsS -H 'Content-Type: application/json' \
  --data-binary @docs/examples/day9/common-parent.json \
  http://127.0.0.1/api/v1/references/search
```

Список содержит 11 текущих эталонов, детали blood-03 — metadata и graph.
Для common-parent.json ожидаются пять FORBIDDEN-совпадений.
На HTTPS замените origin на собственный домен. HTTP 200 для `/references`
проверяет выдачу SPA, но не запуск JavaScript: дополнительно откройте браузер,
проверьте графы, фильтры, A/B, подгрузку 11-го случая и мобильную ширину.
Проверку из российских сетей выполняют отдельно на опубликованной версии.

## Обновление и логи

Для варианта со сборкой из исходников:

```sh
git pull
docker compose build
docker compose up -d
docker compose logs -f --tail=200 backend caddy
```

Для готовых образов сначала загрузите новые, затем используйте команды с
`-f compose.prod.yaml`; `build` к этому файлу неприменим.

Остановка соответствующего варианта:

```sh
docker compose down
# Либо:
docker compose -f compose.prod.yaml down
```

Состояние Caddy сохраняется в named volumes. Команда down без `-v` их не удаляет.
Локальная разработка без Docker — в [README](../README.md#быстрый-старт-без-docker).
