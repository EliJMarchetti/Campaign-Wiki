export type Id = string;

export type ScopeType = "world" | "setting" | "campaign" | "library";
export type Visibility = "gm_private" | "campaign_members" | "shared_authorized" | "public";
export type Role =
  | "owner"
  | "world_editor"
  | "setting_editor"
  | "gm"
  | "co_gm"
  | "player"
  | "invited_reader"
  | "anonymous_public_reader";

export type EntityType =
  | "npc"
  | "pc"
  | "place"
  | "faction"
  | "deity"
  | "creature"
  | "artifact"
  | "item"
  | "event"
  | "quest"
  | "rule"
  | "session"
  | "lore";

export type AuthorityClass =
  | "objective_gm_world_narration"
  | "explicit_gm_ruling"
  | "resolved_event"
  | "gm_approved_setting_doc"
  | "npc_testimony"
  | "player_report"
  | "rumor"
  | "inference"
  | "speculation"
  | "joke"
  | "off_topic"
  | "planned_future_content"
  | "unclear";

export type EpistemicClass =
  | "world_true"
  | "character_belief"
  | "rumor"
  | "lie_or_deception"
  | "speculation"
  | "attempted_action"
  | "unknown";

export type ReviewState = "proposed" | "pending" | "accepted" | "contested" | "rejected";
export type CanonState =
  | "proposed"
  | "accepted"
  | "contested"
  | "superseded"
  | "rejected"
  | "historical"
  | "unresolved";

export type SourceType =
  | "transcript"
  | "gm_notes"
  | "setting_bible"
  | "world_lore"
  | "rules"
  | "faq_seed"
  | "errata_document"
  | "generated_output";

export type SpanTag =
  | "gm_ruling"
  | "gm_narration"
  | "gm_as_npc"
  | "in_character_lie"
  | "player_declaration"
  | "resolved_action"
  | "player_theory"
  | "joke"
  | "off_topic"
  | "hypothetical"
  | "unplayed_preparation"
  | "rules_talk"
  | "unknown";

export interface ScopedRecord {
  homeScope: ScopeType;
  worldId?: Id;
  settingId?: Id;
  campaignId?: Id;
  libraryId?: Id;
}

export interface Profile {
  id: Id;
  displayName: string;
  email?: string;
  createdAt: string;
}

export interface Organization {
  id: Id;
  name: string;
  createdBy: Id;
  createdAt: string;
}

export interface Membership {
  id: Id;
  organizationId: Id;
  profileId: Id;
  role: Role;
  createdAt: string;
}

export interface ScopeGrant extends ScopedRecord {
  id: Id;
  organizationId: Id;
  granteeProfileId?: Id;
  role: Role;
  createdAt: string;
}

export interface World {
  id: Id;
  organizationId: Id;
  name: string;
  description: string;
  visibility: Visibility;
  createdBy: Id;
  createdAt: string;
}

export interface Setting {
  id: Id;
  organizationId: Id;
  worldId?: Id;
  name: string;
  era: string;
  description: string;
  forkedFromSettingId?: Id;
  forkSnapshot?: string;
  visibility: Visibility;
  createdBy: Id;
  createdAt: string;
}

export interface SettingFork {
  id: Id;
  sourceSettingId: Id;
  forkSettingId: Id;
  forkedBy: Id;
  reason: string;
  snapshotLabel: string;
  createdAt: string;
}

export interface Campaign {
  id: Id;
  organizationId: Id;
  settingId?: Id;
  name: string;
  description: string;
  visibility: Visibility;
  gmProfileId: Id;
  createdAt: string;
}

export interface ReferenceLibrary {
  id: Id;
  organizationId: Id;
  name: string;
  description: string;
  createdBy: Id;
  createdAt: string;
}

export interface LibraryAttachment extends ScopedRecord {
  id: Id;
  libraryId: Id;
  createdAt: string;
}

export interface Session {
  id: Id;
  campaignId: Id;
  title: string;
  sessionDate?: string;
  summary: string;
  createdAt: string;
}

export interface Source extends ScopedRecord {
  id: Id;
  organizationId: Id;
  sessionId?: Id;
  sourceType: SourceType;
  title: string;
  author?: string;
  authorityClass: AuthorityClass;
  visibility: Visibility;
  language: string;
  contentHash: string;
  trackName?: string;
  startOffsetMs?: number;
  createdBy: Id;
  createdAt: string;
}

export interface SourceVersion {
  id: Id;
  sourceId: Id;
  versionNumber: number;
  originalText: string;
  normalizedText: string;
  createdBy: Id;
  createdAt: string;
}

export interface SourceFile {
  id: Id;
  sourceId: Id;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  storagePath?: string;
  createdAt: string;
}

