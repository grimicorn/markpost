# Markpost

A content aggregation service for syncing and storing records from across the internet.

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

See `.env.example` for descriptions of each variable and where to obtain them.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

Push the schema to Neon (useful for initial setup):

```bash
npm run db:push
```

Generate a migration from schema changes:

```bash
npm run db:generate
```

Apply pending migrations:

```bash
npm run db:migrate
```

Open Drizzle Studio (visual database browser):

```bash
npm run db:studio
```

| Table     | Description                                               |
| --------- | --------------------------------------------------------- |
| `records` | Content records with uuid, title, content, and created_at |

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the `@clerk/nuxt` module. Server middleware at `server/middleware/auth.ts` verifies the session on every request and makes the user available at `event.context.userId` in API route handlers.

## Development

Start the dev server at `http://localhost:3000`:

```bash
npm run dev
```

## Testing

Run unit tests in watch mode:

```bash
npm test
```

Run once (CI mode):

```bash
npm run test:ci
```

Run end-to-end tests (requires `.env.e2e`):

```bash
npm run e2e
```

The suite signs in using Clerk's test-email flow. A dedicated test user is provisioned automatically via the Clerk Backend API (using `NUXT_CLERK_SECRET_KEY`), so no separate Clerk account or credentials are needed.

## Postman

API requests live in `postman/` in Postman's multi-file (Git-integrated) format. Each request, environment, and the workspace globals is a separate YAML file under `postman/collections/`, `postman/environments/`, and `postman/globals/`. This is the format the [Postman VS Code extension](https://marketplace.visualstudio.com/items?itemName=Postman.postman-for-vscode) reads directly — it is **not** a single `.postman_collection.json` file that the desktop app's **File → Import** dialog can open.

### Opening the collection

Use the [Postman VS Code extension](https://marketplace.visualstudio.com/items?itemName=Postman.postman-for-vscode):

1. Install the **Postman** extension in VS Code and sign in.
2. Open this repository as a folder in VS Code.
3. In the Postman panel, the `api` collection under `postman/collections/api/` is detected automatically. Pick the `Local` or `Production` environment (from `postman/environments/`) and send requests.

The `apiToken` workspace global lives in `postman/globals/workspace.globals.yaml`.

### Variables

The collection uses bearer token auth via the `{{apiToken}}` workspace global. Two environments are included — `Local` and `Production` — that control `baseUrl`:

| Variable   | Location          | Description                                                                                                                                                                                                                             |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`  | Environment       | Base URL for the API (`http://localhost:3000` for Local; production URL for Production)                                                                                                                                                 |
| `apiToken` | Workspace globals | Clerk session JWT sent in `Authorization: Bearer <token>` — obtain from [Clerk Dashboard](https://dashboard.clerk.com) → your user → **Sessions** → copy the session access token, or retrieve it in-app via `await session.getToken()` |

Fill in `apiToken` in your workspace globals directly in your Postman client (it is intentionally left blank in the repo). The value is validated server-side by `clerkClient.verifyToken()` in `server/middleware/auth.ts` — it must be a valid Clerk-issued JWT, not the server secret key.

> **Note:** The Production environment's `baseUrl` is currently a placeholder (`https://markpost.example.com`). Update it to the actual deployed URL once known.

## Linting

Check for issues:

```bash
npm run lint
```

Auto-fix:

```bash
npm run lint:fix
```

## Build & Preview

```bash
npm run build
npm run preview
```

## Deployment

The app deploys to Netlify automatically on push to `main`. CI runs lint and unit tests before the build. E2e tests run as a separate job after CI passes.

Required repository secrets (Settings → Secrets → Actions):

- `E2E_DATABASE_URL`
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NUXT_CLERK_SECRET_KEY`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
