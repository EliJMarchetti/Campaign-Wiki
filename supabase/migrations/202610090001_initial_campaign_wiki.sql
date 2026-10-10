create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type scope_type as enum ('world', 'setting', 'campaign', 'library');
create type visibility_type as enum ('gm_private', 'campaign_members', 'shared_authorized', 'public');
create type member_role as enum ('owner', 'world_editor', 'setting_editor', 'gm', 'co_gm', 'player', 'invited_reader', 'anonymous_public_reader');
create type review_state as enum ('proposed', 'pending', 'accepted', 'contested', 'rejected');
create type canon_state as enum ('proposed', 'accepted', 'contested', 'superseded', 'rejected', 'historical', 'unresolved');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id, role)
);

create table worlds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  visibility visibility_type not null default 'shared_authorized',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  era text not null default '',
  description text not null default '',
  forked_from_setting_id uuid references settings(id),
  fork_snapshot text,
  visibility visibility_type not null default 'shared_authorized',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table setting_forks (
  id uuid primary key default gen_random_uuid(),
  source_setting_id uuid not null references settings(id),
  fork_setting_id uuid not null references settings(id),
  forked_by uuid references profiles(id),
  reason text not null,
  snapshot_label text not null,
  created_at timestamptz not null default now(),
  unique (source_setting_id, fork_setting_id)
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  setting_id uuid references settings(id),
  name text not null,
  description text not null default '',
  visibility visibility_type not null default 'campaign_members',
  gm_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table scope_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  grantee_profile_id uuid references profiles(id),
  role member_role not null,
  scope scope_type not null,
  world_id uuid references worlds(id) on delete cascade,
  setting_id uuid references settings(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  library_id uuid,
  created_at timestamptz not null default now(),
  check (
    (scope = 'world' and world_id is not null and setting_id is null and campaign_id is null)
    or (scope = 'setting' and setting_id is not null and world_id is null and campaign_id is null)
    or (scope = 'campaign' and campaign_id is not null and world_id is null and setting_id is null)
    or (scope = 'library' and library_id is not null and world_id is null and setting_id is null and campaign_id is null)
  )
);

create table reference_libraries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table scope_grants
  add constraint scope_grants_library_fk foreign key (library_id) references reference_libraries(id) on delete cascade;

create table library_attachments (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references reference_libraries(id) on delete cascade,
  scope scope_type not null,
  world_id uuid references worlds(id) on delete cascade,
  setting_id uuid references settings(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  session_date date,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  library_id uuid references reference_libraries(id),
  session_id uuid references sessions(id) on delete set null,
  source_type text not null,
  title text not null,
  author text,
  authority_class text not null,
  visibility visibility_type not null default 'gm_private',
  language text not null default 'en',
  content_hash text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  version_number integer not null,
  original_text text not null,
  normalized_text text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (source_id, version_number)
);

create table source_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  storage_path text,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table normalized_blocks (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  stable_anchor text not null,
  ordinal integer not null,
  block_type text not null,
  speaker_label text,
  start_ms integer,
  end_ms integer,
  text text not null,
  unique (source_version_id, stable_anchor)
);

create table transcript_utterances (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  stable_anchor text not null,
  utterance_id text not null,
  speaker_label text,
  start_ms integer,
  end_ms integer,
  text text not null,
  unique (source_version_id, utterance_id)
);

create table speaker_mappings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  speaker_label text not null,
  player_profile_id uuid references profiles(id),
  character_name text,
  role_tag text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, speaker_label)
);

create table transcript_corrections (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  target_anchor text not null,
  corrected_text text,
  corrected_speaker text,
  reason text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table span_annotations (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  anchor_start text not null,
  anchor_end text not null,
  tags text[] not null,
  confidence numeric not null default 1,
  human_override boolean not null default false,
  notes text not null default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table processing_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stage text not null,
  provider text not null,
  model text,
  prompt_version text not null,
  schema_version text not null,
  input_source_ids uuid[] not null default '{}',
  status text not null,
  token_count integer,
  cost_usd numeric,
  error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stage, idempotency_key)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  processing_run_id uuid references processing_runs(id) on delete set null,
  kind text not null,
  payload jsonb not null,
  status text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  entity_type text not null,
  name text not null,
  visibility visibility_type not null default 'campaign_members',
  created_at timestamptz not null default now()
);

