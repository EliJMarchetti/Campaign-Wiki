import { rebuildCampaignArticles } from "./articles";
import { buildPromptPacketPayload } from "./ai/prompts";
import { classifyBlocks, createMockAnalysis } from "./ai/mock";
import { parseImportText } from "./importers";
import { newId, nowIso, sha256, stableId } from "./id";
import { canWriteScope, readableClaimsForCampaign, readableSourcesForCampaign } from "./permissions";
import { aiImportSchema } from "./schema";
import { campaignLineage, scopeFor } from "./scope";
import { cloneState } from "./state";
import type {
  AiPromptPacket,
  AuthorityClass,
  CanonRuling,
  Claim,
  Entity,
  Erratum,
  EvidenceRef,
  ExtractionProposal,
  Faq,
  FaqVersion,
  Id,
  ImportSourceInput,
  ProcessingRun,
  ScopeType,
  Source,
  SourceVersion,
  SpanAnnotation,
  Viewer,
  Visibility,
  WikiState
} from "./types";

export function audit(state: WikiState, organizationId: Id, eventType: string, targetType: string, targetId?: Id, actorProfileId?: Id, details: Record<string, unknown> = {}): void {
  state.auditEvents.push({
    id: newId(),
    organizationId,
    actorProfileId,
    eventType,
    targetType,
    targetId,
    details,
    createdAt: nowIso()
  });
}

export function importSource(state: WikiState, input: ImportSourceInput): { state: WikiState; source: Source; duplicate: boolean; warnings: string[] } {
  const next = cloneState(state);
  const contentHash = sha256(input.originalText);
  const duplicate = next.sources.find(
    (source) =>
      source.contentHash === contentHash &&
      source.organizationId === input.organizationId &&
      source.homeScope === input.homeScope &&
      source.worldId === input.worldId &&
      source.settingId === input.settingId &&
      source.campaignId === input.campaignId &&
      source.libraryId === input.libraryId
  );
  if (duplicate) return { state: next, source: duplicate, duplicate: true, warnings: ["Duplicate source detected by SHA-256 hash. Existing source was reused."] };

  const parsed = parseImportText(input.originalText, input.fileName ?? `${input.title}.txt`);
  const sourceId = newId();
  const sourceVersionId = newId();
  const source: Source = {
    id: sourceId,
    organizationId: input.organizationId,
    homeScope: input.homeScope,
    worldId: input.worldId,
    settingId: input.settingId,
    campaignId: input.campaignId,
    libraryId: input.libraryId,
    sessionId: input.sessionId,
    sourceType: input.sourceType,
    title: input.title,
    author: input.author,
    authorityClass: input.authorityClass,
    visibility: input.visibility,
    language: input.language,
    contentHash,
    trackName: input.trackName,
    startOffsetMs: input.startOffsetMs,
    createdBy: input.createdBy,
    createdAt: nowIso()
  };
  const version: SourceVersion = {
    id: sourceVersionId,
    sourceId,
    versionNumber: 1,
    originalText: input.originalText,
    normalizedText: parsed.normalizedText,
    createdBy: input.createdBy,
    createdAt: nowIso()
  };
  next.sources.push(source);
  next.sourceVersions.push(version);
  next.normalizedBlocks.push(
    ...parsed.blocks.map((block) => ({
      ...block,
      id: newId(),
      sourceId,
      sourceVersionId
    }))
  );
  next.transcriptUtterances.push(
    ...parsed.utterances.map((utterance) => ({
      ...utterance,
      id: newId(),
      sourceId,
      sourceVersionId
    }))
  );
  if (input.fileName) {
    next.sourceFiles.push({
      id: newId(),
      sourceId,
      fileName: input.fileName,
      mimeType: input.mimeType ?? "text/plain",
      byteSize: input.byteSize ?? Buffer.byteLength(input.originalText),
      sha256: contentHash,
      createdAt: nowIso()
    });
  }
  audit(next, input.organizationId, "source.imported", "source", sourceId, input.createdBy, {
    blockCount: parsed.blocks.length,
    utteranceCount: parsed.utterances.length
  });
  return { state: next, source, duplicate: false, warnings: parsed.warnings };
}

