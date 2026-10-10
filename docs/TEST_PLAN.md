# Test Plan

Automated tests cover the required domain invariants with local persistent services:

- Source import preserves raw text, utterances and stable anchors.
- Speaker corrections create overlays and never modify original transcript text.
- Joke, speculation, NPC lie and failed action annotations do not become objective canon.
- GM rulings override local speculation without rewriting shared world canon.
- Sibling campaigns cannot read each other's private events, search snippets, FAQ drafts or generated answers.
- Incompatible settings under one world resolve as alternate timelines, not contradictions.
- Promotion requires destination-scope authority and creates a signed ruling.
- Errata supersede claims and updates article projections.
- Duplicate imports and retrying jobs are idempotent.
- Generated wiki prose cannot be cited as evidence on later runs.
- Manual no-API-key workflow completes import -> claim -> approval -> article -> search -> FAQ -> errata -> export.

Browser smoke tests verify that the first screen is a working application, not a landing page.
