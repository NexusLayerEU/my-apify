# MyApify — Project Memory

## What This Is
Self-hosted Apify clone. Web scraping automation platform. Multi-user product.
Spec: `docs/superpowers/specs/2026-06-06-myapify-design.md`

## Stack
- Backend: Node.js 20 + Express 5
- Frontend: React 18 + Vite + Tailwind v4
- DB: PostgreSQL 16 (port 4240)
- Queue: Redis 7 + BullMQ (port 4250)
- Actor execution: Docker via dockerode
- Log streaming: SSE
- Auth: JWT + API keys

## Ports (on 192.168.68.111)
- 4200: Frontend
- 4280: Backend API
- 4240: PostgreSQL
- 4250: Redis

## Architectural Decisions
- Actors run in isolated Docker containers (1 CPU, 512MB, 30min timeout)
- Input via ACTOR_INPUT env var, output via HTTP push to /api/datasets/:id/items
- Logs: container stdout tailed via dockerode → run_logs table + SSE stream
- Phase 1 = MVP (no schedules, no KV store) — ship working core first