export interface NormalizedBlock {
  id: Id;
  sourceId: Id;
  sourceVersionId: Id;
  stableAnchor: string;
  ordinal: number;
  blockType: "paragraph" | "utterance" | "heading" | "metadata";
  speakerLabel?: string;
  startMs?: number;
  endMs?: number;
  text: string;
}

export interface TranscriptUtterance {
  id: Id;
  sourceId: Id;
  sourceVersionId: Id;
  stableAnchor: string;
  utteranceId: string;
  speakerLabel?: string;
  startMs?: number;
  endMs?: number;
  text: string;
}

export interface SpeakerMapping {
  id: Id;
  campaignId: Id;
  speakerLabel: string;
  playerProfileId?: Id;
  characterName?: string;
  roleTag: "gm" | "player" | "gm_as_npc" | "npc" | "ooc" | "unknown";
  createdAt: string;
}

export interface TranscriptCorrection {
  id: Id;
  sourceVersionId: Id;
  targetAnchor: string;
  correctedText?: string;
  correctedSpeaker?: string;
  reason: string;
  createdBy: Id;
  createdAt: string;
}

export interface SpanAnnotation {
  id: Id;
  sourceVersionId: Id;
  anchorStart: string;
  anchorEnd: string;
  tags: SpanTag[];
  confidence: number;
  humanOverride: boolean;
  notes: string;
  createdBy?: Id;
  createdAt: string;
}

