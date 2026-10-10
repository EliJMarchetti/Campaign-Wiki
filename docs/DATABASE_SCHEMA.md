# Database Schema Notes

The production schema is defined in `supabase/migrations/202610090001_initial_campaign_wiki.sql`.

Important design choices:

- Scope is modeled by `home_scope_type` plus one of `world_id`, `setting_id`, `campaign_id` or `library_id`.
- Claims split `authority_class`, `epistemic_class`, `review_state`, `canon_state` and `visibility`; there is no `is_canon` shortcut.
- `claim_evidence` can reference source anchors and signed rulings. Generated outputs are intentionally not a valid evidence target.
- `canon_rulings`, `errata` and `audit_events` are append-only.
- `article_projections` are materialized outputs derived from accepted claims and signed editorial text, never evidence.
- RLS policies deny by default and grant reads through organization membership, scope-specific grants and visibility.

The local JSON state in `src/lib/types.ts` mirrors these entities closely enough for integration tests and manual operation.
