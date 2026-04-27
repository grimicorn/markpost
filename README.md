# sync.danholloran.me

Allows for syncing content from all over the internet to one shared place.

## Development

**Prerequisites:** [Netlify CLI](https://docs.netlify.com/cli/get-started/) and Node.js.

```bash
npm install
npm run dev        # starts local dev server via netlify dev
```

The local server runs at `http://localhost:8888`. Functions are available at `/api/*`.

**Environment variables** (set in Netlify dashboard or a local `.env` file):

| Variable    | Description                           |
| ----------- | ------------------------------------- |
| `API_TOKEN` | Bearer token required on all requests |

## Testing

```bash
npm run test       # watch mode
npm run test:ci    # single run (used in CI)
npm run test:ui    # browser UI for test results
```

Tests live in `tests/` and mirror the `src/` structure. Each function and lib has a corresponding test file.

**Linting:**

```bash
npm run lint       # check
npm run lint:fix   # auto-fix
```

## Postman

The Postman collection lives in `postman/` and is structured for use with the [Postman VS Code extension](https://marketplace.visualstudio.com/items?itemName=Postman.postman-for-vscode) or the Postman desktop app.

**Setup:**

1. Import the `postman/` directory into Postman
2. Select the **Local** environment
3. Set the `baseUrl` variable to `http://localhost:8888`
4. Set the `apiToken` variable to match your `API_TOKEN` env var

The collection uses a Bearer Token auth (via `{{apiToken}}`) applied at the collection level, so all requests inherit it automatically.

## API

All endpoints follow the [JSON API spec](https://jsonapi.org). Requests that include a body must set `Content-Type: application/vnd.api+json`. All endpoints require a `Authorization: Bearer <token>` header.

### Records

#### List records

```
GET /api/records
```

**Query parameters:**

| Parameter      | Default | Description             |
| -------------- | ------- | ----------------------- |
| `page[number]` | `1`     | Page number (1-indexed) |
| `page[size]`   | `100`   | Records per page        |

**Response `200`:**

```json
{
  "data": [
    {
      "type": "records",
      "id": "uuid",
      "attributes": {
        "uuid": "uuid",
        "createdAt": "2026-04-11T00:00:00.000Z",
        "title": "My title",
        "content": "My content"
      },
      "links": { "self": "/api/records/uuid" }
    }
  ],
  "meta": {
    "total": 42,
    "pageCount": 1,
    "page": 1,
    "size": 100
  },
  "links": {
    "first": "/api/records?page[number]=1&page[size]=100",
    "last": "/api/records?page[number]=1&page[size]=100",
    "prev": null,
    "next": null
  }
}
```

---

#### Get a record

```
GET /api/records/:uuid
```

**Response `200`:**

```json
{
  "data": {
    "type": "records",
    "id": "uuid",
    "attributes": {
      "uuid": "uuid",
      "createdAt": "2026-04-11T00:00:00.000Z",
      "title": "My title",
      "content": "My content"
    },
    "links": { "self": "/api/records/uuid" }
  }
}
```

---

#### Create a record

```
POST /api/records
Content-Type: application/vnd.api+json
```

**Body:**

```json
{
  "data": {
    "type": "records",
    "attributes": {
      "title": "My title",
      "content": "My content"
    }
  }
}
```

**Response `201`:** same shape as Get a record.

---

#### Delete records

```
DELETE /api/records
Content-Type: application/vnd.api+json
```

**Body:**

```json
{
  "data": {
    "type": "records",
    "attributes": {
      "uuids": ["uuid-1", "uuid-2"]
    }
  }
}
```

**Response `200`:**

```json
{
  "meta": {
    "deleted": 2
  }
}
```
