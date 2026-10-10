import type { WikiState } from "./types";

export function emptyState(): WikiState {
  return {
    version: 1,
    profiles: [],
    organizations: [],
    memberships: [],
    scopeGrants: [],
    worlds: [],
    settings: [],
    settingForks: [],
    campaigns: [],
    referenceLibraries: [],
    libraryAttachments: [],
    sessions: [],
    sources: [],
    sourceVersions: [],
    sourceFiles: [],
    normalizedBlocks: [],
    transcriptUtterances: [],
    speakerMappings: [],
    transcriptCorrections: [],
    spanAnnotations: [],
    processingRuns: [],
    jobs: [],
    extractionProposals: [],
    entities: [],
    aliases: [],
    scopedEntityVersions: [],
    claims: [],
    claimEvidence: [],
    canonRulings: [],
    contradictionCases: [],
    errata: [],
    faqs: [],
    faqVersions: [],
    relationships: [],
    timelineEvents: [],
    articleProjections: [],
    articleRevisions: [],
    generatedOutputs: [],
    publicationGrants: [],
    aiPromptPackets: [],
    auditEvents: []
  };
}

export function cloneState(state: WikiState): WikiState {
  return JSON.parse(JSON.stringify(state)) as WikiState;
}
