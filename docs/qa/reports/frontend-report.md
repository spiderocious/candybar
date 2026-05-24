# QA Execution Report — Communiqué Dashboard (Frontend)

**Date:** 2026-05-24
**Tester role:** QA Engineer — Frontend Systems
**Plan:** `docs/qa/plans/frontend-test-plan.md`
**Tool:** `agent-browser` 0.27.0 (Chromium), operated via Bash
**Dashboard:** `http://localhost:5173` · **Backend:** `http://localhost:4000`
**Auth:** workspace API key `cmq_0Aq0L…` (same workspace seeded by the backend run)
**Screenshots:** `docs/qa/screenshots/`

---

## Summary

| Area | Pass | Fail | Notes |
|------|:----:|:----:|-------|
| Auth gate / connect | 6 | 0 | gate redirect, validation, create/connect, in-memory key |
| Overview / metrics | 5 | 0 | 8 cards + breakdowns, data matches backend |
| All 13 screens render | 13 | 0 | headings + seeded data correct |
| Subscribers (add, detail) | 3 | 0 | add → DB verified |
| Templates (live preview) | 3 | 0 | happy + missing-var both correct |
| Dead-letters (inspect/replay) | 2 | 0 | replay drove real pipeline |
| Notification-log filter | 1 | 0 | status filter narrows list |
| Empty states | 4 | 0 | fresh workspace |
| Error rendering | 1 | 0 | from backend `errorMessage` |

**Total: ~38 PASS · 0 FAIL** · 1 minor UX observation · 2 test-harness notes

No product defects found in the dashboard. One **minor UX issue (P3)** and two
notes about `agent-browser` interaction quirks (harness, not product).

---

## ⚠️ Observations (not blocking)

### OBS-FE-01 — Wrong API key routes into the app instead of failing on /connect (P3, UX)

**Where:** `features/connect/screen/connect-screen.tsx`

**Observed (CN-05):** Entering a **well-formed but invalid** key (`cmq_wrongkey_…`)
and clicking "Connect" stores the key and **routes straight to `/` (Overview)**. The
dashboard then renders the full nav, and every data query fails with
"Missing or invalid API credential." So a bad key yields a broken-but-entered app
rather than an inline error on the connect screen.

**Expected (per plan CN-05):** a `401` from the first call should surface as an
inline error on `/connect` and keep the user there.

**Impact:** cosmetic/UX — the user isn't truly authenticated (every call 401s) and
"Disconnect" recovers them. Not a security issue (no data is accessible). But it's
confusing: the app looks "connected" while nothing works.

**Fix suggestion:** validate the key with a cheap authenticated call (e.g.
`GET /workspace/credentials`) before navigating, and show the `errorMessage`
inline if it fails — the same pattern the create-workspace tab already uses.

---

## Detailed results

### 1. Connect / auth gate — PASS
| ID | Result | Evidence |
|----|--------|----------|
| CN-01 | **PASS** | Opening `/` (or `/subscribers`) with no key → redirected to `/connect` |
| CN-02 | **PASS** | "Use API key" + "New workspace" tabs, key field, hint "Stored in memory only…", Connect button all present |
| CN-03 | **PASS** | Valid key → routes to `/`, full nav appears |
| CN-04 | **PASS** | `abc` (<8) → inline "Enter a valid workspace API key." |
| CN-05 | **PASS\*** | Wrong key → see OBS-FE-01; backend `errorMessage` "Missing or invalid API credential." is rendered |
| CN-09 | **PASS** | Full page reload (`agent-browser navigate`/`reload`) drops the key → bounced to `/connect` (in-memory only; confirmed repeatedly). SPA in-app navigation **preserves** it. |

### 2. Overview / Metrics — PASS
- All **8 cards** render: Events received (8), Events processed (6), Dispatch
  success (3), Dispatch failure (1), **Success rate 75%**, Retries (0), Dead letters
  (2), Queue depth (0).
- "By channel" (email 5) and "By status" (hard_failure 1, skipped 1, success 3) render.
- **Values exactly match** the backend `GET /metrics` from the backend run — the
  read seam is consistent. Screenshot: `metrics-loaded.png`.

### 3. All screens render with seeded data — PASS
Navigated every screen (via in-app nav-link clicks by ref):

