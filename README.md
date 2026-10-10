# Campaign Wiki

Campaign Wiki is a transcript-first tabletop RPG knowledge system. It keeps raw sources, AI proposals, GM rulings, structured canon, wiki projections, FAQ answers, errata and public publishing separate so generated text cannot launder itself into evidence.

This repository currently ships two runnable paths:

- A static Vite/React app that loads directly in the browser, persists to `localStorage`, and is suitable for GitHub Pages demos.
- A Next.js/Supabase-shaped service layer plus Postgres migrations for the fuller production architecture.

The manual workflow works without AI credentials or cloud services.

## Local Startup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env.local
   ```

3. Start the static app:

   ```bash
   npm run dev
   ```

4. Open `http://127.0.0.1:5173`, choose `Seed Demo`, then explore the dashboard.

The static app persists data to browser `localStorage`. Export JSON backups from the Operations panel before clearing browser data. Live campaign data should not be committed to a public repository.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The default `npm run build` creates a static `dist/` build for GitHub Pages. The Next.js backend-shaped build remains available as:

```bash
npm run build:next
```

Playwright smoke tests are included but require browser binaries:

```bash
npm run test:e2e
```

## Supabase

Schema and RLS policies live under `supabase/migrations`. They mirror the domain invariants used by the local services: scope-aware access, source/output separation, immutable evidence, append-only canon decisions and promotion through signed destination rulings.

## AI Modes

- **No API key:** export a privacy-confirmed prompt package, paste it into an external model if desired, then import the structured JSON response. The import validator rejects fabricated anchors, unknown scopes and generated-output citations.
- **Mock provider:** runs deterministic local proposals into the real review queue for demos and tests.
- **OpenAI provider:** configure `OPENAI_API_KEY` and `OPENAI_MODEL`. Provider calls are isolated behind `src/lib/ai/provider.ts`, use structured JSON prompts and still require GM review before canon changes.

## Safety Defaults

- Campaign data is private unless granted.
- Search, article rendering, exports and prompt packages filter before retrieval.
- AI summaries, recaps, wiki prose and FAQ drafts are `generated_outputs`; they are never accepted as evidence unless a GM creates an explicit signed ruling/source.
- Errata supersede claims without deleting original evidence.
