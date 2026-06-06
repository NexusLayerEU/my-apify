# MyApify — Self-Hosted Web Scraping Platform

> **Product spec** — full Apify-like platform, self-hosted on 192.168.68.111

---

## Goal

A production-grade, self-hosted web scraping platform. Users create **Actors** (scraper scripts in Python or Node.js), run them on demand or on a schedule, store results in **Datasets**, and manage everything via a web dashboard or REST API. Designed as a product with multi-user support, API keys, and Docker-isolated execution.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MYAPIFY PLATFORM                      │
│                                                          │
│  React Dashboard (port 4200)                             │
│       ↕ REST API + WebSocket                             │
│  Express API Server (port 4280)                          │
│       ├── Auth (JWT)                                     │
│       ├── Actor Manager                                  │
│       ├── Run Engine  ←→  Docker (isolated containers)   │
│       ├── Dataset Store ←→ PostgreSQL                    │
│       ├── Job Queue  ←→  Redis + BullMQ                  │
│       ├── Scheduler (cron)                               │
│       └── Key-Value Store                                │
│                                                          │
│  PostgreSQL :5440  |  Redis :6390  |  MinIO :9300        │
└──────────────────────────────────────────────────────────┘
```

**All services run via Docker Compose on 192.168.68.111.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express 5 |
| Frontend | React 18 + Vite + Tailwind v4 |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + BullMQ |
| Actor execution | Docker (dockerode) — isolated containers per run |
| Log streaming | Server-Sent Events (SSE) |
| Auth | JWT (30-day tokens) + API keys |
| File storage | Local filesystem (mounted volume) |

---

## Data Models

### Users
```sql
users (id, email, password_hash, api_key, plan, created_at)
```

### Actors
```sql
actors (id, user_id, name, slug, description, runtime, source_code, 
        requirements, dockerfile_extra, is_public, created_at, updated_at)
```
- `runtime`: `python3` | `node20`
- `source_code`: the scraper script (stored as text)
- `requirements`: pip requirements.txt or package.json deps

### Runs
```sql
runs (id, actor_id, user_id, status, input_json, output_dataset_id,
      started_at, finished_at, container_id, exit_code)
```
- `status`: `QUEUED` | `RUNNING` | `SUCCEEDED` | `FAILED` | `ABORTED`

### Logs
```sql
run_logs (id, run_id, timestamp, level, message)
```

### Datasets
```sql
datasets (id, name, user_id, actor_id, run_id, item_count, created_at)
dataset_items (id, dataset_id, data jsonb, created_at)
```

### Schedules
```sql
schedules (id, actor_id, user_id, cron_expr, input_json, enabled, last_run, next_run)
```

### Key-Value Stores
```sql
kv_stores (id, name, user_id)
kv_records (id, store_id, key, value text, content_type, updated_at)
```

---

## API Routes

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT token
- `GET  /api/auth/me` — current user info
- `POST /api/auth/rotate-key` — regenerate API key

### Actors
- `GET    /api/actors` — list user's actors
- `POST   /api/actors` — create actor
- `GET    /api/actors/:id` — get actor
- `PUT    /api/actors/:id` — update actor (code, settings)
- `DELETE /api/actors/:id` — delete actor
- `POST   /api/actors/:id/run` — trigger a run (queues job)
- `GET    /api/actors/:id/runs` — run history for actor

### Runs
- `GET  /api/runs` — all runs (paginated, filterable)
- `GET  /api/runs/:id` — run detail
- `GET  /api/runs/:id/log` — SSE log stream (live + historical)
- `POST /api/runs/:id/abort` — kill running container

### Datasets
- `GET    /api/datasets` — list datasets
- `GET    /api/datasets/:id` — dataset info
- `GET    /api/datasets/:id/items` — paginated items (supports ?format=json|csv)
- `POST   /api/datasets/:id/items` — push items (called from within actor)
- `DELETE /api/datasets/:id` — delete dataset

### Schedules
- `GET    /api/schedules` — list schedules
- `POST   /api/schedules` — create schedule
- `PUT    /api/schedules/:id` — update
- `DELETE /api/schedules/:id` — delete
- `PATCH  /api/schedules/:id/toggle` — enable/disable

### Key-Value Store
- `GET  /api/kv` — list stores
- `POST /api/kv` — create store
- `GET  /api/kv/:storeId/:key` — get value
- `PUT  /api/kv/:storeId/:key` — set value
- `DELETE /api/kv/:storeId/:key` — delete key
- `GET  /api/kv/:storeId` — list all keys

### Stats
- `GET /api/stats` — dashboard stats (runs today, total actors, datasets, etc.)

---

## Actor Execution Engine

Each actor run:
1. **Queue**: run is created with `QUEUED` status, BullMQ job added
2. **Worker picks up**: pulls actor source code from DB
3. **Container built/reused**: Docker image for runtime (python3 or node20) pulled, source injected as a file
4. **Run starts**: `docker run` with:
   - Input JSON passed as `ACTOR_INPUT` env var
   - `MYAPIFY_API_URL` + `MYAPIFY_TOKEN` env vars (so actor can push datasets)
   - CPU/memory limits (1 CPU, 512MB default)
   - 30-minute timeout
5. **Log streaming**: container stdout/stderr tailed via dockerode, written to `run_logs` and streamed via SSE
6. **Completion**: container exits → status updated, dataset finalised
7. **Cleanup**: container removed

### Actor SDK (injected into every run)
A small helper module available inside actors:

```python
# Python actors
from myapify import Actor

