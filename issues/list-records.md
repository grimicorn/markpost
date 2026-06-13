# List Records — GET /api/records

## Summary

Return a paginated list of all records, ordered by storage insertion order.

## Acceptance Criteria

- **Route:** `GET /api/records`
- **Auth:** required (Bearer token)
- **Content-Type header:** not required

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page[number]` | integer | `1` | 1-based page number |
| `page[size]` | integer | `100` | Number of records per page |

### Successful response — `200 OK`

```json
{
  "data": [
    {
      "type": "records",
      "id": "<uuid>",
      "attributes": { "uuid": "...", "createdAt": "...", "title": "...", "content": "..." },
      "links": { "self": "/api/records/<uuid>" }
    }
  ],
  "meta": {
    "total": 42,
    "pageCount": 3,
    "page": 1,
    "size": 20
  },
  "links": {
    "first": "/api/records?page[number]=1&page[size]=20",
    "last":  "/api/records?page[number]=3&page[size]=20",
    "prev":  null,
    "next":  "/api/records?page[number]=2&page[size]=20"
  }
}
```

### Pagination edge cases

- `pageCount` is at least `1` even when there are zero records
- `prev` is `null` when on the first page
- `next` is `null` when on the last page
- An empty store returns `data: []` with `total: 0, pageCount: 1`

## Notes

- Pagination is offset-based: all keys are fetched from storage, then sliced in application code
- `page[number]` and `page[size]` are parsed as integers with `parseInt`; no validation is done on out-of-range values in the current implementation
