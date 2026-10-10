# Implementation Status

Last updated: 2026-10-09.

## Slice Status

| Slice | Status | Evidence |
| --- | --- | --- |
| 1. Foundation and scope hierarchy | Implemented locally; Supabase schema drafted | Next.js app, file-backed repository, scope services, memberships, demo seed, Postgres/RLS migration |
| 2. Source archive | Implemented for paste/TXT/MD/JSON/SRT/VTT plus built-in best-effort DOCX/text-PDF extraction; scanned PDF OCR remains future work | Import wizard, normalized blocks, transcript utterances, tracks, speaker corrections |
| 3. Canon management without AI | Implemented | Entities, structured claims, claim evidence, rulings, promotion, inheritance, search, article projections |
| 4. AI pipeline and prompt packages | Implemented for mock provider, prompt export/import and OpenAI adapter boundary; live OpenAI not exercised without credentials | Prompt packets, validation, jobs, proposals |
| 5. Conflict/errata/FAQ | Partially implemented | Errata ledger, contradiction cases, FAQ manager, FAQ drafts; advanced automatic dependency propagation remains limited |
| 6. Sharing and polish | Partially implemented | Role-safe filtering, view-as previews, exports, responsive UI; production Supabase auth wiring and public hosting are not complete |

## Acceptance Requirements

| Requirement | Status |
| --- | --- |
| Raw upload persists and preserves anchors/timestamps | Covered by tests |
| Speaker attribution correction preserves original | Covered by tests |
| Joke/speculation/NPC lie/failed action do not become objective world canon | Covered by tests |
| GM ruling overrides local speculation only | Covered by tests |
| Sibling campaign isolation | Covered by tests |
| Different setting timelines are not treated as mistakes | Covered by tests |
| Promotion requires authorized editor and provenance | Covered by tests |
| Erratum supersedes claims and updates articles | Covered by tests |
| Duplicate import/retry idempotency | Covered by tests |
| Generated article cannot become evidence | Covered by tests |
| Unapproved FAQ draft is not a ruling | Covered by tests |
| Search/counts/public pages hide GM-only facts | Covered by tests |
| Manual no-key workflow works | Covered by tests and UI |
| Mock provider creates real DB proposals | Covered by tests and UI |
| Docs explain run/test/deploy | Present |

## Known Gaps

- Supabase Auth UI and cloud deployment are documented but not wired to a live Supabase project in this local run.
- DOCX parsing is best-effort for normal Word document text. PDF parsing is best-effort for text PDFs with literal text; scanned PDF OCR is intentionally future work.
- Queue processing is durable in the local repository but not yet mapped to pgmq.
- Playwright smoke tests are included but were not run in this pass; the sandboxed HTTP probe timed out even while the attached Next dev server reported ready.

## Latest Verification

- `npm run verify` passed on 2026-10-09: lint, typecheck, 14 Vitest tests and production build.
- `npm audit` passed with 0 known vulnerabilities after replacing vulnerable parser and lint dependencies.
