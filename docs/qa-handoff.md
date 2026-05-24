# QA Handoff — Communiqué

Everything QA needs to exercise and validate the whole platform — backend API and
dashboard — from this document alone.

**Build status:** Typecheck ✅ · Lint ✅ · Unit ✅ (27) · Integration ✅ (8, Testcontainers) · E2E/Contract ✅ (4) · Production build ✅
**Backend base URL:** `http://localhost:4000` · API prefix `/api/v1`
**Dashboard URL:** `http://localhost:5173`
**Auth header:** `Authorization: Bearer <workspace key>`

---

## 0. Environment setup

```bash
pnpm install
docker compose up -d                      # Postgres :5433, Redis :6380, Mailpit :8025
cp .env.example apps/backend/.env
# set PROVIDER_ENCRYPTION_KEY to: openssl rand -base64 32
pnpm migrate
pnpm dev:backend                          # terminal 1
pnpm dev:dashboard                        # terminal 2
```

> Note the non-default host ports (5433/6380) — chosen to avoid clashing with a
> local Postgres/Redis. The app speaks to them via `apps/backend/.env`.

### Seed a workspace + key (used by every API test below)

```bash
curl -s -X POST http://localhost:4000/api/v1/workspaces \
  -H 'Content-Type: application/json' -d '{"name":"QA Workspace"}'
# copy data.credential.key → export KEY=cmq_…
```

There are **no human/seed user accounts** — auth is entirely workspace API keys.
Create a second workspace the same way to test isolation.

---

