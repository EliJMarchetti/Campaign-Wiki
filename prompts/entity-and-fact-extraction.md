# Entity and Fact Extraction Prompt

Extract reviewable proposals from authorized source excerpts.

Return JSON only. Each proposal must include:

- `kind`: `entity`, `claim`, `relationship`, `timeline_event` or `faq_update`.
- `scope`: one of the supplied scope IDs.
- `evidence`: source anchors from the package.
- `confidence`: number from 0 to 1.
- `why`: brief human-readable explanation.

Never cite generated article text, generated recap text or unapproved FAQ drafts as evidence.