export interface ProcessingRun {
  id: Id;
  organizationId: Id;
  stage: string;
  provider: "manual" | "mock" | "openai";
  model?: string;
  promptVersion: string;
  schemaVersion: string;
  inputSourceIds: Id[];
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  tokenCount?: number;
  costUsd?: number;
  error?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: Id;
  organizationId: Id;
  processingRunId?: Id;
  kind: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "succeeded" | "failed" | "dead_letter";
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionProposal {
  id: Id;
  processingRunId?: Id;
  kind: "entity" | "claim" | "relationship" | "timeline_event" | "faq_update";
  payload: Record<string, unknown>;
  evidence: EvidenceRef[];
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface Entity extends ScopedRecord {
  id: Id;
  organizationId: Id;
  entityType: EntityType;
  name: string;
  visibility: Visibility;
  createdAt: string;
}

export interface Alias {
  id: Id;
  entityId: Id;
  alias: string;
  isHidden: boolean;
  visibility: Visibility;
}

export interface ScopedEntityVersion extends ScopedRecord {
  id: Id;
  entityId: Id;
  stateLabel: string;
  effectiveTime?: string;
  visibility: Visibility;
  createdAt: string;
}

export interface EvidenceRef {
  sourceId?: Id;
  sourceVersionId?: Id;
  anchorStart?: string;
  anchorEnd?: string;
  rulingId?: Id;
  excerpt: string;
}

export interface Claim extends ScopedRecord {
  id: Id;
  organizationId: Id;
  subjectEntityId?: Id;
  predicate: string;
  valueText?: string;
  objectEntityId?: Id;
  effectiveTime?: string;
  authorityClass: AuthorityClass;
  epistemicClass: EpistemicClass;
  reviewState: ReviewState;
  canonState: CanonState;
  visibility: Visibility;
  supersedesClaimId?: Id;
  supersededByClaimId?: Id;
  createdBy: Id;
  createdAt: string;
}

export interface ClaimEvidence extends EvidenceRef {
  id: Id;
  claimId: Id;
  createdAt: string;
}

export interface CanonRuling extends ScopedRecord {
  id: Id;
  organizationId: Id;
  rulingText: string;
  signedBy: Id;
  visibility: Visibility;
  createdAt: string;
}

export interface ContradictionCase extends ScopedRecord {
  id: Id;
  organizationId: Id;
  claimAId: Id;
  claimBId: Id;
  status: "open" | "resolved" | "unresolved";
  resolutionType?:
    | "ruling"
    | "temporal_distinction"
    | "mistaken_identity"
    | "npc_deception"
    | "retcon"
    | "transcript_error"
    | "unresolved";
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Erratum extends ScopedRecord {
  id: Id;
  organizationId: Id;
  correctionType:
    | "transcription"
    | "speaker_assignment"
    | "entity_matching"
    | "extracted_fact"
    | "official_canon_retcon"
    | "rule_clarification"
    | "editorial_page_fix";
  targetClaimId?: Id;
  oldValue: string;
  newValue: string;
  reason: string;
  signedBy: Id;
  visibility: Visibility;
  createdAt: string;
}

export interface Faq extends ScopedRecord {
  id: Id;
  organizationId: Id;
  question: string;
  alternatePhrasings: string[];
  status: "open" | "drafted" | "needs_ruling" | "answered" | "superseded" | "archived";
  visibility: Visibility;
  createdBy: Id;
  createdAt: string;
}

export interface FaqVersion {
  id: Id;
  faqId: Id;
  versionNumber: number;
  answer: string;
  evidenceClaimIds: Id[];
  isAuthoritativeRuling: boolean;
  createdBy: Id;
  createdAt: string;
}

export interface Relationship {
  id: Id;
  organizationId: Id;
  sourceEntityId: Id;
  targetEntityId: Id;
  predicate: string;
  claimId?: Id;
  visibility: Visibility;
}

export interface TimelineEvent extends ScopedRecord {
  id: Id;
  organizationId: Id;
  claimId?: Id;
  eventTime: string;
  title: string;
  description: string;
  visibility: Visibility;
}

export interface ArticleProjection extends ScopedRecord {
  id: Id;
  organizationId: Id;
  entityId?: Id;
  title: string;
  slug: string;
  bodyMarkdown: string;
  sourceClaimIds: Id[];
  visibility: Visibility;
  projectionHash: string;
  updatedAt: string;
}

export interface ArticleRevision {
  id: Id;
  articleProjectionId: Id;
  bodyMarkdown: string;
  sourceClaimIds: Id[];
  createdBy?: Id;
  createdAt: string;
}

export interface GeneratedOutput extends ScopedRecord {
  id: Id;
  organizationId: Id;
  outputType: "recap" | "article_draft" | "faq_draft" | "answer" | "summary";
  body: string;
  inputClaimIds: Id[];
  inputSourceIds: Id[];
  createdAt: string;
}

export interface PublicationGrant extends ScopedRecord {
  id: Id;
  organizationId: Id;
  audience: "public" | "unlisted" | "members";
  createdBy: Id;
  createdAt: string;
}

export interface AiPromptPacket extends ScopedRecord {
  id: Id;
  organizationId: Id;
  packetType:
    | "session-classification"
    | "entity-and-fact-extraction"
    | "contradiction-review"
    | "faq-revision"
    | "article-update"
    | "full-rebuild";
  payload: {
    instructions: string;
    schema: Record<string, unknown>;
    scopes: ScopedRecord[];
    excerpts: Array<EvidenceRef & { text: string }>;
    existingClaims: Claim[];
  };
  privacyConfirmedBy: Id;
  createdAt: string;
}

export interface AuditEvent {
  id: Id;
  organizationId: Id;
  actorProfileId?: Id;
  eventType: string;
  targetType: string;
  targetId?: Id;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface WikiState {
  version: number;
  profiles: Profile[];
  organizations: Organization[];
  memberships: Membership[];
  scopeGrants: ScopeGrant[];
  worlds: World[];
  settings: Setting[];
  settingForks: SettingFork[];
  campaigns: Campaign[];
  referenceLibraries: ReferenceLibrary[];
  libraryAttachments: LibraryAttachment[];
  sessions: Session[];
  sources: Source[];
  sourceVersions: SourceVersion[];
  sourceFiles: SourceFile[];
  normalizedBlocks: NormalizedBlock[];
  transcriptUtterances: TranscriptUtterance[];
  speakerMappings: SpeakerMapping[];
  transcriptCorrections: TranscriptCorrection[];
  spanAnnotations: SpanAnnotation[];
  processingRuns: ProcessingRun[];
  jobs: Job[];
  extractionProposals: ExtractionProposal[];
  entities: Entity[];
  aliases: Alias[];
  scopedEntityVersions: ScopedEntityVersion[];
  claims: Claim[];
  claimEvidence: ClaimEvidence[];
  canonRulings: CanonRuling[];
  contradictionCases: ContradictionCase[];
  errata: Erratum[];
  faqs: Faq[];
  faqVersions: FaqVersion[];
  relationships: Relationship[];
  timelineEvents: TimelineEvent[];
  articleProjections: ArticleProjection[];
  articleRevisions: ArticleRevision[];
  generatedOutputs: GeneratedOutput[];
  publicationGrants: PublicationGrant[];
  aiPromptPackets: AiPromptPacket[];
  auditEvents: AuditEvent[];
}

export interface Viewer {
  profileId?: Id;
  mode: "gm" | "player" | "public";
  campaignId?: Id;
}

export interface ImportSourceInput extends ScopedRecord {
  organizationId: Id;
  sessionId?: Id;
  sourceType: SourceType;
  title: string;
  author?: string;
  authorityClass: AuthorityClass;
  visibility: Visibility;
  language: string;
  originalText: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  trackName?: string;
  startOffsetMs?: number;
  createdBy: Id;
}

export interface AppView {
  state: WikiState;
  viewer: Viewer;
  selectedCampaign?: Campaign;
  selectedSetting?: Setting;
  selectedWorld?: World;
}
