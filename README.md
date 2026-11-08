# Relationer

Проект для построения генеалогических деревьев и поиска аналогичных родственных структур в справочнике.

## Запуск фронтенда

Нужны Node.js >= 22.12 (рекомендуется 22.22.0), npm и JDK 21 для генерации API-клиента. При первом запуске нужен доступ к Maven Central.

Из корня проекта:

```sh
cd frontend
# Если используется nvm:
nvm install
nvm use
npm ci
npm run dev
```

Если терминал использует Node.js 16, а локальная версия уже подготовлена в `frontend/.cache/node/bin`, из каталога `frontend` выполните:

```sh
export PATH="$PWD/.cache/node/bin:$PATH"
node -v # v22.22.0
npm run dev
```

В новом терминале версию нужно выбрать снова. При запуске из IDE укажите тот же Node interpreter: `frontend/.cache/node/bin/node`, либо Node.js 22 из nvm.

Откройте адрес, который выведет Vite. Backend для работы текущего редактора не требуется.

## Тесты фронтенда

В каталоге `frontend` после установки зависимостей:

```sh
npm test                 # Unit-тесты
npm run typecheck        # Проверка TypeScript
npm run test:e2e         # Браузерные тесты; нужен установленный Google Chrome
```

Браузерные тесты сами запускают сервер на порту 4173. Вместо Google Chrome можно установить Chromium:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

## Документация

- [Родители и семейные связи в конструкторе](docs/family-groups.md). Каждый узел — отдельный человек; одного общего родителя достаточно для кровного пути.

- [Модель родства: отдельные люди, кровное родство `<BB>` и свойство `<BMB>`](docs/architecture/kinship-model.md). Поиск исключает избыточные обходы через брак общих родителей, сохраняя исходный граф.
- [Предметные правила определения родства](docs/kinship-rules.md).
- [Спецификация поиска справочных деревьев](docs/tree-matching-rules.md).
