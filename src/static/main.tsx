import React, { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  Download,
  FileText,
  GitBranch,
  MessageSquareText,
  Search,
  Shield,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import "./styles.css";

type Id = string;
type ScopeType = "world" | "setting" | "campaign";
type Visibility = "gm_private" | "campaign_members" | "shared_authorized" | "public";
type Mode = "gm" | "player" | "public";

interface Profile {
  id: Id;
  name: string;
  role: "owner" | "gm" | "player" | "reader";
}

interface World {
  id: Id;
  name: string;
  description: string;
}

interface Setting {
  id: Id;
  worldId: Id;
  name: string;
  era: string;
  description: string;
  forkedFromSettingId?: Id;
}

interface Campaign {
  id: Id;
  settingId: Id;
  name: string;
  description: string;
  gmProfileId: Id;
}

interface Session {
  id: Id;
  campaignId: Id;
  title: string;
  date?: string;
}

interface Block {
  id: Id;
  sourceId: Id;
  anchor: string;
  ordinal: number;
  speaker?: string;
  start?: string;
  text: string;
}

interface Source {
  id: Id;
  scope: ScopeType;
  scopeId: Id;
  campaignId?: Id;
  sessionId?: Id;
  title: string;
  type: "transcript" | "gm_notes" | "world_lore" | "setting_bible" | "rules" | "faq_seed";
  authority: string;
  visibility: Visibility;
  hash: string;
  track?: string;
  originalText: string;
  createdAt: string;
}

interface Entity {
  id: Id;
  scope: ScopeType;
  scopeId: Id;
  name: string;
  type: string;
  visibility: Visibility;
}

interface Evidence {
  sourceId?: Id;
  anchor?: string;
  rulingId?: Id;
  excerpt: string;
}

interface Claim {
  id: Id;
  scope: ScopeType;
  scopeId: Id;
  entityId: Id;
  predicate: string;
  value: string;
  authority: string;
  epistemic: string;
  visibility: Visibility;
  state: "accepted" | "superseded" | "proposed" | "rejected" | "unresolved";
  evidence: Evidence[];
  supersedes?: Id;
  supersededBy?: Id;
  createdAt: string;
}

interface Proposal {
  id: Id;
  campaignId: Id;
  kind: "entity" | "claim" | "faq_update";
  payload: Record<string, string>;
  evidence: Evidence[];
  confidence: number;
  status: "pending" | "accepted" | "rejected";
}

interface Faq {
  id: Id;
  scope: ScopeType;
  scopeId: Id;
  question: string;
  status: "open" | "drafted" | "needs_ruling" | "answered" | "archived";
  visibility: Visibility;
  versions: Array<{ id: Id; answer: string; authoritative: boolean; createdAt: string }>;
}

interface Erratum {
  id: Id;
  claimId: Id;
  oldValue: string;
  newValue: string;
  reason: string;
  type: string;
  createdAt: string;
}

interface Article {
  id: Id;
  campaignId: Id;
  title: string;
  body: string;
  claimIds: Id[];
  updatedAt: string;
}

interface AppState {
  version: 2;
  profiles: Profile[];
  worlds: World[];
  settings: Setting[];
  campaigns: Campaign[];
  sessions: Session[];
  sources: Source[];
  blocks: Block[];
  entities: Entity[];
  claims: Claim[];
  proposals: Proposal[];
  faqs: Faq[];
  errata: Erratum[];
  articles: Article[];
  generatedOutputs: Array<{ id: Id; campaignId: Id; body: string; createdAt: string }>;
}

const storageKey = "campaign-wiki-static-v2";

function id(): Id {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function loadState(): AppState | undefined {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return undefined;
  }
}

function saveState(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function parseBlocks(sourceId: Id, text: string): Block[] {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=\d{1,2}:\d{2})/)
    .map((line) => line.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => {
    const time = chunk.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+/);
    const withoutTime = time ? chunk.slice(time[0].length) : chunk;
    const speaker = withoutTime.match(/^([A-Za-z][A-Za-z0-9 ._-]{0,36}):\s+(.+)/);
    return {
      id: id(),
      sourceId,
      anchor: `p${String(index + 1).padStart(4, "0")}`,
      ordinal: index + 1,
      start: time?.[1],
      speaker: speaker?.[1],
      text: speaker?.[2] ?? withoutTime
    };
  });
}

