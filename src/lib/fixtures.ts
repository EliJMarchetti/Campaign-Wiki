import { rebuildCampaignArticles } from "./articles";
import { newId, nowIso } from "./id";
import { emptyState } from "./state";
import { annotateSourceWithMockClassifier, createAcceptedClaim, createFaq, importSource } from "./workflows";
import type { Profile, ScopeGrant, WikiState } from "./types";

export function seedDemoState(): WikiState {
  let state = emptyState();
  const createdAt = nowIso();
  const gm: Profile = { id: newId(), displayName: "Mira Vale", email: "gm@example.test", createdAt };
  const rowan: Profile = { id: newId(), displayName: "Rowan", email: "rowan@example.test", createdAt };
  const tess: Profile = { id: newId(), displayName: "Tess", email: "tess@example.test", createdAt };
  const ilya: Profile = { id: newId(), displayName: "Ilya", email: "ilya@example.test", createdAt };
  const ashenGm: Profile = { id: newId(), displayName: "Orin Ash", email: "orin@example.test", createdAt };
  const publicReader: Profile = { id: newId(), displayName: "Public Reader", createdAt };
  state.profiles.push(gm, rowan, tess, ilya, ashenGm, publicReader);

  const organization = { id: newId(), name: "Lantern Table", createdBy: gm.id, createdAt };
  state.organizations.push(organization);
  state.memberships.push(
    { id: newId(), organizationId: organization.id, profileId: gm.id, role: "owner", createdAt },
    { id: newId(), organizationId: organization.id, profileId: ashenGm.id, role: "owner", createdAt },
    { id: newId(), organizationId: organization.id, profileId: rowan.id, role: "player", createdAt },
    { id: newId(), organizationId: organization.id, profileId: tess.id, role: "player", createdAt },
    { id: newId(), organizationId: organization.id, profileId: ilya.id, role: "player", createdAt }
  );

  const aetherion = {
    id: newId(),
    organizationId: organization.id,
    name: "Aetherion",
    description: "A shared world of old roads, bright moons and inconvenient imperial archives.",
    visibility: "shared_authorized" as const,
    createdBy: gm.id,
    createdAt
  };
  const unrelatedWorld = {
    id: newId(),
    organizationId: organization.id,
    name: "Thornwake",
    description: "A standalone world used to prove isolation.",
    visibility: "shared_authorized" as const,
    createdBy: gm.id,
    createdAt
  };
  state.worlds.push(aetherion, unrelatedWorld);

  const imperial = {
    id: newId(),
    organizationId: organization.id,
    worldId: aetherion.id,
    name: "Imperial Era",
    era: "Year 814 of the Argent Ledger",
    description: "The empire is bruised but still standing.",
    visibility: "shared_authorized" as const,
    createdBy: gm.id,
    createdAt
  };
  const fallen = {
    id: newId(),
    organizationId: organization.id,
    worldId: aetherion.id,
    name: "Fallen Empire",
    era: "A divergent continuity after the imperial collapse",
    description: "The Senate fell decades earlier and dragon regents hold the old roads.",
    forkedFromSettingId: imperial.id,
    forkSnapshot: "Imperial Era before Session 12",
    visibility: "shared_authorized" as const,
    createdBy: gm.id,
    createdAt
  };
  const thornwakeSetting = {
    id: newId(),
    organizationId: organization.id,
    worldId: unrelatedWorld.id,
    name: "Salt Marches",
    era: "Independent",
    description: "No shared Aetherion canon applies.",
    visibility: "shared_authorized" as const,
    createdBy: gm.id,
    createdAt
  };
  state.settings.push(imperial, fallen, thornwakeSetting);
  state.settingForks.push({
    id: newId(),
    sourceSettingId: imperial.id,
    forkSettingId: fallen.id,
    forkedBy: gm.id,
    reason: "The Last Dynasty intentionally explores an incompatible imperial timeline.",
    snapshotLabel: "pre-collapse fork",
    createdAt
  });

  const silver = {
    id: newId(),
    organizationId: organization.id,
    settingId: imperial.id,
    name: "Silver Lanterns",
    description: "A party of wardens crossing the Moon Gate road.",
    visibility: "campaign_members" as const,
    gmProfileId: gm.id,
    createdAt
  };
  const ashen = {
    id: newId(),
    organizationId: organization.id,
    settingId: imperial.id,
    name: "Ashen Road",
    description: "A different party in the same setting, with private events.",
    visibility: "campaign_members" as const,
    gmProfileId: ashenGm.id,
    createdAt
  };
  const dynasty = {
    id: newId(),
    organizationId: organization.id,
    settingId: fallen.id,
    name: "The Last Dynasty",
    description: "A campaign in the Fallen Empire continuity.",
    visibility: "campaign_members" as const,
    gmProfileId: gm.id,
    createdAt
  };
  const salt = {
    id: newId(),
    organizationId: organization.id,
    settingId: thornwakeSetting.id,
    name: "Salt March Patrol",
    description: "Unrelated campaign.",
    visibility: "campaign_members" as const,
    gmProfileId: gm.id,
    createdAt
  };
  state.campaigns.push(silver, ashen, dynasty, salt);

  const grants: ScopeGrant[] = [
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "world_editor", homeScope: "world", worldId: aetherion.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "setting_editor", homeScope: "setting", settingId: imperial.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "setting_editor", homeScope: "setting", settingId: fallen.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "gm", homeScope: "campaign", campaignId: silver.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "gm", homeScope: "campaign", campaignId: dynasty.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: gm.id, role: "gm", homeScope: "campaign", campaignId: salt.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: ashenGm.id, role: "gm", homeScope: "campaign", campaignId: ashen.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: rowan.id, role: "player", homeScope: "campaign", campaignId: silver.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: tess.id, role: "player", homeScope: "campaign", campaignId: silver.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: ilya.id, role: "player", homeScope: "campaign", campaignId: silver.id, createdAt },
    { id: newId(), organizationId: organization.id, granteeProfileId: publicReader.id, role: "invited_reader", homeScope: "world", worldId: aetherion.id, createdAt }
  ];
  state.scopeGrants.push(...grants);

  const library = {
    id: newId(),
    organizationId: organization.id,
    name: "Reference Library",
    description: "Rules and non-canonical templates.",
    createdBy: gm.id,
    createdAt
  };
  state.referenceLibraries.push(library);
  state.libraryAttachments.push({
    id: newId(),
    libraryId: library.id,
    homeScope: "campaign",
    campaignId: silver.id,
    createdAt
  });

  const silverSession = {
    id: newId(),
    campaignId: silver.id,
    title: "Session 12 - Moon Gate Accord",
    sessionDate: "2026-09-18",
    summary: "",
    createdAt
  };
  state.sessions.push(silverSession);
  const transcript = [
    "00:00:01 GM: The Moon Gate stands north of Vel Ori, where the old road splits.",
    "00:04:12 Rowan: I think Chancellor Elaria secretly burned the treaty.",
    "00:05:00 GM as Elaria: I never met the smugglers. She is lying through a perfect court smile.",
    "00:08:33 Tess: I try to stab King Halvar before he can speak.",
    "00:08:50 GM: The guard catches your wrist. The attempt fails and the king remains alive.",
    "00:12:10 GM: Just kidding, the Moon Gate is made of cheese.",
    "00:15:44 GM RULING: For Silver Lanterns, Vel Ori changes hands to the Lantern Compact on the night of Session 12.",
    "00:18:02 GM RULING: The archive date is corrected from 812 to 814."
  ].join("\n\n");
  let imported = importSource(state, {
    organizationId: organization.id,
    homeScope: "campaign",
    campaignId: silver.id,
    sessionId: silverSession.id,
    sourceType: "transcript",
    title: "Silver Lanterns Session 12 Table Transcript",
    author: "External transcription export",
    authorityClass: "unclear",
    visibility: "gm_private",
    language: "en",
    originalText: transcript,
    fileName: "silver-lanterns-session-12.txt",
    trackName: "table recorder",
    createdBy: gm.id
  });
  state = annotateSourceWithMockClassifier(imported.state, imported.source.id, gm.id);
  imported = importSource(state, {
    organizationId: organization.id,
    homeScope: "campaign",
    campaignId: silver.id,
    sessionId: silverSession.id,
    sourceType: "transcript",
    title: "Silver Lanterns Session 12 GM Phone Transcript",
    author: "External phone transcription export",
    authorityClass: "unclear",
    visibility: "gm_private",
    language: "en",
    originalText: "00:15:41 GM RULING: Vel Ori changes hands to the Lantern Compact tonight.",
    fileName: "silver-lanterns-session-12-phone.srt",
    trackName: "GM phone",
    startOffsetMs: -3000,
    createdBy: gm.id
  });
  state = imported.state;

  const moonGate = addEntityDirect(state, organization.id, "world", aetherion.id, "place", "Moon Gate", "shared_authorized");
  state = moonGate.state;
  const velOri = addEntityDirect(state, organization.id, "world", aetherion.id, "place", "Vel Ori", "shared_authorized");
  state = velOri.state;
  const empire = addEntityDirect(state, organization.id, "world", aetherion.id, "faction", "Aurelian Empire", "shared_authorized");
  state = empire.state;
  const silverVelOri = addEntityDirect(state, organization.id, "campaign", silver.id, "place", "Vel Ori", "campaign_members");
  state = silverVelOri.state;

  const firstSource = state.sources.find((source) => source.title.includes("Table Transcript"))!;
  const firstVersion = state.sourceVersions.find((version) => version.sourceId === firstSource.id)!;
  const anchor = (ordinal: number) => state.normalizedBlocks.find((block) => block.sourceId === firstSource.id && block.ordinal === ordinal)!;

  state = createAcceptedClaim(state, {
    organizationId: organization.id,
    scopeType: "world",
    scopeId: aetherion.id,
    subjectEntityId: moonGate.entity.id,
    predicate: "geographic relation",
    valueText: "The Moon Gate stands north of Vel Ori.",
    authorityClass: "objective_gm_world_narration",
    epistemicClass: "world_true",
    visibility: "shared_authorized",
    evidence: [{ sourceId: firstSource.id, sourceVersionId: firstVersion.id, anchorStart: anchor(1).stableAnchor, anchorEnd: anchor(1).stableAnchor, excerpt: anchor(1).text }],
    createdBy: gm.id
  }).state;
  state = createAcceptedClaim(state, {
    organizationId: organization.id,
    scopeType: "setting",
    scopeId: imperial.id,
    subjectEntityId: empire.entity.id,
    predicate: "political status",
    valueText: "The Aurelian Senate still claims imperial authority.",
    authorityClass: "gm_approved_setting_doc",
    epistemicClass: "world_true",
    visibility: "shared_authorized",
    evidence: [{ sourceId: firstSource.id, sourceVersionId: firstVersion.id, anchorStart: anchor(1).stableAnchor, anchorEnd: anchor(1).stableAnchor, excerpt: anchor(1).text }],
    createdBy: gm.id
  }).state;
  state = createAcceptedClaim(state, {
    organizationId: organization.id,
    scopeType: "setting",
    scopeId: fallen.id,
    subjectEntityId: empire.entity.id,
    predicate: "political status",
    valueText: "The Aurelian Senate collapsed before the campaign begins.",
    authorityClass: "gm_approved_setting_doc",
    epistemicClass: "world_true",
    visibility: "shared_authorized",
    evidence: [{ sourceId: firstSource.id, sourceVersionId: firstVersion.id, anchorStart: anchor(1).stableAnchor, anchorEnd: anchor(1).stableAnchor, excerpt: anchor(1).text }],
    createdBy: gm.id
  }).state;
  state = createAcceptedClaim(state, {
    organizationId: organization.id,
    scopeType: "campaign",
    scopeId: silver.id,
    subjectEntityId: silverVelOri.entity.id,
    predicate: "control",
    valueText: "Vel Ori changes hands to the Lantern Compact in Silver Lanterns only.",
    authorityClass: "explicit_gm_ruling",
    epistemicClass: "world_true",
    visibility: "campaign_members",
    evidence: [{ sourceId: firstSource.id, sourceVersionId: firstVersion.id, anchorStart: anchor(7).stableAnchor, anchorEnd: anchor(7).stableAnchor, excerpt: anchor(7).text }],
    createdBy: gm.id
  }).state;

  const ashenEntity = addEntityDirect(state, organization.id, "campaign", ashen.id, "place", "Ash Vault", "gm_private");
  state = ashenEntity.state;
  state = createAcceptedClaim(state, {
    organizationId: organization.id,
    scopeType: "campaign",
    scopeId: ashen.id,
    subjectEntityId: ashenEntity.entity.id,
    predicate: "secret route",
    valueText: "The Ash Vault has a hidden route under the road.",
    authorityClass: "explicit_gm_ruling",
    epistemicClass: "world_true",
    visibility: "gm_private",
    evidence: [{ sourceId: firstSource.id, sourceVersionId: firstVersion.id, anchorStart: anchor(1).stableAnchor, anchorEnd: anchor(1).stableAnchor, excerpt: "Private Ashen Road GM note." }],
    createdBy: ashenGm.id
  }).state;

  state.generatedOutputs.push({
    id: newId(),
    organizationId: organization.id,
    outputType: "article_draft",
    homeScope: "campaign",
    campaignId: silver.id,
    body: "Generated draft says Elaria burned the treaty, but this is unsupported speculation.",
    inputClaimIds: [],
    inputSourceIds: [firstSource.id],
    createdAt
  });

  const faq = createFaq(state, {
    organizationId: organization.id,
    scopeType: "campaign",
    scopeId: silver.id,
    question: "Who controls Vel Ori after Session 12?",
    createdBy: rowan.id,
    visibility: "campaign_members"
  });
  state = faq.state;
  state.faqVersions.push({
    id: newId(),
    faqId: faq.faq.id,
    versionNumber: 1,
    answer: "Draft: maybe Chancellor Elaria controls it.",
    evidenceClaimIds: [],
    isAuthoritativeRuling: false,
    createdBy: rowan.id,
    createdAt
  });
  state.faqs.find((item) => item.id === faq.faq.id)!.status = "drafted";

  state = rebuildCampaignArticles(state, { profileId: gm.id, mode: "gm", campaignId: silver.id }, silver.id);
  state = rebuildCampaignArticles(state, { profileId: ashenGm.id, mode: "gm", campaignId: ashen.id }, ashen.id);
  return state;
}

function addEntityDirect(
  state: WikiState,
  organizationId: string,
  scopeType: "world" | "setting" | "campaign" | "library",
  scopeId: string,
  entityType: "npc" | "pc" | "place" | "faction" | "deity" | "creature" | "artifact" | "item" | "event" | "quest" | "rule" | "session" | "lore",
  name: string,
  visibility: "gm_private" | "campaign_members" | "shared_authorized" | "public"
) {
  const entity = {
    id: newId(),
    organizationId,
    homeScope: scopeType,
    worldId: scopeType === "world" ? scopeId : undefined,
    settingId: scopeType === "setting" ? scopeId : undefined,
    campaignId: scopeType === "campaign" ? scopeId : undefined,
    libraryId: scopeType === "library" ? scopeId : undefined,
    entityType,
    name,
    visibility,
    createdAt: nowIso()
  };
  state.entities.push(entity);
  return { state, entity };
}
