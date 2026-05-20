# Backup перед слиянием (20.05.2026)

## Что сохранено

| Что | Где |
|-----|-----|
| Ветка | `backup/pre-merge-2026-05-20` |
| Коммит | `f170a8f` (тег `backup-2026-05-20`) |
| Файл для друга | `backups/loomi-pre-merge-2026-05-20.bundle` |

**В git / bundle не вошло (секреты):** `server/.env`, `server/data/` — они в отдельной папке для передачи.

### Полный пакет «как у меня» (код + секреты + база)

Папка на вашем ПК:

`backups/transfer-for-friend/`

| Файл | Назначение |
|------|------------|
| `loomi-pre-merge-2026-05-20.bundle` | весь код |
| `server/.env` | SMTP, JWT |
| `server/data/` | SQLite (аккаунты, синхронизация) |
| `.env`, `src-tauri/.env` | если есть |
| `README.txt` | инструкция для друга |

Передайте **всю папку** другу (флешка / ZIP с паролем). **Не в GitHub.**

---

## Для друга — получить код

### Вариант A: файл `.bundle` (без GitHub)

1. Скопировать `backups/loomi-pre-merge-2026-05-20.bundle` (флешка / облако).
2. У друга:

```bash
git clone loomi-pre-merge-2026-05-20.bundle loomi-backup
cd loomi-backup
git branch -a
```

3. Ветка с полным снимком: `backup/pre-merge-2026-05-20`.
4. Скопировать из переданной папки `server/.env` и `server/data/` в клон (см. `README.txt`).

### Вариант B: общий репозиторий (GitHub)

```bash
git push -u origin backup/pre-merge-2026-05-20
```

Друг:

```bash
git fetch origin
git checkout backup/pre-merge-2026-05-20
```

---

## Слияние (пример)

Друг на своей ветке `feature/...` в **своём** клоне:

```bash
git fetch origin backup/pre-merge-2026-05-20
git merge origin/backup/pre-merge-2026-05-20
# или: git merge backup/pre-merge-2026-05-20  — если клонировали из bundle
```

Конфликты — править вручную, затем `git add` + `git commit`.

---

## После слияния у тебя

Сейчас активна ветка **`backup/pre-merge-2026-05-20`** (весь новый код здесь).

Влить в `main`, когда готово:

```bash
git checkout main
git merge backup/pre-merge-2026-05-20
```

`main` до слияния — старый коммит `79dc9ca` (без облака и нового UI).

---

## Запуск у друга после merge

1. `npm install`
2. `cd server && npm install` (Node **22**)
3. Либо скопировать переданный `server/.env` + `server/data/`, либо `.env.example` и свой SMTP
4. `npm run server:dev` + `npm run tauri dev`
