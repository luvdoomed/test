# Деплой API Loomi на VPS

API — папка `server/`. Клиент (Tauri) ходит на URL из `VITE_API_URL`.

## 1. Подготовка сервера (Ubuntu 22+)

```bash
sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # должно быть v22.x
```

## 2. Клонирование и сборка

```bash
cd /opt
sudo git clone <ваш-репозиторий> loomi
cd loomi/server
sudo npm ci
sudo npm run build   # опционально; в prod: npx tsx src/index.ts
```

## 3. Переменные окружения

Создайте `server/.env`:

```env
PORT=8787
JWT_SECRET=<длинная-случайная-строка-32+символов>
DATA_DIR=/var/lib/loomi-data
AUDIO_QUOTA_BYTES=524288000
ALLOWED_ORIGINS=https://ваш-домен.ru,tauri://localhost,http://tauri.localhost

# Сброс пароля по email (обязательно на проде)
APP_NAME=Loomi
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=Loomi <noreply@example.com>
```

`ALLOWED_ORIGINS` — через запятую. Для Tauri можно оставить `true` (пустой список = все origins в коде).

## 4. Запуск через systemd

`/etc/systemd/system/loomi-api.service`:

```ini
[Unit]
Description=Loomi sync API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/loomi/server
EnvironmentFile=/opt/loomi/server/.env
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/lib/loomi-data
sudo chown www-data:www-data /var/lib/loomi-data
sudo systemctl daemon-reload
sudo systemctl enable --now loomi-api
curl http://127.0.0.1:8787/health
```

## 5. Nginx + HTTPS (пример)

`/etc/nginx/sites-available/loomi-api`:

```nginx
server {
    listen 80;
    server_name api.ваш-домен.ru;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 64m;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/loomi-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.ваш-домен.ru
```

## 6. Клиент (сборка приложения)

В корне проекта `.env`:

```env
VITE_API_URL=https://api.ваш-домен.ru
```

Пересоберите Tauri: `npm run tauri build`.

В профиле внизу должен отображаться ваш URL вместо `127.0.0.1:8787`.

## 7. Проверка

1. `GET https://api.ваш-домен.ru/health` → `{"ok":true}`
2. Регистрация в приложении → «Синхронизировать»
3. Второй ПК с тем же аккаунтом — библиотека, пресеты, «Мои» визуализаторы

## Docker (альтернатива)

```bash
cd server
docker build -t loomi-api .
docker run -d --name loomi-api -p 8787:8787 \
  -v loomi-data:/data \
  -e JWT_SECRET=... \
  -e DATA_DIR=/data \
  loomi-api
```
