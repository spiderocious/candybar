import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  // ── shared: auto-update updated_at ───────────────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION touch_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  `);

  const touch = (table: string) =>
    pgm.sql(`
      CREATE TRIGGER ${table}_touch_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    `);

  // ── workspaces ───────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE workspaces (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  touch('workspaces');

  // ── api_credentials ──────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE api_credentials (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      key_hash      TEXT NOT NULL UNIQUE,
      prefix        TEXT NOT NULL,
      last_used_at  TIMESTAMPTZ,
      revoked_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_api_credentials_ws ON api_credentials (workspace_id) WHERE revoked_at IS NULL;
  `);

  // ── subscribers ───────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE subscribers (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      external_id  TEXT NOT NULL,
      attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, external_id)
    );
    CREATE INDEX idx_subscribers_ws_active ON subscribers (workspace_id, created_at DESC)
      WHERE is_deleted = FALSE;
  `);
  touch('subscribers');

  pgm.sql(`
    CREATE TABLE subscriber_channels (
      id            TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      channel       TEXT NOT NULL,
      address       TEXT NOT NULL,
      verified      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (subscriber_id, channel)
    );
  `);

  pgm.sql(`
    CREATE TABLE channel_optouts (
      subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      channel       TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (subscriber_id, channel)
    );
  `);

  // ── audiences ────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE audiences (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      description  TEXT,
      is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, name)
    );
  `);
  touch('audiences');

  pgm.sql(`
    CREATE TABLE audience_members (
      audience_id   TEXT NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
      subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (audience_id, subscriber_id)
    );
    CREATE INDEX idx_audience_members_sub ON audience_members (subscriber_id);
  `);

  // ── templates ────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE templates (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      channel       TEXT NOT NULL,
      latest_version INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, name)
    );
    CREATE INDEX idx_templates_ws_event ON templates (workspace_id, event_type, channel);
  `);
  touch('templates');

  pgm.sql(`
    CREATE TABLE template_versions (
      id            TEXT PRIMARY KEY,
      template_id   TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      version       INTEGER NOT NULL,
      subject       TEXT,
      body_text     TEXT NOT NULL,
      body_html     TEXT,
      required_vars JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (template_id, version)
    );
  `);

  // template_versions are immutable once written: reject UPDATE and DELETE.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_version_immutability()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'template_versions is append-only: % not allowed', TG_OP;
    END;
    $$;
    CREATE TRIGGER template_versions_immutable
      BEFORE UPDATE OR DELETE ON template_versions
      FOR EACH ROW EXECUTE FUNCTION enforce_version_immutability();
  `);

  // ── providers ────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE providers (
      id               TEXT PRIMARY KEY,
      workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      channel          TEXT NOT NULL,
      provider_key     TEXT NOT NULL,
      priority         INTEGER NOT NULL,
      enabled          BOOLEAN NOT NULL DEFAULT TRUE,
      config_encrypted TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, channel, priority)
    );
    CREATE INDEX idx_providers_ws_channel ON providers (workspace_id, channel, priority)
      WHERE enabled = TRUE;
  `);
  touch('providers');

  // ── routing_rules ────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE routing_rules (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      event_type   TEXT NOT NULL,
      channel      TEXT NOT NULL,
      audience_id  TEXT REFERENCES audiences(id) ON DELETE SET NULL,
      template_id  TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      enabled      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_routing_rules_ws_event ON routing_rules (workspace_id, event_type)
      WHERE enabled = TRUE;
  `);
  touch('routing_rules');

  // ── events ───────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE events (
      id              TEXT PRIMARY KEY,
      workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      event_type      TEXT NOT NULL,
      payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
      target_kind     TEXT NOT NULL,
      target_ref      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'received',
      idempotency_key TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX idx_events_idempotency ON events (workspace_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    CREATE INDEX idx_events_ws_created ON events (workspace_id, created_at DESC);
  `);
  touch('events');

  // ── outbox (transactional) ───────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE outbox (
      id          TEXT PRIMARY KEY,
      event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      enqueued_at TIMESTAMPTZ,
      attempts    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_outbox_pending ON outbox (created_at) WHERE enqueued_at IS NULL;
  `);

  // ── dispatches ───────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE dispatches (
      id                  TEXT PRIMARY KEY,
      workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      event_id            TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      subscriber_id       TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      channel             TEXT NOT NULL,
      template_version_id TEXT REFERENCES template_versions(id) ON DELETE SET NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      attempts            INTEGER NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (event_id, subscriber_id, channel)
    );
    CREATE INDEX idx_dispatches_ws ON dispatches (workspace_id, created_at DESC);
  `);
  touch('dispatches');

  // ── dispatch_attempts (the notification log) ─────────────────────────────────
  pgm.sql(`
    CREATE TABLE dispatch_attempts (
      id            TEXT PRIMARY KEY,
      dispatch_id   TEXT NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      event_type    TEXT NOT NULL,
      channel       TEXT NOT NULL,
      provider_key  TEXT,
      attempt_no    INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL,
      error_code    TEXT,
      error_detail  TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_attempts_ws_created ON dispatch_attempts (workspace_id, created_at DESC);
    CREATE INDEX idx_attempts_filter
      ON dispatch_attempts (workspace_id, channel, status, event_type, created_at DESC);
    CREATE INDEX idx_attempts_sub ON dispatch_attempts (subscriber_id, created_at DESC);
  `);

  // ── dead_letters ─────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE dead_letters (
      id               TEXT PRIMARY KEY,
      workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      event_type       TEXT NOT NULL,
      reason           TEXT NOT NULL,
      last_error       TEXT,
      payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      replayable       BOOLEAN NOT NULL DEFAULT TRUE,
      replayed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_dead_letters_ws ON dead_letters (workspace_id, created_at DESC);
  `);

  // ── idempotency_keys (HTTP layer durability) ─────────────────────────────────
  pgm.sql(`
    CREATE TABLE idempotency_keys (
      key             TEXT NOT NULL,
      workspace_id    TEXT NOT NULL,
      route           TEXT NOT NULL,
      request_hash    TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body   JSONB NOT NULL,
      expires_at      TIMESTAMPTZ NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, route, key)
    );
    CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    DROP TABLE IF EXISTS idempotency_keys, dead_letters, dispatch_attempts, dispatches,
      outbox, events, routing_rules, providers, template_versions, templates,
      audience_members, audiences, channel_optouts, subscriber_channels, subscribers,
      api_credentials, workspaces CASCADE;
    DROP FUNCTION IF EXISTS enforce_version_immutability CASCADE;
    DROP FUNCTION IF EXISTS touch_updated_at CASCADE;
  `);
};
