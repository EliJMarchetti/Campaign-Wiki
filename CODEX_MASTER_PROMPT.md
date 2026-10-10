# Campaign Wiki — Full-Application Codex Build Directive

**Target repository:** `https://github.com/EliJMarchetti/Campaign-Wiki.git`

**Your role:** You are the principal engineer, technical lead, database designer, security reviewer, and product engineer. Build an actual, running, maintainable transcript-to-wiki application. This is an implementation request, not a request for an architecture essay, an illustrative mockup, or merely a project scaffold.

## Mission and product outcome

Build **Campaign Wiki**, a searchable, shareable, AI-assisted knowledge system for tabletop RPG groups. A Game Master (GM) can import long session transcripts produced by *external* transcription services, paste or upload GM notes and lore documents, classify and correct speech, extract evidence-grounded events and facts, approve canonical changes, detect contradictions, issue errata, answer campaign FAQs, and automatically create/update wiki articles. Support multiple campaigns, optionally sharing a world and setting, without leaking secrets or treating divergent campaign histories as shared truth.

An eight-hour session, potentially split across multiple transcription files, must work. The app is **transcript-first**: DO NOT implement microphone capture or your own transcription engine in this first release. Audio may be attached to a session as optional evidence and linked to transcript timestamps, but the core system must work entirely with text and structured transcript imports.

Do not make completion contingent on a paid AI API, production hosting, or microphone hardware. The manual review/editing/wiki workflow must work without an AI key. With an API key, the same workflow supports automated *proposals*, not unreviewed canon.

## Absolute nonnegotiable principles

1. **Source/evidence and generated outputs are separate.** Raw transcripts, human-created GM notes, approved source revisions, and explicit GM rulings can establish evidence. AI-created summaries, answers, FAQ drafts, and wiki prose cannot become independent evidence in subsequent AI runs. Generating text does not establish truth. Human promotion of a generated draft must create a new, attributable GM-signed source/ruling, with its own provenance and an explicit UI confirmation.
2. **GM authority is the highest authority within that GM's campaign, but is context dependent.** A GM speaking in character, hypothesizing, quoting a book, or joking is not necessarily establishing world truth. A campaign GM cannot silently rewrite shared world canon; only authorized world/setting editors can promote revisions at those scopes.
3. **Claims have a provenance, scope, epistemic status, review status, authority, and visibility.** These are different concepts and must not be represented as one `is_canon` boolean.
4. **Cross-campaign sharing is opt-in and scoped.** A campaign inherits explicitly linked shared knowledge but does not automatically export its own events or GM-only information to sibling campaigns.
5. **GM edits and errata are append-only historical decisions.** Supersede and regenerate; never destroy originals. Re-ingesting older evidence must not resurrect superseded canon.
6. **Search and AI answers obey permissions before retrieval.** Avoid spoiler leaks through search ranking, result snippets, aliases, embeddings, FAQ drafts, public URLs, backlinks, logs, or caches.
7. **Real software over demos.** No fake buttons or imaginary end-to-end success. Simulated providers are permitted for tests and demos, clearly labeled; manual mode must be usable with real imports.
8. **Keep things maintainable.** Prefer typed, ordinary application services with small AI stages and SQL constraints to an opaque framework of autonomous agents.

## Engineering workflow for this run

The repository may be empty. Inspect it first and use the existing project if present; otherwise initialize it. Create a root `AGENTS.md`, a living checklist `docs/IMPLEMENTATION_STATUS.md`, architectural decision records, a database schema document, and a test plan. Then **implement**, not merely plan. Work sequentially in independently runnable vertical slices, finishing, testing, and committing each before moving to the next. Attempt all requested product areas within the available execution window; do not declare a feature complete unless its acceptance test passes.

When constrained by time, context, tooling, or API credentials, prefer a smaller fully functional slice over a large nonfunctional scaffold. Leave clear, accurate remaining-work notes and runnable code. Do not make unapproved purchases, initiate production deployment, add external secrets, or claim live integrations have been tested unless they really have.

### Preferred stack

