# Backend Test Plan — Communiqué

**Prepared:** 2026-05-24
**Tester role:** QA Engineer — Backend Systems
**Spec:** `dockito/projects/candybar/features.md` · `plan.md`
**Source of truth:** `apps/backend/src`, `packages/core`, `docs/api-docs.md`
**Base URL:** `http://localhost:4000` · prefix `/api/v1`
**Auth:** `Authorization: Bearer <workspace key>` (no human accounts — API keys only)
**Reports →** `docs/qa/reports/backend-report.md`

This plan is independent of the developer's self-handoff. It tests the API by
hitting it with curl, inspecting the database with `psql`, and inspecting Redis
with `redis-cli`. Every case asserts an **exact** status, error code, and shape —
no `< 500` assertions.

---

## 0. Environment & pre-flight

```bash
pnpm install
docker compose up -d                      # Postgres :5433, Redis :6380, Mailpit :8025
cp .env.example apps/backend/.env
# Replace PROVIDER_ENCRYPTION_KEY with a real value:
#   openssl rand -base64 32
pnpm migrate
pnpm dev:backend                          # serves :4000
```

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgres://communique:communique@localhost:5433/communique` |
| `REDIS_URL` | `redis://localhost:6380` |
| `PROVIDER_ENCRYPTION_KEY` | 32-byte base64 (the only env secret) |
| `RATE_LIMIT_CAPACITY` | 120 (default) |
| `RATE_LIMIT_REFILL_PER_SEC` | 2 (default) |
| `DISPATCH_MAX_ATTEMPTS` | 5 (default) |

**Direct DB / Redis access:**

```bash
export PG="postgres://communique:communique@localhost:5433/communique"
export RD="redis://localhost:6380"
psql "$PG" -c '\dt'
redis-cli -u "$RD" PING
```

**Pre-flight checks:**

```bash
curl -s http://localhost:4000/health | jq .          # { data: { status: "ok" } }
curl -s http://localhost:4000/health/ready | jq .     # { data: { status: "ready", checks: {...} } }
```

**Bootstrap test workspaces (no auth needed):**

```bash
B=http://localhost:4000

# Workspace A
A_JSON=$(curl -s -X POST $B/api/v1/workspaces -H 'Content-Type: application/json' \
  -d '{"name":"QA Workspace A"}')
export KEY_A=$(echo "$A_JSON" | jq -r '.data.credential.key')
export WS_A=$(echo "$A_JSON" | jq -r '.data.workspace.id')

# Workspace B (for isolation tests)
B_JSON=$(curl -s -X POST $B/api/v1/workspaces -H 'Content-Type: application/json' \
  -d '{"name":"QA Workspace B"}')
export KEY_B=$(echo "$B_JSON" | jq -r '.data.credential.key')

echo "KEY_A=$KEY_A  WS_A=$WS_A  KEY_B=$KEY_B"
```

There is **no seed user**. State is created via the API per test.

---

## Mode 1 — Code-flow audit (run before execution)

Run these source audits and file each finding in the report's "Source Audit"
table before executing any HTTP cases. Findings here are free to fix.

| # | Command | Expectation |
|---|---------|-------------|
| SA-01 | `grep -rn "throw new Error" apps/backend/src/features --include="*.service.ts" \| grep -v AppError` | Services return `ServiceResult`, not raw throws |
| SA-02 | `grep -rn "router\.\(get\|post\|put\|patch\|delete\)(.*async" apps/backend/src/features --include="*.routes.ts" \| grep -v asyncHandler` | Every async handler wrapped in `asyncHandler` |
| SA-03 | `grep -rn "res\.json\|res\.send(" apps/backend/src/features --include="*.ts" \| grep -v ResponseUtil` | All responses go through `ResponseUtil` |
| SA-04 | `grep -rn ": any\|as any" apps/backend/src --include="*.ts" \| grep -v test` | No `any` |
| SA-05 | `grep -rn "console\.log" apps/backend/src --include="*.ts" \| grep -v test\|logger` | No stray `console.log` |
| SA-06 | Read `apps/backend/src/app.ts` middleware order | helmet → cors → json → requestId → httpLogger → features → notFound → errorHandler (last) |
| SA-07 | `grep -rn "req\.body\|req\.query\|req\.params" apps/backend/src/features --include="*.service.ts"` | Services read `requestContext`, never `req` |
| SA-08 | Confirm every protected feature route uses `apiKeyAuth` + `rateLimiter` | Only `/health*`, `POST /workspaces`, `GET /workspaces/:id` are public |
| SA-09 | Read `dispatch.service.ts` | opt-out → `skipped`; missing var → `dead_letter(validation)`; hard failure → no fallback |
| SA-10 | `grep -rn "workspace_id" apps/backend/src/features --include="*.repository.ts" \| head` | Every query scoped by `workspace_id` from context, never body |

