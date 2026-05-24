# QA Execution Report — Communiqué Fullstack (Seam Checks)

**Date:** 2026-05-24
**Tester role:** QA Engineer — Full Stack
**Plan:** `docs/qa/plans/fullstack-test-plan.md`
**Tools:** `curl` + `psql` (docker exec) + `agent-browser` 0.27.0
**Backend:** `http://localhost:4000` · **Dashboard:** `http://localhost:5173`
**Workspace:** "FS Seam WS" (`ws_…`, key `cmq_qvL1…`) for A; second workspace for isolation

These 6 checks exercise backend **and** dashboard simultaneously to confirm the
contract seam (`@communique/core` Zod schemas shared by both sides) holds at
runtime — the class of bug neither single-side plan catches.

---

## Summary

| # | Seam | Result | Direction verified |
|---|------|:------:|--------------------|
| FS-01 | Subscriber shape | **PASS** | API write → DB → UI read (verbatim) |
| FS-02 | Dedup guarantee | **PASS** | API write → DB → (1 row, merged) |
| FS-03 | Dispatch + log + metrics | **PASS** | API publish → pipeline → UI log + metrics |
| FS-04 | Dead-letter + replay | **PASS** | API → DLQ → UI shows it |
| FS-05 | Secret masking | **PASS** | DB ciphertext → API masked → **0 plaintext in DOM** |
| FS-06 | Workspace isolation | **PASS** | auth seam (API 404 + UI shows nothing) |

**Total: 6 / 6 PASS.** No contract drift found — the dashboard renders backend
data verbatim, and the shared-schema seam holds end to end.

---

## Detailed results

### FS-01 — Subscriber created via API appears verbatim in UI — PASS
- **API:** `POST /subscribers {external_id:"fs-user-1", attributes:{name:"Ada"},
  channels:[email→ada@x.com]}` → `201`, id `sub_…`.
- **DB:** `SELECT external_id … = 'fs-user-1'` ✅
- **UI:** `/subscribers` renders the `fs-user-1` row. The exact `external_id`
  crosses the boundary with no blank/undefined cell → **no field-name drift**.

### FS-02 — Dedup holds across API write + DB read — PASS
- Re-register `fs-user-1` with `{plan:"pro"}` → **same id**.
- DB `count = 1`; `attributes = {"name":"Ada","plan":"pro"}` (merged, not duplicated).

### FS-03 — Full dispatch: publish (API) → UI log + metrics — PASS
- **API:** publish `user.welcome` to audience → event `status: dispatched`;
  `notification-log` shows `success` / `provider_key: console` / `channel: email`.
- **API metrics:** `events_received: 2, dispatch_success: 1, dispatch_success_rate:
  0.5, dead_letter_count: 1` (matches the publish + the FS-04 DLQ).
- **UI Overview:** "Events received 2" — matches the API exactly.
- **UI notification-log:** shows `user.welcome` + `console`.
- → **no log/metrics shape mismatch.** The breakdown keys (`by_channel`,
  `by_status`) and metric field names line up on both sides.

### FS-04 — Dead-letter round-trip — PASS
- **API:** publish `user.welcome` with `payload:{}` (missing `name`) → DLQ
  `reason: validation`, `replayable: true`. Never silently dropped.
- **UI:** `/dead-letters` shows the `user.welcome` entry with the validation reason
  ("Missing required variables…"). (Replay-drives-pipeline was independently
  verified in the frontend run: DL-05 → backend `replayed_at` stamped.)

### FS-05 — Secret masked end to end — PASS (security)
- Added a `resend` provider with `api_key: "re_SECRET_abcd1234"`.
- **DB:** `config_encrypted = "hJJFOK-6PjGMtOq8NrgU-…"` (opaque ciphertext); a
  `LIKE '%re_SECRET_abcd1234%'` scan returns **0** rows.
- **API:** `GET /providers` → `config_masked: {api_key:"**************1234",
  from_email:"****.com"}`; grep of the raw response for the plaintext → **0**.
- **UI:** full `document.documentElement.outerHTML` grep for `re_SECRET_abcd1234`
  → **0 occurrences**; the masked `…1234` is what's shown.
- → **the credential never reaches the client in plaintext** — at any layer.

### FS-06 — Workspace isolation across the auth seam — PASS
- **API:** with workspace B's key, `GET /subscribers/<A's fs-user-1>` → **404**;
  `GET /subscribers?search=fs-user-1` → **0** results.
- **UI:** disconnect, reconnect the dashboard with B's key, open `/subscribers` →
  `fs-user-1` is **not** visible (`hasFsUser: false`). B's session sees none of A's
  data through the same path the dashboard authenticates with.

---

## Out of scope (per plan)

- Exhaustive endpoint matrix → `backend-report.md`.
- Exhaustive screen-state matrix → `frontend-report.md`.
- Load/concurrency (concurrent dedup, idempotency under contention) — flagged as a
  risk in the backend report; not run.
- Multi-node double-dispatch prevention — backend OPS-02; not part of these checks.
- Real Resend/Twilio delivery — console provider only.

## Risks

- These 6 checks confirm the seam at representative points, not exhaustively. The
  `packages/core` contract tests (run green in the backend suite) are the backstop
  for fields not surfaced in these spot checks.
- Note the **rate-limiter crash (BUG-CRIT-01 in the backend report)** is the one
  cross-cutting issue that would affect the fullstack experience under load — a
  throttled dashboard user would see the whole backend go down, not a `429`.