function makeSource(state: AppState, input: {
  scope: ScopeType;
  scopeId: Id;
  campaignId?: Id;
  sessionId?: Id;
  title: string;
  type: Source["type"];
  visibility: Visibility;
  authority: string;
  track?: string;
  originalText: string;
}): AppState {
  const hash = hashText(input.originalText);
  const duplicate = state.sources.find(
    (source) => source.hash === hash && source.scope === input.scope && source.scopeId === input.scopeId
  );
  if (duplicate) return state;
  const source: Source = { id: id(), hash, createdAt: now(), ...input };
  return {
    ...state,
    sources: [...state.sources, source],
    blocks: [...state.blocks, ...parseBlocks(source.id, input.originalText)]
  };
}

function seedDemo(): AppState {
  const gm = { id: id(), name: "Mira Vale", role: "gm" as const };
  const rowan = { id: id(), name: "Rowan", role: "player" as const };
  const tess = { id: id(), name: "Tess", role: "player" as const };
  const orin = { id: id(), name: "Orin Ash", role: "gm" as const };
  const aetherion = { id: id(), name: "Aetherion", description: "Shared geography, pantheon and imperial archives." };
  const thornwake = { id: id(), name: "Thornwake", description: "A standalone world for isolation checks." };
  const imperial = {
    id: id(),
    worldId: aetherion.id,
    name: "Imperial Era",
    era: "Argent Ledger 814",
    description: "The empire is bruised but standing."
  };
  const fallen = {
    id: id(),
    worldId: aetherion.id,
    name: "Fallen Empire",
    era: "Divergent post-collapse continuity",
    description: "The Senate fell decades earlier.",
    forkedFromSettingId: imperial.id
  };
  const saltSetting = {
    id: id(),
    worldId: thornwake.id,
    name: "Salt Marches",
    era: "Independent",
    description: "No Aetherion canon applies."
  };
  const silver = {
    id: id(),
    settingId: imperial.id,
    name: "Silver Lanterns",
    description: "A wardens' campaign crossing the Moon Gate road.",
    gmProfileId: gm.id
  };
  const ashen = {
    id: id(),
    settingId: imperial.id,
    name: "Ashen Road",
    description: "A sibling campaign with private events.",
    gmProfileId: orin.id
  };
  const dynasty = {
    id: id(),
    settingId: fallen.id,
    name: "The Last Dynasty",
    description: "A campaign in the Fallen Empire timeline.",
    gmProfileId: gm.id
  };
  const salt = {
    id: id(),
    settingId: saltSetting.id,
    name: "Salt March Patrol",
    description: "Unrelated world isolation campaign.",
    gmProfileId: gm.id
  };
  const session = { id: id(), campaignId: silver.id, title: "Session 12 - Moon Gate Accord", date: "2026-09-18" };
  let state: AppState = {
    version: 2,
    profiles: [gm, rowan, tess, orin],
    worlds: [aetherion, thornwake],
    settings: [imperial, fallen, saltSetting],
    campaigns: [silver, ashen, dynasty, salt],
    sessions: [session],
    sources: [],
    blocks: [],
    entities: [],
    claims: [],
    proposals: [],
    faqs: [],
    errata: [],
    articles: [],
    generatedOutputs: []
  };
  state = makeSource(state, {
    scope: "campaign",
    scopeId: silver.id,
    campaignId: silver.id,
    sessionId: session.id,
    title: "Silver Lanterns Session 12 Table Transcript",
    type: "transcript",
    visibility: "gm_private",
    authority: "unclear",
    track: "table recorder",
    originalText: [
      "00:00:01 GM: The Moon Gate stands north of Vel Ori, where the old road splits.",
      "00:04:12 Rowan: I think Chancellor Elaria secretly burned the treaty.",
      "00:05:00 GM as Elaria: I never met the smugglers. She is lying through a perfect court smile.",
      "00:08:33 Tess: I try to stab King Halvar before he can speak.",
      "00:08:50 GM: The guard catches your wrist. The attempt fails and the king remains alive.",
      "00:12:10 GM: Just kidding, the Moon Gate is made of cheese.",
      "00:15:44 GM RULING: For Silver Lanterns, Vel Ori changes hands to the Lantern Compact on the night of Session 12.",
      "00:18:02 GM RULING: The archive date is corrected from 812 to 814."
    ].join("\n\n")
  });
  state = makeSource(state, {
    scope: "campaign",
    scopeId: silver.id,
    campaignId: silver.id,
    sessionId: session.id,
    title: "Silver Lanterns Session 12 GM Phone Transcript",
    type: "transcript",
    visibility: "gm_private",
    authority: "unclear",
    track: "GM phone, -3000ms offset",
    originalText: "00:15:41 GM RULING: Vel Ori changes hands to the Lantern Compact tonight."
  });
  const table = state.sources.find((source) => source.title.includes("Table"))!;
  const blocks = state.blocks.filter((block) => block.sourceId === table.id);
  const moon = addEntity(state, "world", aetherion.id, "Moon Gate", "place", "shared_authorized");
  state = moon.state;
  const vel = addEntity(state, "campaign", silver.id, "Vel Ori", "place", "campaign_members");
  state = vel.state;
  const empire = addEntity(state, "world", aetherion.id, "Aurelian Empire", "faction", "shared_authorized");
  state = empire.state;
  state = addClaim(state, "world", aetherion.id, moon.entity.id, "geography", "The Moon Gate stands north of Vel Ori.", "objective_gm_world_narration", "world_true", "shared_authorized", [{ sourceId: table.id, anchor: blocks[0].anchor, excerpt: blocks[0].text }]);
  state = addClaim(state, "setting", imperial.id, empire.entity.id, "political status", "The Aurelian Senate still claims imperial authority.", "gm_approved_setting_doc", "world_true", "shared_authorized", [{ sourceId: table.id, anchor: blocks[0].anchor, excerpt: blocks[0].text }]);
  state = addClaim(state, "setting", fallen.id, empire.entity.id, "political status", "The Aurelian Senate collapsed before the campaign begins.", "gm_approved_setting_doc", "world_true", "shared_authorized", [{ sourceId: table.id, anchor: blocks[0].anchor, excerpt: blocks[0].text }]);
  state = addClaim(state, "campaign", silver.id, vel.entity.id, "control", "Vel Ori changes hands to the Lantern Compact in Silver Lanterns only.", "explicit_gm_ruling", "world_true", "campaign_members", [{ sourceId: table.id, anchor: blocks[6].anchor, excerpt: blocks[6].text }]);
  const vault = addEntity(state, "campaign", ashen.id, "Ash Vault", "place", "gm_private");
  state = vault.state;
  state = addClaim(state, "campaign", ashen.id, vault.entity.id, "secret route", "The Ash Vault has a hidden road underneath it.", "explicit_gm_ruling", "world_true", "gm_private", [{ excerpt: "Private Ashen Road GM note." }]);
  state.faqs.push({
    id: id(),
    scope: "campaign",
    scopeId: silver.id,
    question: "Who controls Vel Ori after Session 12?",
    status: "drafted",
    visibility: "campaign_members",
    versions: [{ id: id(), answer: "Draft: maybe Chancellor Elaria controls it.", authoritative: false, createdAt: now() }]
  });
  state.generatedOutputs.push({
    id: id(),
    campaignId: silver.id,
    body: "Generated draft says Elaria burned the treaty, but this is unsupported speculation.",
    createdAt: now()
  });
  return rebuildArticles(state, silver.id);
}

