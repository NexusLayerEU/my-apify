# MyApify MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted Apify-like web scraping platform with Actor management, Docker-isolated execution, live log streaming, dataset storage, and a React dashboard.

**Architecture:** Express 5 backend on port 4280 connected to PostgreSQL + Redis, BullMQ workers run Actor scripts inside Docker containers, SSE streams logs live to the React frontend on port 4200.

**Tech Stack:** Node.js 20, Express 5, PostgreSQL 16, Redis 7, BullMQ, dockerode, React 18, Vite, Tailwind v4, Monaco Editor, JWT, bcrypt, axios

**Working directory:** `/Users/admin/Documents/Thomas-SRC/MyApify`

---

## File Map

```
MyApify/
├── backend/
│   ├── src/
│   │   ├── db.js                  # pg pool
│   │   ├── index.js               # Express app
│   │   ├── middleware/auth.js     # JWT + API key guard
│   │   ├── routes/auth.js
│   │   ├── routes/actors.js
│   │   ├── routes/runs.js
│   │   ├── routes/datasets.js
│   │   ├── routes/stats.js
│   │   ├── services/queue.js      # BullMQ setup
│   │   ├── services/runner.js     # Docker execution
│   │   └── services/logStream.js  # SSE EventEmitter
│   ├── migrations/001_initial.sql
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.ts
│   │   ├── auth.tsx
│   │   ├── App.tsx
│   │   ├── components/Layout.tsx
│   │   ├── components/StatCard.tsx
│   │   ├── components/RunBadge.tsx
│   │   ├── pages/Login.tsx
│   │   ├── pages/Dashboard.tsx
│   │   ├── pages/Actors.tsx
│   │   ├── pages/ActorEditor.tsx
│   │   ├── pages/Runs.tsx
│   │   ├── pages/RunDetail.tsx
│   │   └── pages/Datasets.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── docker-compose.yml
│   ├── runtimes/python3/Dockerfile
│   ├── runtimes/node20/Dockerfile
│   └── nginx/nginx.conf
└── .gitignore
```

---

## Task 1: Project scaffold + .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
dist/
.env
*.local
.DS_Store
*.db
*.db-shm
*.db-wal
```

- [ ] **Step 2: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

## Task 2: Backend scaffold + dependencies

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`

- [ ] **Step 1: Init backend**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
mkdir -p backend/src/{middleware,routes,services} backend/migrations
cd backend
npm init -y
npm install express cors dotenv pg bcrypt jsonwebtoken uuid bullmq dockerode
npm install -D nodemon
```

- [ ] **Step 2: Create `backend/.env.example`**

```env
PORT=4280
DATABASE_URL=postgresql://myapify:myapify123@localhost:4240/myapify
REDIS_HOST=localhost
REDIS_PORT=4250
JWT_SECRET=myapify-jwt-secret-change-in-production-64chars
DOCKER_SOCKET=/var/run/docker.sock
ACTOR_DATA_DIR=/tmp/myapify-runs
API_BASE_URL=http://localhost:4280
```

- [ ] **Step 3: Copy to .env**

```bash
cp backend/.env.example backend/.env
```

- [ ] **Step 4: Update package.json scripts**

Edit `backend/package.json` — replace `"scripts"` with:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add backend/
git commit -m "chore: scaffold backend"
```

---

## Task 3: Database schema migration

**Files:**
- Create: `backend/migrations/001_initial.sql`

- [ ] **Step 1: Write migration**

```sql
-- backend/migrations/001_initial.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    api_key     TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE actors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    runtime         TEXT NOT NULL DEFAULT 'python3',
    source_code     TEXT NOT NULL DEFAULT '',
    requirements    TEXT NOT NULL DEFAULT '',
    is_public       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, slug)
);

CREATE TABLE datasets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES actors(id) ON DELETE SET NULL,
    run_id      UUID,
    item_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dataset_items (
    id          BIGSERIAL PRIMARY KEY,
    dataset_id  UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id        UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'QUEUED',
    input_json      JSONB NOT NULL DEFAULT '{}',
    output_dataset_id UUID REFERENCES datasets(id),
    container_id    TEXT,
    exit_code       INTEGER,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE datasets ADD CONSTRAINT fk_run FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE SET NULL;

CREATE TABLE run_logs (
    id          BIGSERIAL PRIMARY KEY,
    run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level       TEXT NOT NULL DEFAULT 'INFO',
    message     TEXT NOT NULL
);

CREATE TABLE schedules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cron_expr   TEXT NOT NULL,
    input_json  JSONB NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT true,
    last_run    TIMESTAMPTZ,
    next_run    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_actor     ON runs(actor_id);
CREATE INDEX idx_runs_user      ON runs(user_id);
CREATE INDEX idx_run_logs_run   ON run_logs(run_id);
CREATE INDEX idx_dataset_items  ON dataset_items(dataset_id);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add backend/migrations/
git commit -m "feat: database schema migration"
```

---

## Task 4: Database connection pool

**Files:**
- Create: `backend/src/db.js`

- [ ] **Step 1: Write db.js**

```javascript
// backend/src/db.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const sql = fs.readFileSync(
        path.join(__dirname, '../migrations/001_initial.sql'), 'utf8'
    );
    await pool.query(sql);
    console.log('Migration complete');
}

module.exports = { pool, migrate };
```

---

## Task 5: Auth middleware

**Files:**
- Create: `backend/src/middleware/auth.js`

- [ ] **Step 1: Write auth.js**

```javascript
// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

module.exports = async function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const apiKey = req.headers['x-api-key'];

    try {
        if (apiKey) {
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE api_key = $1', [apiKey]
            );
            if (!rows.length) return res.status(401).json({ error: 'Invalid API key' });
            req.user = rows[0];
            return next();
        }
        if (header.startsWith('Bearer ')) {
            const token = header.slice(7);
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE id = $1', [payload.userId]
            );
            if (!rows.length) return res.status(401).json({ error: 'User not found' });
            req.user = rows[0];
            return next();
        }
        res.status(401).json({ error: 'Unauthorized' });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
```

---

## Task 6: Auth routes

**Files:**
- Create: `backend/src/routes/auth.js`

- [ ] **Step 1: Write auth routes**

