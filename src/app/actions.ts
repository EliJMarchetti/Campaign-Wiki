"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rebuildCampaignArticles } from "@/lib/articles";
import { seedDemoState } from "@/lib/fixtures";
import { extractTextFromUpload } from "@/lib/importers";
import { newId, nowIso } from "@/lib/id";
import { loadState, saveState, updateState } from "@/lib/store";
import {
  acceptProposal,
  answerFaq,
  applyErratum,
  createAcceptedClaim,
  createFaq,
  correctSpeaker,
  generatePromptPacket,
  importAiResponse,
  importSource,
  promoteClaim,
  runMockAiAnalysis,
  upsertEntity
} from "@/lib/workflows";
import type { AuthorityClass, Entity, ScopeType, Viewer, Visibility } from "@/lib/types";

function value(formData: FormData, key: string, fallback = ""): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : fallback;
}

function viewerFromForm(formData: FormData): Viewer {
  const profileId = value(formData, "profileId") || undefined;
  const campaignId = value(formData, "campaignId") || undefined;
  const mode = value(formData, "mode", "gm") as Viewer["mode"];
  return { profileId, campaignId, mode };
}

function redirectHome(formData: FormData): never {
  const params = new URLSearchParams();
  const campaignId = value(formData, "campaignId");
  const profileId = value(formData, "profileId");
  const mode = value(formData, "mode", "gm");
  if (campaignId) params.set("campaign", campaignId);
  if (profileId) params.set("user", profileId);
  if (mode) params.set("mode", mode);
  redirect(`/${params.size ? `?${params.toString()}` : ""}`);
}

export async function seedDemoAction() {
  await saveState(seedDemoState());
  revalidatePath("/");
  redirect("/");
}

