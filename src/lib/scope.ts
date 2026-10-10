import type { Campaign, Id, ScopeType, ScopedRecord, Setting, WikiState, World } from "./types";

export function getScopeId(record: ScopedRecord): Id | undefined {
  if (record.homeScope === "world") return record.worldId;
  if (record.homeScope === "setting") return record.settingId;
  if (record.homeScope === "campaign") return record.campaignId;
  return record.libraryId;
}

export function scopeEquals(a: ScopedRecord, b: ScopedRecord): boolean {
  return a.homeScope === b.homeScope && getScopeId(a) === getScopeId(b);
}

export function scopeLabel(state: WikiState, scope: ScopedRecord): string {
  if (scope.homeScope === "world") return state.worlds.find((world) => world.id === scope.worldId)?.name ?? "World";
  if (scope.homeScope === "setting") return state.settings.find((setting) => setting.id === scope.settingId)?.name ?? "Setting";
  if (scope.homeScope === "campaign") return state.campaigns.find((campaign) => campaign.id === scope.campaignId)?.name ?? "Campaign";
  return state.referenceLibraries.find((library) => library.id === scope.libraryId)?.name ?? "Library";
}

export function campaignLineage(state: WikiState, campaignId: Id): {
  campaign?: Campaign;
  setting?: Setting;
  world?: World;
  scopes: ScopedRecord[];
} {
  const campaign = state.campaigns.find((item) => item.id === campaignId);
  const setting = campaign?.settingId ? state.settings.find((item) => item.id === campaign.settingId) : undefined;
  const world = setting?.worldId ? state.worlds.find((item) => item.id === setting.worldId) : undefined;
  const scopes: ScopedRecord[] = [];
  if (world) scopes.push({ homeScope: "world", worldId: world.id });
  if (setting) scopes.push({ homeScope: "setting", settingId: setting.id });
  if (campaign) scopes.push({ homeScope: "campaign", campaignId: campaign.id });
  const attachedLibraries = state.libraryAttachments.filter((attachment) => {
    if (attachment.homeScope === "campaign") return attachment.campaignId === campaign?.id;
    if (attachment.homeScope === "setting") return attachment.settingId === setting?.id;
    if (attachment.homeScope === "world") return attachment.worldId === world?.id;
    return false;
  });
  for (const attachment of attachedLibraries) {
    scopes.push({ homeScope: "library", libraryId: attachment.libraryId });
  }
  return { campaign, setting, world, scopes };
}

export function isInCampaignLineage(state: WikiState, campaignId: Id, record: ScopedRecord): boolean {
  return campaignLineage(state, campaignId).scopes.some((scope) => scopeEquals(scope, record));
}

export function scopeFor(type: ScopeType, id: Id): ScopedRecord {
  if (type === "world") return { homeScope: "world", worldId: id };
  if (type === "setting") return { homeScope: "setting", settingId: id };
  if (type === "campaign") return { homeScope: "campaign", campaignId: id };
  return { homeScope: "library", libraryId: id };
}
