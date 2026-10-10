import {
  Archive,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Library,
  MessageSquareText,
  Search,
  Shield,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import Link from "next/link";
import {
  acceptProposalAction,
  answerFaqAction,
  applyErratumAction,
  correctSpeakerAction,
  createCampaignAction,
  createFaqAction,
  createManualClaimAction,
  createSettingAction,
  createWorldAction,
  generatePromptPacketAction,
  importAiResponseAction,
  importSourceAction,
  promoteClaimAction,
  rebuildArticlesAction,
  runMockAiAction,
  seedDemoAction
} from "./actions";
import { readableClaimsForCampaign, readableSourcesForCampaign } from "@/lib/permissions";
import { searchCampaign } from "@/lib/search";
import { campaignLineage, scopeLabel } from "@/lib/scope";
import { loadState } from "@/lib/store";
import type { Claim, Id, Viewer, WikiState } from "@/lib/types";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

export default async function Home(props: PageProps) {
  const searchParams = await props.searchParams;
  const state = await loadState();
  if (state.organizations.length === 0) {
    return <EmptyInstall />;
  }
  const campaignId = one(searchParams?.campaign) ?? state.campaigns[0]?.id;
  const selectedCampaign = state.campaigns.find((campaign) => campaign.id === campaignId) ?? state.campaigns[0];
  const defaultUser = selectedCampaign?.gmProfileId ?? state.profiles[0]?.id;
  const viewer: Viewer = {
    profileId: one(searchParams?.user) ?? defaultUser,
    campaignId: selectedCampaign?.id,
    mode: (one(searchParams?.mode) as Viewer["mode"]) ?? "gm"
  };
  const query = one(searchParams?.q) ?? "";
  const lineage = selectedCampaign ? campaignLineage(state, selectedCampaign.id) : undefined;
  const claims = selectedCampaign ? readableClaimsForCampaign(state, viewer, selectedCampaign.id) : [];
  const sources = selectedCampaign ? readableSourcesForCampaign(state, viewer, selectedCampaign.id) : [];
  const searchResults = selectedCampaign ? searchCampaign(state, viewer, selectedCampaign.id, query) : [];
  const latestPacket = state.aiPromptPackets.at(-1);

  return (
    <main className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><BookOpen size={22} /></span>
            <span>Campaign Wiki</span>
          </Link>
          <form className="toolbar" action="/">
            <label>
              Campaign
              <select name="campaign" defaultValue={selectedCampaign?.id}>
                {state.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label>
              View As
              <select name="mode" defaultValue={viewer.mode}>
                <option value="gm">GM</option>
                <option value="player">Player</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label>
              Persona
              <select name="user" defaultValue={viewer.profileId}>
                {state.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                ))}
              </select>
            </label>
            <button type="submit"><Shield size={16} />Apply</button>
          </form>
        </div>
      </header>

      <div className="layout">
        <nav className="side" aria-label="Main">
          <a href="#home">Home</a>
          <a href="#hierarchy">Worlds & Settings</a>
          <a href="#sources">Sources</a>
          <a href="#review">GM Review</a>
          <a href="#canon">Canon Ledger</a>
          <a href="#encyclopedia">Encyclopedia</a>
          <a href="#faq">FAQ</a>
          <a href="#errata">Errata</a>
          <a href="#ai">AI & Prompts</a>
          <a href="#search">Search</a>
          <a href="#export">Export</a>
        </nav>

        <div className="content">
          <section id="home" className="hero">
            <div className="pill-row">
              {lineage?.world && <span className="pill good">World: {lineage.world.name}</span>}
              {lineage?.setting && <span className="pill good">Setting: {lineage.setting.name}</span>}
              {selectedCampaign && <span className="pill good">Campaign: {selectedCampaign.name}</span>}
              <span className="pill warn">Mode: {viewer.mode}</span>
            </div>
            <h1>{selectedCampaign?.name ?? "Campaign Wiki"}</h1>
            <p>{selectedCampaign?.description ?? "Create a campaign to begin."}</p>
            <div className="grid cols-3">
              <Metric icon={<Database size={18} />} label="Accepted visible claims" value={claims.length} />
              <Metric icon={<FileText size={18} />} label="Readable sources" value={sources.length} />
              <Metric icon={<Brain size={18} />} label="Pending proposals" value={state.extractionProposals.filter((proposal) => proposal.status === "pending").length} />
            </div>
          </section>

          <section id="hierarchy" className="section">
            <SectionTitle icon={<GitBranch size={20} />} title="Worlds & Settings" subtitle="Explicit scope inheritance and local campaign branches." />
            <div className="grid cols-3">
              <CreateWorldForm viewer={viewer} />
              <CreateSettingForm state={state} viewer={viewer} />
              <CreateCampaignForm state={state} viewer={viewer} />
            </div>
            <div className="grid cols-3">
              {state.worlds.map((world) => (
                <div className="card" key={world.id}>
                  <strong>{world.name}</strong>
                  <p>{world.description}</p>
                  <span className="pill">{world.visibility}</span>
                </div>
              ))}
            </div>
          </section>

          {selectedCampaign && (
            <>
              <section id="sources" className="section">
                <SectionTitle icon={<Archive size={20} />} title="Source Archive" subtitle="Paste or upload transcripts and notes. Originals stay immutable; corrections are overlays." />
                <ImportSourceForm state={state} viewer={viewer} campaignId={selectedCampaign.id} />
                <div className="list">
                  {sources.map((source) => (
                    <SourceCard key={source.id} state={state} sourceId={source.id} viewer={viewer} campaignId={selectedCampaign.id} />
                  ))}
                  {sources.length === 0 && <div className="empty">No readable sources for this view.</div>}
                </div>
              </section>

              <section id="review" className="section">
                <SectionTitle icon={<CheckCircle2 size={20} />} title="GM Review Desk" subtitle="AI and manual proposals land here before they can affect canon." />
                <form action={runMockAiAction} className="card">
                  <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                  <strong>Run mock analysis</strong>
                  <p>Creates deterministic proposals in the real review queue and classifies spans. This does not require AI credentials.</p>
                  <div className="grid cols-2">
                    {sources.map((source) => (
                      <label key={source.id}>
                        <span><input type="checkbox" name="sourceIds" value={source.id} /> {source.title}</span>
                      </label>
                    ))}
                  </div>
                  <button type="submit"><Sparkles size={16} />Run Mock AI</button>
                </form>
                <div className="list">
                  {state.extractionProposals.filter((proposal) => proposal.status === "pending").map((proposal) => (
                    <div className="card" key={proposal.id}>
                      <div className="section-header">
                        <div>
                          <strong>{proposal.kind}</strong>
                          <p>{JSON.stringify(proposal.payload)}</p>
                        </div>
                        <span className="pill warn">{Math.round(proposal.confidence * 100)}%</span>
                      </div>
                      {proposal.evidence.map((evidence) => (
                        <p key={`${proposal.id}-${evidence.anchorStart}`} className="source-block"><code>{evidence.anchorStart}</code> {evidence.excerpt}</p>
                      ))}
                      <form action={acceptProposalAction}>
                        <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <button type="submit"><CheckCircle2 size={16} />Accept Into Ledger</button>
                      </form>
                    </div>
                  ))}
                  {state.extractionProposals.filter((proposal) => proposal.status === "pending").length === 0 && <div className="empty">No pending proposals.</div>}
                </div>
              </section>

              <section id="canon" className="section">
                <SectionTitle icon={<Library size={20} />} title="Canon Ledger" subtitle="Structured claims cite source anchors or signed rulings." />
                <ManualClaimForm state={state} viewer={viewer} campaignId={selectedCampaign.id} sources={sources} />
                <PromotionForm state={state} viewer={viewer} campaignId={selectedCampaign.id} claims={claims} />
                <div className="list">
                  {claims.map((claim) => <ClaimCard key={claim.id} state={state} claim={claim} />)}
                </div>
              </section>

              <section id="encyclopedia" className="section">
                <SectionTitle icon={<BookOpen size={20} />} title="Encyclopedia" subtitle="Materialized wiki projections rebuilt from the accepted ledger." />
                <form action={rebuildArticlesAction}>
                  <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                  <button type="submit"><Database size={16} />Rebuild Wiki From Ledger</button>
                </form>
                <div className="grid cols-2">
                  {state.articleProjections.filter((article) => article.campaignId === selectedCampaign.id).map((article) => (
                    <article className="card article-body" key={article.id}>
                      {article.bodyMarkdown.split("\n").map((line, index) => renderMarkdownLine(line, index))}
                    </article>
                  ))}
                </div>
              </section>

              <section id="faq" className="section">
                <SectionTitle icon={<MessageSquareText size={20} />} title="FAQ" subtitle="Drafts are not rulings unless explicitly signed." />
                <CreateFaqForm viewer={viewer} campaignId={selectedCampaign.id} />
                <div className="list">
                  {state.faqs.filter((faq) => faq.campaignId === selectedCampaign.id).map((faq) => (
                    <div className="card" key={faq.id}>
                      <div className="section-header">
                        <strong>{faq.question}</strong>
                        <span className={faq.status === "answered" ? "pill good" : "pill warn"}>{faq.status}</span>
                      </div>
                      {state.faqVersions.filter((version) => version.faqId === faq.id).map((version) => (
                        <p key={version.id}>{version.answer} <span className="pill">{version.isAuthoritativeRuling ? "signed ruling" : "draft output"}</span></p>
                      ))}
                      <form action={answerFaqAction} className="form-grid">
                        <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                        <input type="hidden" name="faqId" value={faq.id} />
                        <label className="full">Answer<textarea name="answer" required /></label>
                        <label><span><input type="checkbox" name="authoritativeRuling" /> Sign as ruling</span></label>
                        <button type="submit"><CheckCircle2 size={16} />Save FAQ Version</button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>

              <section id="errata" className="section">
                <SectionTitle icon={<TriangleAlert size={20} />} title="Errata" subtitle="Corrections supersede prior claims without deleting evidence." />
                <form action={applyErratumAction} className="form-grid">
                  <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                  <label className="full">Target claim
                    <select name="targetClaimId" required>
                      {claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.predicate}: {claim.valueText}</option>)}
                    </select>
                  </label>
                  <label>Correction type
                    <select name="correctionType">
                      <option value="official_canon_retcon">Official canon retcon</option>
                      <option value="transcription">Transcription</option>
                      <option value="speaker_assignment">Speaker assignment</option>
                      <option value="extracted_fact">Extracted fact</option>
                      <option value="rule_clarification">Rule clarification</option>
                    </select>
                  </label>
                  <label>New value<input name="newValue" required /></label>
                  <label className="full">Reason<textarea name="reason" required /></label>
                  <button type="submit" className="warning"><TriangleAlert size={16} />Apply Erratum</button>
                </form>
                <div className="list">
                  {state.errata.map((erratum) => (
                    <div className="card" key={erratum.id}>
                      <strong>{erratum.correctionType}</strong>
                      <p><s>{erratum.oldValue}</s></p>
                      <p>{erratum.newValue}</p>
                      <p>{erratum.reason}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="ai" className="section">
                <SectionTitle icon={<Brain size={20} />} title="AI & Prompt Packages" subtitle="Manual prompt export and validated import work without API credentials." />
                <div className="grid cols-2">
                  <form action={generatePromptPacketAction} className="card">
                    <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                    <strong>Export prompt package</strong>
                    <label>Task type
                      <select name="packetType">
                        <option value="entity-and-fact-extraction">Entity and fact extraction</option>
                        <option value="session-classification">Session classification</option>
                        <option value="contradiction-review">Contradiction review</option>
                        <option value="faq-revision">FAQ revision</option>
                        <option value="article-update">Article update</option>
                        <option value="full-rebuild">Full rebuild</option>
                      </select>
                    </label>
                    <button type="submit"><KeyRound size={16} />Confirm Privacy & Export</button>
                  </form>
                  <form action={importAiResponseAction} className="card">
                    <ContextFields viewer={viewer} campaignId={selectedCampaign.id} />
                    <strong>Import structured AI response</strong>
                    <textarea name="aiJson" placeholder='{"proposals":[...]}' required />
                    <button type="submit"><Brain size={16} />Validate Into Review Queue</button>
                  </form>
                </div>
                {latestPacket && (
                  <div className="card">
                    <strong>Latest prompt packet</strong>
                    <pre>{JSON.stringify(latestPacket.payload, null, 2)}</pre>
                  </div>
                )}
              </section>

              <section id="search" className="section">
                <SectionTitle icon={<Search size={20} />} title="Search" subtitle="Search filters before retrieval, so hidden snippets and counts stay hidden." />
                <form action="/" className="form-grid">
                  <input type="hidden" name="campaign" value={selectedCampaign.id} />
                  <input type="hidden" name="user" value={viewer.profileId ?? ""} />
                  <input type="hidden" name="mode" value={viewer.mode} />
                  <label className="full">Query<input name="q" defaultValue={query} placeholder="Vel Ori, Moon Gate, ruling..." /></label>
                  <button type="submit"><Search size={16} />Search</button>
                </form>
                <div className="list">
                  {searchResults.map((result) => (
                    <div className="card" key={`${result.kind}-${result.id}`}>
                      <div className="pill-row"><span className="pill">{result.kind}</span><span className="pill good">score {result.score}</span></div>
                      <strong>{result.title}</strong>
                      <p>{result.snippet}</p>
                    </div>
                  ))}
                  {query && searchResults.length === 0 && <div className="empty">No authorized results for this view.</div>}
                </div>
              </section>

              <section id="export" className="section">
                <SectionTitle icon={<FileText size={20} />} title="Exports" subtitle="Backups include provenance and respect the current viewer." />
                <a className="button" href={`/api/export?campaignId=${selectedCampaign.id}&userId=${viewer.profileId ?? ""}&mode=${viewer.mode}`}>Download JSON Backup</a>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function EmptyInstall() {
  return (
    <main className="app">
      <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
        <section className="hero">
          <div className="pill-row"><span className="pill warn">Empty repository state</span></div>
          <h1>Campaign Wiki</h1>
          <p>Seed the acceptance-test demo to create Aetherion, three campaigns, transcripts, claims, FAQ drafts and isolation fixtures.</p>
          <form action={seedDemoAction}>
            <button type="submit"><Sparkles size={16} />Seed Demo</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card metric">
      <span className="pill-row">{icon}<span>{label}</span></span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="section-header">
      <div>
        <div className="pill-row"><span className="pill good">{icon}{title}</span></div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function ContextFields({ viewer, campaignId }: { viewer: Viewer; campaignId: Id }) {
  return (
    <>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="profileId" value={viewer.profileId ?? ""} />
      <input type="hidden" name="mode" value={viewer.mode} />
    </>
  );
}

function CreateWorldForm({ viewer }: { viewer: Viewer }) {
  return (
    <form action={createWorldAction} className="card">
      <input type="hidden" name="profileId" value={viewer.profileId ?? ""} />
      <strong>New world</strong>
      <label>Name<input name="name" required /></label>
      <label>Description<textarea name="description" /></label>
      <button type="submit">Create World</button>
    </form>
  );
}

function CreateSettingForm({ state, viewer }: { state: WikiState; viewer: Viewer }) {
  return (
    <form action={createSettingAction} className="card">
      <input type="hidden" name="profileId" value={viewer.profileId ?? ""} />
      <strong>New setting</strong>
      <label>World<select name="worldId">{state.worlds.map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}</select></label>
      <label>Name<input name="name" required /></label>
      <label>Era<input name="era" /></label>
      <label>Description<textarea name="description" /></label>
      <button type="submit">Create Setting</button>
    </form>
  );
}

function CreateCampaignForm({ state, viewer }: { state: WikiState; viewer: Viewer }) {
  return (
    <form action={createCampaignAction} className="card">
      <input type="hidden" name="profileId" value={viewer.profileId ?? ""} />
      <strong>New campaign</strong>
      <label>Setting<select name="settingId">{state.settings.map((setting) => <option key={setting.id} value={setting.id}>{setting.name}</option>)}</select></label>
      <label>Name<input name="name" required /></label>
      <label>Description<textarea name="description" /></label>
      <button type="submit">Create Campaign</button>
    </form>
  );
}

function ImportSourceForm({ state, viewer, campaignId }: { state: WikiState; viewer: Viewer; campaignId: Id }) {
  const sessions = state.sessions.filter((session) => session.campaignId === campaignId);
  return (
    <form action={importSourceAction} className="card form-grid" encType="multipart/form-data">
      <ContextFields viewer={viewer} campaignId={campaignId} />
      <label>Title<input name="title" required /></label>
      <label>Session<select name="sessionId"><option value="">Create from title</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></label>
      <label>New session title<input name="sessionTitle" placeholder="Used if no session selected" /></label>
      <label>Session date<input name="sessionDate" type="date" /></label>
      <label>Source type<select name="sourceType"><option value="transcript">Transcript</option><option value="gm_notes">GM notes</option><option value="world_lore">World lore</option><option value="setting_bible">Setting bible</option><option value="rules">Rules</option></select></label>
      <label>Visibility<select name="visibility"><option value="gm_private">GM private</option><option value="campaign_members">Campaign members</option><option value="shared_authorized">Shared authorized</option><option value="public">Public</option></select></label>
      <label>Track name<input name="trackName" placeholder="table recorder, GM phone..." /></label>
      <label>Start offset ms<input name="startOffsetMs" type="number" defaultValue="0" /></label>
      <label className="full">Upload TXT/MD/JSON/SRT/VTT/DOCX/text PDF<input name="file" type="file" /></label>
      <label className="full">Or paste text<textarea name="sourceText" /></label>
      <button type="submit"><Archive size={16} />Import Source</button>
    </form>
  );
}

function SourceCard({ state, sourceId, viewer, campaignId }: { state: WikiState; sourceId: Id; viewer: Viewer; campaignId: Id }) {
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) return null;
  const blocks = state.normalizedBlocks.filter((block) => block.sourceId === source.id).slice(0, 8);
  return (
    <div className="card">
      <div className="section-header">
        <div>
          <strong>{source.title}</strong>
          <p>{source.sourceType} · {source.visibility} · {source.trackName ?? "no track"}</p>
        </div>
        <span className="pill">{scopeLabel(state, source)}</span>
      </div>
      {blocks.map((block) => (
        <div className="source-block" key={block.id}>
          <code>{block.stableAnchor}</code> {block.speakerLabel && <strong>{block.speakerLabel}: </strong>}{block.text}
          <form action={correctSpeakerAction} className="form-grid">
            <ContextFields viewer={viewer} campaignId={campaignId} />
            <input type="hidden" name="sourceVersionId" value={block.sourceVersionId} />
            <input type="hidden" name="anchor" value={block.stableAnchor} />
            <label>Correct speaker<input name="correctedSpeaker" placeholder={block.speakerLabel ?? "Speaker"} /></label>
            <label>Reason<input name="reason" placeholder="Misattributed in transcript" /></label>
            <button type="submit" className="secondary">Save Overlay</button>
          </form>
        </div>
      ))}
    </div>
  );
}

function ManualClaimForm({ state, viewer, campaignId, sources }: { state: WikiState; viewer: Viewer; campaignId: Id; sources: ReturnType<typeof readableSourcesForCampaign> }) {
  const sourceBlocks = sources.flatMap((source) => state.normalizedBlocks.filter((block) => block.sourceId === source.id).map((block) => ({ source, block })));
  return (
    <form action={createManualClaimAction} className="card form-grid">
      <ContextFields viewer={viewer} campaignId={campaignId} />
      <strong className="full">Manual claim</strong>
      <label>Entity name<input name="entityName" required /></label>
      <label>Entity type<select name="entityType"><option value="npc">NPC</option><option value="place">Place</option><option value="faction">Faction</option><option value="rule">Rule</option><option value="lore">Lore</option></select></label>
      <label>Predicate<input name="predicate" required placeholder="control, location, ruling..." /></label>
      <label>Value<input name="valueText" required /></label>
      <label>Authority<select name="authorityClass"><option value="explicit_gm_ruling">Explicit GM ruling</option><option value="objective_gm_world_narration">Objective GM narration</option><option value="resolved_event">Resolved event</option><option value="npc_testimony">NPC testimony</option><option value="speculation">Speculation</option></select></label>
      <label>Epistemic<select name="epistemicClass"><option value="world_true">World true</option><option value="character_belief">Character belief</option><option value="rumor">Rumor</option><option value="lie_or_deception">Lie/deception</option><option value="attempted_action">Attempted action</option><option value="unknown">Unknown</option></select></label>
      <label>Visibility<select name="visibility"><option value="campaign_members">Campaign members</option><option value="gm_private">GM private</option><option value="public">Public</option></select></label>
      <label>Source anchor<select name="sourceId">{sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
      <label className="full">Anchor<select name="anchorStart">{sourceBlocks.map(({ source, block }) => <option key={block.id} value={block.stableAnchor}>{source.title} · {block.stableAnchor} · {block.text.slice(0, 80)}</option>)}</select></label>
      <button type="submit"><CheckCircle2 size={16} />Create Accepted Claim</button>
    </form>
  );
}

function PromotionForm({ state, viewer, campaignId, claims }: { state: WikiState; viewer: Viewer; campaignId: Id; claims: Claim[] }) {
  const lineage = campaignLineage(state, campaignId);
  return (
    <form action={promoteClaimAction} className="card form-grid">
      <ContextFields viewer={viewer} campaignId={campaignId} />
      <strong className="full">Promote claim upward</strong>
      <label className="full">Claim<select name="claimId">{claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.predicate}: {claim.valueText}</option>)}</select></label>
      <label>Destination<select name="targetScopeType"><option value="setting">Setting</option><option value="world">World</option></select></label>
      <label>Destination ID<select name="targetScopeId">{lineage.setting && <option value={lineage.setting.id}>{lineage.setting.name}</option>}{lineage.world && <option value={lineage.world.id}>{lineage.world.name}</option>}</select></label>
      <label className="full">Reason<textarea name="reason" required /></label>
      <button type="submit">Promote With Signed Ruling</button>
    </form>
  );
}

function ClaimCard({ state, claim }: { state: WikiState; claim: Claim }) {
  const entity = state.entities.find((item) => item.id === claim.subjectEntityId);
  const evidence = state.claimEvidence.filter((item) => item.claimId === claim.id);
  return (
    <div className="card">
      <div className="section-header">
        <div>
          <strong>{entity?.name ?? "Claim"} · {claim.predicate}</strong>
          <p>{claim.valueText}</p>
        </div>
        <span className={claim.canonState === "accepted" ? "pill good" : "pill warn"}>{claim.canonState}</span>
      </div>
      <div className="pill-row">
        <span className="pill">{claim.authorityClass}</span>
        <span className="pill">{claim.epistemicClass}</span>
        <span className="pill">{claim.visibility}</span>
        <span className="pill">{scopeLabel(state, claim)}</span>
      </div>
      {evidence.map((item) => <p className="source-block" key={item.id}><code>{item.anchorStart ?? item.rulingId}</code> {item.excerpt}</p>)}
    </div>
  );
}

function CreateFaqForm({ viewer, campaignId }: { viewer: Viewer; campaignId: Id }) {
  return (
    <form action={createFaqAction} className="card form-grid">
      <ContextFields viewer={viewer} campaignId={campaignId} />
      <label className="full">Question<input name="question" required /></label>
      <label>Visibility<select name="visibility"><option value="campaign_members">Campaign members</option><option value="gm_private">GM private</option><option value="public">Public</option></select></label>
      <button type="submit"><MessageSquareText size={16} />Submit Question</button>
    </form>
  );
}

function renderMarkdownLine(line: string, index: number) {
  if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
  if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
  if (line.startsWith("- ")) return <p key={index}>{line}</p>;
  if (!line.trim()) return <br key={index} />;
  return <p key={index}>{line}</p>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
