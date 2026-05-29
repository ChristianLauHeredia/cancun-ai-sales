-- Cancun AI Sales Platform - Initial Schema
-- Tracks leads through the entire sales pipeline:
-- opt-in → consent → AI call → qualification → follow-up → conversion

-- Lead status enum
create type lead_status as enum (
  'new',
  'consent_recorded',
  'call_scheduled',
  'call_in_progress',
  'qualified_hot',
  'qualified_warm',
  'qualified_cold',
  'no_answer',
  'follow_up',
  'converted',
  'lost',
  'opted_out'
);

-- Contact channel enum
create type contact_channel as enum (
  'voice',
  'sms',
  'email',
  'chat',
  'manual'
);

-- Call outcome enum
create type call_outcome as enum (
  'answered_qualified',
  'answered_not_qualified',
  'answered_callback_requested',
  'voicemail',
  'no_answer',
  'busy',
  'failed',
  'live_transferred'
);

-- ============================================
-- LEADS
-- ============================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  country text default 'US',
  state text,
  city text,
  source text default 'landing_page',
  status lead_status not null default 'new',
  score integer default 0 check (score >= 0 and score <= 100),
  dental_needs text[],
  preferred_timeline text,
  estimated_budget text,
  notes text,
  tags text[],
  utm_source text,
  utm_medium text,
  utm_campaign text,
  assigned_to text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_status on leads(status);
create index idx_leads_phone on leads(phone);
create index idx_leads_email on leads(email);
create index idx_leads_score on leads(score desc);
create index idx_leads_created_at on leads(created_at desc);

-- ============================================
-- CONSENT LOGS (TCPA Compliance)
-- ============================================
create table consent_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  consent_type text not null, -- 'tcpa_call', 'tcpa_sms', 'email_marketing'
  granted boolean not null default true,
  ip_address inet,
  user_agent text,
  trusted_form_cert_url text,
  trusted_form_token text,
  consent_text text not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_consent_lead on consent_logs(lead_id);

-- ============================================
-- CALLS (Retell AI Voice)
-- ============================================
create table calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  retell_call_id text unique,
  agent_id text not null,
  direction text not null default 'outbound',
  status text not null default 'initiated',
  outcome call_outcome,
  duration_seconds integer,
  transcript jsonb,
  summary text,
  sentiment text,
  qualification_data jsonb,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_calls_lead on calls(lead_id);
create index idx_calls_retell on calls(retell_call_id);
create index idx_calls_outcome on calls(outcome);

-- ============================================
-- MESSAGES (SMS/Email via Twilio)
-- ============================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel contact_channel not null,
  direction text not null default 'outbound', -- 'inbound' | 'outbound'
  from_number text,
  to_number text,
  subject text,
  body text not null,
  template_id text,
  external_id text, -- Twilio SID or email provider ID
  status text not null default 'queued', -- 'queued', 'sent', 'delivered', 'failed', 'read'
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_lead on messages(lead_id);
create index idx_messages_channel on messages(channel);

-- ============================================
-- CHAT SESSIONS (Claude API)
-- ============================================
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  visitor_id text not null,
  status text not null default 'active', -- 'active', 'closed', 'transferred'
  messages jsonb not null default '[]'::jsonb,
  summary text,
  lead_captured boolean default false,
  transferred_to text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_chat_visitor on chat_sessions(visitor_id);

-- ============================================
-- PIPELINE EVENTS (Audit Trail)
-- ============================================
create table pipeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  event_type text not null,
  channel contact_channel,
  previous_status lead_status,
  new_status lead_status,
  metadata jsonb,
  triggered_by text not null default 'system', -- 'system', 'agent', 'manual'
  created_at timestamptz not null default now()
);

create index idx_events_lead on pipeline_events(lead_id);
create index idx_events_type on pipeline_events(event_type);
create index idx_events_created on pipeline_events(created_at desc);

-- ============================================
-- FOLLOW-UP SEQUENCES
-- ============================================
create table follow_up_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel contact_channel not null,
  steps jsonb not null default '[]'::jsonb,
  -- steps: [{ delay_hours: 1, template: "...", channel: "sms" }, ...]
  active boolean default true,
  created_at timestamptz not null default now()
);

create table lead_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  sequence_id uuid not null references follow_up_sequences(id) on delete cascade,
  current_step integer not null default 0,
  status text not null default 'active', -- 'active', 'completed', 'paused', 'cancelled'
  next_action_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_lead_seq_next on lead_sequences(next_action_at) where status = 'active';

-- ============================================
-- AGENT DECISIONS (Orchestrator Log)
-- ============================================
create table agent_decisions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  agent_type text not null, -- 'orchestrator', 'voice_qualifier', 'chat_assistant'
  decision text not null,
  reasoning text,
  confidence numeric(3,2) check (confidence >= 0 and confidence <= 1),
  input_data jsonb,
  output_data jsonb,
  model_used text,
  tokens_used integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index idx_decisions_lead on agent_decisions(lead_id);
create index idx_decisions_agent on agent_decisions(agent_type);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at on leads
create or replace function update_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_leads_updated_at();

-- Log pipeline events on lead status change
create or replace function log_lead_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into pipeline_events (lead_id, event_type, previous_status, new_status, triggered_by)
    values (new.id, 'status_change', old.status, new.status, 'system');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger lead_status_change
  after update on leads
  for each row execute function log_lead_status_change();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table leads enable row level security;
alter table consent_logs enable row level security;
alter table calls enable row level security;
alter table messages enable row level security;
alter table chat_sessions enable row level security;
alter table pipeline_events enable row level security;
alter table agent_decisions enable row level security;

-- Service role has full access (used by API routes)
create policy "Service role full access on leads"
  on leads for all using (true) with check (true);

create policy "Service role full access on consent_logs"
  on consent_logs for all using (true) with check (true);

create policy "Service role full access on calls"
  on calls for all using (true) with check (true);

create policy "Service role full access on messages"
  on messages for all using (true) with check (true);

create policy "Service role full access on chat_sessions"
  on chat_sessions for all using (true) with check (true);

create policy "Service role full access on pipeline_events"
  on pipeline_events for all using (true) with check (true);

create policy "Service role full access on agent_decisions"
  on agent_decisions for all using (true) with check (true);

-- ============================================
-- GRANTS
-- ============================================
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
