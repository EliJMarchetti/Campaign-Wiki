import { campaignLineage, isInCampaignLineage, scopeEquals } from "./scope";
import type { Claim, Id, ScopedRecord, Source, Viewer, Visibility, WikiState, Role } from "./types";

const editorRoles: Role[] = ["owner", "world_editor", "setting_editor", "gm", "co_gm"];

export function rolesForViewer(state: WikiState, profileId?: Id): Role[] {
  if (!profileId) return ["anonymous_public_reader"];
  const membershipRoles = state.memberships
    .filter((membership) => membership.profileId === profileId)
    .map((membership) => membership.role);
  const grantRoles = state.scopeGrants
    .filter((grant) => grant.granteeProfileId === profileId)
    .map((grant) => grant.role);
  return [...new Set([...membershipRoles, ...grantRoles])];
}

export function hasScopeGrant(state: WikiState, viewer: Viewer, scope: ScopedRecord, roles?: Role[]): boolean {
  if (!viewer.profileId) return false;
  return state.scopeGrants.some((grant) => {
    const roleOk = roles ? roles.includes(grant.role) : true;
    return grant.granteeProfileId === viewer.profileId && roleOk && scopeEquals(grant, scope);
  });
}

export function canReadVisibility(
  state: WikiState,
  viewer: Viewer,
  visibility: Visibility,
  scope: ScopedRecord
): boolean {
  if (visibility === "public") return true;
  if (viewer.mode === "public") return false;
  if (!viewer.profileId) return false;
  if (viewer.mode === "player" && visibility === "gm_private") return false;
  if (
    viewer.campaignId &&
    visibility === "shared_authorized" &&
    isInCampaignLineage(state, viewer.campaignId, scope) &&
    hasScopeGrant(state, viewer, { homeScope: "campaign", campaignId: viewer.campaignId }, [
      "owner",
      "gm",
      "co_gm",
      "player",
      "invited_reader"
    ])
  ) {
    return true;
  }

  if (scope.homeScope === "campaign") {
    const campaignId = scope.campaignId;
    if (!campaignId) return false;
    const isCampaignMember = hasScopeGrant(state, viewer, scope, [
      "owner",
      "gm",
      "co_gm",
      "player",
      "invited_reader"
    ]);
    if (visibility === "campaign_members") return isCampaignMember;
    return isCampaignMember && hasScopeGrant(state, viewer, scope, ["owner", "gm", "co_gm"]);
  }

  if (scope.homeScope === "setting") {
    return hasScopeGrant(state, viewer, scope, ["owner", "world_editor", "setting_editor", "invited_reader"]);
  }

  if (scope.homeScope === "world") {
    return hasScopeGrant(state, viewer, scope, ["owner", "world_editor", "invited_reader"]);
  }

  return hasScopeGrant(state, viewer, scope, ["owner", "world_editor", "setting_editor", "gm", "co_gm", "invited_reader"]);
}

export function canReadScopedRecord(
  state: WikiState,
  viewer: Viewer,
  record: ScopedRecord & { visibility: Visibility }
): boolean {
  return canReadVisibility(state, viewer, record.visibility, record);
}

export function canWriteScope(state: WikiState, viewer: Viewer, scope: ScopedRecord): boolean {
  if (!viewer.profileId || viewer.mode === "public" || viewer.mode === "player") return false;
  if (scope.homeScope === "world") return hasScopeGrant(state, viewer, scope, ["owner", "world_editor"]);
  if (scope.homeScope === "setting") return hasScopeGrant(state, viewer, scope, ["owner", "world_editor", "setting_editor"]);
  if (scope.homeScope === "campaign") return hasScopeGrant(state, viewer, scope, ["owner", "gm", "co_gm"]);
  return hasScopeGrant(state, viewer, scope, editorRoles);
}

export function readableClaimsForCampaign(state: WikiState, viewer: Viewer, campaignId: Id): Claim[] {
  return state.claims.filter((claim) => {
    if (claim.reviewState !== "accepted" || !["accepted", "historical"].includes(claim.canonState)) return false;
    if (!isInCampaignLineage(state, campaignId, claim)) return false;
    return canReadScopedRecord(state, viewer, claim);
  });
}

export function readableSourcesForCampaign(state: WikiState, viewer: Viewer, campaignId: Id): Source[] {
  return state.sources.filter((source) => {
    if (!isInCampaignLineage(state, campaignId, source)) return false;
    return canReadScopedRecord(state, viewer, source);
  });
}

export function campaignScopeViewer(state: WikiState, profileId: Id | undefined, campaignId: Id, mode: Viewer["mode"]): Viewer {
  const lineage = campaignLineage(state, campaignId);
  return {
    profileId,
    campaignId: lineage.campaign?.id,
    mode
  };
}