- Next.js App Router, React, TypeScript (current stable compatible releases).
- Tailwind CSS, shadcn/ui, Lucide icons, accessible components.
- Supabase: PostgreSQL, Auth, Storage, Row Level Security (RLS), and pgmq-backed queue or a proven compatible database-backed job runner.
- Typed server-side validation with Zod and SQL constraints; use SQL migrations under `supabase/migrations` as the single source of schema truth. Type generation where appropriate.
- Postgres full-text search and `pg_trgm` first. Add `pgvector` as an optional enhancement when embeddings are configured; the whole application must remain searchable with no embeddings key.
- OpenAI Responses API with Structured Outputs for optional classification, claim extraction, entity matching proposals, answer drafting, and article drafting. Abstract provider, model, and prompt versions; never hardcode a model that may be discontinued. Detect refusals/incomplete results and verify cited source anchors independently. Implement an offline `generate prompt package -> import structured AI result` option.
- Testing: Vitest (units), SQL/RLS tests, integration tests, Playwright E2E. GitHub Actions for lint, types, unit, and build checks; integration CI may use local Supabase if feasible.
- Dev: documented npm/pnpm scripts and local Supabase CLI workflow; deploy: Next.js Node server and separate long-running queue worker (e.g., Railway) with Supabase cloud. Avoid adding Redis, multiple ORMs, or needless infrastructure.
- Docs/text parsing: TXT, Markdown, JSON transcripts, SRT, VTT, DOCX, PDF with supported server-side parsers. Validate file types/size. Scanned-PDF OCR can be an explicit future enhancement; do not pretend plain text parsing handles images.

Prefer simple reliable code; explain any deviation in `docs/ARCHITECTURE.md`.

## 1. Knowledge-space hierarchy: multi-world, multi-setting, multi-campaign

Design the domain *before* implementing article tables:

```
Organization / Workspace
  ├── World (shared geography, cosmology, history, pantheon)
  │     ├── Setting (era, alternate timeline, continuity, variant)
  │     │     ├── Campaign A (GM, characters, sessions, local canon)
  │     │     └── Campaign B (different party/history/local canon)
  │     └── Another setting (divergent continuity)
  └── Reference Library (rules, templates, non-canonical guides)
```

A world may contain many settings; a setting many campaigns. Campaigns must be able to have NO shared world (independent settings). Reference libraries are explicit attachments, not automatic canon.

Every source, entity, assertion, FAQ, ruling, erratum, and article has a **home scope**: `world`, `setting`, `campaign`, or `library`. Content also has a specific scope ID. Use stable UUIDs. Ensure referential integrity and prevent impossible cross-world relationships unless an explicit link is established.

**Inheritance:** On a campaign page/search, resolve only (a) its own canon, (b) the selected setting's approved facts, (c) approved world facts, and (d) explicitly attached reference materials with their proper non-canon classification. Use campaign-specific overrides as local variants; never silently delete shared facts. If an apparent conflict arises, display an override/contradiction case, and distinguish changed history from an actual error. A campaign may fork a setting continuity, and the fork retains a recorded lineage/snapshot/version; changes to upstream shared canon should not silently rewrite an intentional fork.

**Sharing:** Campaign events are **not** promoted upward by default. Include GM/editor workflow to propose a claim or source for promotion from campaign → setting or setting → world. Require the destination-scope editor's approval, log provenance, and show impacts on inheriting campaigns. Allow explicit sharing of documents or world notes across compatible campaigns, with per-scope access grants and read-only imports; retain source identity rather than making uncontrolled copies.

**Entity identity:** A person/place can have a shared world ID and scope-local variants, aliases, current states, hidden identities, and time-dependent relationships. Do not merge same-named entities from unrelated settings by default. For the same shared person across campaigns, inherited identity does NOT mean the person's campaign-specific experiences or knowledge are identical.

**FAQ:** Each campaign has its own FAQs; settings and worlds may have FAQs too. Campaign FAQ may cite inherited lore while keeping campaign-only knowledge private. Player questions in Campaign A must not retrieve private or unrelated Campaign B information.

Implement this with explicit scope-resolution services and scope-aware authorization. Add tests for cross-world isolation, campaign variants, promotion, and different setting timelines.

## 2. User accounts, permissions, and spoiler safety

Implement sign-in/invite workflow and memberships for workspace/world/setting/campaign. Roles: owner, world editor, setting editor, GM, co-GM, player, invited reader, optional anonymous public reader.

