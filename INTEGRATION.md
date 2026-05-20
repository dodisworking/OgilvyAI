# TimTheMan / OgilvyAI — Integration handover

This is everything another app (or another Claude session) needs to display
approved time off and holidays from TimTheMan.

---

## TL;DR

You poll two GET endpoints, send a bearer token, render the results. The
feed updates as soon as a request is approved, edited, or rejected in
TimTheMan — there's no webhook to wire up.

| Endpoint | Returns |
|---|---|
| `GET /api/integrations/v1/approved-time-off` | Approved time-off (and optionally WFH) entries |
| `GET /api/integrations/v1/holidays` | US federal holidays for a year/range |
| `POST /api/integrations/v1/verify-password` | Verify a user's email + password; returns profile |
| `GET /api/integrations/v1/users` | Full user roster (for mirroring/SSO) |

Base URL: **`https://ogilvyai-production.up.railway.app`**

Auth: bearer token in `INTEGRATION_API_KEY` env var.

GitHub: **`https://github.com/dodisworking/OgilvyAI`** (branch `main`).

Hosted on: **Railway** project `confident-forgiveness`, service `OgilvyAI`.

---

## One-time setup (you only need to do this once)

1. Open the Railway project: <https://railway.com/project/21204f32-7aa9-40b6-a5aa-9e38a116ea84>
2. Pick the `OgilvyAI` service → **Variables** tab.
3. Add a new variable:
   - **Name**: `INTEGRATION_API_KEY`
   - **Value**: any long random string (e.g. `openssl rand -hex 32`).
4. (Optional) Add `INTEGRATION_ALLOWED_ORIGIN` set to your consumer's exact
   origin (e.g. `https://your-dashboard.example.com`) to lock down CORS.
   Default is `*` which is fine while you're testing.
5. Railway will auto-redeploy. Give the same `INTEGRATION_API_KEY` value to
   the consumer app as **its** env var — never check it into git.

Until step 3 is done, both endpoints return `401 Server missing
INTEGRATION_API_KEY env var`. That's intentional, so the endpoints are
inert by default.

---

## Endpoint 1 — Approved time off

```
GET /api/integrations/v1/approved-time-off
Authorization: Bearer <INTEGRATION_API_KEY>
```

### Query parameters (all optional)

| Param | Type | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Only entries whose `endDate >= from` |
| `to` | `YYYY-MM-DD` | Only entries whose `startDate <= to` |
| `since` | ISO timestamp | Only entries with `updatedAt > since` — use this for incremental polling |
| `include` | comma-list, e.g. `wfh` | Include `WFH` entries too (default is time-off only) |

### Response

```json
{
  "generatedAt": "2026-05-19T18:21:04.123Z",
  "count": 2,
  "entries": [
    {
      "id": "ckxyz123_0",
      "requestId": "ckxyz123",
      "batchId": "b_lwz3o_a4f2",
      "batchLabel": "Long weekend",
      "userName": "Jane Doe",
      "userEmail": "jane.doe@ogilvy.com",
      "title": "Family wedding",
      "reason": null,
      "type": "TIME_OFF",
      "startDate": "2026-05-22",
      "endDate": "2026-05-26",
      "allDay": true,
      "updatedAt": "2026-05-15T14:02:11.000Z"
    }
  ]
}
```

**Field notes**

- `id` is a stable per-range identifier (`{requestId}_{rangeIndex}`). Use it
  as your primary key when upserting.
- `requestId` is the underlying TimTheMan request row. Multiple `entries`
  may share a `requestId` if the request mixes TIME_OFF and WFH days.
- `batchId` is non-null when the user submitted multiple distinct time-off
  blocks together. All entries from the same batch share this id.
- `startDate` / `endDate` are local dates, **inclusive both sides**.
  Treat the event as all-day. If you build an iCal-style range, the
  exclusive `DTEND` is `endDate + 1 day`.
- `updatedAt` reflects the last DB write on the underlying request. Cancels,
  edits, and re-approvals all bump it.

### Incremental polling pattern

```ts
let cursor = localStorage.getItem('timtheman.since') || ''
const res = await fetch(
  `${BASE}/api/integrations/v1/approved-time-off${cursor ? `?since=${cursor}` : ''}`,
  { headers: { Authorization: `Bearer ${API_KEY}` } }
)
const data = await res.json()
upsert(data.entries)            // your local store, keyed by entry.id
localStorage.setItem('timtheman.since', data.generatedAt) // for next poll
```

A 1- to 5-minute poll is plenty — approvals aren't a high-frequency event.
**There's no soft-delete signal in the feed yet:** if a request is rejected
or deleted after being approved, the entry simply stops appearing in a
no-`since` query. If you need hard cancellation signals (e.g. to drop a
specific calendar entry), open a follow-up issue and we'll add a
`removed` array to the response.