export function correctSpeaker(state: WikiState, sourceVersionId: Id, anchor: string, correctedSpeaker: string, reason: string, actor: Id): WikiState {
  const next = cloneState(state);
  next.transcriptCorrections.push({
    id: newId(),
    sourceVersionId,
    targetAnchor: anchor,
    correctedSpeaker,
    reason,
    createdBy: actor,
    createdAt: nowIso()
  });
  const sourceVersion = next.sourceVersions.find((version) => version.id === sourceVersionId);
  if (sourceVersion) {
    const source = next.sources.find((candidate) => candidate.id === sourceVersion.sourceId);
    if (source) audit(next, source.organizationId, "transcript.speaker_corrected", "source", source.id, actor, { anchor, correctedSpeaker });
  }
  return next;
}

export function annotateSourceWithMockClassifier(state: WikiState, sourceId: Id, actor?: Id): WikiState {
  const next = cloneState(state);
  const blocks = next.normalizedBlocks.filter((block) => block.sourceId === sourceId);
  const source = next.sources.find((candidate) => candidate.id === sourceId);
  if (!source) return next;
  const annotations: SpanAnnotation[] = classifyBlocks(blocks).map((annotation) => ({
    id: newId(),
    sourceVersionId: blocks.find((block) => block.stableAnchor === annotation.anchorStart)?.sourceVersionId ?? "",
    anchorStart: annotation.anchorStart,
    anchorEnd: annotation.anchorEnd,
    tags: annotation.tags as SpanAnnotation["tags"],
    confidence: annotation.confidence,
    humanOverride: false,
    notes: annotation.notes,
    createdBy: actor,
    createdAt: nowIso()
  }));
  next.spanAnnotations.push(...annotations.filter((annotation) => annotation.sourceVersionId));
  audit(next, source.organizationId, "source.classified", "source", source.id, actor, { annotationCount: annotations.length });
  return next;
}

export function upsertEntity(state: WikiState, input: {
  organizationId: Id;
  scopeType: ScopeType;
  scopeId: Id;
  entityType: Entity["entityType"];
  name: string;
  visibility: Visibility;
}): { state: WikiState; entity: Entity } {
  const next = cloneState(state);
  const scope = scopeFor(input.scopeType, input.scopeId);
  const existing = next.entities.find(
    (entity) =>
      entity.organizationId === input.organizationId &&
      entity.name.toLowerCase() === input.name.toLowerCase() &&
      entity.homeScope === scope.homeScope &&
      entity.worldId === scope.worldId &&
      entity.settingId === scope.settingId &&
      entity.campaignId === scope.campaignId &&
      entity.libraryId === scope.libraryId
  );
  if (existing) return { state: next, entity: existing };
  const entity: Entity = {
    id: newId(),
    organizationId: input.organizationId,
    ...scope,
    entityType: input.entityType,
    name: input.name,
    visibility: input.visibility,
    createdAt: nowIso()
  };
  next.entities.push(entity);
  audit(next, input.organizationId, "entity.created", "entity", entity.id, undefined, { name: input.name });
  return { state: next, entity };
}

export function createAcceptedClaim(state: WikiState, input: {
  organizationId: Id;
  scopeType: ScopeType;
  scopeId: Id;
  subjectEntityId?: Id;
  predicate: string;
  valueText?: string;
  authorityClass: AuthorityClass;
  epistemicClass: Claim["epistemicClass"];
  visibility: Visibility;
  evidence: EvidenceRef[];
  createdBy: Id;
  effectiveTime?: string;
}): { state: WikiState; claim: Claim } {
  const next = cloneState(state);
  validateEvidence(next, input.evidence);
  const scope = scopeFor(input.scopeType, input.scopeId);
  const claim: Claim = {
    id: newId(),
    organizationId: input.organizationId,
    ...scope,
    subjectEntityId: input.subjectEntityId,
    predicate: input.predicate,
    valueText: input.valueText,
    effectiveTime: input.effectiveTime,
    authorityClass: input.authorityClass,
    epistemicClass: input.epistemicClass,
    reviewState: "accepted",
    canonState: input.epistemicClass === "world_true" || input.epistemicClass === "character_belief" ? "accepted" : "unresolved",
    visibility: input.visibility,
    createdBy: input.createdBy,
    createdAt: nowIso()
  };
  next.claims.push(claim);
  next.claimEvidence.push(
    ...input.evidence.map((evidence) => ({
      id: newId(),
      claimId: claim.id,
      ...evidence,
      createdAt: nowIso()
    }))
  );
  audit(next, input.organizationId, "claim.accepted", "claim", claim.id, input.createdBy, { predicate: input.predicate });
  return { state: next, claim };
}