---

## 1. Error contract — validate first (cross-cutting)

The error envelope is **flat**: `{ errorCode, errorMessage, type, field? }`. There
is **no** nested `error` object. Codes are numeric `1001`–`1009`.

| ID | Test | Request | Expected |
|----|------|---------|----------|
| EC-01 | Missing required field reports ONE field | `POST /subscribers` body `{}` with `KEY_A` | `400`, `{ errorCode:1001, type:"validation_error", field:"external_id" }` |
| EC-02 | Fixing field surfaces the next | `POST /providers` body `{ "channel":"email" }` | `400` `1001`, `field` = next offender (e.g. `provider_key`) |
| EC-03 | No API key | `GET /subscribers` (no header) | `401`, `{ errorCode:1002, type:"auth_error" }` |
| EC-04 | Bad API key | `GET /subscribers -H "Authorization: Bearer cmq_garbage"` | `401` `1002` |
| EC-05 | Revoked key | revoke then reuse (see CR-03) | `401` `1002` |
| EC-06 | Cross-workspace resource | `GET /subscribers/<A's sub>` with `KEY_B` | `404`, `{ errorCode:1004 }` — **not 403, no leakage** |
| EC-07 | Duplicate name | create audience `"Dup"` twice | `409`, `{ errorCode:1005, type:"conflict_error" }` |
| EC-08 | `errorCode` is numeric, never HTTP status string | any error | numeric `1001`–`1009`; `type` matches table in `api-docs.md` |
| EC-09 | `type` ↔ `errorCode` consistency | sample one of each code | matches `ERROR_CODE_HTTP_STATUS` mapping |

```bash
# EC-01
curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A" \
  -H 'Content-Type: application/json' -d '{}' | jq .
# expect: { "errorCode":1001, "errorMessage":"...", "type":"validation_error", "field":"external_id" }

# EC-06 (after creating a subscriber in A — see S-01)
curl -s -o /dev/null -w "%{http_code}\n" -X GET $B/api/v1/subscribers/$SUB_A \
  -H "Authorization: Bearer $KEY_B"   # expect: 404
```

---

## 2. Health & readiness

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| H-01 | Liveness | `GET /health` | `200`, `{ data: { status:"ok" } }` |
| H-02 | Readiness OK | `GET /health/ready` | `200`, `checks.postgres:"ok"`, `checks.redis:"ok"` |
| H-03 | Readiness degraded | stop Redis (`docker compose stop redis`), `GET /health/ready` | `503`, `{ data:{ status:"degraded", checks:{ redis:"down" } } }` |
| H-04 | Recovery | restart Redis, `GET /health/ready` | `200` `ready` again |

---