function addEntity(state: AppState, scope: ScopeType, scopeId: Id, name: string, type: string, visibility: Visibility) {
  const existing = state.entities.find((entity) => entity.scope === scope && entity.scopeId === scopeId && entity.name.toLowerCase() === name.toLowerCase());
  if (existing) return { state, entity: existing };
  const entity: Entity = { id: id(), scope, scopeId, name, type, visibility };
  return { state: { ...state, entities: [...state.entities, entity] }, entity };
}

function addClaim(
  state: AppState,
  scope: ScopeType,
  scopeId: Id,
  entityId: Id,
  predicate: string,
  value: string,
  authority: string,
  epistemic: string,
  visibility: Visibility,
  evidence: Evidence[]
) {
  const claim: Claim = {
    id: id(),
    scope,
    scopeId,
    entityId,
    predicate,
    value,
    authority,
    epistemic,
    visibility,
    evidence,
    state: epistemic === "world_true" || epistemic === "character_belief" ? "accepted" : "unresolved",
    createdAt: now()
  };
  return { ...state, claims: [...state.claims, claim] };
}

function lineage(state: AppState, campaignId: Id): Array<{ scope: ScopeType; scopeId: Id }> {
  const campaign = state.campaigns.find((item) => item.id === campaignId);
  const setting = state.settings.find((item) => item.id === campaign?.settingId);
  return [
    ...(setting ? [{ scope: "world" as const, scopeId: setting.worldId }] : []),
    ...(setting ? [{ scope: "setting" as const, scopeId: setting.id }] : []),
    ...(campaign ? [{ scope: "campaign" as const, scopeId: campaign.id }] : [])
  ];
}

function canRead(mode: Mode, campaignId: Id, item: { scope: ScopeType; scopeId: Id; visibility: Visibility }, state: AppState) {
  if (item.visibility === "public") return true;
  if (mode === "public") return false;
  if (mode === "player" && item.visibility === "gm_private") return false;
  if (item.scope === "campaign" && item.scopeId !== campaignId) return false;
  return lineage(state, campaignId).some((scope) => scope.scope === item.scope && scope.scopeId === item.scopeId);
}