---

## Endpoint 2 — Holidays

```
GET /api/integrations/v1/holidays?year=2026
Authorization: Bearer <INTEGRATION_API_KEY>
```

### Query parameters

| Param | Type | Description |
|---|---|---|
| `year` | int | Default: current year |
| `from` | `YYYY-MM-DD` | If set with `to`, returns holidays across the range |
| `to` | `YYYY-MM-DD` | Pair with `from` for range queries |

### Response

```json
{
  "generatedAt": "2026-05-19T18:21:04.123Z",
  "source": "us-federal-computed",
  "count": 11,
  "holidays": [
    {
      "id": "us-2026-0",
      "name": "New Year's Day",
      "date": "2026-01-01",
      "observed": "2026-01-01",
      "source": "us-federal"
    }
  ]
}
```

These are computed server-side — no DB read, no admin curation. If you need
a different country / company-specific dates, swap to your own holiday
provider on the consumer side and ignore this endpoint.

`date` is the actual holiday; `observed` is the workday it lands on
(Saturday holidays observe Friday, Sunday holidays observe Monday).

---

## Endpoint 3 — Verify password (SSO credential check)

```
POST /api/integrations/v1/verify-password
Authorization: Bearer <INTEGRATION_API_KEY>
Content-Type: application/json

{ "email": "jane@ogilvy.com", "password": "<plaintext-from-your-server>" }
```

Used by another internal app (Mel / WPPP Mission Control) so it doesn't
have to keep its own password database — TimTheMan is the source of truth
for Ogilvy NYC production-team credentials.

This endpoint always returns **HTTP 200** for credential outcomes — the
`ok` flag tells you whether the password was valid. Only infra failures
return 5xx, so your UI can cleanly distinguish "wrong password" from
"the auth service is down."

### Success — `200`

```json
{
  "ok": true,
  "user": {
    "id": "ttm_user_abc123",
    "email": "jane@ogilvy.com",
    "name": "Jane Producer",
    "title": null,
    "role": "producer",
    "active": true,
    "imageUrl": "https://.../avatar.png"
  }
}
```

### Failure — `200` with `ok: false`

```json
{ "ok": false, "reason": "invalid_credentials" }
```

| `reason` | When |
|---|---|
| `invalid_credentials` | Email matched but password didn't |
| `user_not_found` | No user row with that email |
| `user_inactive` | (Reserved — not used today; all users are active) |
| `rate_limited` | More than 5 requests/min from the same IP |

### Notes

- Passwords are checked with bcrypt `compare` (timing-safe).
- The hash never leaves the server.
- Rate limit is 5 requests/min/IP, in-memory sliding window. Resets across
  deploys, which is fine — Mel only retries on user-driven submits.
- Every attempt is logged (success + failure + email + IP) for audit.
- `role` is the lowercased TimTheMan account type — see "Role mapping" below.

---

## Endpoint 4 — Users list (roster mirror)

```
GET /api/integrations/v1/users
GET /api/integrations/v1/users?active=true
Authorization: Bearer <INTEGRATION_API_KEY>
```

Used by Mel/WPPP MI to mirror the full user roster on a ~15-min cron, so it
has a `users.timTheManId` column it can join against without round-tripping
to TimTheMan on every page load.

### Response

```json
{
  "generatedAt": "2026-05-19T18:21:04.123Z",
  "count": 38,
  "users": [
    {
      "id": "ttm_user_abc123",
      "email": "jane@ogilvy.com",
      "name": "Jane Producer",
      "title": null,
      "role": "producer",
      "active": true,
      "imageUrl": "https://.../avatar.png"
    }
  ]
}
```

`?active=true` is accepted but currently a no-op — TimTheMan doesn't track
an inactive flag yet. Every user is returned with `active: true`.

---

## Role mapping

TimTheMan stores a single `accountType` enum per user. The `role` field in
both `verify-password` and `users` is the lowercased enum value:

| TimTheMan `role` (raw) | Maps cleanly to Mel? |
|---|---|
| `producer` | `producer` |
| `creative` | (no direct match — Mel may want to drop these from its crew) |
| `client` | `account` (the "account/PA submitter" role on Mel) |
| `other` | unknown — Mel-side decides |

TimTheMan does **not** yet model `pa`, `ap`, `sp`, `ep`, `gep`, or
`flight_director` separately. If Mel needs finer-grained roles, we have a
few options (in order of effort): keep the mapping client-side, add a
`title` text column on TimTheMan that Mel reads, or migrate to a real
roles enum. Ping Isaac and we'll pick one.

---

## User self-serve signup

