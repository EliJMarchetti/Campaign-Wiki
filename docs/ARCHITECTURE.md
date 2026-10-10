# Architecture

Campaign Wiki is built around an explicit hierarchy:

```text
organization -> world -> setting -> campaign
organization -> reference library
```

Every source, claim, FAQ, ruling, erratum, generated output and article projection has a home scope: `world`, `setting`, `campaign` or `library`. A campaign resolves readable canon from its own campaign, its selected setting, its world and explicitly attached libraries. Sibling campaigns are never part of that resolution unless content is intentionally promoted or shared.

## Runtime Modes

The repository contains two persistence layers:

- `supabase/migrations`: production Postgres schema, constraints and RLS policy baseline.
- `src/lib/store.ts`: local file-backed repository used by the runnable app and tests, requiring no cloud credentials.

The local repository is intentionally not a mock UI store: it persists imported sources, normalized blocks, claims, rulings, articles, jobs and prompt packets to disk. This keeps the no-credentials manual workflow executable while the Supabase schema remains the deployment target.

## Evidence Boundary

Authoritative evidence can come from raw sources, human-created source revisions and signed rulings. Generated summaries, answers, recaps and wiki prose are saved only as generated outputs. Import validation rejects generated output IDs as evidence anchors.

## Processing Stages

Processing is split into durable jobs:

1. Parse and normalize imports.
2. Classify transcript spans.
3. Extract entity/event/claim proposals.
4. Resolve entity candidates.
5. Reconcile conflicts and errata.
6. Draft recaps.
7. Regenerate article projections after approval.

Each job records prompt version, provider, status, source IDs and errors. Local jobs are stored in the same file-backed state; production should map them to pgmq or an equivalent Postgres-backed queue.

## Authorization

Authorization is enforced in service functions and expressed as RLS in the migrations. The UI also offers view-as-player and view-as-public previews, but data filtering happens before search results, article projections, prompt exports and source excerpts are returned.