export function createRuling(state: WikiState, input: {
  organizationId: Id;
  scopeType: ScopeType;
  scopeId: Id;
  rulingText: string;
  signedBy: Id;
  visibility: Visibility;
}): { state: WikiState; ruling: CanonRuling } {
  const next = cloneState(state);
  const ruling: CanonRuling = {
    id: newId(),
    organizationId: input.organizationId,
    ...scopeFor(input.scopeType, input.scopeId),
    rulingText: input.rulingText,
    signedBy: input.signedBy,
    visibility: input.visibility,
    createdAt: nowIso()
  };
  next.canonRulings.push(ruling);
  audit(next, input.organizationId, "ruling.signed", "ruling", ruling.id, input.signedBy);
  return { state: next, ruling };
}

export function promoteClaim(state: WikiState, viewer: Viewer, claimId: Id, targetScopeType: ScopeType, targetScopeId: Id, reason: string): { state: WikiState; promotedClaim?: Claim; error?: string } {
  const next = cloneState(state);
  const sourceClaim = next.claims.find((claim) => claim.id === claimId);
  if (!sourceClaim) return { state: next, error: "Claim not found." };
  const targetScope = scopeFor(targetScopeType, targetScopeId);
  if (!canWriteScope(next, viewer, targetScope)) return { state: next, error: "Viewer is not authorized to promote into the destination scope." };
  const rulingResult = createRuling(next, {
    organizationId: sourceClaim.organizationId,
    scopeType: targetScopeType,
    scopeId: targetScopeId,
    rulingText: `Promoted claim ${claimId}: ${reason}`,
    signedBy: viewer.profileId!,
    visibility: sourceClaim.visibility
  });
  const claimResult = createAcceptedClaim(rulingResult.state, {
    organizationId: sourceClaim.organizationId,
    scopeType: targetScopeType,
    scopeId: targetScopeId,
    subjectEntityId: sourceClaim.subjectEntityId,
    predicate: sourceClaim.predicate,
    valueText: sourceClaim.valueText,
    authorityClass: "explicit_gm_ruling",
    epistemicClass: sourceClaim.epistemicClass,
    visibility: sourceClaim.visibility,
    evidence: [{ rulingId: rulingResult.ruling.id, excerpt: rulingResult.ruling.rulingText }],
    createdBy: viewer.profileId!,
    effectiveTime: sourceClaim.effectiveTime
  });
  return { state: claimResult.state, promotedClaim: claimResult.claim };
}

