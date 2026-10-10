import type { EvidenceRef, ExtractionProposal, Id, NormalizedBlock, ProcessingRun, WikiState } from "../types";
import { newId, nowIso } from "../id";

export function createMockAnalysis(state: WikiState, processingRun: ProcessingRun, sourceIds: Id[]): ExtractionProposal[] {
  const blocks = state.normalizedBlocks.filter((block) => sourceIds.includes(block.sourceId));
  const proposals: ExtractionProposal[] = [];
  const seenEntities = new Set<string>();
  for (const block of blocks) {
    const evidence: EvidenceRef[] = [
      {
        sourceId: block.sourceId,
        sourceVersionId: block.sourceVersionId,
        anchorStart: block.stableAnchor,
        anchorEnd: block.stableAnchor,
        excerpt: block.text.slice(0, 500)
      }
    ];
    for (const name of guessNames(block.text)) {
      if (seenEntities.has(name)) continue;
      seenEntities.add(name);
      proposals.push({
        id: newId(),
        processingRunId: processingRun.id,
        kind: "entity",
        payload: { name, entityType: name.match(/city|gate|road|empire/i) ? "place" : "npc" },
        evidence,
        confidence: 0.74,
        status: "pending",
        createdAt: nowIso()
      });
    }
    const ruling = block.text.match(/GM RULING[:-]\s*(.+)$/i) ?? block.text.match(/official ruling[:-]\s*(.+)$/i);
    if (ruling) {
      proposals.push({
        id: newId(),
        processingRunId: processingRun.id,
        kind: "claim",
        payload: {
          entityName: "Campaign Rulings",
          entityType: "rule",
          predicate: "ruling",
          valueText: ruling[1].trim(),
          authorityClass: "explicit_gm_ruling",
          epistemicClass: "world_true"
        },
        evidence,
        confidence: 0.9,
        status: "pending",
        createdAt: nowIso()
      });
    }
  }
  return proposals;
}

export function classifyBlocks(blocks: NormalizedBlock[]): Array<{
  anchorStart: string;
  anchorEnd: string;
  tags: string[];
  confidence: number;
  notes: string;
}> {
  return blocks.map((block) => {
    const lower = block.text.toLowerCase();
    const tags: string[] = [];
    if (lower.includes("gm ruling") || lower.includes("official ruling")) tags.push("gm_ruling");
    if (lower.includes("just kidding") || lower.includes("joke")) tags.push("joke");
    if (lower.includes("i think") || lower.includes("maybe") || lower.includes("theory")) tags.push("player_theory");
    if (lower.includes("lies") || lower.includes("lying") || lower.includes("as the npc")) tags.push("gm_as_npc");
    if (lower.includes("try to") || lower.includes("attempt")) tags.push("player_declaration");
    if (tags.length === 0) tags.push("unknown");
    return {
      anchorStart: block.stableAnchor,
      anchorEnd: block.stableAnchor,
      tags,
      confidence: tags.includes("unknown") ? 0.4 : 0.8,
      notes: "Deterministic local classifier"
    };
  });
}

function guessNames(text: string): string[] {
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) ?? [];
  return [...new Set(matches.filter((name) => !["GM", "RULING", "The", "Session"].includes(name)))].slice(0, 4);
}