export async function createWorldAction(formData: FormData) {
  await updateState((state) => {
    const actor = value(formData, "profileId") || state.profiles[0]?.id || newId();
    const org = state.organizations[0] ?? { id: newId(), name: "Campaign Workspace", createdBy: actor, createdAt: nowIso() };
    if (!state.organizations.some((item) => item.id === org.id)) state.organizations.push(org);
    const world = {
      id: newId(),
      organizationId: org.id,
      name: value(formData, "name", "New World"),
      description: value(formData, "description"),
      visibility: value(formData, "visibility", "shared_authorized") as Visibility,
      createdBy: actor,
      createdAt: nowIso()
    };
    state.worlds.push(world);
    state.scopeGrants.push({
      id: newId(),
      organizationId: org.id,
      granteeProfileId: actor,
      role: "world_editor",
      homeScope: "world",
      worldId: world.id,
      createdAt: nowIso()
    });
    return state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function createSettingAction(formData: FormData) {
  await updateState((state) => {
    const actor = value(formData, "profileId") || state.profiles[0]?.id || newId();
    const worldId = value(formData, "worldId") || state.worlds[0]?.id;
    const orgId = state.worlds.find((world) => world.id === worldId)?.organizationId ?? state.organizations[0]?.id;
    if (!orgId) return state;
    const setting = {
      id: newId(),
      organizationId: orgId,
      worldId,
      name: value(formData, "name", "New Setting"),
      era: value(formData, "era"),
      description: value(formData, "description"),
      forkedFromSettingId: value(formData, "forkedFromSettingId") || undefined,
      forkSnapshot: value(formData, "forkSnapshot") || undefined,
      visibility: "shared_authorized" as const,
      createdBy: actor,
      createdAt: nowIso()
    };
    state.settings.push(setting);
    state.scopeGrants.push({
      id: newId(),
      organizationId: orgId,
      granteeProfileId: actor,
      role: "setting_editor",
      homeScope: "setting",
      settingId: setting.id,
      createdAt: nowIso()
    });
    return state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function createCampaignAction(formData: FormData) {
  await updateState((state) => {
    const actor = value(formData, "profileId") || state.profiles[0]?.id || newId();
    const settingId = value(formData, "settingId") || state.settings[0]?.id;
    const orgId = state.settings.find((setting) => setting.id === settingId)?.organizationId ?? state.organizations[0]?.id;
    if (!orgId) return state;
    const campaign = {
      id: newId(),
      organizationId: orgId,
      settingId,
      name: value(formData, "name", "New Campaign"),
      description: value(formData, "description"),
      visibility: "campaign_members" as const,
      gmProfileId: actor,
      createdAt: nowIso()
    };
    state.campaigns.push(campaign);
    state.scopeGrants.push({
      id: newId(),
      organizationId: orgId,
      granteeProfileId: actor,
      role: "gm",
      homeScope: "campaign",
      campaignId: campaign.id,
      createdAt: nowIso()
    });
    return state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function importSourceAction(formData: FormData) {
  const file = formData.get("file");
  let originalText = value(formData, "sourceText");
  let fileName = value(formData, "fileName", "pasted.txt");
  let mimeType = "text/plain";
  let byteSize = Buffer.byteLength(originalText);
  let warnings: string[] = [];
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
    mimeType = file.type || "application/octet-stream";
    byteSize = file.size;
    const extracted = await extractTextFromUpload(file.name, mimeType, buffer);
    originalText = extracted.text;
    warnings = extracted.warnings;
  }
  await updateState((state) => {
    const campaignId = value(formData, "campaignId");
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign || !originalText.trim()) return state;
    let sessionId = value(formData, "sessionId");
    if (!sessionId) {
      const session = {
        id: newId(),
        campaignId: campaign.id,
        title: value(formData, "sessionTitle", "Imported Session"),
        sessionDate: value(formData, "sessionDate") || undefined,
        summary: "",
        createdAt: nowIso()
      };
      state.sessions.push(session);
      sessionId = session.id;
    }
    const imported = importSource(state, {
      organizationId: campaign.organizationId,
      homeScope: "campaign",
      campaignId: campaign.id,
      sessionId,
      sourceType: value(formData, "sourceType", "transcript") as "transcript",
      title: value(formData, "title", fileName),
      author: value(formData, "author") || undefined,
      authorityClass: value(formData, "authorityClass", "unclear") as AuthorityClass,
      visibility: value(formData, "visibility", "gm_private") as Visibility,
      language: value(formData, "language", "en"),
      originalText,
      fileName,
      mimeType,
      byteSize,
      trackName: value(formData, "trackName") || undefined,
      startOffsetMs: Number(value(formData, "startOffsetMs", "0")),
      createdBy: value(formData, "profileId")
    });
    state = imported.state;
    for (const warning of warnings) {
      state.auditEvents.push({
        id: newId(),
        organizationId: campaign.organizationId,
        actorProfileId: value(formData, "profileId"),
        eventType: "source.import_warning",
        targetType: "source",
        targetId: imported.source.id,
        details: { warning },
        createdAt: nowIso()
      });
    }
    return state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function runMockAiAction(formData: FormData) {
  await updateState((state) => {
    const sourceIds = formData.getAll("sourceIds").filter((item): item is string => typeof item === "string");
    const campaign = state.campaigns.find((item) => item.id === value(formData, "campaignId"));
    if (!campaign || sourceIds.length === 0) return state;
    return runMockAiAnalysis(state, { organizationId: campaign.organizationId, sourceIds, actor: value(formData, "profileId") });
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function acceptProposalAction(formData: FormData) {
  await updateState((state) => acceptProposal(state, value(formData, "proposalId"), value(formData, "profileId"), value(formData, "campaignId")).state);
  revalidatePath("/");
  redirectHome(formData);
}

export async function createManualClaimAction(formData: FormData) {
  await updateState((state) => {
    const campaign = state.campaigns.find((item) => item.id === value(formData, "campaignId"));
    const source = state.sources.find((item) => item.id === value(formData, "sourceId"));
    const block = state.normalizedBlocks.find((item) => item.sourceId === source?.id && item.stableAnchor === value(formData, "anchorStart"));
    if (!campaign || !source || !block) return state;
    const entityResult = upsertEntity(state, {
      organizationId: campaign.organizationId,
      scopeType: "campaign",
      scopeId: campaign.id,
      entityType: value(formData, "entityType", "lore") as Entity["entityType"],
      name: value(formData, "entityName", "Untitled"),
      visibility: value(formData, "visibility", "campaign_members") as Visibility
    });
    const claimResult = createAcceptedClaim(entityResult.state, {
      organizationId: campaign.organizationId,
      scopeType: "campaign",
      scopeId: campaign.id,
      subjectEntityId: entityResult.entity.id,
      predicate: value(formData, "predicate"),
      valueText: value(formData, "valueText"),
      authorityClass: value(formData, "authorityClass", "explicit_gm_ruling") as AuthorityClass,
      epistemicClass: value(formData, "epistemicClass", "world_true") as never,
      visibility: value(formData, "visibility", "campaign_members") as Visibility,
      evidence: [{ sourceId: source.id, sourceVersionId: block.sourceVersionId, anchorStart: block.stableAnchor, anchorEnd: block.stableAnchor, excerpt: block.text }],
      createdBy: value(formData, "profileId")
    });
    return rebuildCampaignArticles(claimResult.state, viewerFromForm(formData), campaign.id);
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function correctSpeakerAction(formData: FormData) {
  await updateState((state) => correctSpeaker(state, value(formData, "sourceVersionId"), value(formData, "anchor"), value(formData, "correctedSpeaker"), value(formData, "reason", "Manual correction"), value(formData, "profileId")));
  revalidatePath("/");
  redirectHome(formData);
}

export async function promoteClaimAction(formData: FormData) {
  await updateState((state) => promoteClaim(state, viewerFromForm(formData), value(formData, "claimId"), value(formData, "targetScopeType") as ScopeType, value(formData, "targetScopeId"), value(formData, "reason", "Promotion approved")).state);
  revalidatePath("/");
  redirectHome(formData);
}

export async function applyErratumAction(formData: FormData) {
  await updateState((state) => applyErratum(state, {
    targetClaimId: value(formData, "targetClaimId"),
    correctionType: value(formData, "correctionType", "official_canon_retcon") as never,
    newValue: value(formData, "newValue"),
    reason: value(formData, "reason"),
    signedBy: value(formData, "profileId")
  }).state);
  revalidatePath("/");
  redirectHome(formData);
}

export async function createFaqAction(formData: FormData) {
  await updateState((state) => {
    const campaign = state.campaigns.find((item) => item.id === value(formData, "campaignId"));
    if (!campaign) return state;
    return createFaq(state, {
      organizationId: campaign.organizationId,
      scopeType: "campaign",
      scopeId: campaign.id,
      question: value(formData, "question"),
      createdBy: value(formData, "profileId"),
      visibility: value(formData, "visibility", "campaign_members") as Visibility
    }).state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function answerFaqAction(formData: FormData) {
  await updateState((state) => answerFaq(state, {
    faqId: value(formData, "faqId"),
    answer: value(formData, "answer"),
    evidenceClaimIds: formData.getAll("evidenceClaimIds").filter((item): item is string => typeof item === "string"),
    createdBy: value(formData, "profileId"),
    authoritativeRuling: value(formData, "authoritativeRuling") === "on"
  }).state);
  revalidatePath("/");
  redirectHome(formData);
}

export async function generatePromptPacketAction(formData: FormData) {
  await updateState((state) => {
    const campaign = state.campaigns.find((item) => item.id === value(formData, "campaignId"));
    if (!campaign) return state;
    return generatePromptPacket(state, viewerFromForm(formData), {
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      packetType: value(formData, "packetType", "entity-and-fact-extraction") as never,
      privacyConfirmedBy: value(formData, "profileId")
    }).state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function importAiResponseAction(formData: FormData) {
  await updateState((state) => {
    const result = importAiResponse(state, value(formData, "aiJson"));
    for (const error of result.errors) {
      const orgId = state.organizations[0]?.id;
      if (orgId) {
        result.state.auditEvents.push({
          id: newId(),
          organizationId: orgId,
          actorProfileId: value(formData, "profileId"),
          eventType: "ai.import_rejected",
          targetType: "ai_response",
          details: { error },
          createdAt: nowIso()
        });
      }
    }
    return result.state;
  });
  revalidatePath("/");
  redirectHome(formData);
}

export async function rebuildArticlesAction(formData: FormData) {
  await updateState((state) => rebuildCampaignArticles(state, viewerFromForm(formData), value(formData, "campaignId")));
  revalidatePath("/");
  redirectHome(formData);
}

export async function resetLocalDataAction() {
  await saveState(await loadState().then(() => ({ ...seedDemoState(), auditEvents: [] })));
  revalidatePath("/");
  redirect("/");
}
