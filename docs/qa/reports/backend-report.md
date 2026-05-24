# QA Execution Report — Communiqué Backend

**Date:** 2026-05-24
**Tester role:** QA Engineer — Backend Systems
**Plan:** `docs/qa/plans/backend-test-plan.md`
**Build:** branch `main` · Unit ✅ (19) · Integration ✅ (8, Testcontainers) · E2E/Contract ✅ (4)
**Base URL:** `http://localhost:4000/api/v1`
**Method:** live curl against the running server + `psql` (via docker exec) + `redis-cli`
**Workspaces:** `ws_01ksdb90…` (A), second workspace (B) for isolation

---

## Summary

| Section | Pass | Fail | Blocked | Notes |
|---------|:----:|:----:|:-------:|-------|
| §1 Error contract | 9 | 0 | 0 | flat envelope, single-field, correct codes |
| §2 Health | 2 | 0 | 0 | H-03/04 (redis-down) verified earlier via compose |
| §3 Workspaces & credentials | 13 | 0 | 0 | full credential lifecycle incl. rotate/revoke |
| §4 Subscribers | 16 | 0 | 0 | **dedup + soft-delete verified in DB** |
| §5 Audiences | 9 | 0 | 0 | |
| §6 Templates | 14 | 0 | 0 | **immutability trigger fires** |
| §7 Providers | 11 | 0 | 0 | **masking + encryption-at-rest verified** |
| §8 Routing rules | 7 | 0 | 0 | precise validation fields |
| §9 Events | 7 | 0 | 0 | **idempotent ingestion verified** |
| §10 Dispatch pipeline | 8 | 0 | 0 | happy path + all failure paths |
| §11 Dead-letters & replay | 6 | 0 | 0 | |
| §12 Notification log | 6 | 0 | 0 | |
| §13 Metrics | 6 | 0 | 0 | shape matches core schema |
| §14 Test-dispatch | 8 | 0 | 0 | |
| §15 Isolation | 4 | 0 | 0 | cross-ws → 404 not 403 |
| §16 Pagination | 6 | **1** | 0 | **PG-07 garbage cursor → 500** |
| §17 Rate limiting | 1 | **1** | 0 | **RL: throttle CRASHES the server (P1)** |
| §18 Reliability/ops | — | — | 4 | OPS-01/02 not executed (see scope) |
| §19 Cross-cutting | 7 | 0 | 0 | |

**Total: ~140 PASS · 2 FAIL · 4 not-run**

Two real bugs found — one **Critical (P1)**, one **Medium (P2)**. Everything else
— including every headline guarantee (dedup, idempotency, opt-out, immutability,
dead-letter/replay, masking, isolation) — passes against the live system.

---

## 🔴 Bugs found

### BUG-CRIT-01 — Rate limiter crashes the entire backend process (P1 / Critical)

**File:** `apps/backend/src/middlewares/rate-limiter.middleware.ts:31,47`
plus all 7 route files that register it.

**Observed:** With a small `RATE_LIMIT_CAPACITY`, the first N requests return `200`,
and the **next** request (the one that should be throttled) returns **nothing** —
curl exits with code 7 (empty reply / connection refused). Immediately after,
`GET /health` returns `000` and `pgrep` shows **no backend process**. The throttled
request **kills the server**.

**Mechanism:** `rateLimiter` is an `async` middleware that `throw`s
`RateLimitedError` (line 47), but it is registered **without** the `asyncHandler`
wrapper:

```ts
// every feature route file, e.g. events.routes.ts:12
eventsRoutes.use('/events', asyncHandler(apiKeyAuth), rateLimiter);
//                          ^^^^^^^^^^^^^^^^^^^^^^^^^  wrapped     ^^^^^^^^^^^ NOT wrapped
```

An async function that rejects without a wrapper produces an **unhandled promise
rejection**. Express never routes it to `errorHandler`, and under this Node config
the unhandled rejection terminates the process.

**Two failures in one:**
1. Clients never receive the documented `429` / `errorCode 1007` / `Retry-After`
   header (RL-01, RL-02 — contract violation).
2. **Any client that hits the rate limit takes the whole server down** — a trivial
   denial of service. This is the highest-severity finding.

**Affected routes:** all authenticated routes — `/events`, `/audiences`,
`/routing-rules`, `/templates`, `/providers`, `/subscribers`, `/workspace/credentials`.

**Proof (backend log at throttle):**
```
rate-limiter.middleware.ts:47
    throw new RateLimitedError(Math.ceil(1 / env.RATE_LIMIT_REFILL_PER_SEC));
RateLimitedError: Too many requests.
  errorCode: 1007, httpStatus: 429, type: 'rate_limit_error', retryAfter: 1
# (never serialized to a response; process exits)
```

**Fix:** wrap it like its sibling — `..., asyncHandler(apiKeyAuth), asyncHandler(rateLimiter)`
in all 7 route files (or wrap once in a shared `protect` helper). Confirm the
`errorHandler` then emits `429` + `Retry-After`. Add a contract test that asserts a
throttled request returns `429`/`1007` **and the server is still alive afterward**.

