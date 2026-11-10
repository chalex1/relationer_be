# Relationer — frontend

Vue 3 / TypeScript / Vite, Vue Flow для графов и Dagre для layout каталога.
Страницы: `/` — конструктор и поиск; `/references` — публичная лента эталонов.
День 11 завершён; все статусы и будущие задачи находятся в [основном roadmap](../docs/roadmap.md).

Общий быстрый старт frontend/backend — в [корневом README](../README.md#быстрый-старт-без-docker).
Нужны Node >= 22.12, npm и JDK 21 для генерации API. Версия `.nvmrc` — 22.22.0.
Из каталога frontend при установленном nvm:

```sh
nvm install
nvm use
npm ci
npm run dev -- --port 5173 --strictPort
```

Если возникает `os__default.availableParallelism is not a function`, проверьте
`node -v` и interpreter IDE. Подготовленный `.cache/node/bin/node` доступен только
в некоторых локальных копиях и не поставляется с Git. Из frontend его можно
выбрать через `export PATH="$PWD/.cache/node/bin:$PATH"` для текущего терминала.

## API и окружение

`src/api/references.ts` использует generated `ReferencesApi` для GET списка,
GET деталей и POST поиска. Единственный контракт — `../backend/openapi.yaml`.
`npm run api:generate` запускает OpenAPI Generator 7.17.0 / typescript-fetch,
проверяя SHA-256 JAR. Generated-файлы в `src/api/generated` не редактируются
и исключены из Git. Генерация выполняется перед dev/test/typecheck/build;
первый запуск требует Maven Central, далее достаточно локального cache.

При необходимости скопируйте `.env.example` в `.env.local`:

- `VITE_API_BASE_URL`: origin API без `/api` в конце; пустое значение отправляет
  запросы на текущий origin. Подставляется при dev/build, а не runtime-контейнером.
- `API_PROXY_TARGET`: target dev proxy `/api`, по умолчанию `http://127.0.0.1:8080`.

Для каталога и поиска нужен работающий backend. Штатная production-схема —
Caddy с same-origin `/api`. Раздельные origin требуют отдельной настройки CORS,
которой в текущем backend нет. `npm run preview` показывает dist, но не заменяет
production reverse proxy.

## Проверки

Из каталога frontend, последовательно (pre-скрипты генерируют одни и те же файлы):

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Playwright запускает отдельный Vite на 4173 и использует установленный Chrome.
Альтернатива:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

Для четырёх сквозных проверок реального API сначала запустите backend на 8080,
затем выполните:

```sh
RUN_BACKEND_INTEGRATION=1 npm run test:e2e
```

Без этой переменной пропускаются три сценария `backend.spec.ts` и один
`references-real.spec.ts`. Остальные браузерные тесты используют mock API
или локальные действия редактора. Тесты каталога проверяют фильтры, порции,
A/B, изображения и layout; модель layout дополнительно проверяется unit-тестами
на замороженных исходных графах. Снимки в `artifacts/`, отчёты в `test-results/`
генерируются локально и не входят в Git.

## Устройство и ограничения

Подробная [структура frontend/backend и поток данных](../docs/architecture/overview.md)
ведутся в архитектурной документации. Общие `GraphCanvas`/`PersonNode`
используются конструктором и каталогом; compact включён только в каталоге.
Конструктор хранит координаты в EditorState.positions, каталог вычисляет их
отдельно. `toSearchRequest()` исключает координаты и внутренние ID связей.

Переходы между страницами выполняются обычными ссылками; отдельного router нет.
Черновик хранится в памяти и теряется при перезагрузке/переходе. Сохранения,
undo/redo, выделения конкретного совпавшего пути и загрузки эталона в конструктор
нет. Каталог доступен только для чтения. Категории/теги поддерживаются, но
текущие теги пусты и PDF-изображений нет.

[Действия с людьми и родителями](../docs/family-groups.md),
[правила поиска](../docs/tree-matching-rules.md),
[итоги layout Дня 11](../docs/day11-layout.md).