create table aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  alias text not null,
  is_hidden boolean not null default false,
  visibility visibility_type not null default 'campaign_members',
  unique (entity_id, alias)
);

create table scoped_entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  state_label text not null,
  effective_time text,
  visibility visibility_type not null default 'campaign_members',
  created_at timestamptz not null default now()
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  subject_entity_id uuid references entities(id),
  predicate text not null,
  value_text text,
  object_entity_id uuid references entities(id),
  effective_time text,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  authority_class text not null,
  epistemic_class text not null,
  review_state review_state not null default 'proposed',
  canon_state canon_state not null default 'proposed',
  visibility visibility_type not null default 'campaign_members',
  supersedes_claim_id uuid references claims(id),
  superseded_by_claim_id uuid references claims(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  source_id uuid references sources(id),
  source_version_id uuid references source_versions(id),
  anchor_start text,
  anchor_end text,
  ruling_id uuid,
  excerpt text not null,
  created_at timestamptz not null default now(),
  check (source_id is not null or ruling_id is not null)
);

create table canon_rulings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  ruling_text text not null,
  signed_by uuid references profiles(id),
  visibility visibility_type not null default 'campaign_members',
  created_at timestamptz not null default now()
);

alter table claim_evidence
  add constraint claim_evidence_ruling_fk foreign key (ruling_id) references canon_rulings(id);

create table extraction_proposals (
  id uuid primary key default gen_random_uuid(),
  processing_run_id uuid references processing_runs(id) on delete set null,
  kind text not null,
  payload jsonb not null,
  evidence jsonb not null,
  confidence numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table contradiction_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope scope_type not null,
  claim_a_id uuid references claims(id),
  claim_b_id uuid references claims(id),
  status text not null,
  resolution_type text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table errata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  correction_type text not null,
  scope scope_type not null,
  target_claim_id uuid references claims(id),
  old_value text not null,
  new_value text not null,
  reason text not null,
  visibility visibility_type not null default 'campaign_members',
  signed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  question text not null,
  status text not null,
  visibility visibility_type not null default 'campaign_members',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table faq_versions (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references faqs(id) on delete cascade,
  version_number integer not null,
  answer text not null,
  evidence_claim_ids uuid[] not null default '{}',
  is_authoritative_ruling boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (faq_id, version_number)
);

create table relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_entity_id uuid not null references entities(id),
  target_entity_id uuid not null references entities(id),
  predicate text not null,
  claim_id uuid references claims(id),
  visibility visibility_type not null default 'campaign_members'
);

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  claim_id uuid references claims(id),
  scope scope_type not null,
  event_time text not null,
  title text not null,
  description text not null,
  visibility visibility_type not null default 'campaign_members'
);

create table article_projections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_id uuid references entities(id),
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  title text not null,
  slug text not null,
  body_markdown text not null,
  source_claim_ids uuid[] not null default '{}',
  visibility visibility_type not null default 'campaign_members',
  projection_hash text not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, home_scope, slug, coalesce(world_id, setting_id, campaign_id))
);

create table article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_projection_id uuid not null references article_projections(id) on delete cascade,
  body_markdown text not null,
  source_claim_ids uuid[] not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table generated_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  output_type text not null,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  body text not null,
  input_claim_ids uuid[] not null default '{}',
  input_source_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table publication_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  audience text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table ai_prompt_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  packet_type text not null,
  home_scope scope_type not null,
  world_id uuid references worlds(id),
  setting_id uuid references settings(id),
  campaign_id uuid references campaigns(id),
  payload jsonb not null,
  privacy_confirmed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_profile_id uuid references profiles(id),
  event_type text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index worlds_org_idx on worlds(organization_id);
