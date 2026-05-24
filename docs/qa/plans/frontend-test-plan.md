# Frontend Test Plan — Communiqué Dashboard

**Prepared:** 2026-05-24
**Tester role:** QA Engineer — Frontend Systems
**Spec:** `dockito/projects/candybar/features.md` (Web UI section) · `plan.md` §5
**Source of truth:** `apps/dashboard/src`
**Dashboard URL:** `http://localhost:5173` · **Backend:** `http://localhost:4000`
**Tool:** `agent-browser` (operated directly via Bash — never via sub-agents)
**Screenshots →** `docs/qa/screenshots/`

The dashboard authenticates with a **workspace API key** (no user login). The key
is held **in memory only** (`shared/services/workspace-token.ts`) — a hard refresh
drops it and bounces you to `/connect`. Every screen except `/connect` is gated by
`RequireWorkspace`.

Each screen is tested across the four states that matter: **loading**, **loaded
(success)**, **empty**, **error**. Selectors are semantic (`find role`, `find text`,
label/placeholder) — never CSS classes or internal IDs.

---

## 0. Pre-flight

```bash
# Backend + dashboard must both be running
curl -s http://localhost:4000/health | jq .          # { data: { status:"ok" } }
curl -s http://localhost:5173 | head -3              # dashboard HTML

# Seed a workspace + key via API (never through the UI)
B=http://localhost:4000
WS=$(curl -s -X POST $B/api/v1/workspaces -H 'Content-Type: application/json' \
  -d '{"name":"FE QA Workspace"}')
export KEY=$(echo "$WS" | jq -r '.data.credential.key')
echo "KEY=$KEY"

# Seed baseline data so loaded states have content:
#   a subscriber with email, an audience, a template + version, a console provider, a routing rule
# (use the curl flows from backend-test-plan §S/§A/§T/§P/§R)
```

**agent-browser session bootstrap:**

```bash
agent-browser close --all
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
```

---

## Mode 1 — Code-flow audit (run before the browser)

Frontend rules per `frontend-fsd.md` / meemaw. File each finding before execution.

| # | Command | Expectation |
|---|---------|-------------|
| CC-01 | `grep -rn "{.*&&" apps/dashboard/src/features --include="*.tsx" \| grep -v "//"` | Conditional render uses `<Show when=>`, not raw `&&` |
| CC-02 | `grep -rn "\.map(" apps/dashboard/src/features --include="*.tsx"` | Lists use `<Repeat>`, not raw `.map()` in JSX |
| CC-03 | `grep -rn "? <\|? (" apps/dashboard/src/features --include="*.tsx"` | Branching uses `<Switch>/<Case>`, not ternary JSX |
| CC-04 | `grep -rn "bg-\[#\|text-\[#\|border-\[#" apps/dashboard/src/features` | Color tokens only, no raw hex |
| CC-05 | `grep -rn "from 'lucide-react'" apps/dashboard/src/features` | Icons via `@icons` proxy (expect empty) |
| CC-06 | `grep -rn "useMutation\|mutationFn" apps/dashboard/src --include="*.ts" -l \| xargs grep -L onError` | Every mutation has an `onError`/error path (silent-failure risk if missing) |
| CC-07 | `grep -rn "localStorage\|sessionStorage" apps/dashboard/src` | Workspace key must NOT be persisted (in-memory only) |
| CC-08 | `grep -rn "navigate(\"/\|to=\"/" apps/dashboard/src/features` | Routes via `ROUTES` constants from `@communique/core` |
| CC-09 | `grep -rn "fetch(\"/api\|http://localhost" apps/dashboard/src/features` | API paths via `EP` constants, base URL from env |
| CC-10 | `grep -rn ": any\|as any\|console\.log" apps/dashboard/src/features` | No `any`, no stray logs |
| CC-11 | Confirm dashboard types come from `@communique/core` schemas | Zero hand-mirrored types (anti-drift seam) |

---

## 1. Connect / auth gate — `/connect`