Visibility: `gm_private`, `campaign_members`, `shared_authorized`, `public` with scope-specific grants. Never infer that a world reader may access sibling campaigns. Deny by default. Restrict source text, audio attachments, snippets, canonical claims, embeddings, article content, and AI prompts separately as needed. GM-private transcripts remain private by default. Prevent insecure direct object references and bypass through API routes. Add RLS policies plus server-side service checks, and automated allow/deny tests for every sensitive table. Service-role secrets never in client bundles. A public repository must contain **no API keys, personal recordings, authentic private transcripts, or session secrets**.

Provide a GM preview 'View as player' and 'View as public', with server-side impersonation-safe filtering (not just CSS hiding).

## 3. Imports: first-class text-based ingestion

Implement polished upload/paste wizards with large-document support, progress, metadata, validation and helpful parsing errors. Formats:

- Plain TXT; Markdown; pasted rich/plain text; DOCX; text PDFs.
- JSON transcript formats with speaker labels and utterance times, with provider-adapter architecture.
- SRT / WebVTT subtitle transcripts; common structured transcript exports.
- Human notes, GM sourcebooks, world/setting bibles, campaign rules, FAQ seed notes, adventure outlines, timelines, errata documents.

Imported sources must be classified at import time, with editable default role/authority, home scope, spoiler visibility, language, date, source title, author, and version. A GM-authored finalized lore document is different from a player's notes or an unplayed adventure outline. A generated AI recap may be stored as an output artifact, NOT accepted as an authoritative input unless a GM explicitly reauthors/adjudicates it.

Allow upload of one transcript or **multiple transcripts for one session**. For the particular user workflow, expect a primary table recording and a separate GM phone recording, which might be transcribed separately. Each transcript is a separate source with its own timestamp basis, start offset, channel/speaker hints, and confidence. Provide manual relative offset alignment and transcript-view comparison. These are corroborating accounts of the *same* session; do not double-count repeated facts or invent that two slightly different transcripts are two different events. Optional associated original audio can be uploaded or linked for timestamped playback, but transcription itself is out of scope.

For un-timestamped long text, create stable paragraph/character anchors and cite them; never fabricate timestamps. For timestamped transcript imports preserve utterance IDs and start/end times. Save exact original file bytes, content hash (SHA-256), source version, normalized text, speaker labels and extraction offsets. Use chunking + overlaps for long sessions with deterministic boundaries. Preserve source-to-chunk mappings and an import/reprocess capability. Detect duplicate file uploads by hash and ask whether to attach an existing source instead.

Provide a speaker roster: speaker → player → character(s), GM/OOC/GM-as-NPC roles. A user can fix speaker labels and text without editing the immutable original; store corrected overlay/version and preserve the prior version.

## 4. AI pipeline and offline/manual prompt packages

Create clear stages, each persisted as a versioned processing job with prompt version, model, input source IDs, schema version, costs/tokens if available, status, errors, and retry behavior:

1. Parse and normalize imports.
2. Classify transcript spans (GM ruling, GM narration, GM-as-NPC, in-character lie, player declaration, resolved action, player theory, joke, off-topic, hypothetical, unplayed preparation, rules talk, unknown). Multiple tags and spans allowed. Low-confidence cases remain pending. Human GM tags override proposals.
3. Extract session timeline, event proposals, entity and alias proposals, relationship proposals, and atomic claim proposals; each carries exact source anchors, excerpts, status and confidence.
4. Resolve candidate entities against campaign + inherited setting/world and authorized libraries using name/alias + lexical similarity first, optional vectors; ambiguous matches enter review. No automatic uncertain merges.
5. Reconcile with existing accepted claims, locate conflicts or genuine status changes, and propose errata/FAQ follow-ups. Consider timeline and unreliable witnesses before calling something contradictory.
6. Generate a session recap draft *from supporting evidence*, with citations. Draft remains output.
7. After GM acceptance, regenerate affected wiki article sections, indexes, links, timelines, related FAQs, and changelog, without regurgitating old wiki output as evidence.

Expose two execution paths:

**A. `Run AI analysis`**: Server-side OpenAI provider, if credentials exist. Use Structured Outputs / strict validation, bounded inputs, source-anchor validation, retries, per-job cost/token caps, and an approval gate. Never allow an AI response to execute arbitrary code or SQL. Treat transcript text and imported docs as untrusted content even when they contain text that looks like instructions.

