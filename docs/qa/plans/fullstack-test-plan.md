# Fullstack Test Plan — Communiqué

**Prepared:** 2026-05-24
**Tester role:** QA Engineer — Full Stack
**Spec:** `dockito/projects/candybar/features.md` (Deliverables) · `plan.md`
**Both services up:** backend `:4000`, dashboard `:5173`, docker `:5433/:6380/:8025`
**Tools:** `curl` + `psql` + `redis-cli` (backend) **and** `agent-browser` (frontend)
**Screenshots →** `docs/qa/screenshots/`

This is a **small, deliberate set of spot checks** (6 cases) that exercise the
backend and dashboard **simultaneously** to catch what neither side's plan catches
alone: **contract drift at the seam**. The expensive bugs live here — a backend
field rename the frontend still compiles against, a pagination shape mismatch, a
masked-secret leak, an event that 202s but never surfaces in the UI.

The anti-drift seam: dashboard types come from `@communique/core` Zod schemas, the
same schemas the backend contract-tests against. These checks confirm that seam
holds **at runtime**, end to end.

---

## Pre-flight

```bash
curl -s http://localhost:4000/health | jq .
curl -s http://localhost:5173 | head -3

# One workspace, used by BOTH the API calls and the dashboard
B=http://localhost:4000
WS=$(curl -s -X POST $B/api/v1/workspaces -H 'Content-Type: application/json' -d '{"name":"FS QA"}')
export KEY=$(echo "$WS" | jq -r '.data.credential.key')
export PG="postgres://communique:communique@localhost:5433/communique"

# Connect the dashboard with the SAME key
agent-browser close --all
agent-browser open http://localhost:5173/connect
agent-browser wait --load networkidle
agent-browser find role button click --name "Use API key"
agent-browser find label "Workspace API key" fill "$KEY"
agent-browser find role button click --name "Connect"
agent-browser wait 1000
```

---

## The 6 spot checks

### FS-01 — Subscriber created via API appears verbatim in the UI (read seam)

**Layer:** Contract / E2E · **Why:** the most common silent bug is a field rename
(`external_id` → `externalId`) that compiles on the frontend but renders blank.

1. **API** — register a subscriber:
   ```bash
   curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY" \
     -H 'Content-Type: application/json' \
     -d '{"external_id":"fs-user-1","attributes":{"name":"Ada"},"channels":[{"channel":"email","address":"ada@x.com"}]}' | jq '{id:.data.id, ext:.data.external_id}'
   ```
2. **DB** — confirm one row: `psql "$PG" -c "SELECT external_id FROM subscribers WHERE external_id='fs-user-1';"`
3. **UI** — navigate dashboard:
   ```bash
   agent-browser navigate http://localhost:5173/subscribers
   agent-browser wait --text "Subscribers"
   agent-browser eval "document.body.innerText" | grep "fs-user-1"
   ```
4. **UI detail** — click into it; confirm channel `email` + address `ada@x.com` render.

**Expected:** the exact `external_id` and channel created via API render in the UI.
**Drift caught:** any field-name mismatch between backend response and FE type
appears as a blank/undefined cell.

---

### FS-02 — Dedup guarantee holds across API write + UI read (write seam)

**Layer:** Integration / E2E · **Why:** the headline guarantee, verified from both ends.

1. **API** — register `fs-user-1` **again** with different attributes:
   ```bash
   curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY" \
     -H 'Content-Type: application/json' -d '{"external_id":"fs-user-1","attributes":{"plan":"pro"}}' | jq '.data.id'
   ```
2. **DB** — `psql "$PG" -c "SELECT count(*) FROM subscribers WHERE external_id='fs-user-1' AND is_deleted=false;"` → **1**
3. **UI** — reload `/subscribers`; confirm **exactly one** `fs-user-1` row (no duplicate).
4. **UI detail** — confirm attributes merged (both `name` and `plan` present).

**Expected:** one record, merged attributes, same id — across the boundary.

---

### FS-03 — Full dispatch: publish (API) → watch it land in UI log + metrics (end-to-end pipeline)

**Layer:** E2E · **Why:** the core deliverable — event routed → templated →
dispatched → recorded — confirmed from both the API and the dashboard.

**Setup (API):** console email provider + template `user.welcome` (`Hi {{name}}`,
v1) + `fs-user-1` in an audience + a routing rule (`user.welcome → email → audience → template`).

1. **API** — publish:
   ```bash
   EVT=$(curl -s -X POST $B/api/v1/events -H "Authorization: Bearer $KEY" \
     -H 'Content-Type: application/json' \
     -d '{"event_type":"user.welcome","audience_id":"'"$AUD"'","payload":{"name":"Ada"}}' | jq -r '.data.id')
   ```
   → **202** `{ status:"received", accepted:true }`
2. **API** — after ~2s, `GET /events/$EVT` → `status:"dispatched"`; `GET /notification-log?status=success` → one `console` success.
3. **UI** — `/notification-log`: the attempt renders (event_type `user.welcome`,
   channel `email`, provider `console`, success badge).
   ```bash
   agent-browser navigate http://localhost:5173/notification-log
   agent-browser wait --text "Notification log"
   agent-browser eval "document.body.innerText" | grep -E "user.welcome|console"
   ```
4. **UI** — `/metrics`: "Events received" and "Dispatch success" reflect the run
   (compare before/after).

**Expected:** the same dispatch is visible and consistent in the API, the DB, and
the dashboard. **Drift caught:** notification-log shape mismatch (the FE table
silently dropping a column), or metrics field rename (`dispatch_success` vs `success`).

