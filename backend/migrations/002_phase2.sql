-- Phase 2: KV stores, webhooks, templates

CREATE TABLE IF NOT EXISTS kv_stores (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS kv_records (
    id           BIGSERIAL PRIMARY KEY,
    store_id     UUID NOT NULL REFERENCES kv_stores(id) ON DELETE CASCADE,
    key          TEXT NOT NULL,
    value        TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT 'application/json',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, key)
);

-- Add webhook_url to actors
ALTER TABLE actors ADD COLUMN IF NOT EXISTS webhook_url TEXT NOT NULL DEFAULT '';

-- Add webhook_url to schedules
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS webhook_url TEXT NOT NULL DEFAULT '';

-- Templates (public actor library)
CREATE TABLE IF NOT EXISTS templates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'General',
    runtime     TEXT NOT NULL DEFAULT 'python3',
    source_code TEXT NOT NULL DEFAULT '',
    requirements TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '🤖',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kv_records_store ON kv_records(store_id);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled, next_run);