export function applyErratum(state: WikiState, input: {
  targetClaimId: Id;
  correctionType: Erratum["correctionType"];
  newValue: string;
  reason: string;
  signedBy: Id;
}): { state: WikiState; erratum?: Erratum; replacement?: Claim; error?: string } {
  let next = cloneState(state);
  const target = next.claims.find((claim) => claim.id === input.targetClaimId);
  if (!target) return { state: next, error: "Target claim not found." };
  const oldValue = target.valueText ?? "";
  target.canonState = "superseded";
  const erratum: Erratum = {
    id: newId(),
    organizationId: target.organizationId,
    homeScope: target.homeScope,
    worldId: target.worldId,
    settingId: target.settingId,
    campaignId: target.campaignId,
    libraryId: target.libraryId,
    correctionType: input.correctionType,
    targetClaimId: target.id,
    oldValue,
    newValue: input.newValue,
    reason: input.reason,
    signedBy: input.signedBy,
    visibility: target.visibility,
    createdAt: nowIso()
  };
  next.errata.push(erratum);
  const rulingResult = createRuling(next, {
    organizationId: target.organizationId,
    scopeType: target.homeScope,
    scopeId: target.worldId ?? target.settingId ?? target.campaignId ?? target.libraryId!,
    rulingText: `Erratum ${erratum.id}: ${input.reason}`,
    signedBy: input.signedBy,
    visibility: target.visibility
  });
  const replacementResult = createAcceptedClaim(rulingResult.state, {
    organizationId: target.organizationId,
    scopeType: target.homeScope,
    scopeId: target.worldId ?? target.settingId ?? target.campaignId ?? target.libraryId!,
    subjectEntityId: target.subjectEntityId,
    predicate: target.predicate,
    valueText: input.newValue,
    authorityClass: "explicit_gm_ruling",
    epistemicClass: target.epistemicClass,
    visibility: target.visibility,
    evidence: [{ rulingId: rulingResult.ruling.id, excerpt: rulingResult.ruling.rulingText }],
    createdBy: input.signedBy,
    effectiveTime: target.effectiveTime
  });
  next = replacementResult.state;
  const mutableTarget = next.claims.find((claim) => claim.id === target.id);
  if (mutableTarget) mutableTarget.supersededByClaimId = replacementResult.claim.id;
  const mutableReplacement = next.claims.find((claim) => claim.id === replacementResult.claim.id);
  if (mutableReplacement) mutableReplacement.supersedesClaimId = target.id;
  if (target.campaignId) {
    next = rebuildCampaignArticles(next, { profileId: input.signedBy, mode: "gm", campaignId: target.campaignId }, target.campaignId);
  }
  audit(next, target.organizationId, "erratum.applied", "erratum", erratum.id, input.signedBy, { targetClaimId: target.id });
  return { state: next, erratum, replacement: replacementResult.claim };
}

export function createFaq(state: WikiState, input: {
  organizationId: Id;
  scopeType: ScopeType;
  scopeId: Id;
  question: string;
  createdBy: Id;
  visibility: Visibility;
}): { state: WikiState; faq: Faq } {
  const next = cloneState(state);
  const faq: Faq = {
    id: newId(),
    organizationId: input.organizationId,
    ...scopeFor(input.scopeType, input.scopeId),
    question: input.question,
    alternatePhrasings: [],
    status: "open",
    visibility: input.visibility,
    createdBy: input.createdBy,
    createdAt: nowIso()
  };
  next.faqs.push(faq);
  audit(next, input.organizationId, "faq.created", "faq", faq.id, input.createdBy);
  return { state: next, faq };
}

export function answerFaq(state: WikiState, input: {
  faqId: Id;
  answer: string;
  evidenceClaimIds: Id[];
  createdBy: Id;
  authoritativeRuling: boolean;
}): { state: WikiState; version?: FaqVersion; ruling?: CanonRuling; error?: string } {
  let next = cloneState(state);
  const faq = next.faqs.find((candidate) => candidate.id === input.faqId);
  if (!faq) return { state: next, error: "FAQ not found." };
  const version: FaqVersion = {
    id: newId(),
    faqId: faq.id,
    versionNumber: next.faqVersions.filter((item) => item.faqId === faq.id).length + 1,
    answer: input.answer,
    evidenceClaimIds: input.evidenceClaimIds,
    isAuthoritativeRuling: input.authoritativeRuling,
    createdBy: input.createdBy,
    createdAt: nowIso()
  };
  next.faqVersions.push(version);
  faq.status = input.authoritativeRuling ? "answered" : "drafted";
  let ruling: CanonRuling | undefined;
  if (input.authoritativeRuling) {
    const result = createRuling(next, {
      organizationId: faq.organizationId,
      scopeType: faq.homeScope,
      scopeId: faq.worldId ?? faq.settingId ?? faq.campaignId ?? faq.libraryId!,
      rulingText: `FAQ ruling for "${faq.question}": ${input.answer}`,
      signedBy: input.createdBy,
      visibility: faq.visibility
    });
    next = result.state;
    ruling = result.ruling;
  }
  audit(next, faq.organizationId, "faq.answered", "faq", faq.id, input.createdBy, { authoritativeRuling: input.authoritativeRuling });
  return { state: next, version, ruling };
}

