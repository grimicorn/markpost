# JSON API Response Format

## Summary

All API responses follow the [JSON API specification](https://jsonapi.org). Implement the response envelope and the record serializer used by every endpoint.

## Acceptance Criteria

### Response envelope

- All responses have `Content-Type: application/json`
- The body is always a JSON object

### Record serializer

A single record is serialized as:

```json
{
  "type": "records",
  "id": "<uuid>",
  "attributes": {
    "uuid": "<uuid>",
    "createdAt": "<iso8601>",
    "title": "<title>",
    "content": "<content>"
  },
  "links": {
    "self": "/api/records/<uuid>"
  }
}
```

- When a record is not found, the serializer returns `null` (the `data` key will be `null`)

### List response shape

```json
{
  "data": [ /* array of serialized records */ ],
  "meta": {
    "total": 42,
    "pageCount": 1,
    "page": 1,
    "size": 100
  },
  "links": {
    "first": "/api/records?page[number]=1&page[size]=100",
    "last":  "/api/records?page[number]=1&page[size]=100",
    "prev":  null,
    "next":  null
  }
}
```

### Single-record response shape

```json
{
  "data": { /* serialized record or null */ }
}
```

### Create response shape

Same as single-record, with HTTP status `201`.

### Delete response shape

```json
{
  "meta": {
    "deleted": 3
  }
}
```

## Notes

- `prev` and `next` in list links are `null` when there is no previous/next page (not omitted)
- The `attributes` object on a record includes all four fields including `uuid` and `createdAt` (they are not hoisted out)