## 1. Endpoint inventory

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/health`, `/health/ready` | ❌ | liveness / readiness |
| POST | `/workspaces` | ❌ | bootstrap; returns one-time key |
| GET | `/workspaces/:id` | ❌ | |
| GET/POST | `/workspace/credentials` | ✅ | list / issue |
| POST | `/workspace/credentials/:id/rotate` | ✅ | |
| DELETE | `/workspace/credentials/:id` | ✅ | revoke |
| GET/POST | `/subscribers` | ✅ | list+search / register |
| GET/PATCH/DELETE | `/subscribers/:id` | ✅ | get / update / soft-delete |
| POST | `/subscribers/:id/channels` | ✅ | add channel |
| DELETE | `/subscribers/:id/channels/:channelId` | ✅ | |
| POST | `/subscribers/:id/optouts` | ✅ | set/clear opt-out |
| GET | `/subscribers/:id/history` | ✅ | notification log for subscriber |
| GET/POST | `/audiences` | ✅ | |
| GET/PATCH/DELETE | `/audiences/:id` | ✅ | |
| GET/POST | `/audiences/:id/members` | ✅ | |
| DELETE | `/audiences/:id/members/:subscriberId` | ✅ | |
| GET/POST | `/templates` | ✅ | |
| GET | `/templates/:id` | ✅ | with versions |
| GET/POST | `/templates/:id/versions` | ✅ | list / publish |
| GET | `/templates/:id/versions/:version` | ✅ | |
| POST | `/templates/:id/preview` | ✅ | live render |
| GET/POST | `/providers` | ✅ | |
| GET/PATCH/DELETE | `/providers/:id` | ✅ | |
| GET/POST | `/routing-rules` | ✅ | |
| GET/PATCH/DELETE | `/routing-rules/:id` | ✅ | |
| POST | `/events` | ✅ | **202**; idempotent |
| GET | `/events/:id` | ✅ | status |
| GET | `/notification-log` | ✅ | filters |
| GET | `/dead-letters`, `/dead-letters/:id` | ✅ | |
| POST | `/dead-letters/:id/replay` | ✅ | **202** |
| GET | `/metrics` | ✅ | live aggregates |
| POST | `/test-dispatch` | ✅ | synchronous send |

---

## 2. The error contract — validate first

Every failure is a **flat** object: `{ errorCode, errorMessage, type, field? }`.
There is **no nested `error` object**.

**Must validate:**

- [ ] `errorCode` is numeric `1001`–`1009`, never an HTTP status or string.
- [ ] `type` is the matching category string (e.g. `validation_error`).
- [ ] Validation errors (`1001`) include `field` and surface **one field at a time**.
- [ ] Fixing the reported field and resubmitting surfaces the *next* invalid field.

```bash
# both external_id and a channel are wrong; only the FIRST field is reported
curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{}'
# → { "errorCode":1001, "errorMessage":"External id is required.", "type":"validation_error", "field":"external_id" }
```

| Scenario | Expected |
| -------- | -------- |
| Missing required field | `400` `1001`, `field` set, single field |
| No / bad / revoked API key | `401` `1002` |
| Resource in another workspace | `404` `1004` (not 403, no leakage) |
| Duplicate (slug, template name, audience name, provider priority) | `409` `1005` |
| Missing template variables at dispatch | dead-letter `validation` (not an HTTP error) |
| Rate limit exceeded | `429` `1007` + `Retry-After` header |

---

## 3. Core flows to test & validate (backend)

### 3.1 Subscriber dedup (the headline guarantee)

- [ ] Register `external_id: "user-1"` twice with different attributes.
- [ ] **Validate:** `GET /subscribers` returns **one** record; attributes are
      merged (`{a} + {b}`), not duplicated. The second call returns the same `id`.

### 3.2 Soft delete

- [ ] `DELETE /subscribers/:id` → `204`.
- [ ] **Validate:** the subscriber no longer appears in `GET /subscribers`, but
      its prior notification history still resolves (row preserved, `is_deleted=true`).

### 3.3 Per-channel opt-out respected at dispatch

- [ ] Opt a subscriber out of `email`.
- [ ] Dispatch an email event to them.
- [ ] **Validate:** notification log shows `status: skipped`, `error_code: opted_out`.
      The upstream publisher did **not** have to check — Communiqué skipped it.

### 3.4 Template version immutability

- [ ] Publish version 1, then version 2 of a template.
- [ ] **Validate:** both versions exist; `latest_version` is 2; there is **no**
      API to edit a published version. (DB enforces this with a trigger — an
      `UPDATE`/`DELETE` on `template_versions` raises `append-only`.)

### 3.5 Live template preview + required-var validation

- [ ] Publish a version with body `Hi {{name}}` (required var `name`).
- [ ] `POST /templates/:id/preview` with `{ "name": "Ada" }` → `body_text: "Hi Ada"`, `missing_vars: []`.
- [ ] Preview with `{}` → `missing_vars: ["name"]`.

### 3.6 Full dispatch happy path (console provider)

Set up: console email provider → template (event `user.welcome`) → subscriber
with email → audience containing them → routing rule.

- [ ] `POST /events { event_type:"user.welcome", audience_id, payload:{name} }` → **202** `{ status:"received", accepted:true }`.
- [ ] Within ~1–2s, `GET /notification-log` shows one `success` attempt with `provider_key: "console"`.
- [ ] `GET /events/:id` → `status: "dispatched"`.
- [ ] `GET /metrics` → `events_received` and `dispatch_success` incremented; `dispatch_success_rate` reflects it.
- [ ] The backend log shows a `console provider dispatch` line with the rendered body.

### 3.7 Idempotent ingestion

- [ ] `POST /events` twice with the same `Idempotency-Key`.
- [ ] **Validate:** both responses carry the **same** `evt_…` id, and only **one**
      dispatch/notification-log entry results.

### 3.8 Dead-letter on missing variable (never silent)

- [ ] Publish `user.welcome` with `payload: {}` (omit required `name`).
- [ ] **Validate:** `GET /dead-letters` shows an entry with `reason: "validation"`,
      `last_error` mentioning the missing var, `replayable: true`. The event is
      **not** silently dropped, and no `success` attempt is logged.

### 3.9 Dead-letter replay

- [ ] `POST /dead-letters/:id/replay` → **202** `{ requeued: true }`.
- [ ] **Validate:** the event is re-processed through the full pipeline (fix the
      data first — e.g. if it was a missing var with a different root cause — or it
      will dead-letter again, which is also correct behaviour).

### 3.10 Provider fallback (priority order)

- [ ] Configure two email providers: priority 1 = one that transient-fails, priority 2 = `console`.
- [ ] Dispatch; **validate** the log shows a `transport_failure` for provider 1
      followed by a `success` for provider 2.
- [ ] Contrast: a **hard** failure (e.g. invalid recipient / 4xx) does **not** fall
      back — it stops and records `hard_failure`. (Covered by unit + integration tests.)

### 3.11 No route / no provider

- [ ] Publish an event whose `event_type` has no enabled routing rule → dead-letter `reason: "no_route"`.
- [ ] Route exists but no enabled provider for the channel → dead-letter `no_route`, `last_error` names the channel.

### 3.12 Test dispatch (synchronous)

- [ ] `POST /test-dispatch { subscriber_external_id, template_id, variables }` → `200` `{ status:"sent", provider_key }`.
- [ ] Opt the subscriber out, repeat → `{ status:"skipped_optout" }`.
- [ ] Omit a required variable → `422` `1006` (missing vars).

### 3.13 Workspace isolation

- [ ] Create workspace B with its own key.
- [ ] Using B's key, `GET /subscribers/:id` for a subscriber created in A → `404` `1004`.
- [ ] `GET /subscribers` with B's key returns 0 of A's subscribers.

### 3.14 Credential lifecycle

- [ ] Issue a second credential → returns a one-time `key`.
- [ ] Rotate it → old key now returns `401`, new key works.
- [ ] Revoke a credential → its key returns `401`.

### 3.15 Pagination

- [ ] Create > 20 subscribers; `GET /subscribers?limit=20`.
- [ ] **Validate:** `meta.has_more: true`, `meta.next_cursor` present; passing it as
      `?cursor=` returns the next page; the last page has `has_more:false`,
      `next_cursor:null`. No duplicates or skips across pages.

### 3.16 Reliability / ops

- [ ] `GET /health` → `200 { status:"ok" }`.
- [ ] Stop Redis; `GET /health/ready` → `503` with `checks.redis:"down"`. Restart → `200`.
- [ ] Send SIGTERM to the backend mid-dispatch → process drains in-flight jobs
      before exiting (graceful shutdown).

---

## 4. State machines

**Event status:** `received → processing → dispatched`
(or `→ dead` on validation/no-route, `→ failed` on retry exhaustion).

**Dispatch status:** `pending → sent` | `failed` | `skipped_optout` | `dead`.

**Attempt status (notification log):** `success` | `transport_failure` |
`hard_failure` | `skipped`.

**Dead-letter reasons:** `validation` | `no_route` | `exhausted`.

---

## 5. Dashboard — screen-by-screen

**Gate:** every screen except `/connect` requires a connected workspace. Without a
key, you're redirected to `/connect`.

General checks for **every** list screen: loading spinner while fetching, an
inline error (`role="alert"`) on API failure, and a labelled empty state when
there's no data. Errors come from the backend `errorMessage`, never hardcoded.

### `/connect`
- [ ] "New workspace" tab: enter a name → creates workspace, shows the one-time key, "continue" enters the app.
- [ ] "Use API key" tab: paste a key → connects and routes to Overview.
- [ ] Invalid key entry shows an inline error.

### `/` (Overview / Metrics)
- [ ] Eight metric cards render (received, processed, success, failure, success rate %, retries, dead letters, queue depth).
- [ ] "By channel" and "By status" breakdowns render. Auto-refreshes (~10s).

### `/subscribers`
- [ ] List renders; search box filters by external id.
- [ ] "Add subscriber" form: external id (+ optional email) → registers; new row appears.
- [ ] Validation error from the backend shows inline on the right field.
- [ ] Row click → detail.

### `/subscribers/:id`
- [ ] Channels and opt-out toggles render. Toggling an opt-out persists (re-fetch confirms).
- [ ] Notification history lists attempts with status badges.
- [ ] "Delete" removes the subscriber and returns to the list.

### `/audiences` and `/audiences/:id`
- [ ] Create audience; member count shows. Detail screen: add a member by subscriber id; list updates. Adding a missing subscriber shows an inline error.

### `/templates` and `/templates/:id`
- [ ] Create a template (name, event type, channel). Detail: publish a version
      (subject/body for email; body only for SMS).
- [ ] **Live preview**: enter variables JSON → rendered subject/body appears;
      missing required vars are flagged.
- [ ] Versions list shows each immutable version with its required vars.

### `/providers`
- [ ] Add a `console` provider (config `{}`) — no credentials needed.
- [ ] Add a `resend`/`twilio` provider — config JSON; on save the list shows the
      config **masked** (last 4 chars only).
- [ ] Enable/disable toggles; delete works. Invalid config shows an inline error.

### `/routing-rules`
- [ ] Create a rule selecting event type, channel, template (dropdown), audience
      (dropdown or "Direct target"). Channel/template mismatch shows an inline error.
- [ ] Enable/disable and delete work.

### `/notification-log`
- [ ] Entries render with status badges, provider, attempt number, error detail.
- [ ] Channel and status filters narrow the list.

### `/dead-letters`
- [ ] Entries show reason badge and last error. "Inspect" expands the payload JSON.
- [ ] "Replay" re-enqueues (button reflects loading; replayed entries are tagged).
- [ ] Empty state ("No dead letters") shows when clean.

### `/test-dispatch`
- [ ] Pick subscriber external id + template, enter variables JSON, "Send test".
- [ ] Result panel shows status badge (sent/failed/skipped), provider, detail.

---

## 6. End-to-end acceptance (the deliverables)

A reviewer should be able to, in one sitting:

1. [ ] Register a subscriber from "upstream" (API) and see it stored exactly once on retry.
2. [ ] Publish an event and watch it routed → templated → dispatched via a provider, recorded in the log.
3. [ ] Dispatch an email via a configured provider and see the outcome.
4. [ ] Dispatch an SMS via a configured provider and see the outcome (console or Twilio).
5. [ ] See a primary provider fail over to a secondary automatically.
6. [ ] Replay a failed event from the dead-letter queue through the full pipeline.
7. [ ] Use the dashboard (as a non-engineer) to configure a template, inspect delivery, and replay a failure.
8. [ ] Run a second backend node against the same Postgres/Redis with no code change (outbox `SKIP LOCKED` + BullMQ prevent double-dispatch).
9. [ ] Install fresh: clone, fill `.env`, `docker compose up`, `pnpm migrate`, `pnpm dev:*`.

---

## 7. Out of scope (intentionally not built)

- [ ] Additional channels beyond email/SMS (push, webhook, Slack) — the channel
      interface supports them; adapters are future work.
- [ ] Human/admin user accounts + sessions — auth is workspace API keys only.
- [ ] Scheduled / recurring sends — events are dispatched on publish.
- [ ] Per-attempt webhook callbacks to upstream — status is via polling/log today.