**File:** `features/connect/screen/connect-screen.tsx`

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| **CN-01** | **Gate redirect** | open `http://localhost:5173/subscribers` with no key | redirected to `/connect` |
| CN-02 | Tabs render | open `/connect` | buttons "Use API key" and "New workspace" visible |
| CN-03 | Connect with valid key | "Use API key" tab → fill `$KEY` → click "Connect" | routes to Overview (`/`); nav visible |
| CN-04 | Invalid key (<8 chars) | enter `abc` → Connect | inline error "Enter a valid workspace API key." |
| CN-05 | Wrong key | enter a well-formed but bogus key → Connect | backend `401` surfaces as inline error (from `errorMessage`) |
| **CN-06** | **Create workspace** | "New workspace" tab → name "Acme Inc." → "Create workspace" | success panel: "Workspace created. Copy your API key — it is shown only once:" + key shown |
| CN-07 | Continue after create | click "I've saved it — continue" | enters app at Overview |
| CN-08 | Name validation | submit empty name | field error under "Workspace name" |
| **CN-09** | **Key not persisted** | connect → reload page | bounced back to `/connect` (in-memory only) |

```bash
agent-browser navigate http://localhost:5173/subscribers
agent-browser wait --load networkidle
agent-browser eval "location.pathname"     # expect "/connect"  (CN-01)

agent-browser find role button click --name "Use API key"
agent-browser find label "Workspace API key" fill "$KEY"
agent-browser find role button click --name "Connect"
agent-browser wait 1000
agent-browser eval "location.pathname"     # expect "/"  (CN-03)
```

---

## 2. Overview / Metrics — `/` and `/metrics`

**File:** `features/metrics/screen/metrics-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| MX-01 | Heading | h1 "Overview"; subtitle "Live dispatch metrics for this workspace." |
| **MX-02** | **Eight metric cards** | labels: Events received, Events processed, Dispatch success, Dispatch failure, Success rate, Retries, Dead letters, Queue depth |
| MX-03 | Success rate format | rendered as a percentage (`xx%`) |
| MX-04 | Breakdowns | "By channel" and "By status" sections render |
| MX-05 | Auto-refresh | values refresh ~every 10s (`refetchInterval: 10_000`) — observe a counter change after dispatching |
| MX-06 | Loading state | screenshot immediately on navigate — spinner/skeleton before data |
| MX-07 | Error state | network-route `*/api/v1/metrics*` to a `1009` error → `role="alert"` visible |

```bash
agent-browser navigate http://localhost:5173/metrics
agent-browser screenshot docs/qa/screenshots/metrics-loading.png      # MX-06
agent-browser wait --text "Events received"
agent-browser eval "document.body.innerText" | grep -E "Events received|Success rate|Queue depth"
agent-browser screenshot docs/qa/screenshots/metrics-loaded.png

# MX-07 error state
agent-browser network route "*/api/v1/metrics*" --status 500 --body '{"errorCode":1009,"errorMessage":"Service unavailable","type":"internal_error"}'
agent-browser reload
agent-browser wait 1000
agent-browser screenshot docs/qa/screenshots/metrics-error.png
agent-browser is visible "[role=alert]"
agent-browser network unroute
```

---

## 3. Subscribers — `/subscribers`

**File:** `features/subscribers/screen/subscribers-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| SUB-01 | Heading | h1 "Subscribers"; subtitle "People and devices this workspace can reach." |
| SUB-02 | List renders | seeded subscriber rows show `external_id`, `id`, created date |
| **SUB-03** | **Empty state** | fresh workspace → "No subscribers yet" + "Register subscribers via the API or add one here." |
| SUB-04 | Loading state | screenshot immediately on navigate — spinner |
| SUB-05 | Error state | route `*/api/v1/subscribers*` to error → `role="alert"` |
| SUB-06 | Search | type in "Search by external id…" → list filters |
| **SUB-07** | **Add subscriber** | "Add subscriber" → fill "External ID" `ui-user-1` (+ optional "Email (optional)") → "Register" → new row appears |
| SUB-08 | Validation inline | submit empty external id → field error under "External ID" (from backend `field`) |
| SUB-09 | Cancel add | open add form → "Cancel" → form closes |
| **SUB-10** | **Row → detail** | click a row → navigates to `/subscribers/:id` |

