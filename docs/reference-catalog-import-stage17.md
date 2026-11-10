# Импорт накопительного каталога, этап 17

Дата: 11 ноября 2026. Источник — `relationer-full-catalog-stage17.zip` в корне
репозитория. Импортированы 94 черновика и все 94 PNG. Архив не изменён.

SHA-256 архива: `dae3e29d02c08a4c555aac1e7fbca18c8eb87c0106458ee8b843c5bc94c9c378`.

## Проверка сохранности

- ID уникальны внутри каждого файла; все 94 черновых ID сохранены.
- Все 11 рабочих кейсов присутствуют в архиве с идентичным исходным содержимым.
  JSON остаются раздельными: production 11, draft 94. В объединении/поиске 94 ID.
- После обратного преобразования sources[0] в прежний source и удаления только
  новых title/reviewStatus все 94 записи семантически равны архиву. Это сравнение
  охватывает имена людей, направления и типы связей, A/B, категории, теги,
  описания, вердикты, страницы, номера схем и заключения.
- Названия title взяты из description до двоеточия; все reviewStatus=DRAFT.
  Каждый источник получил локальный ID source-1900; полное имя документа сохранено.
- В исходном архиве 8 связей ADOPTED в adoption-forbidden-01…08; текст JSON
  сохранён, loader проецирует их на существующий ADOPTION. Это совместимость
  записи типа, а не исправление родственных связей.
- Все пути разрешаются в backend reference-catalog/images. Имена и байты всех
  PNG совпадают с архивом. Декодирование всех 94 PNG проверено через ImageIO.
- В bootJar проверены JSON и все 94 PNG, совпадение JSON с ресурсом. Собранный JAR
  запущен на временном порту 18080; реальный браузер прочитал 94 черновика и PNG
  из его API. Frontend/public и production dist не содержат копий originals.
- Исторические вердикты: FORBIDDEN — 79, ALLOWED — 14, UNDETERMINED — 1.
  Это выводы источников, не подтверждённые заключения приложения.

## Границы проверки

Импорт проверяет сохранность и техническую валидность, не заменяет предметную
сверку всех 94 схем. Все графы остаются DRAFT. Вопросы к выбору A в трёх
`affinity-allowed`, имени в blood-02 и исходному кадрированию PNG из прежней
интеграции остаются открытыми: [сверка первых 11](day12-reference-images.md).

Архивный review-report отмечает необходимость сверки восстановления брачного
перехода к падчерице на странице 116 и безымянного промежуточного лица для
«внучки сына» на странице 117. Новые appendix-spiritual-forbidden-01…05 требуют
содержательной проверки. Совпадение графов с разными ID автоматически не удаляет
источники и кейсы; объединяются только одинаковые записи с одним ID.

Манифест архива содержит ссылки на дополнительные страницы-кандидаты JPG,
которые не входят в 94 PNG. По ним не создавались дополнительные кейсы или
фиктивные изображения. OCR и автоматическое распознавание PDF не выполнялись.

## Проверки реализации

- `./gradlew test openApiValidate bootJar`: 229 тестов, 0 failures/errors/skipped;
  OpenAPI валиден, executable JAR собран.
- Frontend `npm test`: 64 теста в 5 файлах, все прошли.
- `npm run build`: TypeScript и Vite production-сборка прошли.
- `API_PROXY_TARGET=http://127.0.0.1:18080 RUN_BACKEND_INTEGRATION=1 npm run test:e2e -- --workers=2`:
  42/42 прошли, без пропусков. Использован реальный backend из собранного JAR.
- Проверены все 94 PNG через HTTP и ImageIO, списки 94/11/94, детали каждого
  черновика, фильтры/поиск/сортировка, включение черновых графов в совпадения.
- Старые тесты поиска сохраняют точные ожидания для production-подмножества;
  новые кейсы закономерно расширяют HTTP-выдачу. Доменный алгоритм не изменён.
- Проверены разные выводы нескольких источников, сохранение первого вердикта
  для сопоставления, alias ADOPTED и работа production при повреждённых черновиках.
- Браузер проверил localStorage/reload, комментарии, импорт/экспорт, повторную
  проверку изменённого содержимого, недоступный storage, ошибки API/изображений,
  быстрые переключения, фильтры, infinite scroll, увеличение и desktop/mobile.