## 3. Workspaces & credentials

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| W-01 | Create workspace | `POST /workspaces {name:"Acme"}` | `201`, `data.workspace.id` `ws_…`, `data.credential.key` `cmq_…` present once |
| W-02 | Slug auto-derived | `POST /workspaces {name:"My Company"}` | `201`, `slug:"my-company"` |
| W-03 | Duplicate slug | `POST /workspaces {name:"X",slug:"acme"}` twice | second → `409` `1005` |
| W-04 | Invalid name (<2 chars) | `POST /workspaces {name:"A"}` | `400` `1001`, `field:"name"` |
| W-05 | Get workspace | `GET /workspaces/$WS_A` (no auth) | `200`, workspace object |
| W-06 | Get missing workspace | `GET /workspaces/ws_nope` | `404` `1004` |
| CR-01 | List credentials | `GET /workspace/credentials` (KEY_A) | `200`, array; **no `key_hash`, no plaintext `key`** in items |
| CR-02 | Issue credential | `POST /workspace/credentials {name:"CI"}` | `201`, includes one-time `key` |
| CR-03 | Revoke credential | issue → `DELETE /workspace/credentials/:id` → reuse old key | `204`; reused key → `401` `1002` |
| CR-04 | Rotate credential | `POST /workspace/credentials/:id/rotate` | `201` new key; **old key → `401`, new key works** |
| CR-05 | Rotate missing | `POST /workspace/credentials/cred_nope/rotate` | `404` `1004` |
| CR-06 | Revoke missing/already-revoked | `DELETE` twice | second → `404` `1004` |

**Cross-cutting check:** credential responses never include `key_hash`.

```bash
psql "$PG" -c "SELECT id, prefix, revoked_at FROM api_credentials WHERE workspace_id='$WS_A';"
```

---

## 4. Subscribers

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| S-01 | Register | `POST /subscribers {external_id:"user-1",channels:[{channel:"email",address:"a@x.com"}]}` | `201`, `id` `sub_…`, `channels[0].channel:"email"`, `optouts:[]`, `audiences:[]` |
| **S-02** | **Dedup (headline)** | register `user-1` again with `attributes:{plan:"pro"}` | **same `id`**; `GET /subscribers` shows **ONE** row; attributes merged `{...a, plan:"pro"}` |
| S-03 | List | `GET /subscribers` | `200` list envelope with `meta.has_more`, `meta.next_cursor` |
| S-04 | Search | `GET /subscribers?search=user-1` | returns only matching external_id |
| S-05 | Get one | `GET /subscribers/$SUB_A` | full subscriber with channels/optouts/audiences |
| S-06 | Get missing | `GET /subscribers/sub_nope` | `404` `1004` |
| S-07 | Update (merge attrs) | `PATCH /subscribers/:id {attributes:{tier:"gold"}}` | `200`; prior attrs retained + merged |
| **S-08** | **Soft-delete** | `DELETE /subscribers/:id` | `204`; **absent from `GET /subscribers`**; DB row `is_deleted=true`, `deleted_at` set |
| S-09 | History preserved after delete | `GET /subscribers/:id/history` after S-08 (if had history) | still resolves prior attempts |
| S-10 | Add channel | `POST /subscribers/:id/channels {channel:"sms",address:"+15551234567"}` | `201` channel object `chn_…` |
| S-11 | Add channel — bad subscriber | `POST /subscribers/sub_nope/channels {...}` | `404` `1004` |
| S-12 | Remove channel | `DELETE /subscribers/:id/channels/:channelId` | `204` |
| S-13 | Remove missing channel | `DELETE .../channels/chn_nope` | `404` `1004` |
| S-14 | Set opt-out | `POST /subscribers/:id/optouts {channel:"email",opted_out:true}` | `200`; `optouts` now includes `email` |
| S-15 | Clear opt-out | `POST .../optouts {channel:"email",opted_out:false}` | `200`; `email` no longer in `optouts` |
| S-16 | Empty body validation | `POST /subscribers {}` | `400` `1001` `field:"external_id"` |
| S-17 | external_id too long (>255) | register with 256-char id | `400` `1001` |

```bash
# S-02 — dedup proof
curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A" -H 'Content-Type: application/json' \
  -d '{"external_id":"user-1","attributes":{"name":"Ada"}}' | jq '.data.id' # capture R1
curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A" -H 'Content-Type: application/json' \
  -d '{"external_id":"user-1","attributes":{"plan":"pro"}}' | jq '.data.id'  # must equal R1
psql "$PG" -c "SELECT count(*) FROM subscribers WHERE workspace_id='$WS_A' AND external_id='user-1' AND is_deleted=false;"
# expect: 1
psql "$PG" -c "SELECT attributes FROM subscribers WHERE external_id='user-1';"  # expect both name + plan
```

---

