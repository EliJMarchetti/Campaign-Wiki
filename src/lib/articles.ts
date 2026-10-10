import { sha256, slugify, newId, nowIso } from "./id";
import { readableClaimsForCampaign } from "./permissions";
import type { ArticleProjection, Claim, Id, Viewer, WikiState } from "./types";

export function rebuildCampaignArticles(state: WikiState, viewer: Viewer, campaignId: Id): WikiState {
  const next = structuredClone(state) as WikiState;
  const claims = readableClaimsForCampaign(next, viewer, campaignId);
  const grouped = groupByEntity(claims);
  for (const [entityId, entityClaims] of grouped.entries()) {
    const entity = next.entities.find((item) => item.id === entityId);
    if (!entity) continue;
    const body = renderArticleBody(next, entity.name, entityClaims);
    const projectionHash = sha256(body);
    const slug = slugify(entity.name);
    const existing = next.articleProjections.find((article) => article.campaignId === campaignId && article.slug === slug);
    const base: ArticleProjection = {
      id: existing?.id ?? newId(),
      organizationId: entity.organizationId,
      entityId,
      homeScope: "campaign",
      campaignId,
      title: entity.name,
      slug,
      bodyMarkdown: body,
      sourceClaimIds: entityClaims.map((claim) => claim.id),
      visibility: entity.visibility,
      projectionHash,
      updatedAt: nowIso()
    };
    if (existing) {
      Object.assign(existing, base);
      next.articleRevisions.push({
        id: newId(),
        articleProjectionId: existing.id,
        bodyMarkdown: body,
        sourceClaimIds: base.sourceClaimIds,
        createdAt: nowIso()
      });
    } else {
      next.articleProjections.push(base);
      next.articleRevisions.push({
        id: newId(),
        articleProjectionId: base.id,
        bodyMarkdown: body,
        sourceClaimIds: base.sourceClaimIds,
        createdAt: nowIso()
      });
    }
  }
  return next;
}

export function renderArticleBody(state: WikiState, title: string, claims: Claim[]): string {
  const lines = [`# ${title}`, "", "## Canon Ledger"];
  for (const claim of claims.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const evidence = state.claimEvidence.filter((item) => item.claimId === claim.id);
    const citations = evidence
      .map((item) => {
        const source = item.sourceId ? state.sources.find((candidate) => candidate.id === item.sourceId) : undefined;
        if (source) return `${source.title}#${item.anchorStart ?? "source"}`;
        const ruling = item.rulingId ? state.canonRulings.find((candidate) => candidate.id === item.rulingId) : undefined;
        return ruling ? `Ruling ${ruling.id.slice(0, 8)}` : "uncited";
      })
      .join("; ");
    lines.push(`- **${claim.predicate}:** ${claim.valueText ?? "see linked entity"} (${claim.authorityClass}; ${claim.epistemicClass}) [${citations}]`);
  }
  lines.push("", "_This page is a materialized projection. It is not evidence._");
  return lines.join("\n");
}

function groupByEntity(claims: Claim[]): Map<Id, Claim[]> {
  const grouped = new Map<Id, Claim[]>();
  for (const claim of claims) {
    if (!claim.subjectEntityId) continue;
    const bucket = grouped.get(claim.subjectEntityId) ?? [];
    bucket.push(claim);
    grouped.set(claim.subjectEntityId, bucket);
  }
  return grouped;
}
