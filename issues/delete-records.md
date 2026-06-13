# Delete Records — DELETE /api/records

## Summary

Bulk-delete one or more records by UUID in a single request.

## Acceptance Criteria

- **Route:** `DELETE /api/records`
- **Auth:** required (Bearer token)
- **Content-Type header:** `application/json` required

### Request body

```json
{
  "data": {
    "attributes": {
      "uuids": ["<uuid1>", "<uuid2>"]
    }
  }
}
```

`uuids` is required. Sending a request without it returns `422` (see [attribute-validation.md](attribute-validation.md)).

### Successful response — `200 OK`

```json
{
  "meta": {
    "deleted": 2
  }
}
```

`deleted` is the count of UUIDs supplied in the request (not a count of records that actually existed).

### Behavior

- All deletes are performed concurrently
- Deleting a UUID that does not exist is not an error — it is silently ignored
- `deleted` always reflects the number of UUIDs in the request, regardless of whether they existed

## Notes

- There is no batch size limit enforced in the current implementation
- Single-record deletion is done via this bulk endpoint — just pass an array of one UUID