## 5. Audiences

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| A-01 | Create | `POST /audiences {name:"Active"}` | `201`, `aud_…`, `member_count:0` |
| A-02 | Duplicate name | create `"Active"` again | `409` `1005` |
| A-03 | Invalid name | `POST /audiences {name:"A"}` | `400` `1001` `field:"name"` |
| A-04 | List | `GET /audiences` | `200`, items have `member_count` |
| A-05 | Get | `GET /audiences/:id` | `200` |
| A-06 | Get missing | `GET /audiences/aud_nope` | `404` `1004` |
| A-07 | Update | `PATCH /audiences/:id {description:"vip"}` | `200` |
| A-08 | Soft-delete | `DELETE /audiences/:id` | `204`; absent from list |
| A-09 | Add member | `POST /audiences/:id/members {subscriber_id:"$SUB_A"}` | `200`; `member_count` incremented |
| A-10 | Add missing subscriber | `POST .../members {subscriber_id:"sub_nope"}` | `404` `1004` |
| A-11 | Add member to missing audience | `POST /audiences/aud_nope/members {...}` | `404` `1004` |
| A-12 | List members | `GET /audiences/:id/members` | `200`, items `{subscriber_id, external_id, joined_at}` |
| A-13 | Remove member | `DELETE /audiences/:id/members/:subscriberId` | `204` |
| A-14 | Remove non-member | `DELETE .../members/sub_notmember` | `404` `1004` |

---

## 6. Templates & versioning

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| T-01 | Create template | `POST /templates {name:"Welcome",event_type:"user.welcome",channel:"email"}` | `201`, `latest_version:0` |
| T-02 | Duplicate name | create `"Welcome"` again | `409` `1005` |
| T-03 | Invalid channel | `POST /templates {...,channel:"push"}` | `400` `1001` `field:"channel"` |
| T-04 | Publish version 1 | `POST /templates/:id/versions {subject:"Hi {{name}}",body_text:"Hello {{name}}"}` | `201`, `version:1`, `required_vars:["name"]` (auto-detected) |
| T-05 | Publish version 2 | publish again with new body | `201`, `version:2`; template `latest_version:2` |
| **T-06** | **Immutability — no edit API** | confirm there is no PATCH/PUT/DELETE on `/templates/:id/versions/:version` | route does not exist |
| **T-07** | **Immutability — DB trigger** | `psql … UPDATE template_versions SET subject='x' WHERE …` | raises error `append-only` |
| T-08 | Get template w/ versions | `GET /templates/:id` | `200`, `versions[]` array present |
| T-09 | List versions | `GET /templates/:id/versions` | `200`, newest first |
| T-10 | Get specific version | `GET /templates/:id/versions/1` | `200`, that version |
| T-11 | Bad version number | `GET /templates/:id/versions/0` and `/abc` | `400` `1001` (not a positive int) |
| T-12 | Version not found | `GET /templates/:id/versions/99` | `404` `1004` |
| **T-13** | **Preview — happy** | `POST /templates/:id/preview {variables:{name:"Ada"}}` | `200`, `body_text:"Hello Ada"`, `missing_vars:[]` |
| **T-14** | **Preview — missing var** | `POST /templates/:id/preview {variables:{}}` | `200`, `missing_vars:["name"]` |
| T-15 | Preview specific version | `POST .../preview {variables:{name:"Ada"},version:1}` | renders v1 |
| T-16 | Preview no published version | new template, no versions → preview | `422` `1006` |

```bash
# T-07 — immutability trigger
psql "$PG" -c "UPDATE template_versions SET subject='hacked' WHERE template_id='$TPL';"
# expect: ERROR ... append-only
```

---