export function generatePromptPacket(state: WikiState, viewer: Viewer, input: {
  organizationId: Id;
  campaignId: Id;
  packetType: AiPromptPacket["packetType"];
  privacyConfirmedBy: Id;
}): { state: WikiState; packet: AiPromptPacket } {
  const next = cloneState(state);
  const lineage = campaignLineage(next, input.campaignId);
  const sources = readableSourcesForCampaign(next, viewer, input.campaignId);
  const claims = readableClaimsForCampaign(next, viewer, input.campaignId);
  const excerpts = sources.flatMap((source) =>
    next.normalizedBlocks
      .filter((block) => block.sourceId === source.id)
      .slice(0, 12)
      .map((block) => ({
        sourceId: source.id,
        sourceVersionId: block.sourceVersionId,
        anchorStart: block.stableAnchor,
        anchorEnd: block.stableAnchor,
        excerpt: block.text.slice(0, 400),
        text: block.text
      }))
  );
  const packet: AiPromptPacket = {
    id: newId(),
    organizationId: input.organizationId,
    packetType: input.packetType,
    homeScope: "campaign",
    campaignId: input.campaignId,
    payload: buildPromptPacketPayload({
      packetType: input.packetType,
      scopes: lineage.scopes,
      excerpts,
      existingClaims: claims
    }),
    privacyConfirmedBy: input.privacyConfirmedBy,
    createdAt: nowIso()
  };
  next.aiPromptPackets.push(packet);
  audit(next, input.organizationId, "ai.prompt_packet_exported", "ai_prompt_packet", packet.id, input.privacyConfirmedBy, {
    packetType: input.packetType,
    excerptCount: excerpts.length
  });
  return { state: next, packet };
}

