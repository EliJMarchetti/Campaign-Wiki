import { describe, expect, it } from "vitest";
import { rebuildCampaignArticles } from "../src/lib/articles";
import { seedDemoState } from "../src/lib/fixtures";
import { newId, nowIso } from "../src/lib/id";
import { readableClaimsForCampaign } from "../src/lib/permissions";
import { searchCampaign } from "../src/lib/search";
import { exportBackup, importAiResponse, importSource, promoteClaim, applyErratum, correctSpeaker, createAcceptedClaim, upsertEntity } from "../src/lib/workflows";
import type { Source, WikiState } from "../src/lib/types";

function fixture() {
  const state = seedDemoState();
  const silver = state.campaigns.find((campaign) => campaign.name === "Silver Lanterns")!;
  const ashen = state.campaigns.find((campaign) => campaign.name === "Ashen Road")!;
  const dynasty = state.campaigns.find((campaign) => campaign.name === "The Last Dynasty")!;
  const gm = state.profiles.find((profile) => profile.displayName === "Mira Vale")!;
  const rowan = state.profiles.find((profile) => profile.displayName === "Rowan")!;
  const aetherion = state.worlds.find((world) => world.name === "Aetherion")!;
  return { state, silver, ashen, dynasty, gm, rowan, aetherion };
}

