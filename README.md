# Кто ты из учеников Академии?

Production-source для VK Mini App проекта «Княжич».

## Что внутри
- React + TypeScript + Vite.
- VKUI и VK Bridge.
- 25 канонических результатов.
- 12 основных вопросов.
- 13 адаптивных разделителей A–M, максимум два на одно прохождение.
- Раздельная нормализация положительной/отрицательной части шкал.
- Сохранение прохождения в sessionStorage.
- Кнопка «Назад» позволяет переиграть предыдущий ответ.
- 25 портретов, фон Академии и 25 Story/share-карточек подключаются из public.
- VK Bridge: Story/Share и Invite Box с браузерными fallback-механизмами.

## Запуск
```bash
npm install
npm run dev
```

Сборка:
```bash
npm run build
npm run preview
```

## VK App ID
После создания Mini App вписать ID в `vk-hosting-config.json` вместо 0, при необходимости заполнить `.env` по `.env.example`, проверить внутри VK и выполнить production build/deploy.

## Standalone preview
Локальный пакет содержит папку `standalone/`, которую можно открыть напрямую без npm и VK.

## Revision notes
- v2: вернута кнопка «Назад», добавлен счётчик 1/12…12/12, введён музыкальный eligibility-gate для Илиодора и Евстатия, улучшен desktop-result.
- v3: исправлен DOM счётчика в standalone.
- v4: исправлен слой фонового изображения Академии.
- v5: все 25 `public/share/*.webp` используют именительный результат (`тот, кто…` и эквивалентные формы) вместо ошибочного `тем, кто…`. Логика теста не менялась.

## Source data layout
Для удобной загрузки через GitHub API production-данные разделены на `src/data/split/meta.json`, `profiles-1.json` … `profiles-5.json`, `questions.json` и `tiebreakers.json`. `src/data/index.ts` собирает тот же объект QuizData во время выполнения.