export function importAiResponse(state: WikiState, jsonText: string): { state: WikiState; proposals: ExtractionProposal[]; errors: string[] } {
  const next = cloneState(state);
  let parsed;
  try {
    parsed = aiImportSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    return { state: next, proposals: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
  const errors: string[] = [];
  const proposals: ExtractionProposal[] = [];
  for (const proposal of parsed.proposals) {
    try {
      validateEvidence(next, proposal.evidence);
      const stored: ExtractionProposal = {
        id: newId(),
        kind: proposal.kind,
        payload: proposal.payload,
        evidence: proposal.evidence,
        confidence: proposal.confidence,
        status: "pending",
        createdAt: nowIso()
      };
      next.extractionProposals.push(stored);
      proposals.push(stored);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { state: next, proposals, errors };
}

export function runMockAiAnalysis(state: WikiState, input: { organizationId: Id; sourceIds: Id[]; actor: Id }): WikiState {
  let next = cloneState(state);
  const idempotencyKey = stableId(["mock-analysis", ...input.sourceIds]);
  const existingRun = next.processingRuns.find((run) => run.idempotencyKey === idempotencyKey && run.stage === "extract-proposals");
  if (existingRun?.status === "succeeded") return next;
  const run: ProcessingRun =
    existingRun ??
    {
      id: newId(),
      organizationId: input.organizationId,
      stage: "extract-proposals",
      provider: "mock",
      model: "deterministic-local",
      promptVersion: "2026-10-09",
      schemaVersion: "proposal-v1",
      inputSourceIds: input.sourceIds,
      status: "running",
      idempotencyKey,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  if (!existingRun) next.processingRuns.push(run);
  const proposals = createMockAnalysis(next, run, input.sourceIds);
  const existingKeys = new Set(next.extractionProposals.map((proposal) => JSON.stringify([proposal.kind, proposal.payload, proposal.evidence])));
  for (const proposal of proposals) {
    const key = JSON.stringify([proposal.kind, proposal.payload, proposal.evidence]);
    if (!existingKeys.has(key)) next.extractionProposals.push(proposal);
  }
  const mutableRun = next.processingRuns.find((candidate) => candidate.id === run.id);
  if (mutableRun) {
    mutableRun.status = "succeeded";
    mutableRun.updatedAt = nowIso();
  }
  for (const sourceId of input.sourceIds) {
    next = annotateSourceWithMockClassifier(next, sourceId, input.actor);
  }
  audit(next, input.organizationId, "ai.mock_analysis_completed", "processing_run", run.id, input.actor, { proposalCount: proposals.length });
  return next;
}

export function acceptProposal(state: WikiState, proposalId: Id, actor: Id, campaignId: Id): { state: WikiState; error?: string } {
  let next = cloneState(state);
  const proposal = next.extractionProposals.find((candidate) => candidate.id === proposalId);
  const campaign = next.campaigns.find((candidate) => candidate.id === campaignId);
  if (!proposal || !campaign) return { state: next, error: "Proposal or campaign not found." };
  if (proposal.status !== "pending") return { state: next, error: "Proposal has already been handled." };
  if (proposal.kind === "entity") {
    const entityResult = upsertEntity(next, {
      organizationId: campaign.organizationId,
      scopeType: "campaign",
      scopeId: campaign.id,
      entityType: String(proposal.payload.entityType ?? "lore") as Entity["entityType"],
      name: String(proposal.payload.name ?? "Unnamed"),
      visibility: "campaign_members"
    });
    next = entityResult.state;
  }
  if (proposal.kind === "claim") {
    let entity = next.entities.find((candidate) => candidate.name === proposal.payload.entityName && candidate.campaignId === campaign.id);
    if (!entity) {
      const entityResult = upsertEntity(next, {
        organizationId: campaign.organizationId,
        scopeType: "campaign",
        scopeId: campaign.id,
        entityType: String(proposal.payload.entityType ?? "lore") as Entity["entityType"],
        name: String(proposal.payload.entityName ?? "Campaign Fact"),
        visibility: "campaign_members"
      });
      next = entityResult.state;
      entity = entityResult.entity;
    }
    const claimResult = createAcceptedClaim(next, {
      organizationId: campaign.organizationId,
      scopeType: "campaign",
      scopeId: campaign.id,
      subjectEntityId: entity.id,
      predicate: String(proposal.payload.predicate ?? "note"),
      valueText: String(proposal.payload.valueText ?? ""),
      authorityClass: String(proposal.payload.authorityClass ?? "unclear") as AuthorityClass,
      epistemicClass: String(proposal.payload.epistemicClass ?? "unknown") as Claim["epistemicClass"],
      visibility: "campaign_members",
      evidence: proposal.evidence,
      createdBy: actor
    });
    next = claimResult.state;
  }
  const mutableProposal = next.extractionProposals.find((candidate) => candidate.id === proposalId);
  if (mutableProposal) mutableProposal.status = "accepted";
  next = rebuildCampaignArticles(next, { profileId: actor, mode: "gm", campaignId }, campaignId);
  return { state: next };
}

export function exportBackup(state: WikiState, viewer: Viewer, campaignId: Id): Record<string, unknown> {
  const claims = readableClaimsForCampaign(state, viewer, campaignId);
  const claimIds = new Set(claims.map((claim) => claim.id));
  return {
    exportedAt: nowIso(),
    campaign: state.campaigns.find((campaign) => campaign.id === campaignId),
    sources: readableSourcesForCampaign(state, viewer, campaignId).map((source) => ({
      ...source,
      blocks: state.normalizedBlocks.filter((block) => block.sourceId === source.id)
    })),
    claims,
    claimEvidence: state.claimEvidence.filter((evidence) => claimIds.has(evidence.claimId)),
    articles: state.articleProjections.filter((article) => article.campaignId === campaignId),
    faqs: state.faqs.filter((faq) => faq.campaignId === campaignId)
  };
}

function validateEvidence(state: WikiState, evidenceRefs: EvidenceRef[]): void {
  for (const evidence of evidenceRefs) {
    if (evidence.sourceId) {
      const source = state.sources.find((candidate) => candidate.id === evidence.sourceId);
      if (!source) throw new Error(`Unknown source ID ${evidence.sourceId}.`);
      if (source.sourceType === "generated_output") throw new Error("Generated outputs cannot be used as factual evidence.");
      if (evidence.anchorStart) {
        const hasAnchor = state.normalizedBlocks.some(
          (block) =>
            block.sourceId === evidence.sourceId &&
            block.sourceVersionId === evidence.sourceVersionId &&
            block.stableAnchor === evidence.anchorStart
        );
        if (!hasAnchor) throw new Error(`Fabricated or unauthorized anchor ${evidence.anchorStart}.`);
      }
    }
    if (evidence.rulingId && !state.canonRulings.some((ruling) => ruling.id === evidence.rulingId)) {
      throw new Error(`Unknown ruling ID ${evidence.rulingId}.`);
    }
    if (!evidence.sourceId && !evidence.rulingId) throw new Error("Evidence must cite a source anchor or signed ruling.");
  }
}
