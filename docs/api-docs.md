# Communiqué API Reference

Complete reference for every endpoint: method, path, auth, request payload, every
HTTP status it can return, and the JSON body of each response.

- **Base URL:** `http://localhost:4000`
- **Version prefix:** `/api/v1`
- **Content type:** `application/json` for all request bodies

---

## Conventions

### Authentication

All endpoints except `POST /api/v1/workspaces`, `GET /api/v1/workspaces/:id`,
and the `/health` endpoints require a workspace API key:

```
Authorization: Bearer cmq_…
```

The key resolves to a workspace; every query is scoped to it. A key for
workspace A has **zero** visibility into workspace B (cross-workspace access
returns `404`, never another workspace's data).

### Success envelope

Single resource:

```json
{ "data": { … } }
```

List (cursor-paginated):

```json
{ "data": [ … ], "meta": { "next_cursor": "…" | null, "has_more": true } }
```

`204 No Content` responses have no body.

### Error envelope (flat)

```json
{ "errorCode": 1001, "errorMessage": "Email is invalid.", "type": "validation_error", "field": "email" }
```

| `errorCode` | HTTP | `type`                | Meaning                                            |
| ----------- | ---- | --------------------- | -------------------------------------------------- |
| 1001        | 400  | `validation_error`    | Input validation — `field` names the offender. One field at a time. |
| 1002        | 401  | `auth_error`          | Missing / invalid / revoked API key                |
| 1003        | 403  | `forbidden_error`     | Authenticated but not permitted                    |
| 1004        | 404  | `not_found_error`     | Resource does not exist (or not in this workspace) |
| 1005        | 409  | `conflict_error`      | Duplicate, immutable-version edit, state conflict  |
| 1006        | 422  | `unprocessable_error` | Well-formed but semantically invalid (e.g. missing template vars) |
| 1007        | 429  | `rate_limit_error`    | Rate limit exceeded (includes `Retry-After` header)|
| 1008        | 502  | `upstream_error`      | Provider/dependency failure (transient)            |
| 1009        | 500  | `internal_error`      | Unexpected, irreconcilable error                   |

Clients switch on the numeric `errorCode` (stable), never on `errorMessage`.

### Pagination

List endpoints accept `?limit=` (default 20, max 100) and `?cursor=`. Pass the
`meta.next_cursor` from a response as the next request's `cursor`. When
`has_more` is `false`, you've reached the end.

### IDs

Opaque, resource-prefixed ULIDs (`ws_`, `cred_`, `sub_`, `chn_`, `aud_`, `tpl_`,
`tplv_`, `prov_`, `rule_`, `evt_`, `dsp_`, `att_`, `dlq_`). Never parse them.

### Idempotency

State-mutating `POST /events` accepts an `Idempotency-Key` header. Reusing a key
returns the original result and never double-dispatches.

---

## Health

### `GET /health`

Liveness. No auth.

- **200**

```json
{ "data": { "status": "ok" } }
```

### `GET /health/ready`

Readiness — checks Postgres + Redis. No auth.

- **200** — ready

```json
{ "data": { "status": "ready", "checks": { "postgres": "ok", "redis": "ok" } } }
```

- **503** — a dependency is down

```json
{ "data": { "status": "degraded", "checks": { "postgres": "ok", "redis": "down" } } }
```

---

## Workspaces & credentials

### `POST /api/v1/workspaces`

Create a workspace and its first API key. **No auth** (bootstrap). The plaintext
`key` is returned **once**.

Request:

```json
{ "name": "My Company", "slug": "my-company" }
```

| Field  | Type   | Required | Notes                                            |
| ------ | ------ | -------- | ------------------------------------------------ |
| `name` | string | yes      | 2–120 chars                                      |
| `slug` | string | no       | lowercase letters/digits/hyphens; derived if omitted |

- **201**

```json
{
  "data": {
    "workspace": { "id": "ws_…", "name": "My Company", "slug": "my-company", "created_at": "…", "updated_at": "…" },
    "credential": { "id": "cred_…", "workspace_id": "ws_…", "name": "Default", "prefix": "cmq_xxxxxxxx", "key": "cmq_…", "last_used_at": null, "revoked_at": null, "created_at": "…" }
  }
}
```

- **400** `1001` — invalid `name`/`slug`
- **409** `1005` — slug already exists

### `GET /api/v1/workspaces/:id`

Fetch a workspace by id. No auth.

- **200** `{ "data": { "id": "ws_…", "name": "…", "slug": "…", "created_at": "…", "updated_at": "…" } }`
- **404** `1004` — not found

### `GET /api/v1/workspace/credentials`

List the calling workspace's credentials. **Auth required.**

- **200**

```json
{ "data": [ { "id": "cred_…", "workspace_id": "ws_…", "name": "Default", "prefix": "cmq_xxxxxxxx", "last_used_at": "…"|null, "revoked_at": null, "created_at": "…" } ] }
```

- **401** `1002`

### `POST /api/v1/workspace/credentials`

Issue a new key. **Auth required.** Returns plaintext `key` once.

Request: `{ "name": "CI pipeline" }` (`name` 2–120 chars, required)

- **201** — credential object **with** `key`
- **400** `1001` · **401** `1002`

### `POST /api/v1/workspace/credentials/:id/rotate`

Revoke the named credential and issue a replacement. **Auth required.**

- **201** — new credential **with** `key`
- **404** `1004` — credential not found · **401** `1002`

### `DELETE /api/v1/workspace/credentials/:id`

Revoke a credential. **Auth required.**

- **204** — no body
- **404** `1004` — not found or already revoked · **401** `1002`

---

## Subscribers

### `GET /api/v1/subscribers`

List/search. **Auth.** Query: `?search=` (matches `external_id`), `?limit=`, `?cursor=`.

- **200** — list envelope of subscriber objects:

```json
{
  "data": [ { "id": "sub_…", "workspace_id": "ws_…", "external_id": "user-42", "attributes": { … }, "is_deleted": false, "created_at": "…", "updated_at": "…" } ],
  "meta": { "next_cursor": null, "has_more": false }
}
```

- **401** `1002`

### `POST /api/v1/subscribers`

Register (idempotent on `external_id` — re-registering merges attributes/channels).

Request:

```json
{
  "external_id": "user-42",
  "attributes": { "name": "Ada" },
  "channels": [ { "channel": "email", "address": "ada@example.com" } ]
}
```

| Field         | Type     | Required | Notes                              |
| ------------- | -------- | -------- | ---------------------------------- |
| `external_id` | string   | yes      | 1–255 chars; your unique id        |
| `attributes`  | object   | no       | arbitrary key/values               |
| `channels`    | array    | no       | each `{ channel: "email"\|"sms", address }` |

- **201** — full subscriber with `channels`, `optouts`, `audiences`:

```json
{ "data": { "id": "sub_…", "workspace_id": "ws_…", "external_id": "user-42", "attributes": { "name": "Ada" }, "is_deleted": false, "created_at": "…", "updated_at": "…", "channels": [ { "id": "chn_…", "subscriber_id": "sub_…", "channel": "email", "address": "ada@example.com", "verified": false, "created_at": "…" } ], "optouts": [], "audiences": [] } }
```

- **400** `1001` — e.g. `{ "errorCode": 1001, "errorMessage": "External id is required.", "type": "validation_error", "field": "external_id" }`
- **401** `1002`

### `GET /api/v1/subscribers/:id`

- **200** — full subscriber (as above) · **404** `1004` · **401** `1002`

### `PATCH /api/v1/subscribers/:id`

Merge attributes. Request: `{ "attributes": { "plan": "pro" } }`

- **200** — updated subscriber · **404** `1004` · **400** `1001`

### `DELETE /api/v1/subscribers/:id`

Soft-delete (history preserved; hidden from lists).

- **204** · **404** `1004`

### `POST /api/v1/subscribers/:id/channels`

Add/replace a channel. Request: `{ "channel": "sms", "address": "+15551234567" }`

- **201** — channel object · **404** `1004` (subscriber) · **400** `1001`

### `DELETE /api/v1/subscribers/:id/channels/:channelId`

- **204** · **404** `1004` (subscriber or channel)

### `POST /api/v1/subscribers/:id/optouts`

Set/clear a per-channel opt-out. Request: `{ "channel": "email", "opted_out": true }`

- **200** — full subscriber (with updated `optouts`) · **404** `1004` · **400** `1001`

### `GET /api/v1/subscribers/:id/history`

The subscriber's notification log (cursor-paginated). Query: `?limit=`, `?cursor=`.

- **200** — list of dispatch-attempt objects (see [notification log](#notification-log))
- **401** `1002`

---

## Audiences

### `GET /api/v1/audiences`

List (cursor). **200** — list of:

```json
{ "id": "aud_…", "workspace_id": "ws_…", "name": "Active users", "description": null, "member_count": 12, "created_at": "…", "updated_at": "…" }
```

### `POST /api/v1/audiences`

Request: `{ "name": "Active users", "description": "optional" }` (`name` 2–120, required)

- **201** — audience object · **409** `1005` (name exists) · **400** `1001`

### `GET /api/v1/audiences/:id`

- **200** — audience object · **404** `1004`

### `PATCH /api/v1/audiences/:id`

Request: `{ "name": "…", "description": "…" }` (both optional)

- **200** — updated · **404** `1004` · **400** `1001`

### `DELETE /api/v1/audiences/:id`

Soft-delete. **204** · **404** `1004`

### `GET /api/v1/audiences/:id/members`

List members (cursor). **200**:

```json
{ "data": [ { "subscriber_id": "sub_…", "external_id": "user-42", "joined_at": "…" } ], "meta": { "next_cursor": null, "has_more": false } }
```

- **404** `1004` (audience)

### `POST /api/v1/audiences/:id/members`

Request: `{ "subscriber_id": "sub_…" }`

- **200** — the audience (with updated `member_count`)
- **404** `1004` — audience or subscriber not found
- **400** `1001`

### `DELETE /api/v1/audiences/:id/members/:subscriberId`

- **204** · **404** `1004` (audience, or subscriber not a member)

---

## Templates

### `GET /api/v1/templates`

List (cursor). **200** — list of:

```json
{ "id": "tpl_…", "workspace_id": "ws_…", "name": "Welcome", "event_type": "user.welcome", "channel": "email", "latest_version": 2, "created_at": "…", "updated_at": "…" }
```

### `POST /api/v1/templates`

Request:

```json
{ "name": "Welcome", "event_type": "user.welcome", "channel": "email" }
```

| Field        | Type   | Required | Notes               |
| ------------ | ------ | -------- | ------------------- |
| `name`       | string | yes      | 2–120, unique       |
| `event_type` | string | yes      | 1–120               |
| `channel`    | enum   | yes      | `email` \| `sms`    |

- **201** — template object (`latest_version: 0`)
- **409** `1005` (name exists) · **400** `1001`

### `GET /api/v1/templates/:id`

- **200** — template **with** its `versions` array:

```json
{ "data": { "id": "tpl_…", …, "versions": [ { "id": "tplv_…", "template_id": "tpl_…", "version": 1, "subject": "Hi {{name}}", "body_text": "Hello {{name}}", "body_html": null, "required_vars": ["name"], "created_at": "…" } ] } }
```

- **404** `1004`

### `POST /api/v1/templates/:id/versions`

Publish a **new immutable version** (existing versions can never be edited).

Request:

```json
{ "subject": "Hi {{name}}", "body_text": "Hello {{name}}", "body_html": "<p>Hello {{name}}</p>", "required_vars": ["name"] }
```

| Field           | Type     | Required | Notes                                                |
| --------------- | -------- | -------- | ---------------------------------------------------- |
| `body_text`     | string   | yes      | plain-text body (SMS uses only this)                 |
| `subject`       | string   | no       | email subject                                        |
| `body_html`     | string   | no       | email HTML body                                      |
| `required_vars` | string[] | no       | if omitted, auto-detected from `{{ }}` placeholders  |

- **201** — the new version object · **404** `1004` (template) · **400** `1001`

### `GET /api/v1/templates/:id/versions`

- **200** — `{ "data": [ <version>, … ] }` (newest first) · **404** `1004`

### `GET /api/v1/templates/:id/versions/:version`

- **200** — a single version object
- **400** `1001` — version not a positive integer
- **404** `1004` — template or version not found

### `POST /api/v1/templates/:id/preview`

Render with sample variables. Request:

```json
{ "variables": { "name": "Ada" }, "version": 1 }
```

(`version` optional — defaults to latest.)

- **200**

```json
{ "data": { "subject": "Hi Ada", "body_text": "Hello Ada", "body_html": null, "missing_vars": [] } }
```

- **404** `1004` (template) · **422** `1006` (no published version) · **400** `1001`

---

## Providers

Configured credentials are **encrypted at rest** and never returned in full —
responses include `config_masked`.

### `GET /api/v1/providers`

- **200** — `{ "data": [ <provider>, … ] }`:

```json
{ "id": "prov_…", "workspace_id": "ws_…", "channel": "email", "provider_key": "resend", "priority": 1, "enabled": true, "config_masked": { "api_key": "********wxyz", "from_email": "*********.com" }, "created_at": "…", "updated_at": "…" }
```

### `POST /api/v1/providers`

Request:

```json
{ "channel": "email", "provider_key": "resend", "priority": 1, "enabled": true, "config": { "api_key": "re_…", "from_email": "noreply@example.com", "from_name": "Acme" } }
```

| Field          | Type    | Required | Notes                                              |
| -------------- | ------- | -------- | -------------------------------------------------- |
| `channel`      | enum    | yes      | `email` \| `sms`                                   |
| `provider_key` | enum    | yes      | `console` \| `resend` (email) \| `twilio` (sms)    |
| `config`       | object  | yes      | provider-specific (see below); `console` → `{}`    |
| `priority`     | int     | no       | fallback order (lower first); auto-assigned if omitted |
| `enabled`      | boolean | no       | default `true`                                     |

Provider config shapes:

- `console`: `{}`
- `resend`: `{ "api_key": string, "from_email": string(email), "from_name"?: string }`
- `twilio`: `{ "account_sid": string, "auth_token": string, "from_number": string }`

- **201** — provider object (masked)
- **400** `1001` — provider not valid for channel, or config invalid (`field: "config"` / `"provider_key"`)
- **409** `1005` — that `priority` is already used for the channel

### `GET /api/v1/providers/:id`

- **200** — provider (masked) · **404** `1004`

### `PATCH /api/v1/providers/:id`

Request (all optional): `{ "priority": 2, "enabled": false, "config": { … } }`

- **200** — updated provider · **404** `1004` · **409** `1005` (priority clash) · **400** `1001` (config invalid)

### `DELETE /api/v1/providers/:id`

- **204** · **404** `1004`

---

## Routing rules

### `GET /api/v1/routing-rules`

- **200** — `{ "data": [ <rule>, … ] }`:

```json
{ "id": "rule_…", "workspace_id": "ws_…", "event_type": "user.welcome", "channel": "email", "audience_id": "aud_…"|null, "template_id": "tpl_…", "enabled": true, "created_at": "…", "updated_at": "…" }
```

### `POST /api/v1/routing-rules`

Request:

```json
{ "event_type": "user.welcome", "channel": "email", "template_id": "tpl_…", "audience_id": "aud_…", "enabled": true }
```

| Field         | Type    | Required | Notes                                                  |
| ------------- | ------- | -------- | ------------------------------------------------------ |
| `event_type`  | string  | yes      | 1–120                                                  |
| `channel`     | enum    | yes      | must match the template's channel                      |
| `template_id` | string  | yes      | must exist in this workspace                           |
| `audience_id` | string  | no       | omit for rules applying to direct-target events        |
| `enabled`     | boolean | no       | default `true`                                         |

- **201** — rule object
- **400** `1001` — template not found (`field: "template_id"`), channel mismatch (`field: "channel"`), or audience not found (`field: "audience_id"`)

### `GET /api/v1/routing-rules/:id`

- **200** — rule · **404** `1004`

### `PATCH /api/v1/routing-rules/:id`

Request (all optional): `{ "channel": "sms", "template_id": "tpl_…", "audience_id": null, "enabled": false }`

- **200** — updated · **404** `1004` · **400** `1001`

### `DELETE /api/v1/routing-rules/:id`

- **204** · **404** `1004`

---

## Event ingestion

### `POST /api/v1/events`

Publish an event for asynchronous dispatch. **Headers:** `Authorization`,
optional `Idempotency-Key`.

Request — provide **exactly one** of `audience_id` / `subscriber_external_id`:

```json
{ "event_type": "user.welcome", "audience_id": "aud_…", "payload": { "name": "Ada" } }
```

```json
{ "event_type": "password.reset", "subscriber_external_id": "user-42", "payload": { "link": "…" } }
```

| Field                     | Type   | Required | Notes                                  |
| ------------------------- | ------ | -------- | -------------------------------------- |
| `event_type`              | string | yes      | 1–120; matched against routing rules   |
| `payload`                 | object | no       | variables for template interpolation   |
| `audience_id`             | string | one-of   | target an audience                     |
| `subscriber_external_id`  | string | one-of   | target a single subscriber (your id)   |

- **202 Accepted** — queued (not yet delivered):

```json
{ "data": { "id": "evt_…", "status": "received", "accepted": true } }
```

Re-sending with the same `Idempotency-Key` also returns **202** with the original
event id.

- **400** `1001` — e.g. neither/both targets supplied:
  `{ "errorCode": 1001, "errorMessage": "Provide exactly one of audience_id or subscriber_external_id.", "type": "validation_error" }`
- **401** `1002` · **429** `1007` (with `Retry-After`)

### `GET /api/v1/events/:id`

- **200**

```json
{ "data": { "id": "evt_…", "workspace_id": "ws_…", "event_type": "user.welcome", "payload": { … }, "target_kind": "audience"|"subscriber", "target_ref": "aud_…"|"user-42", "status": "received"|"processing"|"dispatched"|"failed"|"dead", "idempotency_key": "…"|null, "created_at": "…", "updated_at": "…" } }
```

- **404** `1004`

---

## Notification log

### `GET /api/v1/notification-log`

Every dispatch attempt (cursor-paginated). **Auth.**

Query filters (all optional): `subscriber_id`, `event_type`, `channel`
(`email`/`sms`), `status` (`success`/`transport_failure`/`hard_failure`/`skipped`),
`from` (ISO 8601), `to` (ISO 8601), `limit`, `cursor`.

- **200**

```json
{
  "data": [ {
    "id": "att_…", "dispatch_id": "dsp_…", "workspace_id": "ws_…", "subscriber_id": "sub_…",
    "event_type": "user.welcome", "channel": "email", "provider_key": "console"|null,
    "attempt_no": 1, "status": "success"|"transport_failure"|"hard_failure"|"skipped",
    "error_code": null|"missing_vars"|"provider_hard"|"provider_transient"|"opted_out"|"no_provider"|"no_version",
    "error_detail": "…"|null, "created_at": "…"
  } ],
  "meta": { "next_cursor": null, "has_more": false }
}
```

---

## Dead letters

Events that failed validation, had no route, or exhausted retries.

### `GET /api/v1/dead-letters`

List (cursor). **200**:

```json
{
  "data": [ {
    "id": "dlq_…", "workspace_id": "ws_…", "event_id": "evt_…", "event_type": "user.welcome",
    "reason": "validation"|"exhausted"|"no_route", "last_error": "Missing required variables: name",
    "payload_snapshot": { … }, "replayable": true, "replayed_at": null, "created_at": "…"
  } ],
  "meta": { "next_cursor": null, "has_more": false }
}
```

### `GET /api/v1/dead-letters/:id`

- **200** — dead-letter object · **404** `1004`

### `POST /api/v1/dead-letters/:id/replay`

Re-enqueue the event through the full pipeline.

- **202 Accepted**

```json
{ "data": { "event_id": "evt_…", "requeued": true } }
```

- **404** `1004` — not found
- **409** `1005` — entry is not replayable

---

## Metrics

### `GET /api/v1/metrics`

Live aggregates for the workspace. Query filters (optional): `channel`,
`event_type`, `from`, `to`.

- **200**

```json
{
  "data": {
    "events_received": 120, "events_processed": 112, "events_dead": 3,
    "dispatch_success": 108, "dispatch_failure": 9, "dispatch_success_rate": 0.923,
    "retry_count": 5, "dead_letter_count": 3, "queue_depth": 0,
    "by_channel":    [ { "key": "email", "count": 90 }, { "key": "sms", "count": 27 } ],
    "by_event_type": [ { "key": "user.welcome", "count": 80 } ],
    "by_status":     [ { "key": "success", "count": 108 }, { "key": "hard_failure", "count": 9 } ]
  }
}
```

---

## Test dispatch

### `POST /api/v1/test-dispatch`

Synchronously dispatch one template to one subscriber and return the immediate
result (goes through the same render → opt-out → provider-fallback path as the
worker, but is not queued).

Request:

```json
{ "subscriber_external_id": "user-42", "template_id": "tpl_…", "version": 1, "variables": { "name": "Ada" } }
```

| Field                    | Type   | Required | Notes                          |
| ------------------------ | ------ | -------- | ------------------------------ |
| `subscriber_external_id` | string | yes      | your subscriber id             |
| `template_id`            | string | yes      | template to send               |
| `version`                | int    | no       | defaults to latest             |
| `variables`              | object | no       | template variables             |

- **200**

```json
{ "data": { "dispatch_id": "dsp_…", "status": "sent"|"failed"|"skipped_optout", "provider_key": "console"|null, "detail": "…"|null } }
```

- **404** `1004` — template or subscriber not found
- **422** `1006` — no published version, missing required variables, no channel address, or no enabled provider
- **400** `1001`
