# День 12 — оригинальные схемы каталога

> Исторический отчёт первой интеграции 11 PNG. Текущее хранение всех 94 PNG на backend
> и API описаны в [едином каталоге](reference-catalog.md). Пути frontend/public ниже относятся к прежнему состоянию.

Дата: 10 ноября 2026. Интегрированы 11 PNG из `relationer-reference-import.zip`.
День 12 не завершён: предметные вопросы ниже требуют решения владельца каталога.
Инфраструктура и Docker не менялись, новых кейсов нет, коммит не создавался.

## Проверка импорта

Архив распакован во временный каталог; пути проверены на выход за его пределы.
Все 11 PNG открыты для визуального просмотра. ID, порядок и количество записей
совпали с рабочим каталогом. `references-original.json` семантически идентичен
рабочему JSON до импорта. Единственные отличия `references-with-images.json` —
11 полей `source.image`. Люди, имена, A/B, связи, категории, теги, описания,
вердикты и прочие сведения источника не изменены.

В рабочий файл перенесены только `source.image` по ID, с сохранением форматирования.
Все пути соответствуют файлам в `frontend/public/reference-images/`.
Байты каждого опубликованного PNG совпали с соответствующим файлом ZIP.
Исходные имена сохранены, перекодирования и OCR нет.

## Сопоставление всех 11 схем

Страницы ниже совпадают в JSON и `import-report.md` архива. Сам PDF не включён
в архив и не найден в репозитории: переход на страницу оригинального документа,
печатная нумерация и окружающий текст независимо не проверены.
Номер схемы прочитан на каждом PNG. Файлы названы `<ID>.png`.
Все PNG загружаются и отображаются без дополнительного обрезания в UI.

| ID | Страница PDF по метаданным | № схемы на PNG | Размер PNG | Участники и связи |
| --- | ---: | ---: | --- | --- |
| blood-01 | 34 | 1 | 518×564 | p=Пётр → a=Георгий, b=Мария; A/B соответствуют брату и сестре |
| blood-02 | 34 | 2 | 554×659 | p=Пётр → a=Георгий, s=Иоанн → b; структура совпала, имя b расходится, верхний контур p обрезан |
| blood-03 | 35 | 3 | 529×786 | p → a («великий дядя»), s («брат») → n («племянник») → b («великая племянница»); A/B и связи совпали, верх p обрезан |
| blood-04 | 35 | 4 | 561×746 | p=Пётр → f=Георгий и m=Иоанн; f → a=Фома, m → b=Мария; соответствует |
| blood-05 | 36 | 5 | 576×1492 | p → a и s → n → gn → b; A=левый «великий дядя», B=«ея дочь», связи соответствуют |
| affinity-allowed-01 | 61 | 2 | 820×1204 | ancestor → maria/feodora; petr рядом с maria; petr → ioanna → georgiy; feodora → irina → elena; узлы и ветви совпали, A требует решения |
| affinity-allowed-02 | 62 | 3 | 918×1336 | ancestor → left/right → maria/feodora; petr рядом с maria; petr → ioanna → georgiy; feodora → anna; узлы и ветви совпали, A требует решения |
| affinity-allowed-03 | 65 | 1 | 980×1242 | ancestor → maria/irina; petr рядом с maria; petr → ioanna → georgiy → foma; irina → anna; узлы и ветви совпали, A требует решения |
| spiritual-forbidden-01 | 120 | 1 | 408×474 | godparent → goddaughter, подпись «крести» соответствует SPIRITUAL; A/B совпали, верх godparent обрезан |
| spiritual-forbidden-02 | 121 | 2 | 583×616 | godparent → godchild духовно, mother → godchild биологически; A=восприемник, B=мать, соответствует |
| spiritual-forbidden-03 | 121 | 3 | 496×637 | godparent → godson/goddaughter духовно; A/B соответствуют крестнику/крестнице |

У безымянных узлов blood-03/05 JSON сохраняет ID без исторических подписей;
соответствие установлено по положению в ветвях. Имена в старой орфографии
сопоставлялись вручную, нормализация данных не выполнялась.

## Вопросы для решения

1. **affinity-allowed-01:** JSON выбирает `petr → elena`; в их пути 4 кровных
   шага и брак. PNG подписан «Степень шестый, бывает». Шесть кровных шагов
   получаются для `georgiy → elena`, с использованием обеих нижних ветвей.
   Возможная ошибка — выбор `personA=petr` вместо `georgiy`. Нужна проверка
   текста PDF, поскольку сама схема не помечает A/B.
2. **affinity-allowed-02:** JSON выбирает `petr → anna`, 5 кровных шагов и брак;
   PNG указывает седьмую степень. Пара `georgiy → anna` даёт 7 кровных шагов.
   Нужно решить, относится ли пример к этой паре, и согласовать описание.
3. **affinity-allowed-03:** JSON выбирает `petr → anna`, 3 кровных шага и брак;
   PNG указывает шестую степень. Пара `foma → anna` даёт 6 кровных шагов.
   Требуется то же предметное решение о A и описании.
4. **Брак во всех трёх affinity:** соприкасающиеся круги Петра и Марии
   интерпретированы JSON как MARRIAGE. PNG сам по себе не подтверждает условие
   отсутствия предшествующего брака из `source.conclusion`; его необходимо
   проверить по соседнему тексту и сноскам полного PDF. Существующий вердикт
   ALLOWED не пересматривался.
