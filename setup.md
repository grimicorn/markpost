# Stack Reference

A snapshot of the packages, frameworks, and services used in this repo — useful as a starting point for new projects with a similar setup.

---

## Framework

| Package | Version | Notes                                                  |
| ------- | ------- | ------------------------------------------------------ |
| `nuxt`  | ^4.0.0  | Full-stack Vue framework (Nitro server + Vue frontend) |

---

## Frontend

| Package                       | Version | Notes                       |
| ----------------------------- | ------- | --------------------------- |
| `tailwindcss`                 | ^4.3.0  | Utility-first CSS           |
| `@tailwindcss/vite`           | ^4.3.0  | Vite plugin for Tailwind v4 |
| `prettier-plugin-tailwindcss` | ^0.8.0  | Auto-sorts Tailwind classes |

**Fonts (Google Fonts):** JetBrains Mono, Newsreader

---

## Database

| Package                    | Version  | Notes                              |
| -------------------------- | -------- | ---------------------------------- |
| `drizzle-orm`              | ^0.45.2  | Type-safe ORM for Postgres         |
| `drizzle-kit`              | ^0.31.10 | CLI for migrations and schema push |
| `@neondatabase/serverless` | ^1.1.0   | Neon serverless Postgres driver    |

**Dialect:** PostgreSQL
**Service:** [Neon](https://neon.tech) — serverless Postgres with branching support

---

## Auth

| Package          | Version | Notes                                  |
| ---------------- | ------- | -------------------------------------- |
| `@clerk/nuxt`    | ^2.5.3  | Clerk Nuxt module                      |
| `@clerk/backend` | ^3.5.0  | Server-side Clerk SDK                  |
| `@clerk/testing` | ^2.0.35 | Clerk helpers for Playwright e2e tests |

**Service:** [Clerk](https://clerk.com)

---

## Error Tracking

| Package        | Version  | Notes                                    |
| -------------- | -------- | ---------------------------------------- |
| `@sentry/nuxt` | ^10.57.0 | Sentry module for Nuxt (client + server) |

**Service:** [Sentry](https://sentry.io) — error tracking, performance monitoring, session replay

---

## Testing

| Package            | Version | Notes                           |
| ------------------ | ------- | ------------------------------- |
| `vitest`           | ^4.1.5  | Unit/component test runner      |
| `@vitest/ui`       | ^4.1.5  | Browser UI for Vitest           |
| `@vue/test-utils`  | ^2.4.11 | Vue component testing utilities |
| `happy-dom`        | ^20.0.0 | DOM environment for Vitest      |
| `@playwright/test` | ^1.60.0 | End-to-end tests                |

---

## Code Quality

| Package                     | Version | Notes                                             |
| --------------------------- | ------- | ------------------------------------------------- |
| `eslint`                    | ^10.0.0 | Linter                                            |
| `eslint-plugin-vue`         | ^10.0.0 | Vue-specific lint rules                           |
| `@typescript-eslint/parser` | ^8.0.0  | TypeScript parser for ESLint                      |
| `eslint-config-prettier`    | ^10.0.0 | Disables ESLint rules that conflict with Prettier |
| `prettier`                  | ^3.0.0  | Code formatter                                    |
| `husky`                     | ^9.0.0  | Git hooks                                         |
| `fallow`                    | ^2.86.0 | Dependency auditing / lint enforcement            |

---

## Deployment

**Host:** [Netlify](https://netlify.com)
**Nitro preset:** `netlify`
**Build command:** `npm run test:ci && npm run build`
**Publish directory:** `dist`

---

## Runtime Requirement

Node.js >= 24

---

## New Project Setup Prompt

Use the prompt below to bootstrap a new project with this stack. Paste it into a fresh Claude Code session at the root of your new repo.

````
Set up a new Nuxt 4 project with the following stack. Work through each section in order and confirm each is wired up correctly before moving on.

---

### 1. Scaffold

Run `npx nuxi@latest init .` and select the defaults. Set `"engines": { "node": ">=24" }` in package.json. Create a `.nvmrc` file with `24`.

---

### 2. Install dependencies

```bash
# Runtime
npm install @clerk/nuxt @neondatabase/serverless @sentry/nuxt drizzle-orm

# Dev
npm install -D @clerk/backend @clerk/testing @eslint/js @playwright/test @tailwindcss/vite @typescript-eslint/parser @vitejs/plugin-vue @vitest/ui @vue/test-utils dotenv drizzle-kit eslint eslint-config-prettier eslint-plugin-vue fallow globals happy-dom husky prettier prettier-plugin-tailwindcss tailwindcss typescript vitest
```

---

### 3. npm scripts

Add these scripts to package.json (replacing the defaults):

```json
"scripts": {
  "dev": "TMPDIR=/tmp nuxt dev",
  "build": "nuxt build",
  "preview": "nuxt preview",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:ci": "vitest run",
  "lint": "prettier --check . && eslint . && fallow audit",
  "lint:ci": "prettier --check . && eslint . && fallow audit --base origin/${BASE_BRANCH:-main}",
  "lint:fix": "prettier --write . && eslint . --fix && fallow fix",
  "prepare": "husky",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio",
  "e2e": "playwright test",
  "e2e:headed": "playwright test --headed",
  "e2e:ui": "playwright test --ui",
  "e2e:debug": "playwright test --debug",
  "e2e:report": "playwright show-report e2e/report"
}
```

---

### 4. nuxt.config.ts

Configure Nuxt with Clerk, Sentry, Tailwind, and Netlify preset:

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  future: { compatibilityVersion: 4 },
  modules: ["@clerk/nuxt", "@sentry/nuxt/module"],
  sentry: {
    sourceMapsUploadOptions: {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },
  clerk: {
    skipServerMiddleware: true,
  },
  runtimeConfig: {
    databaseUrl: "",
  },
  devtools: { enabled: true },
  nitro: {
    preset: "netlify",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

---

### 5. Database

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Create `server/db/schema.ts` with your initial tables. Create `server/db/index.ts` that instantiates a Drizzle client using `@neondatabase/serverless` and reads the connection string from `useRuntimeConfig().databaseUrl`.

---

### 6. Auth (Clerk)

Add server middleware at `server/middleware/auth.ts` to verify the Clerk session on protected API routes. Add a `server/utils/auth.ts` helper to extract the verified user from the event.

---

### 7. Sentry

Create `sentry.client.config.ts`:

```ts
import * as Sentry from "@sentry/nuxt";

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  integrations: [Sentry.replayIntegration(), Sentry.browserTracingIntegration()],
});
```

Create `sentry.server.config.ts`:

```ts
import * as Sentry from "@sentry/nuxt";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
```

---

### 8. Tailwind CSS

Create `app/assets/css/main.css` with `@import "tailwindcss";` and reference it in `nuxt.config.ts` via the `css` array.

---

### 9. Code quality

Set up ESLint (`eslint.config.js`) with `@eslint/js`, `eslint-plugin-vue`, `@typescript-eslint/parser`, and `eslint-config-prettier`. Set up `prettier.config.js` with `prettier-plugin-tailwindcss`. Run `npm run prepare` to install Husky hooks. Add a pre-commit hook that runs `npm run lint:fix`.

---

### 10. Testing

Configure `vitest.config.ts` with `happy-dom` as the environment and `@vue/test-utils`. Configure `playwright.config.ts` to run against the dev server, output reports to `e2e/report/`, and use Chromium only. Load `.env.e2e` for e2e runs.

---

### 11. GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
        env:
          HUSKY: 0
      - run: npm run lint:ci
        env:
          BASE_BRANCH: ${{ github.event.pull_request.base.ref || 'main' }}
      - run: npm run test:ci

  e2e:
    runs-on: ubuntu-latest
    needs: ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
        env:
          HUSKY: 0
      - run: npx playwright install chromium --with-deps
      - run: npm run e2e
        env:
          E2E_DATABASE_URL: ${{ secrets.E2E_DATABASE_URL }}
          NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          NUXT_CLERK_SECRET_KEY: ${{ secrets.NUXT_CLERK_SECRET_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: e2e/report/
          retention-days: 7
```

Add the following secrets to the repo (Settings → Secrets → Actions): `E2E_DATABASE_URL`, `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NUXT_CLERK_SECRET_KEY`, and any other service secrets.

---

### 12. CodeRabbit

Create `.coderabbit.yaml` at the repo root:

```yaml
reviews:
  auto_review:
    enabled: true
    base_branches:
      - "main"
  request_changes_workflow: true
```

---

### 13. Netlify

Create `netlify.toml`:

```toml
[build]
  command = "npm run test:ci && npm run build"
  publish = "dist"
```

---

### 14. Environment files

Create `.env.example` documenting all required variables:

```
# Neon DB
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
NUXT_DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# Clerk — https://dashboard.clerk.com → API Keys
NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NUXT_CLERK_SECRET_KEY=sk_test_...

# Sentry — https://sentry.io → Settings → Projects → Client Keys (DSN)
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

Create `.env.e2e.example`:

```
# Neon branch for e2e tests
E2E_DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

Copy both to `.env` and `.env.e2e` and fill in real values. Add `.env` and `.env.e2e` to `.gitignore`.

---

### 15. README.md

Create `README.md` with the following sections. Tailor the project name, description, and table of database tables to match the app.

```markdown
# <Project Name>

<One sentence description of what the app does.>

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

\`\`\`bash
npm install
\`\`\`

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

\`\`\`bash
cp .env.example .env
\`\`\`

See `.env.example` for descriptions of each variable and where to obtain them.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

Push the schema to Neon (useful for initial setup):

\`\`\`bash
npm run db:push
\`\`\`

Generate a migration from schema changes:

\`\`\`bash
npm run db:generate
\`\`\`

Apply pending migrations:

\`\`\`bash
npm run db:migrate
\`\`\`

Open Drizzle Studio (visual database browser):

\`\`\`bash
npm run db:studio
\`\`\`

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the `@clerk/nuxt` module. Server middleware at `server/middleware/auth.ts` verifies the session on every request and makes the user available at `event.context.user` in API route handlers.

## Development

Start the dev server at `http://localhost:3000`:

\`\`\`bash
npm run dev
\`\`\`

## Testing

Run unit tests in watch mode:

\`\`\`bash
npm test
\`\`\`

Run once (CI mode):

\`\`\`bash
npm run test:ci
\`\`\`

Run end-to-end tests (requires `.env.e2e`):

\`\`\`bash
npm run e2e
\`\`\`

## Linting

Check for issues:

\`\`\`bash
npm run lint
\`\`\`

Auto-fix:

\`\`\`bash
npm run lint:fix
\`\`\`

## Build & Preview

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Deployment

The app deploys to Netlify automatically on push to `main`. CI runs lint and unit tests before the build. E2e tests run as a separate job after CI passes.

Required repository secrets (Settings → Secrets → Actions):

- `E2E_DATABASE_URL`
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NUXT_CLERK_SECRET_KEY`
- _(add any other secrets your app needs)_
```
````