function visibleClaims(state: AppState, campaignId: Id, mode: Mode) {
  return state.claims.filter((claim) => claim.state === "accepted" && canRead(mode, campaignId, claim, state));
}

function visibleSources(state: AppState, campaignId: Id, mode: Mode) {
  return state.sources.filter((source) => canRead(mode, campaignId, source, state));
}

function rebuildArticles(state: AppState, campaignId: Id): AppState {
  const claims = visibleClaims(state, campaignId, "gm");
  const byEntity = new Map<Id, Claim[]>();
  for (const claim of claims) {
    byEntity.set(claim.entityId, [...(byEntity.get(claim.entityId) ?? []), claim]);
  }
  const retained = state.articles.filter((article) => article.campaignId !== campaignId);
  const articles = [...byEntity.entries()].map(([entityId, entityClaims]) => {
    const entity = state.entities.find((item) => item.id === entityId)!;
    const lines = [
      `# ${entity.name}`,
      "",
      "## Canon Ledger",
      ...entityClaims.map((claim) => {
        const cites = claim.evidence.map((evidence) => `${sourceTitle(state, evidence.sourceId)}#${evidence.anchor ?? "ruling"}`).join("; ");
        return `- **${claim.predicate}:** ${claim.value} (${claim.authority}; ${claim.epistemic}) [${cites}]`;
      }),
      "",
      "_This page is a materialized projection. It is not evidence._"
    ];
    return { id: id(), campaignId, title: entity.name, body: lines.join("\n"), claimIds: entityClaims.map((claim) => claim.id), updatedAt: now() };
  });
  return { ...state, articles: [...retained, ...articles] };
}

function sourceTitle(state: AppState, sourceId?: Id) {
  return state.sources.find((source) => source.id === sourceId)?.title ?? "Signed ruling";
}

function runMockAi(state: AppState, campaignId: Id): AppState {
  const existing = new Set(state.proposals.map((proposal) => JSON.stringify([proposal.kind, proposal.payload, proposal.evidence])));
  const proposals: Proposal[] = [];
  for (const source of state.sources.filter((item) => item.campaignId === campaignId)) {
    for (const block of state.blocks.filter((item) => item.sourceId === source.id)) {
      const evidence = [{ sourceId: source.id, anchor: block.anchor, excerpt: block.text }];
      const ruling = block.text.match(/GM RULING[:-]\s*(.+)$/i);
      if (ruling) {
        proposals.push({
          id: id(),
          campaignId,
          kind: "claim",
          payload: {
            entityName: "Campaign Rulings",
            entityType: "rule",
            predicate: "ruling",
            value: ruling[1],
            authority: "explicit_gm_ruling",
            epistemic: "world_true"
          },
          evidence,
          confidence: 0.9,
          status: "pending"
        });
      }
    }
  }
  return {
    ...state,
    proposals: [
      ...state.proposals,
      ...proposals.filter((proposal) => !existing.has(JSON.stringify([proposal.kind, proposal.payload, proposal.evidence])))
    ]
  };
}

function search(state: AppState, campaignId: Id, mode: Mode, query: string) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!terms.length) return [];
  const matches = (text: string) => terms.every((term) => text.toLowerCase().includes(term));
  const claims = visibleClaims(state, campaignId, mode)
    .filter((claim) => matches(`${entityName(state, claim.entityId)} ${claim.predicate} ${claim.value}`))
    .map((claim) => ({ kind: "claim", title: `${entityName(state, claim.entityId)}: ${claim.predicate}`, text: claim.value }));
  const articles = state.articles
    .filter((article) => article.campaignId === campaignId && matches(`${article.title} ${article.body}`))
    .map((article) => ({ kind: "article", title: article.title, text: article.body.slice(0, 220) }));
  const sources = visibleSources(state, campaignId, mode)
    .filter((source) => matches(`${source.title} ${source.originalText}`))
    .map((source) => ({ kind: "source", title: source.title, text: source.originalText.slice(0, 220) }));
  return [...articles, ...claims, ...sources].slice(0, 30);
}

function entityName(state: AppState, entityId: Id) {
  return state.entities.find((entity) => entity.id === entityId)?.name ?? "Claim";
}

