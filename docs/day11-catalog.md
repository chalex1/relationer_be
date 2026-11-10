# День 11 — классификация и публичный каталог

> Отчёт об исходном этапе реализации, до улучшения layout. День 11 завершён.
> Итоговая раскладка и проверки — в [отчёте layout](day11-layout.md),
> текущее устройство — в [архитектуре](architecture/overview.md), план —
> в [основном roadmap](roadmap.md). Числа ниже относятся к исходному прогону.

Реализован сценарий `references.json → API → /references → граф`.
Каталог публичный, без авторизации, БД и редактирования. Используется один
production-файл `backend/src/main/resources/references.json` и один singleton
`ReferenceCatalog` для каталога и существующего поиска.

## Контракт и совместимость

- `GET /api/v1/references` — массив метаданных всех записей в порядке JSON:
  `id`, `categories`, `tags`, `verdict`, `description`, `source`, `hasImage`.
- `GET /api/v1/references/{id}` — `{ metadata, graph }`; `graph` использует
  существующую схему `SearchRequest`: `persons`, `relations`, `personA`, `personB`.
- Неизвестный ID — HTTP 404 и `{ "message": "Unknown reference id: …" }`.
- `source` сохраняет `document`, `page`, `example`, `conclusion`; добавлено
  необязательное `image`. Путь/URL изображения обслуживается как обычный
  статический ресурс; извлечение и публикация изображений не реализованы.
- `POST /api/v1/references/search` и семантика путей сохраняются.
- OpenAPI находится в `backend/openapi.yaml`. Kotlin и TypeScript генерируются
  штатными `./gradlew openApiGenerate` и `npm run api:generate`. Сгенерированные
  файлы, как и раньше, исключены из git.

Старые записи без новых полей загружаются с пустыми множествами категорий/тегов,
`description = null`, `source.image = null`. Пустые категории означают отсутствие
классификации; UI явно показывает «Требует ручной классификации».
Неизвестные категории (включая MIXED), неверные типы коллекций и пустые теги
отклоняются с ID записи в ошибке. Повторные категории исключаются, теги приводятся
к NFC, обрезаются по краям, переводятся в нижний регистр через Locale.ROOT и
дедуплицируются. Категории не вычисляются загрузчиком автоматически.

## Классификация 11 существующих записей

Классификация описывает виды связей в схеме, а не новый юридический вердикт
между A/B. В составных схемах BIOLOGICAL учитывается как BLOOD наряду с другим
видом родства. Основание — фактические связи JSON и уже сохранённые сведения
источников. Повторная историческая сверка с PDF в этот этап не входит.

| ID | Категории | Основание |
| --- | --- | --- |
| blood-01 … blood-05 | BLOOD | Только BIOLOGICAL; глава I, страницы 34–36 |
| affinity-allowed-01 … affinity-allowed-03 | BLOOD, AFFINITY | BIOLOGICAL и MARRIAGE; глава IV, страницы 61, 62, 65 |
| spiritual-forbidden-01 | SPIRITUAL | Крёстный и крестница; Приложения I §1, стр. 120 |
| spiritual-forbidden-02 | BLOOD, SPIRITUAL | Крёстный, крестник и его родная мать; Приложения I §2, стр. 121 |
| spiritual-forbidden-03 | SPIRITUAL | Два крестника общего восприемника; Приложения I §3, стр. 121 |

Неоднозначных случаев для этой классификации нет. Все 11 имеют непустые
категории; эталонов ADOPTION в текущем production-каталоге нет. Теги оставлены
пустыми, изображения отсутствуют: новые сведения не придуманы. Порядок записей
сохранён: кровные, свойство, духовные; ID, графы, вердикты и источники сохранены.
Тестовая копия прежних данных `catalog/legacy-production.json` фиксирует регрессию,
не является вторым источником production-каталога.

## Лента

Все загруженные карточки полностью раскрыты. Метаданные загружаются один раз,
поиск и фильтры применяются ко всему каталогу до нарезки на порции. Категории
объединяются по ИЛИ, выбранные теги — по И, вердикт и текст — по И с ними.
Графы запрашиваются порциями до 10. IntersectionObserver с запасом 500px
подгружает следующую порцию; кнопка «Загрузить ещё» доступна для клавиатуры.
При изменении фильтров запросы отменяются, ревизия не допускает устаревших
ответов, карточки очищаются и страница прокручивается к началу. Порция
добавляется целиком, при ошибке доступен повтор без дубликатов.