**B. `Export Prompt Package`**: Without an API key, package only authorized and relevant source excerpts/structured canon into a Markdown/JSON task bundle for human paste into an external model. Export task-specific prompt types: session-classification, entity-and-fact extraction, contradiction review, FAQ revision, article update, and full-rebuild. Include expected output JSON schema, stable IDs/anchors, authority and spoiler rules, scope IDs, and provenance requirements. Provide `Import AI Response` with schema and evidence validation and a normal GM review queue. Reject unknown claim IDs, fabricated citation anchors, unrelated scope references and invalid JSON. Show exactly what will be sent outside the app and require an explicit privacy confirmation.

Generate task prompts intelligently: when a new session touches only three NPCs, re-evaluate those NPCs and related FAQs, not every article in the universe. Provide a button `Review effects of Session N` with a preview of candidate wiki pages, FAQs, errata and contradictions. Provide `Re-run from stage` rather than rerunning all stages on every edit.

Ensure all stages are idempotent. A retry or double click must not duplicate entities, events, claims, pages, or job effects. The GM can edit/reject extracted proposals before committing.

## 5. Source authority, epistemic truth, canon ledger

Implement normalized, queryable assertions—not just summaries. Every assertion carries: subject entity, predicate, typed value/object entity, world/campaign effective time (when applicable), scope, claimed-by, source anchors, supporting evidence, authority class, epistemic class, review state, canon state, visibility, revision/supersession links, and publication impact dependencies.

Example classes: objective GM world narration, explicit GM ruling, successfully resolved event, GM-approved setting doc, NPC testimony, player report, rumor, inference, speculation, joke, off-topic, planned future content, unclear. GM-authored correction takes highest precedence *within the jurisdiction it governs*. GM speaking as a deceitful NPC proves that NPC made a statement; does not prove its content. "I stab the king" is an attempt until outcome is established. A historical date may refer to construction vs reconstruction; avoid fake conflicts.

Claims can be `proposed`, `accepted`, `contested`, `superseded`, `rejected`, `historical`, `unresolved`. Separately store whether true in world, believed by a character, or intentionally unknowable to players. Preserve an audit ledger; never hard-delete evidence or accepted claim history.

**Promotion of scope:** An approved campaign claim may be proposed for world/setting promotion, but do not elevate authority or expose secrets through a simple `scope_id` update. Copy or reference a new signed destination ruling with full provenance; require permission and explicit approval.

**No model-output laundering:** The extraction pipeline can use a previously approved *structured* claim to discover a possible related issue, but any factual wiki sentence must be traceable to source evidence and a canon decision. Previously generated text never counts as additional corroboration. Test this.

## 6. GM review desk, contradiction resolution, errata and FAQ

Create real connected screens:

- Review queue with candidate facts, entities, speaker flags, jokes, proposed changes, source excerpts, citations, accepted/rejected reason, bulk low-risk approvals.
- Contradiction cases with both sides' evidence, timeline and scope, suggested interpretations, affected wiki pages; resolve by ruling, temporal distinction, mistaken identity, NPC deception, retcon, transcript error, or unresolved. Never resolve automatically when meaningful.
- Errata ledger with distinct correction types: transcription, speaker assignment, entity matching, extracted fact, official canon retcon, rule clarification, purely editorial page fix. Corrections retain old/new value, author, reason, timestamp, scope, effective date, approval, visibility and dependent-page regeneration.
- FAQ manager, for every scope, with question, alternate phrasings, drafts, approved answers, source evidence, linked contradiction/ruling, visibility, history, GM author and statuses `open`, `drafted`, `needs_ruling`, `answered`, `superseded`, `archived`.

After a new session, find FAQ entries touched by changed people/events/rules. Propose an amended answer, preserving unresolved questions and previous approved answers. Clicking `Review FAQ updates` should show a before/after diff and evidence. If an approved FAQ establishes new facts, create a separate signed source/ruling: the FAQ article itself is not source evidence.

Support direct questions from players to the GM as submissions; GM may approve public response or keep private. Player question does not establish canon.

## 7. Searchable, polished wiki and Q&A

Provide an excellent browser UI with campaign/world/setting switcher and obvious scope breadcrumbs. Main navigation: Home, Worlds & Settings, Campaigns, Sessions, Sources, Encyclopedia, Timeline, Relations, Search, FAQ, Errata, GM Review, Settings.

