# Public API

Read access to the Arbor company corpus. Base URL: `https://<your-host>/api/v1`.

Machine-readable spec: **`GET /api/v1/openapi`** (OpenAPI 3.1, no auth).

## Authentication

Send your key as a bearer token. Keys are created in **/admin** and shown once.

```
Authorization: Bearer arbor_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are stored only as a sha256 hash, can expire, and carry **scopes**. The
companies endpoint requires the `read` scope (legacy scopeless keys retain full
access).

## Rate limits

Per-IP throttling guards key lookups; per-key quota scales with the org's plan:

| Plan       | Requests / min |
| ---------- | -------------- |
| Free       | 60             |
| Pro        | 300            |
| Enterprise | 1000           |

On `429`, honor the `Retry-After` header. Every response includes `x-request-id`
— quote it in support requests.

## Endpoints

### `GET /companies`

Companies ordered by most-recently-updated.

Query params: `sector`, `deal` (`carveout|private_asset`), `stage`
(`in_market|monitor_for_exit|on_hold|pulled`), `limit` (1–500, default 100),
`cursor` (keyset — preferred), `offset` (legacy).

```bash
curl -H "Authorization: Bearer $ARBOR_KEY" \
  "https://your-host/api/v1/companies?deal=carveout&limit=50"
```

```json
{
  "companies": [
    {
      "id": "…",
      "name": "Dow Polyurethanes",
      "sector": "chemicals",
      "dealType": "carveout",
      "stage": "in_market",
      "confidence": "high",
      "sponsorFirm": null,
      "parentCompany": "Dow Inc.",
      "revenue": "$1.2B",
      "ebitda": null,
      "updatedAt": "2026-06-07T00:00:00Z"
    }
  ],
  "total": 1084,
  "limit": 50,
  "nextCursor": "eyJ0cyI6..."
}
```

### Pagination

Prefer **keyset**: pass the previous response's `nextCursor` as `cursor` until it
is `null`.

```bash
curl -H "Authorization: Bearer $ARBOR_KEY" \
  "https://your-host/api/v1/companies?cursor=$NEXT_CURSOR"
```

## Errors

JSON `{ "error": "..." }` with status `400` (bad input), `401` (auth), `403`
(scope), `429` (rate limit), `503` (backend unconfigured), `500` (generic — the
detail is logged server-side under your `x-request-id`).

## CORS

`GET` + `OPTIONS` are allowed from any origin.