## 7. Providers (encryption + masking)

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| P-01 | Add console provider | `POST /providers {channel:"email",provider_key:"console",config:{}}` | `201`, `priority` auto-assigned |
| P-02 | Add resend provider | `POST /providers {channel:"email",provider_key:"resend",config:{api_key:"re_x",from_email:"a@b.com"}}` | `201` |
| **P-03** | **Config masked on read** | `GET /providers` | `config_masked` shows last-4 only (e.g. `"********xyz"`); **no plaintext** |
| **P-04** | **Encrypted at rest** | `psql … SELECT config_encrypted FROM workspace_providers` | BYTEA/encrypted, not readable plaintext |
| P-05 | Provider invalid for channel | `POST /providers {channel:"sms",provider_key:"resend",config:{}}` | `400` `1001` `field:"provider_key"` |
| P-06 | Invalid config shape | `POST /providers {channel:"email",provider_key:"resend",config:{api_key:"x"}}` (no from_email) | `400` `1001` `field:"config"` |
| P-07 | Priority clash | two email providers, same `priority:1` | second → `409` `1005` |
| P-08 | Update priority | `PATCH /providers/:id {priority:5}` | `200` |
| P-09 | Update to taken priority | set to an existing priority | `409` `1005` |
| P-10 | Enable/disable | `PATCH /providers/:id {enabled:false}` | `200`, `enabled:false` |
| P-11 | Delete | `DELETE /providers/:id` | `204` |
| P-12 | Twilio provider (sms) | `POST /providers {channel:"sms",provider_key:"twilio",config:{account_sid,auth_token,from_number}}` | `201` |

---

## 8. Routing rules

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| R-01 | Create rule (audience) | `POST /routing-rules {event_type:"user.welcome",channel:"email",template_id:$TPL,audience_id:$AUD}` | `201`, `enabled:true` |
| R-02 | Create rule (direct) | same but omit `audience_id` | `201`, `audience_id:null` |
| R-03 | Channel/template mismatch | rule `channel:"sms"` with an email template | `400` `1001` `field:"channel"` |
| R-04 | Template not found | `template_id:"tpl_nope"` | `400` `1001` `field:"template_id"` |
| R-05 | Audience not found | `audience_id:"aud_nope"` | `400` `1001` `field:"audience_id"` |
| R-06 | List | `GET /routing-rules` | `200` array |
| R-07 | Update enabled | `PATCH /routing-rules/:id {enabled:false}` | `200` |
| R-08 | Delete | `DELETE /routing-rules/:id` | `204` |
| R-09 | Get missing | `GET /routing-rules/rule_nope` | `404` `1004` |

---

## 9. Event ingestion (async, idempotent, at-least-once)

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| **E-01** | **Publish (audience)** | `POST /events {event_type:"user.welcome",audience_id:$AUD,payload:{name:"Ada"}}` | **`202`**, `{ id:"evt_…", status:"received", accepted:true }` |
| E-02 | Publish (direct target) | `POST /events {event_type:"user.welcome",subscriber_external_id:"user-1",payload:{name:"Ada"}}` | `202` |
| E-03 | Neither target | `POST /events {event_type:"x",payload:{}}` | `400` `1001` ("exactly one of audience_id or subscriber_external_id") |
| E-04 | Both targets | supply both `audience_id` and `subscriber_external_id` | `400` `1001` |
| E-05 | Missing event_type | `POST /events {audience_id:$AUD}` | `400` `1001` `field:"event_type"` |
| **E-06** | **Idempotent ingestion** | `POST /events` twice with same `Idempotency-Key` | both `202`, **same `evt_…` id**; only ONE event row, ONE outbox row |
| E-07 | Get event status | `GET /events/:id` | `200`, status transitions `received→processing→dispatched` |
| E-08 | Get missing event | `GET /events/evt_nope` | `404` `1004` |
| E-09 | Outbox written in same tx | after E-01, `psql` check | one `events` row + one `outbox` row, same `event_id` |

```bash
# E-06 — idempotency
KEY=$(uuidgen)
BODY='{"event_type":"user.welcome","subscriber_external_id":"user-1","payload":{"name":"Ada"}}'
R1=$(curl -s -X POST $B/api/v1/events -H "Authorization: Bearer $KEY_A" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $KEY" -d "$BODY" | jq -r '.data.id')
R2=$(curl -s -X POST $B/api/v1/events -H "Authorization: Bearer $KEY_A" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $KEY" -d "$BODY" | jq -r '.data.id')
[ "$R1" = "$R2" ] && echo "PASS same id" || echo "FAIL"
psql "$PG" -c "SELECT count(*) FROM events WHERE idempotency_key='$KEY' AND workspace_id='$WS_A';"  # expect 1
psql "$PG" -c "SELECT count(*) FROM outbox o JOIN events e ON e.id=o.event_id WHERE e.idempotency_key='$KEY';"  # expect 1
```

