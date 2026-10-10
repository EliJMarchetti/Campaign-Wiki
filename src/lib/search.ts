import { readableClaimsForCampaign, readableSourcesForCampaign } from "./permissions";
import type { ArticleProjection, Claim, Id, Source, Viewer, WikiState } from "./types";

export interface SearchResult {
  kind: "article" | "claim" | "source" | "faq";
  id: Id;
  title: string;
  snippet: string;
  score: number;
}

export function searchCampaign(state: WikiState, viewer: Viewer, campaignId: Id, query: string): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const claims = readableClaimsForCampaign(state, viewer, campaignId);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const articles = state.articleProjections.filter(
    (article) => article.campaignId === campaignId && article.sourceClaimIds.some((id) => claimIds.has(id))
  );
  const sources = readableSourcesForCampaign(state, viewer, campaignId);
  const faqs = state.faqs.filter((faq) => {
    if (faq.campaignId !== campaignId) return false;
    if (viewer.mode === "public" && faq.visibility !== "public") return false;
    if (viewer.mode === "player" && faq.visibility === "gm_private") return false;
    return true;
  });

  return [
    ...articles.map((article) => articleResult(article, terms)),
    ...claims.map((claim) => claimResult(state, claim, terms)),
    ...sources.map((source) => sourceResult(state, source, terms)),
    ...faqs.map((faq) => ({
      kind: "faq" as const,
      id: faq.id,
      title: faq.question,
      snippet: faq.status,
      score: scoreText(`${faq.question} ${faq.status}`, terms)
    }))
  ]
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 30);
}

function articleResult(article: ArticleProjection, terms: string[]): SearchResult {
  const baseScore = scoreText(`${article.title} ${article.bodyMarkdown}`, terms);
  return {
    kind: "article",
    id: article.id,
    title: article.title,
    snippet: excerpt(article.bodyMarkdown, terms),
    score: baseScore > 0 ? baseScore + 2 : 0
  };
}

function claimResult(state: WikiState, claim: Claim, terms: string[]): SearchResult {
  const entityName = state.entities.find((entity) => entity.id === claim.subjectEntityId)?.name ?? "Claim";
  const text = `${entityName} ${claim.predicate} ${claim.valueText ?? ""}`;
  const baseScore = scoreText(text, terms);
  return {
    kind: "claim",
    id: claim.id,
    title: `${entityName}: ${claim.predicate}`,
    snippet: claim.valueText ?? claim.epistemicClass,
    score: baseScore > 0 ? baseScore + 1 : 0
  };
}

function sourceResult(state: WikiState, source: Source, terms: string[]): SearchResult {
  const text = state.normalizedBlocks
    .filter((block) => block.sourceId === source.id)
    .slice(0, 20)
    .map((block) => block.text)
    .join(" ");
  return {
    kind: "source",
    id: source.id,
    title: source.title,
    snippet: excerpt(text, terms),
    score: scoreText(`${source.title} ${text}`, terms)
  };
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1);
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  if (!terms.every((term) => lower.includes(term))) return 0;
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function excerpt(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const index = terms.map((term) => lower.indexOf(term)).find((position) => position >= 0) ?? 0;
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + 180);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
