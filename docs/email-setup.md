# Письма на почту (сброс пароля)

Без настроек SMTP код показывается только в консоли сервера и в приложении (режим разработки).

## 1. Файл `server/.env`

Скопируйте `server/.env.example` → `server/.env` и заполните блок SMTP (см. примеры ниже).

**Важно:** `server/.env` не попадает в git — пароли храните только там.

## 2. Gmail (рекомендуется для теста)

1. Включите [двухэтапную аутентификацию](https://myaccount.google.com/security).
2. Создайте [пароль приложения](https://myaccount.google.com/apppasswords) → «Почта» → «Другое» → Loomi.
3. В `server/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ваш@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=Loomi <ваш@gmail.com>
```

`SMTP_PASS` — **16 символов пароля приложения** (пробелы можно убрать).

## 3. Yandex

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ваш@yandex.ru
SMTP_PASS=пароль-приложения
SMTP_FROM=Loomi <ваш@yandex.ru>
```

Пароль приложения: [id.yandex.ru](https://id.yandex.ru) → Безопасность → Пароли приложений.

## 4. Mail.ru

```env
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ваш@mail.ru
SMTP_PASS=пароль-приложения
SMTP_FROM=Loomi <ваш@mail.ru>
```

## 5. Перезапуск

```bash
npm run server:dev
```

В консоли должно быть: **`SMTP проверен, письма будут уходить на email`**.

Проверка: [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health) → `"mail": "smtp"`.

## 6. В приложении

Профиль → Войти → Забыли пароль? → email **того же аккаунта**, что при регистрации.

Письмо может попасть в **Спам**. Тема: «Loomi: код для сброса пароля».

## Ошибки

| Симптом | Что сделать |
|--------|-------------|
| В консоли «SMTP не настроен» | Заполните `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` в `server/.env` |
| «подключение не удалось» | Неверный пароль, нужен пароль приложения, не обычный пароль |
| Письма нет, в UI «отправлено» | Спам, другой email, не тот что в аккаунте Loomi |
| 503 в приложении | Смотрите ошибку в консоли сервера |
