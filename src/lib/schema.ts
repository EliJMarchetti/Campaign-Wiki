import { z } from "zod";

export const evidenceRefSchema = z.object({
  sourceId: z.string().uuid().optional(),
  sourceVersionId: z.string().uuid().optional(),
  anchorStart: z.string().optional(),
  anchorEnd: z.string().optional(),
  rulingId: z.string().uuid().optional(),
  excerpt: z.string().min(1)
});

export const aiProposalSchema = z.object({
  kind: z.enum(["entity", "claim", "relationship", "timeline_event", "faq_update"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceRefSchema).min(1),
  payload: z.record(z.string(), z.unknown())
});

export const aiImportSchema = z.object({
  packetId: z.string().uuid().optional(),
  proposals: z.array(aiProposalSchema)
});

export type AiImportPayload = z.infer<typeof aiImportSchema>;

export const manualClaimSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  entityName: z.string().min(1),
  entityType: z.string().min(1),
  predicate: z.string().min(1),
  valueText: z.string().min(1),
  sourceId: z.string().uuid(),
  anchorStart: z.string().min(1),
  visibility: z.enum(["gm_private", "campaign_members", "shared_authorized", "public"]).default("campaign_members")
});