---

## 10. Dispatch pipeline (the heart of the system)

**Setup (the canonical happy path):** console email provider + template `user.welcome`
(`Hi {{name}}`) + subscriber `user-1` with email + audience containing them + a
routing rule wiring it together.

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| **D-01** | **Happy path (console)** | publish `user.welcome` to audience | within ~1–2s: `GET /notification-log` has ONE `success` attempt, `provider_key:"console"`; `GET /events/:id` → `dispatched`; backend log shows rendered body |
| **D-02** | **Opt-out respected** | opt `user-1` out of email, publish | attempt `status:"skipped"`, `error_code:"opted_out"`; dispatch `skipped_optout`; **no provider call**; event still `dispatched` |
| **D-03** | **Missing var → dead-letter** | publish `user.welcome` with `payload:{}` | `GET /dead-letters` has `reason:"validation"`, `last_error` names `name`, `replayable:true`; **no `success` attempt**; never silently dropped |
| **D-04** | **No route → dead-letter** | publish `event_type:"orphan.event"` (no rule) | dead-letter `reason:"no_route"` |
| **D-05** | **No enabled provider → dead-letter** | disable all providers for channel, publish | dead-letter `reason:"no_route"`, `last_error` names the channel |
| **D-06** | **Provider fallback (transport)** | priority-1 provider that transient-fails + priority-2 console | log: `transport_failure` (provider 1) **then** `success` (provider 2) |
| **D-07** | **Hard failure — no fallback** | priority-1 hard-fails (4xx) | log: ONE `hard_failure`, dispatch stops, no attempt on provider 2 (covered by unit/integration; verify via integration test) |
| **D-08** | **Retry exhaustion → dead-letter** | all providers transient-fail through `DISPATCH_MAX_ATTEMPTS` | after max attempts, dead-letter `reason:"exhausted"`, `replayable` per impl; `retry_count` in metrics increments |
| D-09 | SMS dispatch (console) | console sms provider + sms template + sms channel sub | `success`, `channel:"sms"` |
| D-10 | Dispatch keyed on (event,sub,channel) | re-deliver same job | no double-send (unique key) |

```bash
# D-01 verify
sleep 2
curl -s "$B/api/v1/notification-log?status=success" -H "Authorization: Bearer $KEY_A" | jq '.data[0] | {status,provider_key,channel}'
curl -s "$B/api/v1/events/$EVT" -H "Authorization: Bearer $KEY_A" | jq '.data.status'   # "dispatched"

# D-03 verify
curl -s "$B/api/v1/dead-letters" -H "Authorization: Bearer $KEY_A" | jq '.data[0] | {reason,last_error,replayable}'
```

---

## 11. Dead-letters & replay

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| DL-01 | List | `GET /dead-letters` | `200`, items have `reason`, `last_error`, `payload_snapshot`, `replayable` |
| DL-02 | Get one | `GET /dead-letters/:id` | `200` |
| DL-03 | Get missing | `GET /dead-letters/dlq_nope` | `404` `1004` |
| **DL-04** | **Replay** | `POST /dead-letters/:id/replay` | `202`, `{ event_id, requeued:true }`; event re-processed through full pipeline |
| DL-05 | Replay re-dead-letters if root cause unfixed | replay a `validation` DLQ without fixing payload | re-processes and dead-letters again (correct behaviour) |
| DL-06 | Replay non-replayable | replay an entry with `replayable:false` | `409` `1005` |
| DL-07 | `replayed_at` stamped | after DL-04, `GET /dead-letters/:id` | `replayed_at` set |

---

## 12. Notification log (filters + pagination)

| ID | Test | Query | Expected |
|----|------|-------|----------|
| NL-01 | List | `GET /notification-log` | `200` list envelope, attempt objects |
| NL-02 | Filter by channel | `?channel=email` | only email attempts |
| NL-03 | Filter by status | `?status=success` | only successes |
| NL-04 | Filter by subscriber | `?subscriber_id=$SUB` | only that subscriber |
| NL-05 | Filter by event_type | `?event_type=user.welcome` | matching only |
| NL-06 | Date range | `?from=…&to=…` (ISO 8601) | within range |
| NL-07 | Combined filters | `?channel=email&status=success` | AND semantics |
| NL-08 | Subscriber history endpoint | `GET /subscribers/:id/history` | same shape, scoped to subscriber |