Общий `GraphCanvas` использует прежние Vue Flow, `PersonNode` и типы API.
Конструктор сохраняет редактирование, каталог показывает граф без редактирования.
Узлы A/B выделены существующими стилями. Первоначальная раскладка затем
заменена Dagre: только биологические и приёмные связи задают следующие
поколения, духовные связи не увеличивают уровень. Высота холста зависит от числа
уровней, все узлы и связи сохраняются, внутренней полосы прокрутки нет.
Для больших графов есть панорамирование, масштаб и разворот в диалоге; мобильная
страница сохраняет обычную вертикальную прокрутку. При наличии PDF-изображения
desktop показывает его рядом с графом, mobile — ниже. Отсутствующий или
недоступный файл имеет понятную подпись.

Маршрутизатора в исходном проекте нет: `main.ts` выбирает страницу по pathname,
обычные ссылки обеспечивают переходы и историю браузера. Локальный Vite SPA
fallback обслуживает прямое открытие `/references`; настройки hosting не менялись.

## Проверки

Проверено 10 ноября 2026 с JDK 21 и локальным Node 22.22.0:

- `cd backend && ./gradlew test openApiValidate`: 222 теста, 0 ошибок;
  OpenAPI валиден.
- `cd frontend && npm test`: 48 тестов, 3 файла, все прошли.
- `npm run typecheck`: проходит.
- `npm run build`: production-сборка проходит.
- `RUN_BACKEND_INTEGRATION=1 npm run test:e2e`: 32/32, без пропусков,
  Chrome, включая реальный backend и старые сценарии поиска.
- `git diff --check`: проходит.

Системный shell использует Node 16; для frontend-команд использован уже
существовавший `frontend/.cache/node/bin/node` через добавление его каталога
в PATH. Node и зависимости не обновлялись.

Backend проверяет старые записи без метаданных и описания, несколько категорий,
неизвестные enum и неправильные коллекции, дедупликацию, нормализацию тегов,
source.image, список, детали, 404. Все production-детали сравниваются с прежним
JSON: ID/имена людей, направления и типы связей, A/B, вердикт, описание, документ,
страница, пример и заключение. Существующие проверки сопоставления также прошли.

Frontend проверяет фильтрацию всего набора, раскладку пяти и двадцати уровней,
циклы и браки без потери узлов, выделение A/B, порции 10 → 20 → 23,
развёрнутый просмотр, смену фильтров и сброс ленты, повтор после ошибки,
отсутствующий и недоступный файл изображения, мобильное расположение PDF ниже
графа без горизонтального переполнения. Сквозной тест без mock показывает
все 11 реальных кейсов и фильтрует составные случаи свойства.

Временные серверы, запущенные для проверок, остановлены.

## Изменённые файлы

Backend:

- `backend/openapi.yaml`
- `backend/src/main/kotlin/com/relationer/backend/domain/ReferencePattern.kt`
- `backend/src/main/kotlin/com/relationer/backend/domain/ReferenceCatalogLoader.kt`
- `backend/src/main/kotlin/com/relationer/backend/api/ReferenceCatalog.kt`
- `backend/src/main/kotlin/com/relationer/backend/api/ReferenceCatalogService.kt`
- `backend/src/main/kotlin/com/relationer/backend/api/ReferenceSearchController.kt`
- `backend/src/main/kotlin/com/relationer/backend/api/ReferenceSearchService.kt`
- `backend/src/main/kotlin/com/relationer/backend/api/SearchApiExceptionHandler.kt`
- `backend/src/main/resources/references.json`
- `backend/src/test/kotlin/com/relationer/backend/domain/ReferenceCatalogLoaderTest.kt`
- `backend/src/test/kotlin/com/relationer/backend/api/ReferenceCatalogHttpTest.kt`
- `backend/src/test/resources/catalog/{metadata,unknown-category,invalid-categories,invalid-tags,legacy-production}.json`

Frontend:

- `frontend/src/App.vue`, `frontend/src/main.ts`, `frontend/src/style.css`
- `frontend/src/api/references.ts`
- `frontend/src/components/{GraphCanvas,PersonNode,ReferenceCard,ReferenceGraph}.vue`
- `frontend/src/pages/ReferencesPage.vue`
- `frontend/src/domain/{catalog,catalogLabels,graphPresentation}.ts`
- `frontend/tests/catalog.test.ts`
- `frontend/e2e/{references,references-real}.spec.ts`

Документация: `docs/day11-catalog.md`. Существующие пользовательские изменения
README, compose и других документов не входят в реализацию Дня 11.

## Следующая итерация и День 12

На следующую итерацию остаётся кнопка загрузки эталона в конструктор с A/B.
Сверка и расширение PDF-каталога, добавление изображений выполняются отдельно.
По текущему roadmap День 12 посвящён публичному релизу: VPS, домен/HTTPS,
финальная проверка пользовательских сценариев и публикация. В этой задаче
инфраструктура, Docker и деплой не изменялись. Загрузка эталона в конструктор и перенос PDF остаются открытым backlog,
а не критериями уже завершённого согласованного Дня 11.