Not exposed. If Mel sees a user log in with an email TimTheMan doesn't
have, route them to a friendly "ask Tim to add you to TimTheMan" page.
Tim can add the user via the existing TimTheMan signup flow or admin UI.

---

## CORS

The endpoints respond to `OPTIONS` preflight and send these headers:

```
Access-Control-Allow-Origin: <INTEGRATION_ALLOWED_ORIGIN env, or *>
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization, X-API-Key, Content-Type
```

Browser-side fetches from your dashboard origin will work as long as
`INTEGRATION_ALLOWED_ORIGIN` is either `*` or your exact origin.

---

## Authentication alternatives

Pick whichever the consumer finds easiest:

```http
Authorization: Bearer <INTEGRATION_API_KEY>
```
```http
X-API-Key: <INTEGRATION_API_KEY>
```
```
?apiKey=<INTEGRATION_API_KEY>   # least preferred — shows up in server logs
```

---

## Example minimal client (TypeScript)

```ts
const BASE = 'https://ogilvyai-production.up.railway.app'
const KEY = process.env.TIMTHEMAN_API_KEY!

export async function fetchApprovedTimeOff(opts: {
  from?: string
  to?: string
  since?: string
  includeWfh?: boolean
} = {}) {
  const qs = new URLSearchParams()
  if (opts.from) qs.set('from', opts.from)
  if (opts.to) qs.set('to', opts.to)
  if (opts.since) qs.set('since', opts.since)
  if (opts.includeWfh) qs.set('include', 'wfh')
  const url = `${BASE}/api/integrations/v1/approved-time-off${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error(`TimTheMan API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<{
    generatedAt: string
    count: number
    entries: Array<{
      id: string
      requestId: string
      batchId: string | null
      batchLabel: string | null
      userName: string
      userEmail: string
      title: string | null
      reason: string | null
      type: 'TIME_OFF' | 'WFH'
      startDate: string
      endDate: string
      allDay: true
      updatedAt: string
    }>
  }>
}

export async function fetchHolidays(year = new Date().getFullYear()) {
  const res = await fetch(
    `${BASE}/api/integrations/v1/holidays?year=${year}`,
    { headers: { Authorization: `Bearer ${KEY}` } }
  )
  if (!res.ok) throw new Error(`TimTheMan holidays API ${res.status}`)
  return res.json() as Promise<{
    generatedAt: string
    source: string
    count: number
    holidays: Array<{ id: string; name: string; date: string; observed: string; source: string }>
  }>
}
```

---

## Smoke test (curl)

```bash
curl -fsS "https://ogilvyai-production.up.railway.app/api/integrations/v1/approved-time-off" \
  -H "Authorization: Bearer $TIMTHEMAN_API_KEY" | jq

curl -fsS "https://ogilvyai-production.up.railway.app/api/integrations/v1/holidays?year=2026" \
  -H "Authorization: Bearer $TIMTHEMAN_API_KEY" | jq

curl -fsS -X POST \
  -H "Authorization: Bearer $TIMTHEMAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@ogilvy.com","password":"correct"}' \
  "https://ogilvyai-production.up.railway.app/api/integrations/v1/verify-password" | jq

curl -fsS "https://ogilvyai-production.up.railway.app/api/integrations/v1/users" \
  -H "Authorization: Bearer $TIMTHEMAN_API_KEY" | jq
```

---

## When things go wrong

| Status | Body | Meaning |
|---|---|---|
| 401 | `Server missing INTEGRATION_API_KEY env var` | Set the env var on Railway. The endpoints stay inert until you do. |
| 401 | `Missing API key` | No `Authorization`, `X-API-Key`, or `?apiKey`. |
| 401 | `Invalid API key` | The key you sent doesn't match the Railway env var. |
| 400 | `Invalid \`since\` timestamp` | `since` must be an ISO date-time. |
| 500 | `Failed to load approved time off` | DB blip — retry. Logs in Railway → OgilvyAI → Deployments → View logs. |

---

## Where to file changes / asks

- New fields, removal signals, webhook support, non-US holidays, etc. →
  open an issue on the GitHub repo (`dodisworking/OgilvyAI`) or just tell
  the TimTheMan Claude session.
- The implementation lives in:
  - [`app/api/integrations/v1/approved-time-off/route.ts`](app/api/integrations/v1/approved-time-off/route.ts)
  - [`app/api/integrations/v1/holidays/route.ts`](app/api/integrations/v1/holidays/route.ts)

Schema for what's read (Prisma): see `Request` in
[`prisma/schema.prisma`](prisma/schema.prisma) — relevant columns are
`status`, `startDate`, `endDate`, `dayBreakdown`, `requestType`, `title`,
`reason`, `batchId`, `batchLabel`, `updatedAt`, and the joined `user.name`
/ `user.email`.
