# melodia

One planet. Infinite vibes. Интерактивен глобус с live radio, любими станции и музикални визуализации.

## Структура

```text
public/                  Публичният сайт — само тази папка се публикува
  index.html             Начална страница
  styles.css             Стилове
  *.js                   Browser ES modules и module worker
  assets/                Карти, градове, резервен каталог, икона и изображения
  vendor/                Three.js, HLS.js и техните лицензи
tests/                   Автоматизирани Node.js тестове
tools/                   Локални браузърни и performance проверки
scripts/check.js         Проверка на JavaScript синтаксиса
server.js                Локален HTTP сървър, не е част от сайта
.github/workflows/       Публикуване в GitHub Pages
.gitignore               Изключени локални файлове и тайни
```

## Локално стартиране

Нужен е Node.js 22 или по-нов. Не е нужен `npm install`: помощните скриптове използват Node.js built-ins, а browser библиотеките са в `public/vendor/`.

```powershell
npm start
```

Отвори `http://localhost:3000`. Не използвай `file://`: приложението използва ES modules, module worker и HTTP заявки за ресурсите.

Сървърът публикува само `public/`, а не корена на repository. За друг порт:

```powershell
$env:PORT='3001'; npm start
```

## Проверки

```powershell
npm run check
npm run test:pages
npm test
```

`test:pages` проверява публичната структура, локалните зависимости и че сървърът не отдава файлове от repository. При реорганизацията общият тестов набор имаше три предварително съществуващи грешки в `tests/station-visuals.test.js`, свързани с очаквания за фонови shader ефекти. Те не се заобикалят или премахват; Pages workflow пуска синтактичните и deployment проверките, а не целия набор.

## GitHub Pages

1. Качи проекта в GitHub с основен клон `main`.
2. В **Settings → Pages → Build and deployment → Source** избери **GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` проверява кода и качва **само `public/`** като Pages artifact. Стартира при push в `main` или ръчно от Actions.
4. Ако основният клон е с друго име, промени `branches: [main]` в workflow.

Не избирай публикуване от root на клона: така не се използва разделението на публични и помощни файлове. В крайния сайт `public/index.html` става `/index.html`; в адреса няма `/public/`.

Локалните URL адреси в сайта са относителни, за да работят както на домейн, така и под `https://USERNAME.github.io/REPOSITORY/`. Radio Browser, Overpass, Google Fonts и радио стриймовете са външни услуги; Pages не предоставя proxy или backend. Достъпността и възпроизвеждането зависят от HTTPS, CORS, кодеци и самите радиостанции.

Не е добавен `CNAME`, тъй като custom domain и DNS настройките трябва да бъдат потвърдени отделно.

## Какво е публично и какво не

- **Сайт:** само съдържанието на `public/`.
- **Repository:** при публичен repository тестовете, инструментите и изходният код също са видими в GitHub, въпреки че не се публикуват в Pages.
- **Само локално:** `.env*`, ключове, browser профили, кешове, логове, preview снимки и editor настройки са изключени чрез `.gitignore`.
- `.gitignore` не скрива вече commit-нати файлове и не изтрива историята. Никога не поставяй тайни в browser JavaScript или в `public/`.
- JavaScript, HTML, CSS и данните, изпращани до браузъра, не могат да бъдат направени секретни на статичен сайт.

## Диагностични инструменти

Инструментите в `tools/` не се публикуват в GitHub Pages. За изолираната браузърна performance сцена включи достъпа изрично само локално:

```powershell
$env:DEV_TOOLS='1'; npm start
```

После стартирай Chromium с debugging port `9223` и отворен `http://localhost:3000`. Примерни проверки:

```powershell
node tools/station-layout-check.js
node tools/browser-check.js
node tools/performance-scenes.js
```

Browser screenshot проверката създава игнорирани `preview*.png` в корена на проекта. Диагностичният UI `?perf=1` остава част от приложението, тъй като се използва за диагностика на действителния глобус и е изключен по подразбиране.

## Данни и лицензи

- Radio Browser: каталог и резервна снимка в `public/assets/stations.json`; не е нужен API ключ.
- Natural Earth: географски граници и градове, public domain.
- OpenStreetMap contributors: заявявани при нужда административни граници чрез Overpass, ODbL.
- Three.js: MIT, `public/vendor/LICENSE`.
- HLS.js: Apache-2.0, `public/vendor/hls-LICENSE.txt`.
- Социални икони: атрибуция в `public/assets/social-icons-LICENSE.md`.
- Manrope: Google Fonts със системен fallback.

Лицензите на външните библиотеки са запазени. Те не определят автоматично лиценз за оригиналния код и дизайн на проекта.