---

### FS-04 — Dead-letter + replay round-trip (API ↔ UI ↔ pipeline)

**Layer:** E2E · **Why:** failed-event handling must never be silent, and the UI
replay must drive the real pipeline.

1. **API** — publish `user.welcome` with `payload:{}` (missing `name`):
   ```bash
   curl -s -X POST $B/api/v1/events -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
     -d '{"event_type":"user.welcome","audience_id":"'"$AUD"'","payload":{}}' >/dev/null
   ```
2. **API** — `GET /dead-letters` → entry `reason:"validation"`, `replayable:true`.
3. **UI** — `/dead-letters`: entry visible with validation badge; "Inspect" shows
   the empty `payload_snapshot`.
4. **UI** — click "Replay":
   ```bash
   agent-browser find role button click --name "Replay"
   agent-browser wait --load networkidle
   agent-browser eval "document.body.innerText" | grep -i "replayed"
   ```
5. **API/DB** — confirm `replayed_at` stamped and the event was requeued
   (`psql "$PG" -c "SELECT status FROM events WHERE id IN (SELECT event_id FROM dead_letters ORDER BY created_at DESC LIMIT 1);"`).

**Expected:** the failure surfaces (never dropped), and the UI replay re-runs the
real pipeline (re-dead-letters since the var is still missing — also correct).

---

### FS-05 — Provider secret is masked end to end (security seam)

**Layer:** Contract / Security · **Why:** a leaked credential is the worst seam bug —
verify the secret never crosses to the client in plaintext, from DB to UI.

1. **UI or API** — add a resend provider with a real-looking secret:
   ```bash
   curl -s -X POST $B/api/v1/providers -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
     -d '{"channel":"email","provider_key":"resend","config":{"api_key":"re_SECRET_abcd1234","from_email":"a@b.com"}}' >/dev/null
   ```
2. **DB** — `psql "$PG" -c "SELECT config_encrypted FROM workspace_providers ORDER BY created_at DESC LIMIT 1;"`
   → encrypted bytes, **not** `re_SECRET_abcd1234`.
3. **API** — `GET /providers` → `config_masked` shows last-4 only (`********1234`),
   no full key.
4. **UI** — `/providers`: the row shows the masked value; **grep the page source /
   network for the plaintext secret — it must NOT appear**:
   ```bash
   agent-browser navigate http://localhost:5173/providers
   agent-browser wait --text "Providers"
   agent-browser eval "document.documentElement.outerHTML" | grep -c "re_SECRET_abcd1234"   # expect 0
   ```

**Expected:** `0` occurrences of the plaintext secret in DB, API response, and DOM.

---

### FS-06 — Workspace isolation holds across the auth seam (multi-tenancy)

**Layer:** Integration / E2E · **Why:** a key for workspace B must have zero
visibility into A — verified through the actual auth path the dashboard uses.

1. **API** — create workspace B, capture `KEY_B`:
   ```bash
   KEY_B=$(curl -s -X POST $B/api/v1/workspaces -H 'Content-Type: application/json' -d '{"name":"FS QA B"}' | jq -r '.data.credential.key')
   ```
2. **API** — with `KEY_B`, fetch A's subscriber: `GET /subscribers/<fs-user-1 id>`
   → **`404` `1004`** (not 403, no leak).
3. **API** — `GET /subscribers` with `KEY_B` → **0** of A's subscribers.
4. **UI** — "Disconnect", reconnect with `KEY_B`, open `/subscribers`:
   ```bash
   agent-browser find role button click --name "Disconnect"
   agent-browser wait --url "**/connect"
   agent-browser find role button click --name "Use API key"
   agent-browser find label "Workspace API key" fill "$KEY_B"
   agent-browser find role button click --name "Connect"
   agent-browser navigate http://localhost:5173/subscribers
   agent-browser wait --text "Subscribers"
   agent-browser eval "document.body.innerText" | grep -c "fs-user-1"   # expect 0
   ```

**Expected:** B's session — both API and dashboard — sees none of A's data;
cross-workspace fetch is `404`.

---

## Summary of seam coverage

| # | Seam tested | Direction | Drift it catches |
|---|-------------|-----------|------------------|
| FS-01 | Subscriber shape | API write → UI read | field rename, blank cells |
| FS-02 | Dedup guarantee | API write → DB → UI read | duplicate records, merge loss |
| FS-03 | Dispatch + log + metrics | API → pipeline → UI | log/metrics shape mismatch |
| FS-04 | Dead-letter + replay | API ↔ UI ↔ pipeline | silent drop, replay not wired |
| FS-05 | Secret masking | DB → API → DOM | credential leak to client |
| FS-06 | Workspace isolation | auth seam (API + UI) | cross-tenant data leak |

---

## Out of scope (covered elsewhere or not built)

- Exhaustive endpoint matrix → `backend-test-plan.md`.
- Exhaustive screen-state matrix (loading/empty/error per screen) → `frontend-test-plan.md`.
- Load / concurrency (concurrent dedup, idempotency under contention) — flagged as
  a risk in the backend plan; not run here.
- Multi-node double-dispatch prevention — backend OPS-02; not part of these spot checks.
- Real Resend/Twilio delivery — console provider only.

## Risks

- These 6 checks confirm the seam at **representative** points, not exhaustively. A
  rename on an untested field (e.g. a metrics breakdown key) could still slip
  through — the contract tests in `packages/core` are the backstop.
- FS-03 timing depends on the outbox relay (~1–2s); if the log is empty, wait and
  re-read before failing.