- Снимки нового adoption-forbidden-08 на desktop/mobile просмотрены вручную;
  исходный JSON не отмечался REVIEWED, отметка в тесте была только локальной.
- `git diff --check` проходит. Конструктор, ReferencePattern, PathMatcher,
  PathExtractor, PathEncoder, ReferenceSearch, Docker и зависимости не менялись.

Vite и временный JAR-сервер проверки остановлены. Новых кейсов сверх архива
не создавалось; JSON-fixture нескольких источников используется только в тестах.

## Указатель для ручного исследования

Откройте `/references` → «На проверке», найдите ID и сравните граф с оригиналом.
Страницы и обозначения ниже перенесены из архива, независимо по полному PDF
не подтверждены. Путь каждого изображения: `reference-catalog/images/<ID>.png`.

| ID | PDF-страница | Обозначение / пример | Исторический вердикт |
| --- | ---: | --- | --- |
| blood-01 | 34 | Изображение 1 | FORBIDDEN |
| blood-02 | 34 | Изображение 2 | FORBIDDEN |
| blood-03 | 35 | Изображение 3 | FORBIDDEN |
| blood-04 | 35 | Изображение 4 | FORBIDDEN |
| blood-05 | 36 | Изображение 5 | FORBIDDEN |
| affinity-allowed-01 | 61 | Изображение 2 | ALLOWED |
| affinity-allowed-02 | 62 | Изображение 3 | ALLOWED |
| affinity-allowed-03 | 65 | Изображение 1 | ALLOWED |
| spiritual-forbidden-01 | 120 | Изображение 1 | FORBIDDEN |
| spiritual-forbidden-02 | 121 | Изображение 2 | FORBIDDEN |
| spiritual-forbidden-03 | 121 | Изображение 3 | FORBIDDEN |
| blood-06 | 36 | Изображение 6 | FORBIDDEN |
| blood-07 | 37 | Изображение 7 | FORBIDDEN |
| blood-08 | 37 | Изображение 8 | FORBIDDEN |
| blood-09 | 38 | Изображение 9 | FORBIDDEN |
| blood-10 | 38 | Изображение 10 | FORBIDDEN |
| blood-11 | 39 | Изображение 11 | FORBIDDEN |
| blood-12 | 39 | Изображение 12 | FORBIDDEN |
| blood-13 | 41 | Схема четвероюродных брата и сестры | ALLOWED |
| affinity-forbidden-01 | 46 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-02 | 46 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-03 | 47 | Изображение 3 | FORBIDDEN |
| affinity-forbidden-04 | 47 | Изображение 4 | FORBIDDEN |
| affinity-forbidden-05 | 49 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-06 | 49 | Изображение 3 | FORBIDDEN |
| affinity-forbidden-07 | 50 | Изображение 4 | FORBIDDEN |
| affinity-forbidden-08 | 50 | Изображение 5 | FORBIDDEN |
| affinity-forbidden-09 | 51 | Изображение 6 | FORBIDDEN |
| affinity-forbidden-10 | 51 | Изображение 7 | FORBIDDEN |
| affinity-forbidden-11 | 52 | Изображение 8 | FORBIDDEN |
| affinity-forbidden-12 | 52 | Изображение 9 | FORBIDDEN |
| affinity-forbidden-13 | 53 | Изображение 9 | FORBIDDEN |
| affinity-allowed-04 | 54 | Изображение 1 | ALLOWED |
| affinity-allowed-05 | 55 | Изображение 2 | ALLOWED |
| affinity-allowed-06 | 56 | Изображение 3 | ALLOWED |
| affinity-forbidden-14 | 57 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-15 | 57 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-16 | 58 | Изображение 3 | FORBIDDEN |
| affinity-forbidden-17 | 58 | Изображение 4 | FORBIDDEN |
| affinity-forbidden-18 | 59 | Изображение 5 | FORBIDDEN |
| affinity-allowed-07 | 60 | Изображение 1 | ALLOWED |
| affinity-forbidden-19 | 63 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-20 | 64 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-21 | 66 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-22 | 68 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-23 | 68 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-24 | 69 | Изображение 3 | FORBIDDEN |
| affinity-forbidden-25 | 69 | Изображение 4 | FORBIDDEN |
| affinity-forbidden-26 | 70 | Изображение 5 | FORBIDDEN |
| affinity-forbidden-27 | 70 | Изображение 6 | FORBIDDEN |
| affinity-two-marriages-forbidden-01 | 73 | Изображение 1 | FORBIDDEN |
| affinity-two-marriages-forbidden-02 | 74 | Изображение 2 | FORBIDDEN |
| affinity-two-marriages-forbidden-03 | 77 | Изображение 5 | FORBIDDEN |
| affinity-forbidden-28 | 83 | Схема 1 (левая) | FORBIDDEN |
| affinity-forbidden-29 | 83 | Схема 1 (правая) | FORBIDDEN |
| affinity-forbidden-30 | 83 | Схема 2 | FORBIDDEN |
| affinity-forbidden-31 | 84 | Схема 3 | FORBIDDEN |
| affinity-forbidden-32 | 84 | Схема 4 | FORBIDDEN |
| affinity-forbidden-33 | 84 | Схема 5 | FORBIDDEN |
| affinity-forbidden-34 | 85 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-35 | 85 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-36 | 85 | Изображение 3 | FORBIDDEN |
| affinity-forbidden-37 | 86 | Изображение 1 | FORBIDDEN |
| affinity-forbidden-38 | 86 | Изображение 2 | FORBIDDEN |
| affinity-forbidden-39 | 86 | Изображение 3 | FORBIDDEN |
| three-family-forbidden-01 | 92 | Изображение 1 | FORBIDDEN |
| three-family-forbidden-02 | 93 | Изображение 3 | FORBIDDEN |
| three-family-forbidden-03 | 94 | Изображение 4 | FORBIDDEN |
| three-family-forbidden-04 | 94 | Изображение 5 | FORBIDDEN |
| affinity-inlaws-forbidden-01 | 87 | Изображение 1 | FORBIDDEN |
| three-family-allowed-01 | 98 | Изображение 1 | ALLOWED |
| three-family-allowed-02 | 100 | Изображение 4 | ALLOWED |
| three-family-allowed-03 | 101 | Изображение 6 | ALLOWED |
| spiritual-forbidden-04 | 110 | Крестник и крестница одного восприемника | FORBIDDEN |
| spiritual-forbidden-05 | 111 | Крестник и жена его духовного брата | FORBIDDEN |
| spiritual-forbidden-06 | 111 | Крестник мужа и крестница его жены | FORBIDDEN |
| spiritual-allowed-01 | 108 | Кум и родная сестра другого кума | ALLOWED |
| spiritual-allowed-02 | 109 | Родной сын восприемника и родная сестра крестника | ALLOWED |
| spiritual-allowed-03 | 109 | Родной брат восприемника и родная сестра крестника | ALLOWED |
| spiritual-forbidden-07 | 112 | Зять и крестная дочь тестя | FORBIDDEN |
| spiritual-undetermined-01 | 113 | Крестник тестя и крестница зятя | UNDETERMINED |
| adoption-forbidden-01 | 115 | Усыновлённый сын и жена усыновителя | FORBIDDEN |
| adoption-forbidden-02 | 115 | Усыновитель и жена усыновлённого сына | FORBIDDEN |
| adoption-forbidden-03 | 118 | Внук и названная дочь его деда | FORBIDDEN |
| adoption-forbidden-04 | 116 | Усыновлённый и родная дочь усыновителя | FORBIDDEN |
| adoption-forbidden-05 | 116 | Усыновлённый и падчерица усыновителя | FORBIDDEN |
| adoption-forbidden-06 | 116 | Усыновлённый и мать усыновителя | FORBIDDEN |
| adoption-forbidden-07 | 116 | Усыновлённый и родная сестра матери усыновителя | FORBIDDEN |
| adoption-forbidden-08 | 117 | Усыновлённый и внучка родного сына усыновителя | FORBIDDEN |
| appendix-spiritual-forbidden-01 | 120 | Изображение 1 | FORBIDDEN |
| appendix-spiritual-forbidden-02 | 121 | Изображение 2 | FORBIDDEN |
| appendix-spiritual-forbidden-03 | 122 | Изображение 4 | FORBIDDEN |
| appendix-spiritual-forbidden-04 | 123 | Изображение 6 | FORBIDDEN |
| appendix-spiritual-forbidden-05 | 124 | Изображение 9 | FORBIDDEN |

Порядок хранения, REST API и процесс ревью: [единый каталог](reference-catalog.md).
День 12 остаётся открытым. Коммит не создавался.
