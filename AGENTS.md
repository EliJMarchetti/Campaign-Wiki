# Campaign Wiki — Persistent Codex project instructions

Read `CODEX_MASTER_PROMPT.md` for product outcomes and nonnegotiable invariants. Keep `docs/IMPLEMENTATION_STATUS.md` current and honest. Implement and test working vertical slices rather than mock-only pages. Prefer Next.js/TypeScript/Supabase/PostgreSQL and narrowly scoped AI stages; keep manual operation possible without an API key.

## Critical invariants
- Do not treat AI-generated articles, summaries, FAQ drafts, or answers as independent evidence. Structured canonical claims must cite original sources and/or signed human rulings.
- A campaign GM's explicit ruling is highest within that campaign, not automatically within a shared world or other campaigns.
- Imported GM-as-NPC statements, jokes, player guesses, and attempted actions are not automatically objective truth.
- Use explicit `world -> setting -> campaign` scoped inheritance, with local overrides/forks and editor-approved promotion only. Cross-campaign access is never implicit.
- Enforce spoiler/privacy permissions in DB queries, search, AI context retrieval, exports and public URLs. A public GitHub repo contains no private session data or keys.
- Retcon/errata is versioned; do not destroy original evidence; prevent superseded canon reappearing during reprocessing.
- User brings transcripts from external tools. Transcription and live microphone capture are not part of this release. Optional audio evidence linkage is acceptable.

## Working expectations
- Before complex changes, inspect current code/migrations and update the implementation checklist.
- Keep source ingestion, claim extraction, adjudication and wiki projection as distinct tested stages.
- Run lint, tests, typecheck and build after feature completion, and accurately report problems.
- Use small functions, typed schemas, SQL migrations, RLS tests, and stable IDs. No fake functional UI actions.
- Do not autonomously deploy, buy services, submit real data to providers, or commit secrets.