---

## 13. Metrics

| ID | Test | Expected |
|----|------|----------|
| M-01 | Shape | `GET /metrics` → `200` with `events_received`, `events_processed`, `dispatch_success`, `dispatch_failure`, `dispatch_success_rate` (0–1), `retry_count`, `dead_letter_count`, `queue_depth`, `by_channel[]`, `by_event_type[]`, `by_status[]` |
| M-02 | Counts move after dispatch | publish + dispatch (D-01) → re-fetch | `events_received` and `dispatch_success` incremented |
| M-03 | success_rate bounded | always `0 ≤ rate ≤ 1` (Zod-bounded) |
| M-04 | Filter by channel | `?channel=email` | scoped counts |
| M-05 | Filter by date | `?from=…&to=…` | scoped counts |
| M-06 | queue_depth reflects BullMQ | publish a batch, fetch immediately | `queue_depth > 0` while pending |

---

## 14. Test dispatch (synchronous)

| ID | Test | Method+Path | Expected |
|----|------|-------------|----------|
| TD-01 | Send test | `POST /test-dispatch {subscriber_external_id:"user-1",template_id:$TPL,variables:{name:"Ada"}}` | `200`, `{ status:"sent", provider_key:"console", dispatch_id }` |
| TD-02 | Opted-out subscriber | opt out, repeat | `200`, `{ status:"skipped_optout" }` |
| TD-03 | Missing required variable | omit `name` | `422` `1006` |
| TD-04 | No published version | template w/ no version | `422` `1006` |
| TD-05 | No channel address | subscriber lacks the template's channel | `422` `1006` |
| TD-06 | No enabled provider | disable providers | `422` `1006` |
| TD-07 | Template not found | `template_id:"tpl_nope"` | `404` `1004` |
| TD-08 | Subscriber not found | `subscriber_external_id:"nope"` | `404` `1004` |
| TD-09 | Specific version | `version:1` | renders v1 |
| TD-10 | Records an attempt | after TD-01, `GET /notification-log` | attempt recorded like the worker would |

---

## 15. Workspace isolation (multi-tenancy)

| ID | Test | Expected |
|----|------|----------|
| **ISO-01** | `GET /subscribers/$SUB_A` with `KEY_B` | `404` `1004` (not 403, no data) |
| ISO-02 | `GET /subscribers` with `KEY_B` | zero of A's subscribers |
| ISO-03 | Create template `"Welcome"` in B after A has one | `201` — name uniqueness is per-workspace |
| ISO-04 | Replay A's dead-letter with KEY_B | `404` `1004` |
| ISO-05 | A's metrics vs B's metrics | counts disjoint |
| ISO-06 | DB-level scoping | `psql` confirm every feature table row carries `workspace_id` |

---

## 16. Pagination (cursor keyset)

| ID | Test | Expected |
|----|------|----------|
| PG-01 | Default limit | `GET /subscribers` with >20 rows → 20 returned, `has_more:true`, `next_cursor` present |
| PG-02 | Follow cursor | pass `next_cursor` as `?cursor=` → next page, no dupes/skips |
| PG-03 | Last page | final page `has_more:false`, `next_cursor:null` |
| PG-04 | Custom limit | `?limit=5` → 5 rows |
| PG-05 | limit clamp | `?limit=1000` → clamped to max 100 |
| PG-06 | limit=0 / negative | `?limit=0` | clamped to a sane minimum (verify behaviour, assert exact) |
| PG-07 | Garbage cursor | `?cursor=not-base64` | `400` `1001` or empty result — assert exact |

```bash
for i in $(seq 1 25); do
  curl -s -X POST $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A" -H 'Content-Type: application/json' \
    -d "{\"external_id\":\"page-user-$i\"}" >/dev/null
done
curl -s "$B/api/v1/subscribers?limit=20" -H "Authorization: Bearer $KEY_A" | jq '{n:(.data|length),meta}'
```