5. **blood-02:** на PNG у B читается «Марину» (Марина), в JSON `name=Мария`.
   Связи и роль племянницы совпадают. Решить вопрос имени после сверки PDF.
6. **Края изображений:** у blood-02, blood-03 и spiritual-forbidden-01 верхние
   контуры узлов уже выходят за край PNG. Полноту подписи верхнего узла
   blood-03 без PDF подтвердить нельзя. Нужны более полные фрагменты из PDF. В некоторых
   других PNG присутствует соседний текст/фрагмент соседней схемы; удалять их
   автоматически нельзя. CSS `contain` не исправляет исходное кадрирование.

Предложения о замене A — вывод из структуры и указанной степени, а не
подтверждённая трактовка полного первоисточника. Ни одно из этих изменений
не внесено. Существующие поисковые тесты продолжают проверять текущие пары.

## Реализация и воспроизводимая проверка

Модель ReferenceSource, loader, SourceDto/OpenAPI и read API уже поддерживали
optional image. Добавлена его передача также в source результатов поиска,
без изменения поиска и сопоставления. В `/references` добавлены подписи панелей,
увеличение в нативном dialog, Escape/кнопка закрытия и ссылка на исходный файл.
Сохранены фильтры, теги, порции 10 записей, infinite scroll и компактные графы.
Отсутствующий путь и ошибка загрузки имеют отдельные сообщения.

Backend HTTP-тесты проверяют `source.image` в списке, деталях и поиске для
production-каталога; прежние loader-fixtures проверяют обратную совместимость.
Playwright `reference-images.spec.ts` использует реальные PNG со статического
сервера и каталог JSON через mock API: все 11 файлов проверяются при 1440 и 390 px,
включая декодирование, пропорции, отсутствие обрезанных узлов графа, две колонки /
вертикальное расположение, открытие увеличения, Escape и возврат фокуса.
Отдельные тесты проверяют отсутствие/ошибку изображения, фильтры и подгрузку.
`references-real.spec.ts` проверяет каталог с реальным backend.

Команды выполняются из соответствующего каталога (Node 22.22.0 из
`frontend/.cache/node/bin`, JDK 21):

```sh
# backend
./gradlew test openApiValidate
# frontend
npm test
npm run build
# При запущенном backend:
RUN_BACKEND_INTEGRATION=1 npm run test:e2e
```

Результаты окончательного прогона:

- Backend: 222 теста, 0 failures/errors/skipped; OpenAPI валиден.
- Frontend unit: 59 тестов, 4 файла, все прошли.
- Production build: TypeScript и Vite прошли, все 11 PNG присутствуют в dist
  и побайтно совпадают с public/reference-images.
- Playwright: `RUN_BACKEND_INTEGRATION=1 npm run test:e2e -- --workers=2` —
  36/36 прошли, без пропусков, включая реальный backend, поиск, фильтры,
  подгрузку, отсутствие/ошибку изображения, desktop/mobile и увеличение.
- `git diff --check` проходит. Снимки blood-03 desktop/mobile также просмотрены.

Временные frontend/backend-серверы остановлены.
Инструкция добавления изображений и новых эталонов —
[архитектура](architecture/overview.md#изображения-и-добавление-эталонов).

## Изменённые и добавленные файлы

- `backend/src/main/resources/references.json` — только source.image у 11 ID.
- `backend/src/main/kotlin/com/relationer/backend/api/SearchApiMapper.kt` — image в source поискового ответа.
- `backend/src/test/kotlin/com/relationer/backend/api/ReferenceCatalogHttpTest.kt` — изображение в списке и деталях.
- `backend/src/test/kotlin/com/relationer/backend/api/ReferenceSearchHttpTest.kt` — изображение в поиске.
- `frontend/src/components/ReferenceCard.vue` — панели и увеличение.
- `frontend/src/style.css` — стили панелей и диалога изображения.
- `frontend/e2e/references.spec.ts` — fixture без image для сценария отсутствующего изображения.
- `frontend/e2e/reference-images.spec.ts` — все реальные PNG, desktop/mobile и увеличение.
- `frontend/public/reference-images/blood-01.png`.
- `frontend/public/reference-images/blood-02.png`.
- `frontend/public/reference-images/blood-03.png`.
- `frontend/public/reference-images/blood-04.png`.
- `frontend/public/reference-images/blood-05.png`.
- `frontend/public/reference-images/affinity-allowed-01.png`.
- `frontend/public/reference-images/affinity-allowed-02.png`.
- `frontend/public/reference-images/affinity-allowed-03.png`.
- `frontend/public/reference-images/spiritual-forbidden-01.png`.
- `frontend/public/reference-images/spiritual-forbidden-02.png`.
- `frontend/public/reference-images/spiritual-forbidden-03.png`.
- `docs/architecture/overview.md` — хранение, привязка, сверка, добавление эталонов.
- `docs/roadmap.md` — выполненная интеграция и открытые вопросы Дня 12.
- `docs/day12-reference-images.md` — этот отчёт.

Архив ZIP уже находился в staged-изменениях пользователя до начала работы;
его содержимое и состояние индекса не менялись. Generated API, dist и снимки
браузера являются локальными артефактами и исключены из Git.
