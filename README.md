# Campaign Wiki

Campaign Wiki is a transcript-first tabletop RPG knowledge system. It keeps raw sources, AI proposals, GM rulings, structured canon, wiki projections, FAQ answers, errata and public publishing separate so generated text cannot launder itself into evidence.

This repository currently ships a local, file-backed Next.js implementation plus Supabase/Postgres migrations for the production data model. The manual workflow works without AI credentials or cloud services.

## Local Startup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env.local
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`, choose `Seed demo`, then explore the dashboard.

The local app persists data to `data/campaign-wiki.json` by default. That file is ignored by git because live campaign data should not be committed to a public repository.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
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