Wiki page types: NPC, PC, place, faction, deity, creature, artifact, item, event, quest, rule, session, lore. Render clean pages with infobox, aliases, relationships, first appearance, last appearance, campaign references, timeline, citations to evidence (timestamp links if present), approved errata, changelog and backlinks. Distinguish inherited shared-world details from local campaign additions or overrides with subtle provenance labels.

Build full-text/fuzzy global search plus scope filters, source-type filters, speaker/date/session filter, canon status and entity class. Semantic similarity can be optional, not required. Results and counts must be authorization-safe. Natural-language `Ask the Codex` should be evidence-grounded with citations, return `unknown` when the record lacks support, differentiate competing accounts, and be available in manual-prompt export mode if no AI provider key exists. No uncited claims in AI answers. Keep secrets out of retrieval before the model sees context.

Generated wiki articles are **materialized projections**, never primary evidence. A regeneration should be deterministic as far as structured facts allow and preserve permitted custom editorial prose separately. Support targeted regeneration, version history, article diffs, and a `Rebuild wiki from canonical ledger` admin action. Rebuilding from authoritative source + structured ledger must not require any previous generated prose.

Sharing: invite members, read-only viewer role, per-scope permissions, private by default, opt-in public/unlisted publishing and deep links. Show clear spoiler levels. Public URLs may never bypass access checks. Add exported Markdown/JSON/ZIP backups with full provenance and selectable inclusion/exclusion of private sources; exports need authorization.

UI feel: an elegant, modern scholarly fantasy reference with fast search and readable long articles, not an overdecorated game menu. Accessible responsive layout, light/dark mode, keyboard-friendly review forms, useful empty states, processing status, no nonfunctional controls.

## 8. Data model and migrations

At minimum create/consider tables for: users/profiles, organizations, memberships, worlds, settings, setting_forks, campaigns, scope_grants, reference_libraries, library_attachments, participants, characters, sessions, sources, source_versions, source_files, normalized_blocks, transcript_utterances, speaker_mappings, transcript_corrections, span_annotations, processing_runs, jobs, extraction_proposals, entities, aliases, scoped_entity_versions, claims, claim_evidence, canon_rulings, contradiction_cases, errata, faqs, faq_versions, article_projections, article_revisions, relationships, timeline_events, audit_events, generated_outputs, publication_grants, and AI_prompt_packets.

This list is not a demand for gratuitous tables; normalize enough to enforce source/output separation and scope boundaries. Document a clear ERD and migrations. Require durable stable IDs, FK constraints, unique constraints, indexed scope and status fields, sensible storage of text and structured JSON, RLS policies and typed API/service functions. Use DB transactions for GM-approval + claim revisions + downstream enqueue operations where practical.

## 9. Security, scalability, and operations

Do not send huge transcripts in a single AI request. Use deterministic chunks, overlap, deduplicated evidence, stage-specific retrieval, and progressive reconciliation. Handle 8-hour / 100k+ word transcripts without timing out web requests or storing massive payloads in a single database row. Jobs live in a durable queue with retry/backoff, dead-letter/failed state and explicit progress. Workers should be separable from web serving. AI budget cap per import/campaign, estimated cost preview and cancellation. Validate uploads and sanitize Markdown/HTML and PDFs/docx extraction. Prevent stored XSS, CSRF, privilege escalation, SSRF from arbitrary URLs, and prompt injection from imported materials. Implement structured logs without disclosing private source text. Test concurrent retries and idempotency.

Create `.env.example`, `.gitignore`, `README.md`, setup instructions, a starter seed, local Docker/Supabase instructions, a deploy guide, export/import procedures and production backup notes. Make clear that the repository is public and live private campaign data belongs in private database/storage, not Git history.

## 10. Deliver implementation in verifiable vertical slices

Complete the following in sequence. Each slice must leave a runnable program; mark honestly what was built versus simulated.

**Slice 1 — Full foundation and scope hierarchy:** App, styling, Supabase migrations, Auth/invites/roles, world/setting/campaign creation and selection, correct RLS, seed demo.

**Slice 2 — Real source archive:** Upload/paste TXT/MD/JSON/SRT/VTT/DOCX/text-PDF, document roles and permissions, huge transcript segmentation, multiple transcript tracks per session, speaker mapping and corrections, source viewer with citation anchors.

