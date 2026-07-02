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

| Table           | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `records`       | Content records with uuid, title, content, and created_at           |
| `subscriptions` | One row per user tracking plan, status, trial dates, and Stripe IDs |

## Billing and subscriptions

Billing is handled via [Stripe](https://stripe.com). The integration consists of three API routes under `/api/billing/`:

| Route                   | Method | Auth                    | Description                                                                                                                                                                                                                                           |
| ----------------------- | ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/billing/checkout` | POST   | Clerk / API token       | Creates a Stripe Checkout session for upgrading to Pro. Returns `{ data: { url } }` — redirect the user to this URL.                                                                                                                                  |
| `/api/billing/portal`   | POST   | Clerk / API token       | Creates a Stripe Customer Portal session for managing an existing subscription. Returns `{ data: { url } }`. Requires the user to have an existing Stripe customer ID (i.e. they have completed at least one Checkout session).                       |
| `/api/billing/webhook`  | POST   | None (Stripe signature) | Receives Stripe lifecycle events (`customer.subscription.created/updated/deleted`, `checkout.session.completed`) and updates the local `subscriptions` table. The Stripe-Signature header is verified on every request using `STRIPE_WEBHOOK_SECRET`. |
| `/api/billing/usage`    | GET    | Clerk / API token       | Returns the number of records synced this month and the number of connected sources.                                                                                                                                                                  |

### Required environment variables

| Variable                     | Description                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`          | Stripe secret key (from [Dashboard → API Keys](https://dashboard.stripe.com/apikeys)). Server-only.                           |
| `STRIPE_WEBHOOK_SECRET`      | Webhook signing secret (from [Dashboard → Webhooks → your endpoint → Signing secret](https://dashboard.stripe.com/webhooks)). |
| `STRIPE_PRO_PRICE_ID`        | Stripe price ID for the monthly Pro plan.                                                                                     |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe price ID for the annual Pro plan (optional; falls back to monthly).                                                    |

### Setting up the Stripe webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks) and add an endpoint pointing to `https://your-domain.com/api/billing/webhook`.
2. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

For local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

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

## Security scanning

A deterministic scanner layer guards against committed secrets and vulnerable dependencies, both locally and in CI.

### Secret scanning ([gitleaks](https://github.com/gitleaks/gitleaks))

Rules live in [`.gitleaks.toml`](.gitleaks.toml), which extends the default gitleaks ruleset with checks for Clerk secret keys (`sk_live_`/`sk_test_`) and credentialed Postgres connection strings. Publishable Clerk keys (`pk_*`) are public by design and are not flagged.

- **Locally:** the `.husky/pre-commit` hook scans staged changes and blocks the commit on any finding. Install gitleaks first ([instructions](https://github.com/gitleaks/gitleaks#installing)); if it is not installed, the hook prints a warning and lets the commit through.
- **Run a manual staged scan:**

  ```bash
  gitleaks git --staged --redact --verbose --config .gitleaks.toml
  ```

- **In CI:** the `secret-scan` job in [`.github/workflows/security.yml`](.github/workflows/security.yml) downloads the pinned gitleaks binary, scans the PR commit range on pull requests, and scans full history on push to `main`. It fails the check on any finding.

### Dependency scanning

- **In CI:** the `dependency-audit` job in [`.github/workflows/security.yml`](.github/workflows/security.yml) runs `npm audit`. It fails only on **high** or **critical** advisories and prints moderate/low advisories as a summary.
- **Automated updates:** [`.github/dependabot.yml`](.github/dependabot.yml) opens weekly PRs against `main`, grouping minor and patch bumps into a single PR.

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
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID` (optional)