async with Actor() as actor:
    input = await actor.get_input()
    dataset = await actor.open_dataset()
    await dataset.push_data({"result": "value"})
    kv = await actor.open_key_value_store()
    await kv.set("my_key", {"data": 123})
```

```javascript
// Node.js actors
const { Actor } = require('myapify');
await Actor.init();
const input = await Actor.getInput();
const dataset = await Actor.openDataset();
await dataset.pushData({ result: 'value' });
await Actor.exit();
```

---

## Frontend Pages

| Page | Route | Description |
|---|---|---|
| Login / Register | `/login` | Auth screen |
| Dashboard | `/` | Stats, recent runs, quick actions |
| Actors | `/actors` | List all actors with status |
| Actor Editor | `/actors/new` `/actors/:id` | Code editor (Monaco) + settings |
| Runs | `/runs` | All runs with status, filter |
| Run Detail | `/runs/:id` | Live log stream, input/output |
| Datasets | `/datasets` | List datasets |
| Dataset Viewer | `/datasets/:id` | Browse items, export CSV/JSON |
| Schedules | `/schedules` | Cron schedule management |
| Key-Value | `/kv` | Browse KV stores |
| Settings | `/settings` | API key, account |

---

## File Structure

```
MyApify/
├── backend/
│   ├── src/
│   │   ├── routes/        (actors, runs, datasets, schedules, kv, auth, stats)
│   │   ├── services/      (runner, scheduler, docker, dataset, queue)
│   │   ├── models/        (db schema + queries)
│   │   ├── middleware/    (auth, error)
│   │   ├── sdk/           (actor SDK injected into containers)
│   │   └── index.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
├── docker/
│   ├── docker-compose.yml
│   ├── runtimes/
│   │   ├── python3/Dockerfile
│   │   └── node20/Dockerfile
│   └── nginx.conf
├── AgentAI/
│   ├── memory.md
│   ├── handover.md
│   ├── state.md
│   └── sessions.md
└── docs/
```

---

## Deployment

- **Port 4200**: Frontend (nginx)
- **Port 4280**: Backend API
- **Port 4240**: PostgreSQL (internal)
- **Port 4250**: Redis (internal)
- All on `192.168.68.111` via Docker Compose

---

## MVP Scope (Phase 1)

1. Auth (register, login, API keys)
2. Actor CRUD + code editor
3. Run engine (Docker, Python + Node runtimes)
4. Live log streaming (SSE)
5. Dataset push + viewer
6. Dashboard with stats
7. Docker Compose deploy on home server

## Phase 2 (after MVP)

- Schedules (cron)
- Key-Value store
- Actor templates library
- Webhooks on run completion
- Public actor marketplace
- Usage/billing tracking