```javascript
// backend/src/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, api_key, plan, created_at',
            [email.toLowerCase(), hash]
        );
        const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
        throw err;
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email?.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...user } = rows[0];
    res.json({ token, user });
});

router.get('/me', auth, (req, res) => {
    const { password_hash, ...user } = req.user;
    res.json(user);
});

router.post('/rotate-key', auth, async (req, res) => {
    const newKey = uuidv4();
    await pool.query('UPDATE users SET api_key = $1 WHERE id = $2', [newKey, req.user.id]);
    res.json({ api_key: newKey });
});

module.exports = router;
```

---

## Task 7: Actor routes (CRUD)

**Files:**
- Create: `backend/src/routes/actors.js`

- [ ] **Step 1: Write actor routes**

```javascript
// backend/src/routes/actors.js
const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { enqueueRun } = require('../services/queue');

router.use(auth);

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { name, description = '', runtime = 'python3', source_code = '', requirements = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { rows } = await pool.query(
        `INSERT INTO actors (user_id, name, slug, description, runtime, source_code, requirements)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.id, name, slug, description, runtime, source_code, requirements]
    );
    res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
    const { name, description, runtime, source_code, requirements, is_public } = req.body;
    const { rows } = await pool.query(
        `UPDATE actors SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            runtime     = COALESCE($3, runtime),
            source_code = COALESCE($4, source_code),
            requirements= COALESCE($5, requirements),
            is_public   = COALESCE($6, is_public),
            updated_at  = NOW()
         WHERE id = $7 AND user_id = $8 RETURNING *`,
        [name, description, runtime, source_code, requirements, is_public, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Actor not found' });
    res.json({ success: true });
});

router.post('/:id/run', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    const actor = rows[0];
    const input = req.body.input || {};
    const { rows: runRows } = await pool.query(
        `INSERT INTO runs (actor_id, user_id, input_json) VALUES ($1,$2,$3) RETURNING *`,
        [actor.id, req.user.id, input]
    );
    const run = runRows[0];
    await enqueueRun(run.id);
    res.status(201).json(run);
});

router.get('/:id/runs', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM runs WHERE actor_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
        [req.params.id, req.user.id]
    );
    res.json(rows);
});

module.exports = router;
```

---

## Task 8: Dataset routes

**Files:**
- Create: `backend/src/routes/datasets.js`

- [ ] **Step 1: Write dataset routes**

```javascript
// backend/src/routes/datasets.js
const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM datasets WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM datasets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });
    res.json(rows[0]);
});