---

## 17. Rate limiting

| ID | Test | Expected |
|----|------|----------|
| RL-01 | Exceed capacity | fire >`RATE_LIMIT_CAPACITY` requests rapidly on one key | eventually `429` `1007` |
| RL-02 | `Retry-After` header | inspect a `429` response | `Retry-After` header present (`ceil(1/refill)` s) |
| RL-03 | Per-credential bucket | A's limit doesn't affect B | independent buckets (`rl:{credentialId}`) |
| RL-04 | Refill | wait, retry | succeeds again after refill |
| RL-05 | Unauthenticated bucket | hammer a public route | falls back to `rl:{ip}` |

```bash
# RL-01 / RL-02 (note: default capacity 120; lower RATE_LIMIT_CAPACITY in .env to make this fast)
for i in $(seq 1 200); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X GET $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A")
  [ "$code" = "429" ] && { echo "429 at request $i"; break; }
done
curl -s -D - -o /dev/null -X GET $B/api/v1/subscribers -H "Authorization: Bearer $KEY_A" | grep -i retry-after
```

---

## 18. Reliability / ops

| ID | Test | Expected |
|----|------|----------|
| OPS-01 | Graceful shutdown | publish a batch, `kill -SIGTERM <backend pid>` mid-dispatch | in-flight BullMQ jobs drain before exit; no half-written dispatch rows |
| OPS-02 | Multi-node (no dup dispatch) | run a 2nd backend node vs same PG/Redis, publish | outbox `FOR UPDATE SKIP LOCKED` + BullMQ jobId dedup → each event dispatched once |
| OPS-03 | Stateless app layer | restart backend, re-query | all state from PG/Redis, none lost |
| OPS-04 | Redis down during dispatch | stop Redis mid-run | events stay in outbox; resume enqueuing on recovery (no loss) |

---

## 19. Cross-cutting checks (assert on every response sampled)

| # | Check |
|---|-------|
| X-01 | All timestamps are ISO 8601 (with `Z`) |
| X-02 | IDs are resource-prefixed ULIDs (`ws_`, `sub_`, `chn_`, `aud_`, `tpl_`, `tplv_`, `prov_`, `rule_`, `evt_`, `dsp_`, `att_`, `dlq_`) |
| X-03 | No secret fields ever in responses (`key_hash`, `config` plaintext, `PROVIDER_ENCRYPTION_KEY`) |
| X-04 | `429` responses carry `Retry-After` |
| X-05 | Every error matches the flat envelope `{ errorCode, errorMessage, type, field? }` |
| X-06 | `X-Request-Id` echoed/seeded on responses |
| X-07 | Success envelope is `{ data }` (+ `{ meta }` on lists); `204` has no body |

---

## State machines (assert transitions, reject illegal ones)

**Event:** `received → processing → dispatched` | `→ dead` (validation/no_route) | `→ failed` (exhaustion)
**Dispatch:** `pending → sent` | `failed` | `skipped_optout` | `dead`
**Attempt (log):** `success` | `transport_failure` | `hard_failure` | `skipped`
**Dead-letter reason:** `validation` | `no_route` | `exhausted`

---

## Out of scope (not tested here — see fullstack plan / future work)

- Additional channels (push, webhook, Slack) — interface only, no adapters.
- Human/admin accounts & sessions — API-key auth only.
- Scheduled/recurring sends — dispatch is on publish.
- Real Resend/Twilio network calls — stubbed in CI; console is the live path.
- Browser/dashboard behaviour — see `frontend-test-plan.md`.

## Risks

- **Concurrency on dedup**: S-02 tests serial dedup. The concurrent-insert race
  (two simultaneous registrations of the same `external_id`) is only safe if the
  UNIQUE constraint + upsert holds under contention — flag a load test if time allows.
- **Idempotency under concurrency**: E-06 is serial; concurrent same-key publish
  is the failure mode that gets missed.
- **Outbox relay timing**: D-01 assumes ~1–2s; under load `OUTBOX_POLL_INTERVAL_MS`
  may need accounting for.