create index settings_world_idx on settings(world_id);
create index campaigns_setting_idx on campaigns(setting_id);
create index sources_scope_idx on sources(home_scope, world_id, setting_id, campaign_id, library_id);
create index blocks_text_trgm_idx on normalized_blocks using gin (text gin_trgm_ops);
create index claims_scope_idx on claims(home_scope, world_id, setting_id, campaign_id, canon_state, review_state);
create index article_search_idx on article_projections using gin ((title || ' ' || body_markdown) gin_trgm_ops);

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table worlds enable row level security;
alter table settings enable row level security;
alter table campaigns enable row level security;
alter table sources enable row level security;
alter table source_versions enable row level security;
alter table normalized_blocks enable row level security;
alter table transcript_utterances enable row level security;
alter table speaker_mappings enable row level security;
alter table transcript_corrections enable row level security;
alter table span_annotations enable row level security;
alter table entities enable row level security;
alter table aliases enable row level security;
alter table claims enable row level security;
alter table claim_evidence enable row level security;
alter table canon_rulings enable row level security;
alter table contradiction_cases enable row level security;
alter table errata enable row level security;
alter table faqs enable row level security;
alter table faq_versions enable row level security;
alter table article_projections enable row level security;
alter table generated_outputs enable row level security;
alter table ai_prompt_packets enable row level security;

create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from memberships
    where organization_id = org_id
      and profile_id = current_profile_id()
  )
$$;

create or replace function has_scope_role(scope_kind scope_type, world uuid, setting uuid, campaign uuid, allowed member_role[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from scope_grants g
    where g.grantee_profile_id = current_profile_id()
      and g.scope = scope_kind
      and coalesce(g.world_id, '00000000-0000-0000-0000-000000000000') = coalesce(world, '00000000-0000-0000-0000-000000000000')
      and coalesce(g.setting_id, '00000000-0000-0000-0000-000000000000') = coalesce(setting, '00000000-0000-0000-0000-000000000000')
      and coalesce(g.campaign_id, '00000000-0000-0000-0000-000000000000') = coalesce(campaign, '00000000-0000-0000-0000-000000000000')
      and g.role = any(allowed)
  )
$$;

create policy "members read organizations" on organizations
  for select using (is_org_member(id));

create policy "members read worlds" on worlds
  for select using (
    visibility = 'public'
    or is_org_member(organization_id)
    or has_scope_role('world', id, null, null, array['owner','world_editor','invited_reader']::member_role[])
  );

create policy "members read settings" on settings
  for select using (
    visibility = 'public'
    or is_org_member(organization_id)
    or has_scope_role('setting', null, id, null, array['owner','world_editor','setting_editor','invited_reader']::member_role[])
  );

create policy "campaign scoped read" on campaigns
  for select using (
    visibility = 'public'
    or has_scope_role('campaign', null, null, id, array['owner','gm','co_gm','player','invited_reader']::member_role[])
  );

create policy "sources readable by scope and visibility" on sources
  for select using (
    visibility = 'public'
    or (
      visibility = 'campaign_members'
      and campaign_id is not null
      and has_scope_role('campaign', null, null, campaign_id, array['owner','gm','co_gm','player','invited_reader']::member_role[])
    )
    or (
      visibility in ('shared_authorized','gm_private')
      and (
        has_scope_role(home_scope, world_id, setting_id, campaign_id, array['owner','world_editor','setting_editor','gm','co_gm','invited_reader']::member_role[])
      )
    )
  );

create policy "claims readable by scope and visibility" on claims
  for select using (
    visibility = 'public'
    or (
      visibility = 'campaign_members'
      and campaign_id is not null
      and has_scope_role('campaign', null, null, campaign_id, array['owner','gm','co_gm','player','invited_reader']::member_role[])
    )
    or (
      visibility in ('shared_authorized','gm_private')
      and has_scope_role(home_scope, world_id, setting_id, campaign_id, array['owner','world_editor','setting_editor','gm','co_gm','invited_reader']::member_role[])
    )
  );

create policy "article projections visible by grant" on article_projections
  for select using (
    visibility = 'public'
    or has_scope_role(home_scope, world_id, setting_id, campaign_id, array['owner','world_editor','setting_editor','gm','co_gm','player','invited_reader']::member_role[])
  );

create policy "service role writes all app tables" on profiles
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
