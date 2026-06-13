# Bearer Token Authentication

## Summary

Every API endpoint requires a valid bearer token. Requests missing or supplying an invalid token must be rejected with a 401 before any business logic runs.

## Acceptance Criteria

- All `/api/records` endpoints require an `Authorization` header
- The header must be in the form `Authorization: Bearer <token>`
- The token is validated against the `API_TOKEN` environment variable
- A missing header, a header that does not start with `Bearer `, or a token that does not match `API_TOKEN` all return:
  ```json
  {
    "data": {
      "errors": [
        {
          "status": "401",
          "title": "Unauthorized",
          "detail": "A valid API token is required."
        }
      ]
    }
  }
  ```
  with HTTP status `401`
- Auth is checked after method/content-type validation but before any body parsing or business logic

## Notes

- There is a single shared token for all callers — no per-user auth
- `API_TOKEN` must be set as an environment variable; see `.env.sample`