describe("Campaign Wiki domain invariants", () => {
  it("keeps sibling campaign secrets out of claims, search and exports", () => {
    const { state, silver, rowan } = fixture();
    const viewer = { profileId: rowan.id, mode: "player" as const, campaignId: silver.id };
    const claims = readableClaimsForCampaign(state, viewer, silver.id);
    expect(claims.some((claim) => claim.valueText?.includes("Ash Vault"))).toBe(false);
    expect(searchCampaign(state, viewer, silver.id, "Ash Vault")).toHaveLength(0);
    const backup = exportBackup(state, viewer, silver.id);
    expect(JSON.stringify(backup)).not.toContain("Ash Vault");
  });

  it("inherits authorized world geography without leaking sibling private history", () => {
    const { state, silver, rowan } = fixture();
    const viewer = { profileId: rowan.id, mode: "player" as const, campaignId: silver.id };
    const claims = readableClaimsForCampaign(state, viewer, silver.id);
    expect(claims.some((claim) => claim.valueText?.includes("Moon Gate stands north"))).toBe(true);
    expect(claims.some((claim) => claim.valueText?.includes("hidden route"))).toBe(false);
  });

  it("does not convert jokes, speculation, NPC lies or failed attempts into objective canon", () => {
    const { state, silver, gm } = fixture();
    const claims = readableClaimsForCampaign(state, { profileId: gm.id, mode: "gm", campaignId: silver.id }, silver.id);
    const text = claims.map((claim) => claim.valueText).join("\n");
    expect(text).not.toContain("cheese");
    expect(text).not.toContain("burned the treaty");
    expect(text).not.toContain("king remains dead");
    const tags = state.spanAnnotations.flatMap((annotation) => annotation.tags);
    expect(tags).toContain("joke");
    expect(tags).toContain("player_theory");
    expect(tags).toContain("player_declaration");
  });

  it("keeps GM rulings local until explicit authorized promotion", () => {
    const { state, silver, rowan, gm, aetherion } = fixture();
    const localClaim = state.claims.find((claim) => claim.valueText?.includes("Lantern Compact"))!;
    expect(localClaim.homeScope).toBe("campaign");
    const denied = promoteClaim(state, { profileId: rowan.id, mode: "player", campaignId: silver.id }, localClaim.id, "world", aetherion.id, "Player asked for global canon.");
    expect(denied.error).toMatch(/not authorized/i);
    const promoted = promoteClaim(state, { profileId: gm.id, mode: "gm", campaignId: silver.id }, localClaim.id, "world", aetherion.id, "World editor approved.");
    expect(promoted.error).toBeUndefined();
    expect(promoted.promotedClaim?.homeScope).toBe("world");
    expect(promoted.state.canonRulings.some((ruling) => ruling.rulingText.includes(localClaim.id))).toBe(true);
  });

  it("treats different setting timelines as intentional variants", () => {
    const { state, silver, dynasty, gm } = fixture();
    const silverClaims = readableClaimsForCampaign(state, { profileId: gm.id, mode: "gm", campaignId: silver.id }, silver.id);
    const dynastyClaims = readableClaimsForCampaign(state, { profileId: gm.id, mode: "gm", campaignId: dynasty.id }, dynasty.id);
    expect(silverClaims.some((claim) => claim.valueText?.includes("Senate still claims"))).toBe(true);
    expect(dynastyClaims.some((claim) => claim.valueText?.includes("Senate collapsed"))).toBe(true);
    expect(state.contradictionCases).toHaveLength(0);
  });

  it("supersedes claims through errata and rebuilds article projections", () => {
    const seeded = fixture();
    let state = seeded.state;
    const { silver, gm } = seeded;
    const source = state.sources.find((item) => item.campaignId === silver.id)!;
    const block = state.normalizedBlocks.find((item) => item.sourceId === source.id && item.text.includes("archive date"))!;
    const entityResult = upsertEntity(state, {
      organizationId: silver.organizationId,
      scopeType: "campaign",
      scopeId: silver.id,
      entityType: "lore",
      name: "Archive Date",
      visibility: "campaign_members"
    });
    state = entityResult.state;
    const oldClaim = createAcceptedClaim(state, {
      organizationId: silver.organizationId,
      scopeType: "campaign",
      scopeId: silver.id,
      subjectEntityId: entityResult.entity.id,
      predicate: "date",
      valueText: "812",
      authorityClass: "explicit_gm_ruling",
      epistemicClass: "world_true",
      visibility: "campaign_members",
      evidence: [{ sourceId: source.id, sourceVersionId: block.sourceVersionId, anchorStart: block.stableAnchor, anchorEnd: block.stableAnchor, excerpt: block.text }],
      createdBy: gm.id
    });
    const result = applyErratum(oldClaim.state, {
      targetClaimId: oldClaim.claim.id,
      correctionType: "official_canon_retcon",
      newValue: "814",
      reason: "GM corrected the date.",
      signedBy: gm.id
    });
    expect(result.state.claims.find((claim) => claim.id === oldClaim.claim.id)?.canonState).toBe("superseded");
    expect(result.replacement?.valueText).toBe("814");
    expect(result.state.articleProjections.some((article) => article.bodyMarkdown.includes("814"))).toBe(true);
  });

  it("is idempotent for duplicate imports", () => {
    const { state, silver, gm } = fixture();
    const input = {
      organizationId: silver.organizationId,
      homeScope: "campaign" as const,
      campaignId: silver.id,
      sourceType: "transcript" as const,
      title: "Duplicate",
      authorityClass: "unclear" as const,
      visibility: "gm_private" as const,
      language: "en",
      originalText: "GM: One unique line.",
      fileName: "dup.txt",
      createdBy: gm.id
    };
    const once = importSource(state, input);
    const twice = importSource(once.state, input);
    expect(twice.duplicate).toBe(true);
    expect(twice.state.sources.filter((source) => source.contentHash === once.source.contentHash)).toHaveLength(1);
  });

  it("rejects generated output laundering and fabricated anchors", () => {
    const { state, silver, gm } = fixture();
    const generatedSource: Source = {
      id: newId(),
      organizationId: silver.organizationId,
      homeScope: "campaign",
      campaignId: silver.id,
      sourceType: "generated_output",
      title: "Generated Article Draft",
      authorityClass: "unclear",
      visibility: "campaign_members",
      language: "en",
      contentHash: "generated",
      createdBy: gm.id,
      createdAt: nowIso()
    };
    const generatedVersionId = newId();
    const withGenerated: WikiState = {
      ...state,
      sources: [...state.sources, generatedSource],
      sourceVersions: [...state.sourceVersions, { id: generatedVersionId, sourceId: generatedSource.id, versionNumber: 1, originalText: "Generated says false thing.", normalizedText: "Generated says false thing.", createdBy: gm.id, createdAt: nowIso() }],
      normalizedBlocks: [
        ...state.normalizedBlocks,
        { id: newId(), sourceId: generatedSource.id, sourceVersionId: generatedVersionId, stableAnchor: "p0001", ordinal: 1, blockType: "paragraph", text: "Generated says false thing." }
      ]
    };
    const response = JSON.stringify({
      proposals: [
        {
          kind: "claim",
          confidence: 0.9,
          evidence: [{ sourceId: generatedSource.id, sourceVersionId: generatedVersionId, anchorStart: "p0001", excerpt: "Generated says false thing." }],
          payload: { predicate: "false", valueText: "false" }
        }
      ]
    });
    const result = importAiResponse(withGenerated, response);
    expect(result.proposals).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/Generated outputs cannot be used/i);
  });

  it("keeps unapproved FAQ drafts from becoming rulings", () => {
    const { state } = fixture();
    const faq = state.faqs.find((item) => item.question.includes("Vel Ori"))!;
    const versions = state.faqVersions.filter((version) => version.faqId === faq.id);
    expect(versions.some((version) => version.isAuthoritativeRuling)).toBe(false);
    expect(state.canonRulings.some((ruling) => ruling.rulingText.includes(faq.question))).toBe(false);
  });

  it("speaker corrections create overlays without editing original transcript text", () => {
    const { state, silver, gm } = fixture();
    const source = state.sources.find((item) => item.campaignId === silver.id)!;
    const block = state.normalizedBlocks.find((item) => item.sourceId === source.id)!;
    const next = correctSpeaker(state, block.sourceVersionId, block.stableAnchor, "Corrected GM", "speaker label was off", gm.id);
    expect(next.normalizedBlocks.find((item) => item.id === block.id)?.speakerLabel).toBe(block.speakerLabel);
    expect(next.transcriptCorrections.at(-1)).toMatchObject({ targetAnchor: block.stableAnchor, correctedSpeaker: "Corrected GM" });
  });

  it("manual workflow works without OPENAI_API_KEY", () => {
    const { state, silver, gm } = fixture();
    const viewer = { profileId: gm.id, mode: "gm" as const, campaignId: silver.id };
    const rebuilt = rebuildCampaignArticles(state, viewer, silver.id);
    const results = searchCampaign(rebuilt, viewer, silver.id, "Vel Ori");
    expect(results.length).toBeGreaterThan(0);
    const backup = exportBackup(rebuilt, viewer, silver.id);
    expect(JSON.stringify(backup)).toContain("Vel Ori");
  });
});
