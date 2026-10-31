# Кто ты из учеников Академии?

Интерактивный тест по миру «Княжича»: 25 результатов, 12 основных вопросов, не более двух адаптивных уточнений. Единый код для браузера и VK Mini Apps.

## Две версии

- Браузер (GitHub Pages): https://socman2023.github.io/academy-quiz/
- VK Mini App: https://vk.com/app54787284

Обе версии используют одну модель данных, алгоритм v8, изображения персонажей и интерфейс. Различается только публикация результата:

| Действие | VK | Обычный браузер |
| --- | --- | --- |
| Похвастаться результатом | Редактор VK Историй | Скачивание вертикальной WebP-карточки |
| Позвать друга в Академию | Отправка ссылки VK | Системное окно «Поделиться» или копирование URL |
| Повторить тест | Да | Да |

Публикация на стене VK отключена: VK не разрешил соответствующий вызов даже после прохождения модерации.

## Данные и алгоритм

Алгоритм v8 сравнивает профиль ответов с двадцатимерными профилями 25 героев, использует калибровочные поправки и задаёт уточняющий вопрос лишь тогда, когда ответы могут изменить победителя. Подробности: `docs/V8_ALGORITHM_AUDIT.md`.

- Профили и параметры: `src/data/split/`;
- 25 портретов: `public/assets/characters/`;
- фон: `public/assets/academy.webp`;
- 25 вертикальных карточек: `public/share/*.webp`;
- квадратные карточки (архив): `public/share/wall/*.webp`.

`src/lib/assets.ts` учитывает базовый адрес обоих хостингов. `src/lib/environment.ts` определяет запуск внутри VK. Не добавляйте абсолютные URL, начинающиеся с `/assets/`, прямо в React `src`: используйте `publicAssetUrl`.

## Локальный запуск

```bash
npm install
npm run dev
```

Проверки:

```bash
npm run test:engine
npm run audit:distribution
npm run test:assets
npm run build
npm run build:pages
```

## Публикация на GitHub Pages

1. Владелец переводит репозиторий в **Public** в Settings → General → Danger Zone → Change repository visibility.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → **Publish browser version (GitHub Pages)** → Run workflow → main → Run workflow.
4. Дождаться завершения workflow и открыть https://socman2023.github.io/academy-quiz/.

После этого каждый push в `main` автоматически запускает сборку и публикацию Pages. Пока репозиторий приватный, задача Pages сознательно пропускается. Для Pages предусмотрена отдельная команда `npm run build:pages` с Vite base `/academy-quiz/`; сборка VK по-прежнему имеет относительный base `./`.

## Публикация во VK

**Обновление GitHub Pages не обновляет VK Mini App.** После проверки браузерной версии и CI владелец репозитория подтягивает `main` через GitHub Desktop, затем выполняет из командной строки в папке проекта:

```cmd
set MINI_APPS_ENVIRONMENT=production
npm run deploy
```

При подтверждении публикации обновить production URL, а dev URL и тестовую группу не менять. ID приложения `54787284` указан в `vk-hosting-config.json`. Не добавляйте токены, пароли и `.env` в Git.

CI (`.github/workflows/ci.yml`) выполняет тест движка, аудит распределения, проверку медиа и обе сборки. Публикация браузерной версии — отдельный workflow (`.github/workflows/pages.yml`).