function App() {
  const [state, setStateInternal] = useState<AppState | undefined>(() => loadState());
  const [campaignId, setCampaignId] = useState(() => state?.campaigns[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("gm");
  const [profileId, setProfileId] = useState(() => state?.profiles[0]?.id ?? "");
  const [query, setQuery] = useState("");

  function setState(next: AppState) {
    saveState(next);
    setStateInternal(next);
    if (!campaignId && next.campaigns[0]) setCampaignId(next.campaigns[0].id);
    if (!profileId && next.profiles[0]) setProfileId(next.profiles[0].id);
  }

  if (!state) {
    return (
      <main className="app-shell">
        <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
          <section className="hero">
            <span className="pill warn">No server required</span>
            <h1>Campaign Wiki</h1>
            <p>Seed a full local demo in browser storage, or import your own campaign material. No AI key or cloud database is needed for manual operation.</p>
            <button onClick={() => setState(seedDemo())}><Sparkles size={16} />Seed Demo</button>
          </section>
        </div>
      </main>
    );
  }

  const campaign = state.campaigns.find((item) => item.id === campaignId) ?? state.campaigns[0];
  const currentCampaignId = campaign.id;
  const currentProfile = state.profiles.find((profile) => profile.id === profileId) ?? state.profiles[0];
  const claims = visibleClaims(state, currentCampaignId, mode);
  const sources = visibleSources(state, currentCampaignId, mode);
  const results = useMemo(() => search(state, currentCampaignId, mode, query), [state, currentCampaignId, mode, query]);
  const setting = state.settings.find((item) => item.id === campaign.settingId);
  const world = state.worlds.find((item) => item.id === setting?.worldId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-mark"><BookOpen size={22} /></span>Campaign Wiki</div>
          <div className="switcher">
            <label>Campaign<select value={currentCampaignId} onChange={(event) => setCampaignId(event.target.value)}>{state.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>View<select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="gm">GM</option><option value="player">Player</option><option value="public">Public</option></select></label>
            <label>Persona<select value={currentProfile.id} onChange={(event) => setProfileId(event.target.value)}>{state.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          </div>
          <button className="secondary" onClick={() => downloadJson("campaign-wiki-backup.json", exportState(state, currentCampaignId, mode))}><Download size={16} />Export</button>
        </div>
      </header>
      <div className="layout">
        <nav className="side">
          <a href="#home">Home</a><a href="#sources">Sources</a><a href="#review">GM Review</a><a href="#canon">Canon</a><a href="#wiki">Wiki</a><a href="#faq">FAQ</a><a href="#errata">Errata</a><a href="#search">Search</a><a href="#ops">Ops</a>
        </nav>
        <div className="content">
          <section id="home" className="hero">
            <div className="pill-row">
              <span className="pill good">World: {world?.name}</span>
              <span className="pill good">Setting: {setting?.name}</span>
              <span className="pill good">Campaign: {campaign.name}</span>
              <span className="pill warn">Mode: {mode}</span>
            </div>
            <h1>{campaign.name}</h1>
            <p>{campaign.description}</p>
            <div className="grid cols-3">
              <Metric icon={<Database size={18} />} label="Visible claims" value={claims.length} />
              <Metric icon={<Archive size={18} />} label="Readable sources" value={sources.length} />
              <Metric icon={<Brain size={18} />} label="Pending proposals" value={state.proposals.filter((p) => p.status === "pending").length} />
            </div>
          </section>

          <section id="sources" className="section">
            <Title icon={<Archive size={20} />} title="Source Archive" subtitle="Paste transcripts, notes and lore. Duplicate imports are deduped by content hash." />
            <ImportForm state={state} campaignId={currentCampaignId} setState={setState} />
            <div className="list">
              {sources.map((source) => <SourceCard key={source.id} state={state} source={source} />)}
              {!sources.length && <div className="empty">No sources are visible in this view.</div>}
            </div>
          </section>

          <section id="review" className="section">
            <Title icon={<CheckCircle2 size={20} />} title="GM Review" subtitle="Mock AI creates real review proposals from cited source anchors." />
            <button onClick={() => setState(runMockAi(state, currentCampaignId))}><Sparkles size={16} />Run Mock AI Analysis</button>
            <div className="list">
              {state.proposals.filter((proposal) => proposal.status === "pending" && proposal.campaignId === currentCampaignId).map((proposal) => (
                <div className="card" key={proposal.id}>
                  <div className="section-header"><h3>{proposal.kind}</h3><span className="pill warn">{Math.round(proposal.confidence * 100)}%</span></div>
                  <p>{JSON.stringify(proposal.payload)}</p>
                  {proposal.evidence.map((evidence) => <p className="source-line" key={evidence.anchor}><code>{evidence.anchor}</code> {evidence.excerpt}</p>)}
                  <button onClick={() => setState(acceptProposal(state, proposal.id, currentCampaignId))}><CheckCircle2 size={16} />Accept Into Ledger</button>
                </div>
              ))}
            </div>
          </section>

          <section id="canon" className="section">
            <Title icon={<GitBranch size={20} />} title="Canon Ledger" subtitle="Claims split authority, epistemic status, visibility and canon state." />
            <ManualClaimForm state={state} campaignId={currentCampaignId} setState={setState} />
            <div className="list">{claims.map((claim) => <ClaimCard key={claim.id} state={state} claim={claim} />)}</div>
          </section>

          <section id="wiki" className="section">
            <Title icon={<BookOpen size={20} />} title="Encyclopedia" subtitle="Pages are materialized projections rebuilt from accepted structured claims." />
            <button onClick={() => setState(rebuildArticles(state, currentCampaignId))}><Database size={16} />Rebuild Wiki From Ledger</button>
            <div className="grid cols-2">
              {state.articles.filter((article) => article.campaignId === currentCampaignId).map((article) => <ArticleCard key={article.id} article={article} />)}
            </div>
          </section>

          <section id="faq" className="section">
            <Title icon={<MessageSquareText size={20} />} title="FAQ" subtitle="Draft answers do not become rulings unless explicitly signed." />
            <FaqForm state={state} campaignId={currentCampaignId} setState={setState} />
            <div className="list">
              {state.faqs.filter((faq) => faq.scope === "campaign" && faq.scopeId === currentCampaignId).map((faq) => (
                <div className="card" key={faq.id}>
                  <div className="section-header"><h3>{faq.question}</h3><span className={faq.status === "answered" ? "pill good" : "pill warn"}>{faq.status}</span></div>
                  {faq.versions.map((version) => <p key={version.id}>{version.answer} <span className="pill">{version.authoritative ? "signed ruling" : "draft"}</span></p>)}
                </div>
              ))}
            </div>
          </section>

          <section id="errata" className="section">
            <Title icon={<TriangleAlert size={20} />} title="Errata" subtitle="Corrections supersede old canon without deleting evidence." />
            <ErrataForm state={state} claims={claims} setState={setState} campaignId={currentCampaignId} />
            <div className="list">{state.errata.map((erratum) => <div className="card" key={erratum.id}><strong>{erratum.type}</strong><p><s>{erratum.oldValue}</s></p><p>{erratum.newValue}</p><p>{erratum.reason}</p></div>)}</div>
          </section>

          <section id="search" className="section">
            <Title icon={<Search size={20} />} title="Search" subtitle="Results are filtered by scope and spoiler visibility before matching." />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Vel Ori, Moon Gate, Ash Vault..." />
            <div className="list">{results.map((result, index) => <div className="card" key={`${result.kind}-${index}`}><span className="pill">{result.kind}</span><strong>{result.title}</strong><p>{result.text}</p></div>)}</div>
          </section>

          <section id="ops" className="section">
            <Title icon={<Shield size={20} />} title="Operations" subtitle="Static manual mode is intentionally local. Production data belongs in Supabase with RLS." />
            <div className="pill-row">
              <button className="secondary" onClick={() => setState(seedDemo())}><Sparkles size={16} />Reset Demo</button>
              <button className="secondary" onClick={() => downloadJson("campaign-wiki-full-state.json", state)}><FileText size={16} />Export Full State</button>
              <button className="warning" onClick={() => { localStorage.removeItem(storageKey); location.reload(); }}><TriangleAlert size={16} />Clear Browser Data</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="card metric"><span className="pill-row">{icon}<span>{label}</span></span><strong>{value}</strong></div>;
}

function Title({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div><div className="pill-row"><span className="pill good">{icon}{title}</span></div><h2>{title}</h2><p>{subtitle}</p></div>;
}

function ImportForm({ state, campaignId, setState }: { state: AppState; campaignId: Id; setState: (state: AppState) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = String(data.get("text") ?? "");
    const title = String(data.get("title") ?? "Untitled Source");
    if (!text.trim()) return;
    const sessionId = String(data.get("sessionId") ?? "") || id();
    let next = state;
    if (!state.sessions.some((session) => session.id === sessionId)) {
      next = { ...next, sessions: [...next.sessions, { id: sessionId, campaignId, title: String(data.get("sessionTitle") ?? "Imported Session") }] };
    }
    setState(makeSource(next, {
      scope: "campaign",
      scopeId: campaignId,
      campaignId,
      sessionId,
      title,
      type: String(data.get("type") ?? "transcript") as Source["type"],
      visibility: String(data.get("visibility") ?? "gm_private") as Visibility,
      authority: String(data.get("authority") ?? "unclear"),
      track: String(data.get("track") ?? ""),
      originalText: text
    }));
    event.currentTarget.reset();
  }
  return (
    <form className="card form-grid" onSubmit={submit}>
      <label>Title<input name="title" required /></label>
      <label>Session<select name="sessionId"><option value="">Create new</option>{state.sessions.filter((session) => session.campaignId === campaignId).map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></label>
      <label>New session title<input name="sessionTitle" /></label>
      <label>Type<select name="type"><option value="transcript">Transcript</option><option value="gm_notes">GM notes</option><option value="world_lore">World lore</option><option value="setting_bible">Setting bible</option><option value="rules">Rules</option></select></label>
      <label>Visibility<select name="visibility"><option value="gm_private">GM private</option><option value="campaign_members">Campaign members</option><option value="shared_authorized">Shared authorized</option><option value="public">Public</option></select></label>
      <label>Track<input name="track" placeholder="table recorder, GM phone..." /></label>
      <label className="full">Paste transcript, SRT/VTT text, notes or lore<textarea name="text" required /></label>
      <button type="submit"><Archive size={16} />Import Source</button>
    </form>
  );
}

function SourceCard({ state, source }: { state: AppState; source: Source }) {
  return <div className="card"><div className="section-header"><h3>{source.title}</h3><span className="pill">{source.visibility}</span></div><p>{source.type} · {source.track || "no track"} · hash {source.hash}</p>{state.blocks.filter((block) => block.sourceId === source.id).slice(0, 6).map((block) => <p className="source-line" key={block.id}><code>{block.anchor}</code> {block.speaker && <strong>{block.speaker}: </strong>}{block.text}</p>)}</div>;
}

function ManualClaimForm({ state, campaignId, setState }: { state: AppState; campaignId: Id; setState: (state: AppState) => void }) {
  const sourceBlocks = state.sources.filter((source) => source.campaignId === campaignId).flatMap((source) => state.blocks.filter((block) => block.sourceId === source.id).map((block) => ({ source, block })));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entity = addEntity(state, "campaign", campaignId, String(data.get("entityName")), String(data.get("entityType")), String(data.get("visibility")) as Visibility);
    const sourceId = String(data.get("sourceId"));
    const anchor = String(data.get("anchor"));
    const block = state.blocks.find((item) => item.sourceId === sourceId && item.anchor === anchor);
    const next = addClaim(entity.state, "campaign", campaignId, entity.entity.id, String(data.get("predicate")), String(data.get("value")), String(data.get("authority")), String(data.get("epistemic")), String(data.get("visibility")) as Visibility, [{ sourceId, anchor, excerpt: block?.text ?? "Manual signed ruling" }]);
    setState(rebuildArticles(next, campaignId));
    event.currentTarget.reset();
  }
  return (
    <form className="card form-grid" onSubmit={submit}>
      <label>Entity<input name="entityName" required /></label>
      <label>Type<select name="entityType"><option>npc</option><option>place</option><option>faction</option><option>rule</option><option>lore</option></select></label>
      <label>Predicate<input name="predicate" required /></label>
      <label>Value<input name="value" required /></label>
      <label>Authority<select name="authority"><option>explicit_gm_ruling</option><option>objective_gm_world_narration</option><option>resolved_event</option><option>npc_testimony</option><option>speculation</option></select></label>
      <label>Epistemic<select name="epistemic"><option>world_true</option><option>character_belief</option><option>rumor</option><option>lie_or_deception</option><option>attempted_action</option><option>unknown</option></select></label>
      <label>Visibility<select name="visibility"><option value="campaign_members">Campaign members</option><option value="gm_private">GM private</option><option value="public">Public</option></select></label>
      <label>Source<select name="sourceId">{state.sources.filter((source) => source.campaignId === campaignId).map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
      <label className="full">Anchor<select name="anchor">{sourceBlocks.map(({ source, block }) => <option key={block.id} value={block.anchor}>{source.title} · {block.anchor} · {block.text.slice(0, 90)}</option>)}</select></label>
      <button type="submit"><CheckCircle2 size={16} />Create Claim</button>
    </form>
  );
}

function ClaimCard({ state, claim }: { state: AppState; claim: Claim }) {
  return <div className="card"><div className="section-header"><h3>{entityName(state, claim.entityId)} · {claim.predicate}</h3><span className={claim.state === "accepted" ? "pill good" : "pill warn"}>{claim.state}</span></div><p>{claim.value}</p><div className="pill-row"><span className="pill">{claim.authority}</span><span className="pill">{claim.epistemic}</span><span className="pill">{claim.visibility}</span></div>{claim.evidence.map((evidence) => <p className="source-line" key={`${evidence.sourceId}-${evidence.anchor}`}><code>{evidence.anchor ?? "ruling"}</code> {evidence.excerpt}</p>)}</div>;
}

function ArticleCard({ article }: { article: Article }) {
  return <article className="card article">{article.body.split("\n").map((line, index) => line.startsWith("# ") ? <h3 key={index}>{line.slice(2)}</h3> : line.startsWith("- ") ? <p key={index}>{line}</p> : line.trim() ? <p key={index}>{line}</p> : <br key={index} />)}</article>;
}

function FaqForm({ state, campaignId, setState }: { state: AppState; campaignId: Id; setState: (state: AppState) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const authoritative = data.get("authoritative") === "on";
    const faq: Faq = {
      id: id(),
      scope: "campaign",
      scopeId: campaignId,
      question: String(data.get("question")),
      status: authoritative ? "answered" : "drafted",
      visibility: String(data.get("visibility")) as Visibility,
      versions: [{ id: id(), answer: String(data.get("answer")), authoritative, createdAt: now() }]
    };
    setState({ ...state, faqs: [...state.faqs, faq] });
    event.currentTarget.reset();
  }
  return <form className="card form-grid" onSubmit={submit}><label className="full">Question<input name="question" required /></label><label className="full">Answer<textarea name="answer" required /></label><label>Visibility<select name="visibility"><option value="campaign_members">Campaign members</option><option value="gm_private">GM private</option><option value="public">Public</option></select></label><label><span><input type="checkbox" name="authoritative" /> Sign as ruling</span></label><button type="submit"><MessageSquareText size={16} />Save FAQ</button></form>;
}

function ErrataForm({ state, claims, campaignId, setState }: { state: AppState; claims: Claim[]; campaignId: Id; setState: (state: AppState) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const claimId = String(data.get("claimId"));
    const target = state.claims.find((claim) => claim.id === claimId);
    if (!target) return;
    const replacement: Claim = { ...target, id: id(), value: String(data.get("newValue")), supersedes: target.id, createdAt: now() };
    const erratum: Erratum = { id: id(), claimId, oldValue: target.value, newValue: replacement.value, reason: String(data.get("reason")), type: String(data.get("type")), createdAt: now() };
    const next = {
      ...state,
      claims: state.claims.map((claim) => claim.id === target.id ? { ...claim, state: "superseded" as const, supersededBy: replacement.id } : claim).concat(replacement),
      errata: [...state.errata, erratum]
    };
    setState(rebuildArticles(next, campaignId));
    event.currentTarget.reset();
  }
  return <form className="card form-grid" onSubmit={submit}><label className="full">Target claim<select name="claimId">{claims.map((claim) => <option key={claim.id} value={claim.id}>{entityName(state, claim.entityId)} · {claim.predicate}: {claim.value}</option>)}</select></label><label>Type<select name="type"><option>official_canon_retcon</option><option>transcription</option><option>speaker_assignment</option><option>extracted_fact</option><option>rule_clarification</option></select></label><label>New value<input name="newValue" required /></label><label className="full">Reason<textarea name="reason" required /></label><button className="warning" type="submit"><TriangleAlert size={16} />Apply Erratum</button></form>;
}

function acceptProposal(state: AppState, proposalId: Id, campaignId: Id): AppState {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return state;
  let next = state;
  if (proposal.kind === "claim") {
    const entityResult = addEntity(next, "campaign", campaignId, proposal.payload.entityName ?? "Campaign Fact", proposal.payload.entityType ?? "lore", "campaign_members");
    next = addClaim(entityResult.state, "campaign", campaignId, entityResult.entity.id, proposal.payload.predicate ?? "note", proposal.payload.value ?? "", proposal.payload.authority ?? "unclear", proposal.payload.epistemic ?? "unknown", "campaign_members", proposal.evidence);
  }
  next = { ...next, proposals: next.proposals.map((item) => item.id === proposalId ? { ...item, status: "accepted" } : item) };
  return rebuildArticles(next, campaignId);
}

function exportState(state: AppState, campaignId: Id, mode: Mode) {
  const claimIds = new Set(visibleClaims(state, campaignId, mode).map((claim) => claim.id));
  return {
    exportedAt: now(),
    campaign: state.campaigns.find((campaign) => campaign.id === campaignId),
    sources: visibleSources(state, campaignId, mode),
    claims: visibleClaims(state, campaignId, mode),
    articles: state.articles.filter((article) => article.campaignId === campaignId && article.claimIds.some((claimId) => claimIds.has(claimId))),
    faqs: state.faqs.filter((faq) => faq.scope === "campaign" && faq.scopeId === campaignId && canRead(mode, campaignId, faq, state)),
    errata: state.errata
  };
}

function downloadJson(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

createRoot(document.getElementById("root")!).render(<App />);
