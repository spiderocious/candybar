# Integrating with Communiqué

This guide is for an **upstream service** that wants to register subscribers and
publish notification events. You do not need to know anything about channels,
templates, providers, or delivery — you publish an event and Communiqué handles
the rest.

- **Base URL:** `http://localhost:4000` (your deployment's host)
- **All paths are prefixed** `/api/v1`
- **Content type:** `application/json`

---

## 1. Get a workspace API key

A workspace is an isolated tenant. Everything you create lives inside it, and
your API key only ever sees its own workspace's data.

Create one (one-time bootstrap — do this once, store the key as a secret in your
service):

```bash
curl -X POST http://localhost:4000/api/v1/workspaces \
  -H 'Content-Type: application/json' \
  -d '{ "name": "My Company" }'
```

```json
{
  "data": {
    "workspace": { "id": "ws_…", "name": "My Company", "slug": "my-company", "created_at": "…", "updated_at": "…" },
    "credential": {
      "id": "cred_…",
      "workspace_id": "ws_…",
      "name": "Default",
      "prefix": "cmq_xxxxxxxx",
      "key": "cmq_…the_full_key…",
      "last_used_at": null,
      "revoked_at": null,
      "created_at": "…"
    }
  }
}
```

> **The `key` is shown once.** Store it securely. You can issue more keys, rotate,
> or revoke them later (see the API docs `workspace/credentials` endpoints).

Every authenticated request sends it as a Bearer token:

```
Authorization: Bearer cmq_…
```

---

## 2. Register a subscriber

A subscriber is uniquely identified by **your** `external_id` (your user id,
account id, device id — whatever you key users by). Registration is
**idempotent**: calling it again with the same `external_id` updates the record,
never duplicates it. Safe to call on every login or profile change.

```bash
curl -X POST http://localhost:4000/api/v1/subscribers \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{
    "external_id": "user-42",
    "attributes": { "name": "Ada", "plan": "pro" },
    "channels": [
      { "channel": "email", "address": "ada@example.com" },
      { "channel": "sms",   "address": "+15551234567" }
    ]
  }'
```

`attributes` are arbitrary key/values you can interpolate into templates.
`channels` are the addresses Communiqué can reach the subscriber on.

**Opt-outs are respected automatically.** If a subscriber opts out of email,
your service does not need to check — Communiqué skips them at dispatch time.

---

## 3. (Optional) Group subscribers into an audience

Notifications are usually sent to an **audience** (a named group) rather than
individuals. Create one and add members:

```bash
# create
curl -X POST http://localhost:4000/api/v1/audiences \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{ "name": "Active users" }'        # → { "data": { "id": "aud_…", … } }

# add a member (by subscriber id, returned from step 2)
curl -X POST http://localhost:4000/api/v1/audiences/aud_…/members \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{ "subscriber_id": "sub_…" }'
```

---

## 4. One-time setup (usually done by an admin in the dashboard)

Before events can be delivered, the workspace needs:

1. **A provider** for the channel (e.g. a `console`, `resend`, or `twilio`
   provider). See `POST /api/v1/providers` in the API docs.
2. **A template** + a published version, tied to an `event_type` and `channel`.
3. **A routing rule**: `event_type → channel → (audience) → template`.

These are typically configured once in the dashboard by a non-engineer. Your
service only needs to publish events (step 5).

A template body uses `{{ variable }}` placeholders, resolved from the event
`payload`. Variables a template marks as **required** must be present in the
payload or the event is dead-lettered (never silently dropped).

---

## 5. Publish an event

This is the only call your service makes at runtime. It is **asynchronous** —
you get `202 Accepted` immediately; you are not blocked on delivery.

**To an audience:**

```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 7e3f…unique-per-logical-event' \
  -d '{
    "event_type": "user.welcome",
    "audience_id": "aud_…",
    "payload": { "name": "Ada" }
  }'
```

**To a single subscriber** (direct target — use `subscriber_external_id`, your id):

```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{
    "event_type": "password.reset",
    "subscriber_external_id": "user-42",
    "payload": { "reset_link": "https://app.example.com/r/abc" }
  }'
```

Response (`202 Accepted`):

```json
{ "data": { "id": "evt_…", "status": "received", "accepted": true } }
```

Provide **exactly one** of `audience_id` or `subscriber_external_id`.

### Idempotency

Send an `Idempotency-Key` header (any unique string per logical event — e.g. a
hash of "user-42 + welcome"). If the same key is published again, Communiqué
returns the original event and dispatches **exactly once**. This makes retries
from your side safe.

### What "202 Accepted" means

The event is **queued**, not delivered. Do not show your user "sent" — the work
happens asynchronously through the dispatch pipeline. To observe the outcome,
poll the event or the notification log (below), or just trust the platform's
retries + dead-letter handling.

---

## 6. Check delivery status

Fetch a single event's processing status:

```bash
curl http://localhost:4000/api/v1/events/evt_… -H "Authorization: Bearer $KEY"
# status: received | processing | dispatched | failed | dead
```

Query the **notification log** (every dispatch attempt) filtered however you like:

```bash
curl "http://localhost:4000/api/v1/notification-log?subscriber_id=sub_…&status=success&channel=email" \
  -H "Authorization: Bearer $KEY"
```

---

## Error handling

Every error is a **flat** JSON object:

```json
{ "errorCode": 1001, "errorMessage": "External id is required.", "type": "validation_error", "field": "external_id" }
```

Switch on the numeric `errorCode`, never the message text:

| `errorCode` | Meaning                            | Typical action                            |
| ----------- | ---------------------------------- | ----------------------------------------- |
| 1001        | Validation (one field at a time)   | Fix `field`, resubmit                     |
| 1002        | Missing / invalid API key          | Check your `Authorization` header         |
| 1003        | Forbidden (wrong workspace)        | You're using the wrong key                |
| 1004        | Not found                          | Check the id                              |
| 1005        | Conflict (duplicate / state)       | Resource already exists                   |
| 1006        | Unprocessable (e.g. missing vars)  | Fix the payload/template                  |
| 1007        | Rate limited                       | Back off; honour `Retry-After`            |
| 1008        | Upstream/provider failure          | Transient — safe to retry                 |
| 1009        | Internal error                     | Retry; if persistent, contact the admin   |

> **Validation is single-field:** if several fields are invalid, you get the
> first one. Fix it and resubmit to see the next. The offending field is in
> `field`.

---

## Reliability guarantees

- **At-least-once**: an accepted event is persisted with its outbox row in one
  transaction before `202` is returned — it will be processed even if the queue
  hiccups.
- **Exactly-once dispatch**: deduped on `(workspace, idempotency_key)` and on
  `(event, subscriber, channel)`.
- **Automatic retries**: transient provider failures fall back to the next
  provider, then retry with exponential backoff.
- **Nothing is lost silently**: events that fail validation or exhaust retries
  land in the dead-letter queue, where an admin can inspect and replay them.
