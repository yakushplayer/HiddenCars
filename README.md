# HiddenCars

Прятки на машинах: админ создаёт игру и зону на карте, игроки вступают по паролю, отмечают «спрятался» / «меня нашли», загружают фото. Геолокация игроков не используется.

## Стек

- PostgreSQL (Docker)
- Node.js + Express + Socket.IO
- React (Vite) + Leaflet

## Быстрый старт

### 1. PostgreSQL

В проекте уже настроено подключение к локальному PostgreSQL (`hiddencars` / `hiddencars` / БД `hiddencars`).

Если базы ещё нет (первый раз на другом ПК):

```powershell
# пример через psql (пароль суперпользователя postgres)
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE ROLE hiddencars LOGIN PASSWORD 'hiddencars';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE hiddencars OWNER hiddencars;"
```

Либо через Docker (если установлен Docker Desktop):

```powershell
cd C:\Users\Admin\Desktop\HiddenCars
docker compose up -d
```
### 2. Backend

```powershell
cd C:\Users\Admin\Desktop\HiddenCars\backend
npm install
npm run setup
npm run dev
```

Админ по умолчанию: `admin` / `admin123` (из `.env`).

### 3. Frontend

```powershell
cd C:\Users\Admin\Desktop\HiddenCars\frontend
npm install
npm run dev
```

Открой http://localhost:5173

## Как посмотреть БД

Подключение:

| Параметр | Значение |
|----------|----------|
| Host | `localhost` |
| Port | `5432` |
| User | `hiddencars` |
| Password | `hiddencars` |
| Database | `hiddencars` |

Схема: `db/migrations/001_init.sql`  
Удобные клиенты: pgAdmin, DBeaver, или расширение PostgreSQL в VS Code.

## Структура

```
HiddenCars/
  backend/           API + Socket.IO + db/migrations
  frontend/          React UI
  docker-compose.yml optional local Postgres
```