```bash
agent-browser navigate http://localhost:5173/subscribers
agent-browser wait --text "Subscribers"
agent-browser find role button click --name "Add subscriber"
agent-browser find label "External ID" fill "ui-user-1"
agent-browser find label "Email (optional)" fill "ui-user-1@example.com"
agent-browser find role button click --name "Register"
agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep "ui-user-1"      # SUB-07
agent-browser reload && agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep "ui-user-1"      # persisted
```

---

## 4. Subscriber detail — `/subscribers/:id`

**File:** `features/subscribers/screen/subscriber-detail-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| SD-01 | Header | title = `external_id`, subtitle = `id`; "Back to subscribers" button |
| SD-02 | Channels card | "Channels" h3; rows show channel + address; "No channels." when none |
| **SD-03** | **Opt-out toggle persists** | under "Channel opt-outs", click "Opt out" → button becomes "Opted out — re-enable"; reload → still opted out |
| SD-04 | Re-enable | click "Opted out — re-enable" → back to "Opt out"; reload confirms |
| SD-05 | History | "Notification history" h3; attempts with status badges; "No notifications yet." when none |
| SD-06 | Status badge tones | success=success, transport_failure=warning, hard_failure=error, skipped=neutral |
| **SD-07** | **Delete** | "Delete" → subscriber removed → returns to list; row gone from `/subscribers` |
| SD-08 | Error state | route detail endpoint to error → `role="alert"` |

```bash
# SD-03 — opt-out persistence (the must-verify case)
agent-browser find role button click --name "Opt out"
agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep "Opted out — re-enable"
agent-browser reload && agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep "Opted out — re-enable"   # still set
```

---

## 5. Audiences — `/audiences` and `/audiences/:id`

**Files:** `features/audiences/screen/audiences-screen.tsx`, `audience-detail-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| AUD-01 | Heading | h1 "Audiences"; subtitle "Named groups of subscribers you dispatch to." |
| AUD-02 | Empty state | "No audiences yet" + "Create an audience to target groups of subscribers." |
| AUD-03 | Loading / error states | spinner on load; `role="alert"` on routed error |
| **AUD-04** | **Create audience** | "New audience" → "Name" = `All users` → "Create" → row with `member_count` badge appears |
| AUD-05 | Duplicate name | create `All users` again → inline error from backend `409` |
| AUD-06 | Row → detail | click → `/audiences/:id`, "Back to audiences" present |
| **AUD-07** | **Add member** | detail → "Add member by subscriber ID" → paste a `sub_…` id → "Add" → member list updates, count rises |
| AUD-08 | Add missing subscriber | paste `sub_nope` → "Add" → inline error (backend `404`) |
| AUD-09 | Members empty state | "No members yet." before adding |

---

## 6. Templates — `/templates` and `/templates/:id`