**Slice 3 — Canon management without AI:** Manual entity creation, structured claim ledger, source linking, inherited canon resolution, GM review, scope promotion/forks/overrides, basic encyclopedia projection, search.

**Slice 4 — AI pipeline and offline prompt export/import:** Typed prompt stages, provider integration, prompt package generator, validated JSON import, processing queue, extraction proposals and recap drafts.

**Slice 5 — Conflict/errata/FAQ:** Real contradiction workflows, immutable rulings/retcons, FAQ review and update suggestions, downstream dependency propagation.

**Slice 6 — Sharing and product polish:** Role-safe public and member pages, wiki links, history, search/Q&A, exports, responsive UX, production-ready configurations and test coverage.

Implement the most difficult domain invariants before decorative charts or maps. Don't stop after Slice 1 if there is time to implement more. If a slice is blocked by unavailable credentials, implement working local/manual behavior and mock the external provider behind a typed interface, document the exact production integration gap, then continue other slices.

## 11. Mandatory regression and end-to-end fixtures

Create a realistic demo seed involving:

- World `Aetherion` and shared world lore.
- Setting `Imperial Era` and setting `Fallen Empire` with intentionally incompatible political timelines.
- Campaign `Silver Lanterns` in the Imperial Era, with a GM and three to five players.
- Campaign `Ashen Road` in the same world/setting, with a different party and private events.
- Campaign `The Last Dynasty` in the Fallen Empire.
- A standalone unrelated world and campaign to prove isolation.
- Session transcript in which an NPC lies, the GM jokes, a player speculates, a player fails an action, an official GM ruling is made, a city changes hands in only one campaign, and the GM corrects a date later.
- One optional parallel GM transcript with an offset to demonstrate the same session from two audio sources.

Automated assertions must prove:

1. Raw upload persists; import normalization preserves source anchors, speaker info and timestamps where available.
2. Speaker attribution can be corrected without modifying the original.
3. A joke, speculation, NPC lie, and attempted but failed action do not become objective world canon.
4. An explicit GM ruling overrides contradictory player speculation locally without changing world canon.
5. Two campaigns inherit approved world geography but **not each other's private histories, secrets or rulings**.
6. Two different settings can represent different histories of the same world without being treated as mistakes.
7. World/setting promotion requires an authorized editor and leaves provenance.
8. An erratum supersedes an accepted claim, updates affected articles and FAQ drafts, and survives full regeneration.
9. Duplicate import/job retry does not duplicate claims or pages.
10. A fabricated statement in a generated article cannot be imported as factual support during the next run or full rebuild.
11. An unapproved FAQ draft is not an authoritative ruling.
12. Search, autocomplete, backlinks, generated answers, counts and public pages never expose GM-only facts or another campaign's private data.
13. A real manual workflow works with **no OPENAI_API_KEY**: import, edit, manually create claims, approve, publish, search, FAQ, errata, export.
14. Provider mock workflow runs automatically and ends in reviewable **real database** proposals, not hardcoded UI cards.
15. Documentation explains how to run, test, seed, and deploy the application. No undocumented dead-end buttons.

Use unit, database RLS, integration and Playwright UI tests where appropriate. Run lint, type checking, tests and a production build. Fix failures and report remaining limitations truthfully.

## 12. Definition of done and final handoff

A clean clone plus documented local services can launch the app. A GM can sign in, create a world and two settings, create several campaigns, attach a shared world document, import a real long-form transcript, tag jokes/GM rulings, produce a set of source-cited proposed claims through an AI key or prompt packet, approve the claims, produce and browse wiki articles, search them, review a contradiction, publish a GM erratum, revise an FAQ, and verify that an unrelated campaign cannot see private information. Automated tests verify the no-output-feedback rule and cross-campaign isolation.

Final response from Codex must state (a) real files and functionality completed, (b) commands actually run and their results, (c) what requires credentials or manual provider setup, (d) what remains incomplete, (e) any security risks, and (f) the exact next local startup steps. Do not claim production-ready or full completion unless the test-backed acceptance conditions are satisfied. Do not merge or deploy without user permission.

**Start now: inspect the repository; initialize it if empty; establish the actual schema and executable vertical slices; implement and test as much of this complete product as possible.**