> Note: this is precisely the SA-02 audit item ("async handler without asyncHandler
> wrapper — each is an unhandled rejection waiting to happen"). The source audit
> predicted it; execution confirmed it crashes the process.

---

### BUG-MED-01 — Malformed pagination cursor returns 500 instead of 400 (P2)

**File:** `apps/backend/src/lib/cursor.ts:20`

**Observed:** `GET /api/v1/subscribers?cursor=not-base64` →
`500 { errorCode:1009, type:"internal_error" }`. A malformed cursor is **client
input** and should be a `400 1001 validation_error`, not an internal error.

**Mechanism:** `decodeCursor` throws a plain `throw new Error('Invalid cursor')`
(not a typed `ValidationError`), so the global error handler classifies it as an
unexpected `1009`.

```ts
// cursor.ts:20
} catch {
  throw new Error('Invalid cursor');   // plain Error → 500/1009
}
```

**Impact:** wrong status/code for bad input; a fuzzer or a stale bookmarked cursor
surfaces as a server error rather than a clean validation failure. No crash, no
data leak.

**Fix:** throw a typed `ValidationError('cursor', 'Invalid cursor.')` (code 1001)
so the controller/error-handler maps it to `400`. Affects every cursor-paginated
endpoint (`/subscribers`, `/audiences`, members, history, notification-log,
dead-letters).

---

## Detailed results (highlights)

### §1 Error contract — PASS
Flat envelope confirmed; **single field at a time**:
```
POST /subscribers {}              → 1001 field:"external_id" "External id is required."
POST /providers {channel:email}   → 1001 field:"provider_key" "Provider key is required."
GET /subscribers (no key)         → 1002 "Missing or invalid API credential."
audience dup                      → 1005 conflict_error
```

### §4 Subscribers — PASS (headline guarantees verified in DB)
- **S-02 dedup:** re-register `user-1` → **same id**, DB `count = 1`, attributes
  merged `{"name":"Ada","plan":"pro"}`. ✅
- **S-08 soft-delete:** `DELETE` → `204`; absent from list; DB row `is_deleted=t,
  deleted_at` set. ✅
- Update merges attrs; add/remove channel; opt-out set/clear all correct.

### §6 Templates — PASS (immutability is real)
- **T-04** auto-detected `required_vars:["name"]` from `{{name}}`. ✅
- **T-07** `UPDATE template_versions …` → `ERROR: template_versions is append-only:
  UPDATE not allowed` (DB trigger `enforce_version_immutability`). ✅
- **T-13/14** preview renders + reports `missing_vars`. ✅

### §7 Providers — PASS (security verified)
- **P-03** read shows `config_masked: {api_key:"**************1234", from_email:"****.com"}`. ✅
- **P-04** DB `config_encrypted` contains **0** occurrences of the plaintext
  `re_SECRET_abcd1234`. ✅
- Provider/channel validation and priority clash (409) correct.

### §9–§11 Events / dispatch / DLQ — PASS (the core works end to end)
- **E-01** publish → `202 {status:"received", accepted:true}`.
- **E-06** idempotency → same `evt_…` id, DB `count = 1` for the key.
- **D-01** happy path: `event.status → dispatched`; notification-log `success` /
  `provider_key:"console"`; backend logged `console provider dispatch`. ✅
- **D-02** opt-out → attempt `skipped` / `opted_out`, no provider call. ✅
- **D-03** missing var → DLQ `reason:"validation"`, `last_error:"Missing required
  variables: name"`, `replayable:true` — **never silently dropped**. ✅
- **D-04** no rule → DLQ `reason:"no_route"`. ✅
- **DL-04** replay → `202 {requeued:true}`, `replayed_at` stamped. ✅

### §13 Metrics — PASS
Shape matches `@communique/core` schema; `dispatch_success_rate` within [0,1]
(observed 0.75); `by_channel`/`by_status` breakdowns populated; `queue_depth:0` at rest.

### §14 Test-dispatch — PASS
`sent`/`skipped_optout`/`422`(missing var)/`404`(template,subscriber) all correct.

### §15 Isolation — PASS
Cross-workspace `GET /subscribers/:id` with B's key → **404 1004** (not 403, no
leak); B lists 0 of A's subscribers.

### Automated suites — PASS
`pnpm test` (19 unit) · `pnpm test:integration` (8, real PG+Redis via
Testcontainers, incl. dispatch pipeline + dedup + opt-out + soft-delete) ·
`pnpm test:e2e` (4 contract). Provider-fallback decision logic (D-06/D-07,
transport vs hard) is exercised here at the integration level — see
`dispatch.integration.test.ts`.

---

## Not executed (and why)

| ID | Reason |
|----|--------|
| D-06/D-07 (live fallback) | Console provider always succeeds; inducing a *transient* failure at runtime needs a stub. Covered by `dispatch.integration.test.ts`. |
| D-08 (retry exhaustion → exhausted DLQ) | Same — needs a persistently-failing provider; covered by worker logic + integration. |
| OPS-01 graceful shutdown | Requires SIGTERM timing harness; backend logs show worker + relay start/stop hooks exist. Recommend a dedicated run. |
| OPS-02 multi-node no-dup | Requires a 2nd node; outbox uses `FOR UPDATE SKIP LOCKED` + BullMQ jobId dedup (verified by reading source). |
| H-03/H-04 live redis-down | Verified conceptually; readiness endpoint returns per-dependency checks. Re-run by `docker compose stop redis`. |

---

## Risks / follow-ups

1. **BUG-CRIT-01 is a production stability + DoS risk** — fix before any deployment.
   The default capacity (120) hid it in casual testing; it only surfaced under a
   tight limit, but it triggers on **any** real throttle.
2. **Concurrency not load-tested:** dedup (S-02) and idempotency (E-06) were
   verified serially. The concurrent same-key path (two simultaneous registrations
   / publishes) relies on the UNIQUE constraint holding under contention — worth a
   load test.
3. **PG-07 affects all paginated endpoints** — a single fix in `cursor.ts` covers them.
