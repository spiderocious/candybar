# Communiqué

An open-source, self-hostable **subscriber & notification dispatch platform**. One
notification layer for your whole organisation: any internal service registers
subscribers, publishes events, and trusts Communiqué to handle delivery,
deduplication, retries, templating, provider fallback and observability.

- **Upstream-oblivious** — services publish an event; Communiqué decides the
  channel, template, provider and handles delivery.
- **Provider-agnostic** — Email and SMS today (console / Resend / Twilio), added
  as plugins. New providers are one file.
- **Multi-tenant** — isolated workspaces, scoped by API credential.
- **Operationally boring** — at-least-once + idempotent ingestion, exponential
  backoff, dead-letter + replay, a queryable notification log and live metrics.

```
apps/
  backend/      Express API + BullMQ dispatch worker (Node, Postgres, Redis)
  dashboard/    Vite + React admin UI
packages/
  core/         Shared types, Zod schemas, error + route + endpoint constants
```

---

## Quickstart (under 15 minutes)

**Prerequisites:** Node ≥ 20, [pnpm](https://pnpm.io) ≥ 9, Docker.

```bash
# 1. Install
pnpm install

# 2. Start Postgres + Redis (+ Mailpit for local email viewing)
docker compose up -d

# 3. Configure the backend
cp .env.example apps/backend/.env
# generate the one required secret (provider credential encryption key):
openssl rand -base64 32
# paste it as PROVIDER_ENCRYPTION_KEY in apps/backend/.env

# 4. Run migrations
pnpm migrate

# 5. Run the backend (http://localhost:4000) and dashboard (http://localhost:5173)
pnpm dev:backend     # terminal 1
pnpm dev:dashboard   # terminal 2
```

Open the dashboard, click **New workspace**, and you'll get an API key. Then:

1. **Providers** → add a `console` email provider (no credentials needed — it
   "sends" to the server log, so you can see the whole pipeline work immediately).
2. **Templates** → create one for event type `user.welcome`, channel `email`,
   publish a version with body `Hi {{name}}!`.
3. **Subscribers** → add one with an email address.
4. **Audiences** → create one, add the subscriber.
5. **Routing rules** → `user.welcome` → email → that audience → that template.
6. **Test dispatch** (or publish a real event via the API) and watch it land in
   **Notification log**.

To send real email/SMS, configure a **Resend** or **Twilio** provider instead of
(or at a higher priority than) `console`.

---

## How dispatch works

```
POST /api/v1/events ──(one DB tx)──▶  events + outbox
        202 Accepted                        │
                              outbox relay (FOR UPDATE SKIP LOCKED)
                                            │
                                      BullMQ queue
                                            │
                              dispatch worker (concurrency N)
        resolve routing rule ▶ audience/subscriber ▶ render template
        ├─ opted out?            → skip (logged)
        ├─ missing required var? → dead-letter (never silently dropped)
        ├─ provider[0] sends     → success ✓
        ├─ transport failure     → fall back to provider[1], [2]…
        └─ all fail / exhausted  → retry w/ backoff → dead-letter (replayable)
```

Every attempt is recorded in `dispatch_attempts` (the notification log) with the
provider used, outcome, and any error.

---

## Providers

| Key       | Channel | Needs credentials | Use                                       |
| --------- | ------- | ----------------- | ----------------------------------------- |
| `console` | both    | no                | Default; logs the message. Demos + tests. |
| `resend`  | email   | `api_key`, `from_email` | Real email                          |
| `twilio`  | sms     | `account_sid`, `auth_token`, `from_number` | Real SMS             |

Credentials are stored **encrypted per workspace** (AES-256-GCM, keyed by
`PROVIDER_ENCRYPTION_KEY`), configured via the dashboard — never in config files.
Multiple providers per channel are tried in `priority` order (fallback).

Add a provider by implementing the `ChannelProvider` interface in
`apps/backend/src/providers/` and registering it in `registry.ts`.

---

## Commands

```bash
pnpm dev:backend          # backend with hot reload (tsx)
pnpm dev:dashboard        # dashboard (vite)
pnpm migrate              # run DB migrations
pnpm typecheck            # all packages
pnpm lint                 # all packages
pnpm test                 # unit tests (all packages)
pnpm test:integration     # Testcontainers integration tests (backend)
pnpm test:e2e             # Supertest end-to-end + contract tests (backend)
pnpm build                # production build of every package
```

For production, `pnpm --filter @communique/backend build` then
`pnpm --filter @communique/backend start`. The app layer is stateless — run
multiple backend nodes against the same Postgres + Redis for high availability;
the outbox relay (`SKIP LOCKED`) and BullMQ ensure each event is dispatched once.

---

## Docs

- [`docs/integration.md`](docs/integration.md) — integrate an upstream service.
- [`docs/api-docs.md`](docs/api-docs.md) — full API reference (every endpoint,
  payload, status code and response).
- [`docs/qa-handoff.md`](docs/qa-handoff.md) — QA test plan for every feature.

---

## Conventions

TypeScript strict throughout, no `any`. Backend is a 3-layer
controller → service → repository with `ServiceResult<T>` (services never throw
for expected failures), an `AsyncLocalStorage` request context (services never
receive `req`), ULID resource-prefixed IDs, cursor pagination only, and a single
`ResponseUtil` for the success envelope. The error envelope is **flat**:

```json
{ "errorCode": 1001, "errorMessage": "Email is invalid.", "type": "validation_error", "field": "email" }
```

`errorCode` is a stable number (1001–1009); clients switch on it, not the message.
Validation reports **one field at a time**.