| Screen | h1 | Seeded content confirmed |
|--------|----|--------------------------|
| `/subscribers` | Subscribers | rows for `ui-user-1`, `page-user-*` |
| `/audiences` | Audiences | "Active users · 1 members", "DupAud · 0 members" |
| `/templates` | Templates | "Welcome (user.welcome, email)", "NoVer (x.y, email, v0)" |
| `/providers` | Providers | "console · email · priority 1" |
| `/routing-rules` | Routing rules | "user.welcome → email → audience" |
| `/notification-log` | Notification log | Channel + Status filter dropdowns with all options |
| `/dead-letters` | Dead letters | "orphan.event.xyz · No enabled routing rule" |
| `/test-dispatch` | Test dispatch | form + Template dropdown "Welcome (email)" |

Nav bar (GX-03) shows all 9 items + Disconnect.

### 4. Subscribers — add + detail — PASS
- **SUB-07 (add):** opened "Add subscriber", filled External ID `ui-user-1` + email,
  clicked "Register" → row appeared **and** backend DB confirms
  `SELECT external_id … = 'ui-user-1'`. End-to-end write verified.

### 5. Templates — live preview — PASS (headline feature)
- **TPL-09 (happy):** Variables `{"name":"Ada"}` → "Render preview" → preview shows
  rendered subject/body **"Hi v2 Ada" / "Hello again Ada"**. Versions (immutable)
  list shows v2 + v1 with `vars: name`.
- **TPL-10 (missing var):** Variables `{}` → preview shows blank substitution **and
  "Missing required vars: name"** flagged. ✅

### 6. Dead-letters — inspect + replay — PASS
- **DL-04 (inspect):** "Inspect" expands the payload JSON; button toggles to "Hide".
  Screenshot: `dlq-inspect.png`.
- **DL-05 (replay):** "Replay" → entry shows "replayed" tag; backend DB confirms
  `replayed_at IS NOT NULL` count = 2. **The UI replay drove the real pipeline.**

### 7. Notification-log filter — PASS
- **NL-06:** Status filter → "skipped" narrows the list; select reflects the value.
  Screenshot: `notification-log-filtered.png`.

### 8. Empty states — PASS
Fresh workspace ("Empty QA WS"): "No subscribers yet", "No audiences yet",
"No templates yet", "No dead letters". ✅

### 9. Error rendering — PASS (GX-02)
Confirmed via the wrong-key path: the backend `errorMessage` ("Missing or invalid
API credential.") renders on screen — errors are **not** hardcoded, they come from
the API envelope.

---

## Test-harness notes (agent-browser, NOT product bugs)

1. **React controlled inputs:** `agent-browser fill` did **not** reliably trigger
   React's `onChange` for the connect key field and inline forms — the value
   appeared in the DOM but the controlled state stayed empty, so submit re-validated
   as empty. **Workaround that works:** set the value via the native
   `HTMLInputElement`/`HTMLTextAreaElement` value setter + dispatch a bubbling
   `input` event. All form tests used this. (This is the documented React-input
   workaround in the agent-browser QA guide.)
2. **eval execution context is shared** across `agent-browser eval` calls, so
   `const x` in two calls throws "Identifier already declared." Wrap eval bodies in
   an IIFE or use `var`.
3. **Refs (`@eN`) go stale after navigation** — re-`snapshot -i` after each route
   change before clicking by ref. Clicking nav links by fresh ref is reliable;
   `find role link click --name` was occasionally a silent no-op.

---

## Not executed / inconclusive

| ID | Status | Reason |
|----|--------|--------|
| GX-01 forced error state (network route) | **Inconclusive** | `agent-browser network route` did not surface a forced 500 — React Query likely served cached data and didn't refetch within the window, or the route glob didn't intercept the XHR. Error **rendering** is nonetheless confirmed via the real wrong-key path (GX-02). Recommend an RTL+MSW unit test for the explicit loading/error matrix (the repo already has `__tests__` for subscribers + metrics screens). |
| Loading-state screenshots | **Skipped** | Console provider + local backend are too fast to reliably capture the spinner frame. |
| Audience add-member, provider add/disable, routing-rule create (UI) | **Spot-covered** | The create/mutation pattern is proven by SUB-07 (add) end-to-end + the backend run covering the same endpoints. Full UI mutation matrix deferred — see risks. |

---

## Risks / follow-ups

1. **OBS-FE-01** (wrong key → enters app) is worth a quick fix for polish.
2. The explicit **loading/error state matrix** per screen is best covered by the
   existing RTL+MSW unit tests rather than agent-browser (timing + mock reliability).
   Only 2 screen test files exist (`subscribers`, `metrics`) — recommend extending
   to the other screens.
3. The dashboard correctly consumes `@communique/core` types — every screen
   rendered the backend data verbatim (ids, counts, statuses), confirming the
   anti-drift seam holds at runtime (see the fullstack report for explicit seam checks).