**Files:** `features/templates/screen/templates-screen.tsx`, `template-detail-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| TPL-01 | Heading | h1 "Templates"; subtitle present |
| TPL-02 | Empty state | "No templates yet" + "Create a template, then publish a version with your content." |
| **TPL-03** | **Create template** | "New template" → Name `Welcome`, Event type `user.welcome`, Channel `email` → "Create" → row with channel + `v0` badge |
| TPL-04 | Duplicate name | create `Welcome` again → inline error (`409`) |
| TPL-05 | Channel field | select between "email" / "sms" |
| TPL-06 | Detail header | title=name, subtitle=`event_type · channel`, `v{latest}` badge |
| **TPL-07** | **Publish version** | detail → "Publish new version": Subject `Welcome {{name}}!`, Body `Hi {{name}}, thanks.` → "Publish version" → versions list shows `v1` |
| TPL-08 | SMS hides subject/html | for an sms template, Subject and Body(HTML) fields are absent |
| **TPL-09** | **Live preview — happy** | "Live preview" → Variables `{"name":"Ada"}` → "Render preview" → rendered subject/body shows "Ada"; no missing-vars warning |
| **TPL-10** | **Live preview — missing var** | Variables `{}` → "Render preview" → missing-vars warning lists `name` (yellow) |
| TPL-11 | Invalid JSON | Variables `{bad` → "Render preview" → "Variables must be valid JSON." |
| TPL-12 | Versions immutable | "Versions (immutable)" heading; each version shows required vars; no edit control |

```bash
agent-browser find label "Variables (JSON)" fill '{"name":"Ada"}'
agent-browser find role button click --name "Render preview"
agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep "Ada"            # TPL-09
```

---

## 7. Providers — `/providers`

**File:** `features/providers/screen/providers-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| PRV-01 | Heading | h1 "Providers"; subtitle mentions priority fallback + encrypted creds |
| PRV-02 | Empty state | "No providers configured" + console/Resend/Twilio hint |
| **PRV-03** | **Add console provider** | "Add provider" → Channel `email`, Provider `console`, Config `{}` → "Add provider" → row shows `console · email · priority N`, "enabled" badge |
| **PRV-04** | **Add resend provider (masked)** | Provider `resend`, Config `{"api_key":"re_secret123","from_email":"a@b.com"}` → save → list shows `config_masked` (last-4 only, e.g. `********t123`) — **never plaintext** |
| PRV-05 | Invalid JSON config | Config `{bad` → "Config must be valid JSON." |
| PRV-06 | Invalid config shape | resend with missing `from_email` → inline backend error on `config` |
| PRV-07 | Enable/disable | toggle "Disable"/"Enable" → badge flips; reload confirms |
| PRV-08 | Delete | trash icon → provider removed |
| PRV-09 | Provider options track channel | switch Channel to `sms` → Provider options change to twilio/console |

---

## 8. Routing rules — `/routing-rules`

**File:** `features/routing-rules/screen/routing-rules-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| RR-01 | Heading | h1 "Routing rules"; subtitle present |
| RR-02 | Empty state | "No routing rules" + "Create a rule so published events know where to go." |
| **RR-03** | **Create rule** | "New rule" → Event type `user.welcome`, Channel `email`, Template (dropdown, format "Welcome (email)"), Audience ("Direct target" or a name) → "Create rule" → row "user.welcome → email → audience/direct", "enabled" badge |
| RR-04 | Channel/template mismatch | pick sms channel + email template → inline error (backend `field:"channel"`) |
| RR-05 | Direct target | leave Audience = "Direct target" → rule shows "→ direct" |
| RR-06 | Dropdowns populated | Template and Audience dropdowns list seeded entities |
| RR-07 | Delete | trash icon → rule removed |
| RR-08 | Empty template list | with no templates, dropdown only has "Select…" |

---

## 9. Notification log — `/notification-log`

**File:** `features/notification-log/screen/notification-log-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| NL-01 | Heading | h1 "Notification log"; subtitle present |
| NL-02 | Empty state | "No log entries" + "Dispatch attempts will appear here." |
| NL-03 | Entries render | after a dispatch: event_type, channel · provider · attempt N, status badge, timestamp |
| NL-04 | Error detail | failed attempts show `error_detail` in muted text |
| **NL-05** | **Channel filter** | dropdown "All/email/sms" → narrows list |
| **NL-06** | **Status filter** | dropdown "All/success/transport_failure/hard_failure/skipped" → narrows list |
| NL-07 | Combined filters | channel + status together → AND |
| NL-08 | Badge tones | success/warning/error/neutral mapping correct |

---

## 10. Dead letters — `/dead-letters`

**File:** `features/dead-letters/screen/dead-letters-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| DL-01 | Heading | h1 "Dead letters"; subtitle mentions inspect + replay |
| DL-02 | Empty state | "No dead letters" + "Everything is being delivered or retried successfully." |
| DL-03 | Entry renders | event_type, last_error, reason badge (validation=warning, exhausted=error, no_route=neutral) |
| **DL-04** | **Inspect payload** | "Inspect" → expands JSON `payload_snapshot`; button toggles to "Hide" |
| **DL-05** | **Replay** | "Replay" → button reflects loading → on success entry shows a "replayed" tag; footer note about re-enqueue |
| DL-06 | Replay disabled when not replayable | entry with `replayable:false` → "Replay" disabled |
| DL-07 | Loading / error states | spinner; `role="alert"` on routed error |

```bash
# Seed a dead-letter first: publish user.welcome with empty payload (missing var) — see backend D-03
agent-browser navigate http://localhost:5173/dead-letters
agent-browser wait --text "Dead letters"
agent-browser find role button click --name "Inspect"
agent-browser wait 300
agent-browser screenshot docs/qa/screenshots/dlq-inspect.png        # DL-04
agent-browser find role button click --name "Replay"
agent-browser wait --load networkidle
agent-browser eval "document.body.innerText" | grep -i "replayed"    # DL-05
```

---

## 11. Test dispatch — `/test-dispatch`

**File:** `features/test-dispatch/screen/test-dispatch-screen.tsx`

| ID | Test | Expected |
|----|------|----------|
| TD-01 | Heading | h1 "Test dispatch"; subtitle present |
| TD-02 | Form | "Subscriber external ID", "Template" (dropdown "Select…" + "name (channel)"), "Variables (JSON)" prefilled `{"name":"Ada"}` |
| TD-03 | Send disabled until valid | "Send test" disabled until external id + template chosen |
| **TD-04** | **Send → sent** | external id `ui-user-1`, template `Welcome`, vars `{"name":"Ada"}` → "Send test" → Result panel: Status badge "sent" (success tone), Provider `console` |
| TD-05 | Skipped (opt-out) | opt subscriber out, send → Result "skipped_optout" (neutral) |
| TD-06 | Failed | force a failing provider → Result "failed" (error tone) |
| TD-07 | Invalid JSON | Variables `{bad` → "Variables must be valid JSON." |
| TD-08 | Missing var (422) | omit `name` → backend `422` surfaces as inline/general error |
| TD-09 | Result empty state | before sending → "Run a test to see the outcome." |

---

## 12. Cross-cutting browser checks

| ID | Check |
|----|-------|
| GX-01 | Every list screen: loading spinner (`role="status"`), empty state with label, error `role="alert"` |
| GX-02 | Error messages come from backend `errorMessage`, not hardcoded |
| GX-03 | Nav present on all gated screens: Overview, Subscribers, Audiences, Templates, Providers, Routing rules, Notification log, Dead letters, Test dispatch, Disconnect |
| GX-04 | "Disconnect" clears the key and returns to `/connect` |
| GX-05 | No console errors in the browser during any flow (`agent-browser` console capture) |
| GX-06 | Forms set `aria-invalid` + `aria-describedby` on errored fields; errors have `role="alert"` |
| GX-07 | Buttons set `aria-busy` while mutating |

---

## Test execution loop (per screen)

```bash
# 1. Loading — screenshot immediately
agent-browser navigate http://localhost:5173/<route>
agent-browser screenshot docs/qa/screenshots/<screen>-loading.png

# 2. Loaded — wait for known text, read body, screenshot
agent-browser wait --text "<Heading>"
agent-browser eval "document.body.innerText"
agent-browser screenshot docs/qa/screenshots/<screen>-loaded.png

# 3. Empty — fresh workspace or filter to empty
agent-browser screenshot docs/qa/screenshots/<screen>-empty.png

# 4. Error — network route, reload, assert alert
agent-browser network route "*/api/v1/<resource>*" --status 500 --body '{"errorCode":1009,"errorMessage":"Service unavailable","type":"internal_error"}'
agent-browser reload && agent-browser wait 1000
agent-browser is visible "[role=alert]"
agent-browser screenshot docs/qa/screenshots/<screen>-error.png
agent-browser network unroute

# After any mutation: assert DOM, then RELOAD to confirm persistence
```

---

## Out of scope

- Backend correctness of responses — covered in `backend-test-plan.md`.
- Visual/pixel regression — semantic + functional only.
- Mobile/responsive breakpoints beyond a spot check.
- Cross-browser (Chromium via agent-browser only).

## Risks

- **Loading-state capture**: console provider is fast; loading states may flash too
  briefly to screenshot — if so, flag as a component concern, don't fake a PASS.
- **In-memory key**: any test that reloads must re-connect first (CN-09 by design).
- **Auto-refresh races**: the metrics 10s `refetchInterval` can repaint mid-assertion;
  pin to a single read.