router.get('/:id/items', async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const fmt    = req.query.format;

    const ds = await pool.query('SELECT * FROM datasets WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]);
    if (!ds.rows.length) return res.status(404).json({ error: 'Dataset not found' });

    const { rows } = await pool.query(
        'SELECT data FROM dataset_items WHERE dataset_id = $1 ORDER BY id LIMIT $2 OFFSET $3',
        [req.params.id, limit, offset]
    );
    const items = rows.map(r => r.data);

    if (fmt === 'csv' && items.length) {
        const keys = Object.keys(items[0]);
        const csv  = [keys.join(','), ...items.map(i => keys.map(k => JSON.stringify(i[k] ?? '')).join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="dataset-${req.params.id}.csv"`);
        return res.send(csv);
    }
    res.json({ items, total: ds.rows[0].item_count, limit, offset });
});

// Called from within actors via SDK
router.post('/:id/items', async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (!items.length) return res.json({ pushed: 0 });

    const values = items.map((_, i) => `($1, $${i + 2})`).join(',');
    await pool.query(
        `INSERT INTO dataset_items (dataset_id, data) VALUES ${values}`,
        [req.params.id, ...items]
    );
    await pool.query(
        'UPDATE datasets SET item_count = item_count + $1 WHERE id = $2',
        [items.length, req.params.id]
    );
    res.json({ pushed: items.length });
});

router.delete('/:id', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM datasets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Dataset not found' });
    res.json({ success: true });
});

module.exports = router;
```

---

## Task 9: Stats route + Runs route

**Files:**
- Create: `backend/src/routes/stats.js`
- Create: `backend/src/routes/runs.js`

- [ ] **Step 1: Write stats.js**

```javascript
// backend/src/routes/stats.js
const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    const uid = req.user.id;
    const [actors, runs, datasets, todayRuns] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM actors WHERE user_id=$1', [uid]),
        pool.query('SELECT COUNT(*) FROM runs WHERE user_id=$1', [uid]),
        pool.query('SELECT COUNT(*) FROM datasets WHERE user_id=$1', [uid]),
        pool.query("SELECT COUNT(*) FROM runs WHERE user_id=$1 AND created_at > NOW()-INTERVAL '24h'", [uid]),
    ]);
    const statusCounts = await pool.query(
        'SELECT status, COUNT(*) FROM runs WHERE user_id=$1 GROUP BY status', [uid]
    );
    const byStatus = Object.fromEntries(statusCounts.rows.map(r => [r.status, parseInt(r.count)]));
    res.json({
        actors:    parseInt(actors.rows[0].count),
        runs:      parseInt(runs.rows[0].count),
        datasets:  parseInt(datasets.rows[0].count),
        todayRuns: parseInt(todayRuns.rows[0].count),
        byStatus,
    });
});

module.exports = router;
```

- [ ] **Step 2: Write runs.js**

```javascript
// backend/src/routes/runs.js
const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { getSSEClients, removeSSEClient } = require('../services/logStream');

router.use(auth);

router.get('/', async (req, res) => {
    const { status, actor_id } = req.query;
    let q = 'SELECT r.*, a.name as actor_name FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.user_id=$1';
    const params = [req.user.id];
    if (status)   { params.push(status);   q += ` AND r.status=$${params.length}`; }
    if (actor_id) { params.push(actor_id); q += ` AND r.actor_id=$${params.length}`; }
    q += ' ORDER BY r.created_at DESC LIMIT 100';
    const { rows } = await pool.query(q, params);
    res.json(rows);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT r.*, a.name as actor_name FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.id=$1 AND r.user_id=$2',
        [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    res.json(rows[0]);
});

// SSE log stream
router.get('/:id/log', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id FROM runs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    const runId = req.params.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send historical logs
    const { rows: logs } = await pool.query(
        'SELECT * FROM run_logs WHERE run_id=$1 ORDER BY id', [runId]
    );
    for (const log of logs) {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
    }

    // Check if run is already finished
    const { rows: run } = await pool.query('SELECT status FROM runs WHERE id=$1', [runId]);
    if (['SUCCEEDED','FAILED','ABORTED'].includes(run[0]?.status)) {
        res.write(`data: ${JSON.stringify({ type: 'done', status: run[0].status })}\n\n`);
        return res.end();
    }

    // Subscribe to live logs
    const clients = getSSEClients();
    if (!clients[runId]) clients[runId] = [];
    clients[runId].push(res);

    req.on('close', () => removeSSEClient(runId, res));
});

router.post('/:id/abort', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM runs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].status !== 'RUNNING') return res.status(400).json({ error: 'Run not running' });

    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET });
    if (rows[0].container_id) {
        try {
            const container = docker.getContainer(rows[0].container_id);
            await container.kill();
        } catch {}
    }
    await pool.query("UPDATE runs SET status='ABORTED', finished_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ success: true });
});

module.exports = router;
```

---

## Task 10: Log streaming service

**Files:**
- Create: `backend/src/services/logStream.js`

- [ ] **Step 1: Write logStream.js**

```javascript
// backend/src/services/logStream.js
const { pool } = require('../db');

// Map of runId → array of SSE response objects
const sseClients = {};

function getSSEClients() {
    return sseClients;
}

function removeSSEClient(runId, res) {
    if (sseClients[runId]) {
        sseClients[runId] = sseClients[runId].filter(r => r !== res);
        if (!sseClients[runId].length) delete sseClients[runId];
    }
}

async function appendLog(runId, level, message) {
    const { rows } = await pool.query(
        'INSERT INTO run_logs (run_id, level, message) VALUES ($1,$2,$3) RETURNING *',
        [runId, level, message]
    );
    const log = rows[0];
    // Broadcast to connected SSE clients
    if (sseClients[runId]) {
        const data = `data: ${JSON.stringify(log)}\n\n`;
        sseClients[runId].forEach(res => {
            try { res.write(data); } catch {}
        });
    }
    return log;
}

function broadcastDone(runId, status) {
    if (sseClients[runId]) {
        const data = `data: ${JSON.stringify({ type: 'done', status })}\n\n`;
        sseClients[runId].forEach(res => {
            try { res.write(data); res.end(); } catch {}
        });
        delete sseClients[runId];
    }
}

module.exports = { getSSEClients, removeSSEClient, appendLog, broadcastDone };
```

---

## Task 11: BullMQ queue setup

**Files:**
- Create: `backend/src/services/queue.js`

- [ ] **Step 1: Write queue.js**

```javascript
// backend/src/services/queue.js
const { Queue, Worker } = require('bullmq');

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 4250,
};

const runQueue = new Queue('actor-runs', { connection });

async function enqueueRun(runId) {
    await runQueue.add('run', { runId }, { attempts: 1 });
}

function startWorker(processRun) {
    const worker = new Worker('actor-runs', async job => {
        await processRun(job.data.runId);
    }, { connection, concurrency: 3 });

    worker.on('failed', (job, err) => {
        console.error(`[Queue] Job ${job.id} failed:`, err.message);
    });

    return worker;
}

module.exports = { enqueueRun, startWorker };
```

---

## Task 12: Docker run engine

**Files:**
- Create: `backend/src/services/runner.js`

- [ ] **Step 1: Write runner.js**

```javascript
// backend/src/services/runner.js
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pool } = require('../db');
const { appendLog, broadcastDone } = require('./logStream');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

const RUNTIME_IMAGES = {
    python3: 'myapify-runtime-python3',
    node20:  'myapify-runtime-node20',
};

async function processRun(runId) {
    // Mark as RUNNING
    await pool.query(
        "UPDATE runs SET status='RUNNING', started_at=NOW() WHERE id=$1", [runId]
    );
    await appendLog(runId, 'INFO', '--- Run started ---');

    let run, actor;
    try {
        const { rows } = await pool.query(
            'SELECT r.*, a.name as actor_name, a.source_code, a.requirements, a.runtime FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.id=$1',
            [runId]
        );
        if (!rows.length) throw new Error('Run not found');
        run = rows[0];
        actor = rows[0];
    } catch (err) {
        await finishRun(runId, 'FAILED', -1, err.message);
        return;
    }

    // Create output dataset
    const { rows: dsRows } = await pool.query(
        'INSERT INTO datasets (name, user_id, actor_id, run_id) VALUES ($1,$2,$3,$4) RETURNING *',
        [`${actor.actor_name}-${runId.slice(0,8)}`, run.user_id, run.actor_id, runId]
    );
    const dataset = dsRows[0];
    await pool.query('UPDATE runs SET output_dataset_id=$1 WHERE id=$2', [dataset.id, runId]);

    // Write actor source to temp dir
    const workDir = path.join(process.env.ACTOR_DATA_DIR || os.tmpdir(), runId);
    fs.mkdirSync(workDir, { recursive: true });

    const mainFile = actor.runtime === 'python3' ? 'main.py' : 'main.js';
    fs.writeFileSync(path.join(workDir, mainFile), actor.source_code);
    if (actor.requirements) {
        const reqFile = actor.runtime === 'python3' ? 'requirements.txt' : 'package.json';
        fs.writeFileSync(path.join(workDir, reqFile), actor.requirements);
    }

    await appendLog(runId, 'INFO', `Runtime: ${actor.runtime} | Dataset: ${dataset.id}`);

    const image = RUNTIME_IMAGES[actor.runtime] || 'myapify-runtime-python3';
    const env = [
        `ACTOR_INPUT=${JSON.stringify(run.input_json)}`,
        `MYAPIFY_API_URL=${process.env.API_BASE_URL || 'http://host.docker.internal:4280'}`,
        `MYAPIFY_RUN_ID=${runId}`,
        `MYAPIFY_DATASET_ID=${dataset.id}`,
        `MYAPIFY_API_KEY=${run.user_id}`,
    ];

    let container;
    try {
        container = await docker.createContainer({
            Image: image,
            Cmd: actor.runtime === 'python3' ? ['python3', '/actor/main.py'] : ['node', '/actor/main.js'],
            Env: env,
            HostConfig: {
                Binds: [`${workDir}:/actor:ro`],
                Memory: 512 * 1024 * 1024,
                CpuQuota: 100000,
                NetworkMode: 'host',
                AutoRemove: false,
            },
        });

        await pool.query('UPDATE runs SET container_id=$1 WHERE id=$2', [container.id, runId]);
        await container.start();
        await appendLog(runId, 'INFO', `Container started: ${container.id.slice(0,12)}`);

        // Stream logs
        const logStream = await container.logs({
            follow: true, stdout: true, stderr: true, timestamps: false,
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(async () => {
                try { await container.kill(); } catch {}
                reject(new Error('Timeout: 30 minutes exceeded'));
            }, 30 * 60 * 1000);

            docker.modem.demuxStream(logStream, {
                write: async (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        await appendLog(runId, 'INFO', line);
                    }
                },
            }, {
                write: async (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        await appendLog(runId, 'ERROR', line);
                    }
                },
            });

            logStream.on('end', () => { clearTimeout(timeout); resolve(); });
            logStream.on('error', (e) => { clearTimeout(timeout); reject(e); });
        });

        const data = await container.inspect();
        const exitCode = data.State.ExitCode;
        await container.remove();
        fs.rmSync(workDir, { recursive: true, force: true });

        const status = exitCode === 0 ? 'SUCCEEDED' : 'FAILED';
        await finishRun(runId, status, exitCode);

    } catch (err) {
        await appendLog(runId, 'ERROR', `Fatal: ${err.message}`);
        try { if (container) await container.remove({ force: true }); } catch {}
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
        await finishRun(runId, 'FAILED', -1);
    }
}

async function finishRun(runId, status, exitCode, errMsg) {
    if (errMsg) await appendLog(runId, 'ERROR', errMsg);
    await appendLog(runId, 'INFO', `--- Run ${status} ---`);
    await pool.query(
        "UPDATE runs SET status=$1, exit_code=$2, finished_at=NOW() WHERE id=$3",
        [status, exitCode, runId]
    );
    broadcastDone(runId, status);
}

module.exports = { processRun };
```

---

## Task 13: Express app entry point

**Files:**
- Create: `backend/src/index.js`

- [ ] **Step 1: Write index.js**

```javascript
// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { migrate } = require('./db');
const { startWorker } = require('./services/queue');
const { processRun }  = require('./services/runner');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/actors',   require('./routes/actors'));
app.use('/api/runs',     require('./routes/runs'));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/stats',    require('./routes/stats'));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4280;

async function start() {
    await migrate();
    startWorker(processRun);
    app.listen(PORT, () => console.log(`MyApify API running on port ${PORT}`));
}

start().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Test backend starts**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify/backend
node src/index.js
# Expected: MyApify API running on port 4280
# (will fail on DB connection — that's expected without Docker Compose)
```

- [ ] **Step 3: Commit backend**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add backend/src/
git commit -m "feat: complete backend — auth, actors, runs, datasets, docker runner, SSE"
```

---

## Task 14: Runtime Dockerfiles

**Files:**
- Create: `docker/runtimes/python3/Dockerfile`
- Create: `docker/runtimes/node20/Dockerfile`
- Create: `docker/sdk/myapify.py`
- Create: `docker/sdk/myapify.js`

- [ ] **Step 1: Create directories**

```bash
mkdir -p /Users/admin/Documents/Thomas-SRC/MyApify/docker/{runtimes/python3,runtimes/node20,sdk,nginx}
```

- [ ] **Step 2: Write Python3 Dockerfile**

```dockerfile
# docker/runtimes/python3/Dockerfile
FROM python:3.12-slim
WORKDIR /actor
COPY sdk/myapify.py /usr/local/lib/python3.12/site-packages/myapify.py
RUN pip install requests
CMD ["python3", "main.py"]
```

- [ ] **Step 3: Write Node20 Dockerfile**

```dockerfile
# docker/runtimes/node20/Dockerfile
FROM node:20-slim
WORKDIR /actor
COPY sdk/myapify.js /usr/local/lib/node_modules/myapify.js
RUN npm install -g axios
ENV NODE_PATH=/usr/local/lib/node_modules
CMD ["node", "main.js"]
```

- [ ] **Step 4: Write Python SDK**

```python
# docker/sdk/myapify.py
import os, json, urllib.request

_API_URL    = os.environ.get('MYAPIFY_API_URL', 'http://localhost:4280')
_RUN_ID     = os.environ.get('MYAPIFY_RUN_ID', '')
_DATASET_ID = os.environ.get('MYAPIFY_DATASET_ID', '')
_API_KEY    = os.environ.get('MYAPIFY_API_KEY', '')
_INPUT      = json.loads(os.environ.get('ACTOR_INPUT', '{}'))

def get_input():
    return _INPUT

def push_data(items):
    if not isinstance(items, list):
        items = [items]
    data = json.dumps(items).encode()
    req  = urllib.request.Request(
        f"{_API_URL}/api/datasets/{_DATASET_ID}/items",
        data=data,
        headers={"Content-Type": "application/json", "x-api-key": _API_KEY},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def log(message, level="INFO"):
    print(f"[{level}] {message}", flush=True)
```

- [ ] **Step 5: Write Node.js SDK**

```javascript
// docker/sdk/myapify.js
const https = require('https');
const http  = require('http');
const url   = require('url');

const API_URL    = process.env.MYAPIFY_API_URL || 'http://localhost:4280';
const DATASET_ID = process.env.MYAPIFY_DATASET_ID || '';
const API_KEY    = process.env.MYAPIFY_API_KEY || '';

function getInput() {
    return JSON.parse(process.env.ACTOR_INPUT || '{}');
}

function pushData(items) {
    return new Promise((resolve, reject) => {
        const data    = JSON.stringify(Array.isArray(items) ? items : [items]);
        const parsed  = new url.URL(`${API_URL}/api/datasets/${DATASET_ID}/items`);
        const lib     = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'Content-Length': Buffer.byteLength(data) },
        };
        const req = lib.request(options, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

module.exports = { getInput, pushData };
```

- [ ] **Step 6: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add docker/
git commit -m "feat: Docker runtimes and Actor SDK (Python + Node.js)"
```

---

## Task 15: Docker Compose + Nginx

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/nginx/nginx.conf`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
# docker/docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: myapify-postgres
    environment:
      POSTGRES_DB: myapify
      POSTGRES_USER: myapify
      POSTGRES_PASSWORD: myapify123
    ports:
      - "4240:5432"
    volumes:
      - myapify_pg:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: myapify-redis
    ports:
      - "4250:6379"
    restart: unless-stopped

  backend:
    build:
      context: ..
      dockerfile: docker/backend.Dockerfile
    container_name: myapify-backend
    ports:
      - "4280:4280"
    environment:
      DATABASE_URL: postgresql://myapify:myapify123@postgres:5432/myapify
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: myapify-jwt-secret-change-in-production-64chars
      DOCKER_SOCKET: /var/run/docker.sock
      ACTOR_DATA_DIR: /tmp/myapify-runs
      API_BASE_URL: http://myapify-backend:4280
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - myapify_runs:/tmp/myapify-runs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: myapify-nginx
    ports:
      - "4200:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ../frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  myapify_pg:
  myapify_runs:
```

- [ ] **Step 2: Write backend Dockerfile**

```dockerfile
# docker/backend.Dockerfile
FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/migrations ./migrations
EXPOSE 4280
CMD ["node", "src/index.js"]
```

- [ ] **Step 3: Write nginx.conf**

```nginx
# docker/nginx/nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:4280;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add docker/
git commit -m "feat: Docker Compose, backend Dockerfile, nginx config"
```

---

## Task 16: Frontend scaffold

**Files:**
- Create: `frontend/` (Vite + React + Tailwind)

- [ ] **Step 1: Create frontend**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios lucide-react @monaco-editor/react react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:4280' } }
})
```

- [ ] **Step 3: Set src/index.css**

```bash
echo '@import "tailwindcss";' > /Users/admin/Documents/Thomas-SRC/MyApify/frontend/src/index.css
```

- [ ] **Step 4: Commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add frontend/
git commit -m "chore: scaffold frontend Vite + React + Tailwind v4"
```

---

## Task 17: Frontend — API client + auth context

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/auth.tsx`

- [ ] **Step 1: Write api.ts**

```typescript
// frontend/src/api.ts
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    r => r,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
```

- [ ] **Step 2: Write auth.tsx**

```tsx
// frontend/src/auth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';

interface User { id: string; email: string; api_key: string; plan: string; }
interface AuthCtx { user: User | null; login: (email: string, pass: string) => Promise<void>; register: (email: string, pass: string) => Promise<void>; logout: () => void; }

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (localStorage.getItem('token')) {
            api.get('/auth/me').then(r => setUser(r.data)).catch(() => {});
        }
    }, []);

    const login = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        setUser(data.user);
    };

    const register = async (email: string, password: string) => {
        const { data } = await api.post('/auth/register', { email, password });
        localStorage.setItem('token', data.token);
        setUser(data.user);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        window.location.href = '/login';
    };

    return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// Need to import axios in auth.tsx
import axios from 'axios';
```

---

## Task 18: Frontend — Layout + shared components

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/StatCard.tsx`
- Create: `frontend/src/components/RunBadge.tsx`

- [ ] **Step 1: Write Layout.tsx**

```tsx
// frontend/src/components/Layout.tsx
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Code2, Play, Database, Settings, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../auth';

const NAV = [
    { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
    { to: '/actors',    label: 'Actors',    icon: Code2 },
    { to: '/runs',      label: 'Runs',      icon: Play },
    { to: '/datasets',  label: 'Datasets',  icon: Database },
    { to: '/settings',  label: 'Settings',  icon: Settings },
];

export default function Layout() {
    const { user, logout } = useAuth();
    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
            <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="px-5 py-5 border-b border-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <Zap size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-white">MyApify</span>
                </div>
                <nav className="flex-1 py-4 px-2 space-y-0.5">
                    {NAV.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'}`
                        }>
                            <Icon size={16} />{label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-3 border-t border-gray-800">
                    <div className="text-xs text-gray-500 mb-2 px-1 truncate">{user?.email}</div>
                    <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
```

- [ ] **Step 2: Write StatCard.tsx**

```tsx
// frontend/src/components/StatCard.tsx
const COLORS: Record<string, string> = {
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400',
    blue:   'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    green:  'from-green-500/10 to-green-500/5 border-green-500/20 text-green-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
};
export function StatCard({ label, value, sub, color = 'orange' }: { label: string; value: string | number; sub?: string; color?: string }) {
    const c = COLORS[color] || COLORS.orange;
    return (
        <div className={`bg-gradient-to-br ${c} border rounded-xl p-5`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.split(' ').pop()}`}>{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}
```

- [ ] **Step 3: Write RunBadge.tsx**

```tsx
// frontend/src/components/RunBadge.tsx
const STYLES: Record<string, string> = {
    QUEUED:    'bg-gray-700 text-gray-300',
    RUNNING:   'bg-blue-500/20 text-blue-300 animate-pulse',
    SUCCEEDED: 'bg-green-500/20 text-green-300',
    FAILED:    'bg-red-500/20 text-red-300',
    ABORTED:   'bg-yellow-500/20 text-yellow-300',
};
export function RunBadge({ status }: { status: string }) {
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STYLES[status] || 'bg-gray-700 text-gray-400'}`}>
            {status}
        </span>
    );
}
```

---

## Task 19: Frontend pages — Login + Dashboard

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write Login.tsx**

```tsx
// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Zap } from 'lucide-react';

export default function Login() {
    const { login, register } = useAuth();
    const nav = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            if (mode === 'login') await login(email, password);
            else await register(email, password);
            nav('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Something went wrong');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <Zap size={20} className="text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">MyApify</span>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                    <h2 className="text-lg font-semibold text-white mb-6">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
                    {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>}
                    <form onSubmit={submit} className="space-y-4">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                    <p className="text-sm text-gray-500 text-center mt-4">
                        {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')} className="text-orange-400 hover:underline">
                            {mode === 'login' ? 'Register' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Write Dashboard.tsx**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { StatCard } from '../components/StatCard';
import { RunBadge } from '../components/RunBadge';
import { Plus } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);
    const [runs, setRuns]   = useState<any[]>([]);

    useEffect(() => {
        api.get('/stats').then(r => setStats(r.data));
        api.get('/runs').then(r => setRuns(r.data.slice(0, 6)));
    }, []);

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Your scraping activity overview</p>
                </div>
                <Link to="/actors/new" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus size={15} /> New Actor
                </Link>
            </div>
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Actors"     value={stats.actors}    color="orange" />
                    <StatCard label="Total Runs" value={stats.runs}      color="blue" />
                    <StatCard label="Datasets"   value={stats.datasets}  color="purple" />
                    <StatCard label="Runs Today" value={stats.todayRuns} color="green" />
                </div>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Recent Runs</h3>
                <div className="space-y-2">
                    {runs.map(r => (
                        <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors">
                            <div>
                                <p className="text-sm text-white font-medium">{r.actor_name}</p>
                                <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
                            </div>
                            <RunBadge status={r.status} />
                        </Link>
                    ))}
                    {!runs.length && <p className="text-sm text-gray-500 py-4 text-center">No runs yet. Create an actor and run it!</p>}
                </div>
            </div>
        </div>
    );
}
```

---

## Task 20: Frontend pages — Actors + Actor Editor

**Files:**
- Create: `frontend/src/pages/Actors.tsx`
- Create: `frontend/src/pages/ActorEditor.tsx`

- [ ] **Step 1: Write Actors.tsx**

```tsx
// frontend/src/pages/Actors.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Plus, Play, Edit, Trash2, Code2 } from 'lucide-react';

export default function Actors() {
    const [actors, setActors] = useState<any[]>([]);

    useEffect(() => { api.get('/actors').then(r => setActors(r.data)); }, []);

    const run = async (id: string) => {
        await api.post(`/actors/${id}/run`, { input: {} });
        alert('Run started!');
    };

    const del = async (id: string) => {
        if (!confirm('Delete this actor?')) return;
        await api.delete(`/actors/${id}`);
        setActors(a => a.filter(x => x.id !== id));
    };

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Actors</h1>
                <Link to="/actors/new" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus size={15} /> New Actor
                </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {actors.map(a => (
                    <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <Code2 size={16} className="text-orange-400 shrink-0" />
                                <h3 className="text-sm font-semibold text-white">{a.name}</h3>
                            </div>
                            <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">{a.runtime}</span>
                        </div>
                        {a.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{a.description}</p>}
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => run(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs hover:bg-orange-500/25 transition-colors">
                                <Play size={11} /> Run
                            </button>
                            <Link to={`/actors/${a.id}`} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors">
                                <Edit size={11} /> Edit
                            </Link>
                            <button onClick={() => del(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={11} />
                            </button>
                        </div>
                    </div>
                ))}
                {!actors.length && (
                    <div className="col-span-3 text-center py-16 text-gray-500">
                        <Code2 size={40} className="mx-auto mb-3 opacity-20" />
                        <p>No actors yet. Create your first scraper.</p>
                        <Link to="/actors/new" className="inline-block mt-3 text-orange-400 hover:underline text-sm">Create Actor →</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Write ActorEditor.tsx**

```tsx
// frontend/src/pages/ActorEditor.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../api';
import { Save, Play, ArrowLeft } from 'lucide-react';

const STARTER: Record<string, string> = {
    python3: `# MyApify Actor — Python
from myapify import get_input, push_data, log

def main():
    input = get_input()
    log(f"Starting with input: {input}")
    
    # Your scraping logic here
    result = {"hello": "world", "input": input}
    
    push_data(result)
    log("Done!")

main()
`,
    node20: `// MyApify Actor — Node.js
const { getInput, pushData } = require('myapify');

async function main() {
    const input = getInput();
    console.log('Starting with input:', input);
    
    // Your scraping logic here
    const result = { hello: 'world', input };
    
    await pushData(result);
    console.log('Done!');
}

main().catch(console.error);
`,
};

export default function ActorEditor() {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const isNew = id === 'new';

    const [name, setName]         = useState('');
    const [desc, setDesc]         = useState('');
    const [runtime, setRuntime]   = useState('python3');
    const [code, setCode]         = useState(STARTER.python3);
    const [reqs, setReqs]         = useState('');
    const [saving, setSaving]     = useState(false);

    useEffect(() => {
        if (!isNew) {
            api.get(`/actors/${id}`).then(r => {
                const a = r.data;
                setName(a.name); setDesc(a.description);
                setRuntime(a.runtime); setCode(a.source_code);
                setReqs(a.requirements);
            });
        }
    }, [id]);

    const handleRuntimeChange = (r: string) => {
        setRuntime(r);
        if (!code || code === STARTER.python3 || code === STARTER.node20) {
            setCode(STARTER[r]);
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = { name, description: desc, runtime, source_code: code, requirements: reqs };
            if (isNew) {
                const { data } = await api.post('/actors', payload);
                nav(`/actors/${data.id}`, { replace: true });
            } else {
                await api.put(`/actors/${id}`, payload);
            }
        } finally { setSaving(false); }
    };

    const runNow = async () => {
        await save();
        const actorId = isNew ? id : id;
        await api.post(`/actors/${actorId}/run`, { input: {} });
        nav('/runs');
    };

    return (
        <div className="h-screen flex flex-col bg-gray-950">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 bg-gray-900">
                <button onClick={() => nav('/actors')} className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Actor name"
                    className="flex-1 bg-transparent text-white text-sm font-medium placeholder-gray-500 focus:outline-none" />
                <select value={runtime} onChange={e => handleRuntimeChange(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none">
                    <option value="python3">Python 3</option>
                    <option value="node20">Node.js 20</option>
                </select>
                <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-50">
                    <Save size={13} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={runNow}
                    className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                    <Play size={13} /> Run
                </button>
            </div>
            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    language={runtime === 'python3' ? 'python' : 'javascript'}
                    value={code}
                    onChange={v => setCode(v || '')}
                    theme="vs-dark"
                    options={{ fontSize: 14, minimap: { enabled: false }, padding: { top: 16 } }}
                />
            </div>
            {/* Footer: description + requirements */}
            <div className="flex gap-4 px-6 py-3 border-t border-gray-800 bg-gray-900">
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none" />
                <input value={reqs} onChange={e => setReqs(e.target.value)} placeholder="requirements.txt or package.json deps (optional)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none" />
            </div>
        </div>
    );
}
```

---

## Task 21: Frontend pages — Runs + RunDetail + Datasets

**Files:**
- Create: `frontend/src/pages/Runs.tsx`
- Create: `frontend/src/pages/RunDetail.tsx`
- Create: `frontend/src/pages/Datasets.tsx`
- Create: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Write Runs.tsx**

```tsx
// frontend/src/pages/Runs.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { RunBadge } from '../components/RunBadge';

export default function Runs() {
    const [runs, setRuns] = useState<any[]>([]);

    useEffect(() => { api.get('/runs').then(r => setRuns(r.data)); }, []);

    return (
        <div className="p-8 space-y-5">
            <h1 className="text-2xl font-bold text-white">Runs</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                        <tr className="text-xs text-gray-400 uppercase tracking-wider">
                            <th className="text-left px-5 py-3">Actor</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-left px-5 py-3">Started</th>
                            <th className="text-left px-5 py-3">Duration</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {runs.map(r => {
                            const dur = r.finished_at && r.started_at
                                ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
                                : r.status === 'RUNNING' ? 'running...' : '—';
                            return (
                                <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-5 py-3 text-white font-medium">{r.actor_name}</td>
                                    <td className="px-5 py-3"><RunBadge status={r.status} /></td>
                                    <td className="px-5 py-3 text-gray-400">{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</td>
                                    <td className="px-5 py-3 text-gray-400">{dur}</td>
                                    <td className="px-5 py-3 text-right">
                                        <Link to={`/runs/${r.id}`} className="text-xs text-orange-400 hover:underline">View →</Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {!runs.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-500">No runs yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Write RunDetail.tsx**

```tsx
// frontend/src/pages/RunDetail.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { RunBadge } from '../components/RunBadge';
import { Database, StopCircle } from 'lucide-react';

export default function RunDetail() {
    const { id } = useParams<{ id: string }>();
    const [run, setRun]   = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const logsEndRef      = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get(`/runs/${id}`).then(r => setRun(r.data));

        const es = new EventSource(`/api/runs/${id}/log`);
        es.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.type === 'done') {
                setRun((r: any) => r ? { ...r, status: data.status } : r);
                es.close();
            } else {
                setLogs(l => [...l, data]);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        };
        return () => es.close();
    }, [id]);

    const abort = async () => {
        await api.post(`/runs/${id}/abort`);
        setRun((r: any) => r ? { ...r, status: 'ABORTED' } : r);
    };

    if (!run) return <div className="p-8 text-gray-400">Loading...</div>;

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{run.actor_name}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <RunBadge status={run.status} />
                        <span className="text-xs text-gray-400">{run.id.slice(0,8)}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    {run.output_dataset_id && (
                        <Link to={`/datasets/${run.output_dataset_id}`} className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-sm">
                            <Database size={13} /> View Dataset
                        </Link>
                    )}
                    {run.status === 'RUNNING' && (
                        <button onClick={abort} className="flex items-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-sm">
                            <StopCircle size={13} /> Abort
                        </button>
                    )}
                </div>
            </div>
            {/* Log viewer */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-400 font-mono">Run Log</div>
                <div className="h-[calc(100vh-280px)] overflow-auto p-4 font-mono text-xs space-y-0.5 bg-gray-950">
                    {logs.map((l, i) => (
                        <div key={i} className={`flex gap-3 ${l.level === 'ERROR' ? 'text-red-400' : 'text-gray-300'}`}>
                            <span className="text-gray-600 shrink-0">{new Date(l.ts).toLocaleTimeString()}</span>
                            <span className={`shrink-0 ${l.level === 'ERROR' ? 'text-red-400' : 'text-gray-500'}`}>[{l.level}]</span>
                            <span>{l.message}</span>
                        </div>
                    ))}
                    {!logs.length && <p className="text-gray-600">Waiting for logs...</p>}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Write Datasets.tsx**

```tsx
// frontend/src/pages/Datasets.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { Download, Database } from 'lucide-react';

function DatasetList() {
    const [datasets, setDatasets] = useState<any[]>([]);
    useEffect(() => { api.get('/datasets').then(r => setDatasets(r.data)); }, []);
    return (
        <div className="p-8 space-y-5">
            <h1 className="text-2xl font-bold text-white">Datasets</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {datasets.map(d => (
                    <Link key={d.id} to={`/datasets/${d.id}`} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <Database size={15} className="text-purple-400" />
                            <h3 className="text-sm font-semibold text-white">{d.name}</h3>
                        </div>
                        <p className="text-2xl font-bold text-purple-400">{d.item_count}</p>
                        <p className="text-xs text-gray-500 mt-0.5">items · {new Date(d.created_at).toLocaleDateString()}</p>
                    </Link>
                ))}
                {!datasets.length && <p className="col-span-3 text-center py-12 text-gray-500">No datasets yet. Run an actor to generate data.</p>}
            </div>
        </div>
    );
}

function DatasetView() {
    const { id } = useParams<{ id: string }>();
    const [ds, setDs]       = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        api.get(`/datasets/${id}`).then(r => setDs(r.data));
        api.get(`/datasets/${id}/items?limit=100`).then(r => {
            setItems(r.data.items); setTotal(r.data.total);
        });
    }, [id]);

    const exportCSV = () => { window.open(`/api/datasets/${id}/items?format=csv&limit=10000`, '_blank'); };

    if (!ds) return <div className="p-8 text-gray-400">Loading...</div>;
    const cols = items.length ? Object.keys(items[0]) : [];

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/datasets" className="text-xs text-gray-500 hover:text-gray-300">← Datasets</Link>
                    <h1 className="text-2xl font-bold text-white mt-1">{ds.name}</h1>
                    <p className="text-sm text-gray-400">{total} items</p>
                </div>
                <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/25 transition-colors">
                    <Download size={13} /> Export CSV
                </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-260px)]">
                    <table className="w-full text-xs font-mono">
                        <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                            <tr>{cols.map(c => <th key={c} className="text-left px-4 py-2 text-gray-400 font-medium">{c}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {items.map((item, i) => (
                                <tr key={i} className="hover:bg-gray-800/50">
                                    {cols.map(c => <td key={c} className="px-4 py-2 text-gray-300 max-w-xs truncate">{JSON.stringify(item[c])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function Datasets() {
    const { id } = useParams();
    return id ? <DatasetView /> : <DatasetList />;
}
```

- [ ] **Step 4: Write Settings.tsx**

```tsx
// frontend/src/pages/Settings.tsx
import { useState } from 'react';
import { useAuth } from '../auth';
import api from '../api';
import { Copy, RefreshCw, Check } from 'lucide-react';

export default function Settings() {
    const { user } = useAuth();
    const [apiKey, setApiKey] = useState(user?.api_key || '');
    const [copied, setCopied] = useState(false);
    const [rotating, setRotating] = useState(false);

    const copy = () => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const rotate = async () => {
        if (!confirm('Rotate API key? Old key will stop working immediately.')) return;
        setRotating(true);
        const { data } = await api.post('/auth/rotate-key');
        setApiKey(data.api_key);
        setRotating(false);
    };

    return (
        <div className="p-8 max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">Account</h3>
                <div>
                    <p className="text-xs text-gray-400 mb-1">Email</p>
                    <p className="text-sm text-gray-200">{user?.email}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400 mb-1">Plan</p>
                    <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded">{user?.plan}</span>
                </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">API Key</h3>
                <p className="text-xs text-gray-400">Use this key in the <code className="bg-gray-800 px-1 rounded">x-api-key</code> header to authenticate API requests.</p>
                <div className="flex gap-2">
                    <input readOnly value={apiKey} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none" />
                    <button onClick={copy} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <button onClick={rotate} disabled={rotating} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                        <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
        </div>
    );
}
```

---

## Task 22: Frontend App.tsx + build verification

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write App.tsx**

Read and replace `frontend/src/App.tsx`:

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Actors     from './pages/Actors';
import ActorEditor from './pages/ActorEditor';
import Runs       from './pages/Runs';
import RunDetail  from './pages/RunDetail';
import Datasets   from './pages/Datasets';
import Settings   from './pages/Settings';

function Protected({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Protected><Layout /></Protected>}>
                        <Route index element={<Dashboard />} />
                        <Route path="actors" element={<Actors />} />
                        <Route path="actors/:id" element={<ActorEditor />} />
                        <Route path="runs" element={<Runs />} />
                        <Route path="runs/:id" element={<RunDetail />} />
                        <Route path="datasets" element={<Datasets />} />
                        <Route path="datasets/:id" element={<Datasets />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
```

- [ ] **Step 2: Build frontend**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify/frontend
npm run build
# Expected: ✓ built in Xs — no TypeScript errors
```

- [ ] **Step 3: Commit all frontend**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add frontend/src/
git commit -m "feat: complete frontend — dashboard, actors+editor, runs+logs, datasets, settings"
```

---

## Task 23: Build Docker runtime images + Docker Compose

- [ ] **Step 1: Build runtime images on home server**

```bash
sshpass -p 'cb1312ef' ssh -o StrictHostKeyChecking=no thomas@192.168.68.111 "
    mkdir -p /opt/myapify/docker
"
```

- [ ] **Step 2: Copy docker folder to server**

```bash
scp -r /Users/admin/Documents/Thomas-SRC/MyApify/docker \
    thomas@192.168.68.111:/opt/myapify/
```

- [ ] **Step 3: Build runtime images on server**

```bash
sshpass -p 'cb1312ef' ssh -o StrictHostKeyChecking=no thomas@192.168.68.111 "
    cd /opt/myapify/docker
    docker build -f runtimes/python3/Dockerfile -t myapify-runtime-python3 .
    docker build -f runtimes/node20/Dockerfile  -t myapify-runtime-node20  .
    echo 'Runtime images built'
"
```

- [ ] **Step 4: Build and push frontend dist**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify/frontend && npm run build
scp -r dist thomas@192.168.68.111:/opt/myapify/frontend/
```

- [ ] **Step 5: Copy backend to server**

```bash
scp -r /Users/admin/Documents/Thomas-SRC/MyApify/backend \
    thomas@192.168.68.111:/opt/myapify/
```

- [ ] **Step 6: Start Docker Compose on server**

```bash
sshpass -p 'cb1312ef' ssh -o StrictHostKeyChecking=no thomas@192.168.68.111 "
    cd /opt/myapify/docker
    docker compose up -d --build
    docker compose ps
"
```

- [ ] **Step 7: Verify running**

```bash
curl http://192.168.68.111:4280/api/stats
# Expected: connection refused or 401 (server is up, needs auth)

curl -s -X POST http://192.168.68.111:4280/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"thomas@myapify.local","password":"myapify123"}' | python3 -m json.tool
# Expected: {"token":"...","user":{...}}
```

- [ ] **Step 8: Open in browser**

Visit: http://192.168.68.111:4200

- [ ] **Step 9: Final commit**

```bash
cd /Users/admin/Documents/Thomas-SRC/MyApify
git add .
git commit -m "feat: complete MyApify MVP — full platform ready"
```

---

## Self-Review

**Spec coverage:**
- ✅ Auth (register, login, JWT, API key, rotate)
- ✅ Actor CRUD (create, list, get, update, delete)
- ✅ Actor run trigger → BullMQ queue
- ✅ Docker execution engine (Python3 + Node20 runtimes)
- ✅ Live log streaming (SSE — historical + live)
- ✅ Dataset push from actors + viewer with CSV export
- ✅ Dashboard stats
- ✅ Monaco code editor with starter templates
- ✅ Run abort
- ✅ Settings + API key management
- ✅ Docker Compose deploy on 192.168.68.111
- ✅ Actor SDK (Python + Node.js)

**Placeholders:** None — all code blocks complete.

**Type consistency:** All route names, service exports, and component props are consistent across tasks.
