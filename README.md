# Cancun AI Sales Platform

> **Code challenge for Cancun AI Ventures — AI Specialist position**
>
> A production-deployed AI outbound sales system. Patients opt in → AI voice agent calls within minutes → qualifies them live → hot leads get SMS-alerted to the founder or live-transferred → automated SMS follow-up for warm/cold/no-answer outcomes.

**Live:** [cancun-ai-sales.vercel.app](https://cancun-ai-sales.vercel.app) · **Pipeline:** [cancun-ai-sales.vercel.app/dashboard?secret=cancun2026](https://cancun-ai-sales.vercel.app/dashboard?secret=cancun2026)

---

## What It Does

```
Patient fills form
       │
       ▼
POST /api/leads  ─────────────────────────────────────────────────────────┐
  • Validates input (Zod)                                                  │
  • Logs TCPA consent                                                      │
  • Saves lead to Supabase                                                 │
  • Notifies n8n                                                           │
       │                                                                   │
       ▼                                                                   ▼
n8n workflow-01                                               Dashboard refreshes
  • Waits 10s (avoids calling immediately after opt-in)       • Shows new lead
  • Calls Retell API → creates outbound phone call            • Status: "new" → "call_scheduled"
  • Passes lead metadata + dynamic vars to AI agent
       │
       ▼
Retell AI calls the lead
  • AI agent qualifies: procedures, budget, timeline
  • Outcomes: qualified_hot / qualified_warm / no_answer / live_transferred
       │
       ▼
Retell fires call_analyzed webhook → POST /api/voice/webhook
  • Updates calls table (transcript, sentiment, summary)
  • Updates lead status
  • Inserts agent_decision record
  • Notifies n8n workflow-02
       │
       ├─── qualified_hot ──────→ Update lead → SMS founder: "🔥 HOT LEAD"
       │
       ├─── live_transferred ───→ Update lead → SMS founder: "✅ LIVE TRANSFER"
       │
       ├─── qualified_warm ─────→ Update lead → Fetch lead → SMS lead: "Hi, Sofia here..."
       │
       ├─── no_answer ──────────→ Wait 2h → Retry call (via /api/test/trigger-call)
       │
       └─── (fallback) ─────────→ Update lead status: cold
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Landing Page + Chat Widget                        │
│                     Next.js 14 · TrustedForm TCPA                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ POST /api/leads
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Supabase (PostgreSQL)                          │
│              leads │ calls │ messages │ agent_decisions │ consent_logs   │
└────────┬──────────────────────────────────────────────────┬─────────────┘
         │                                                  │
         │ notify n8n                                       │ read/write
         ▼                                                  ▼
┌─────────────────────┐    webhooks    ┌────────────────────────────────────┐
│    n8n Workflows    │◄───────────────│         Next.js API Routes          │
│                     │                │                                    │
│  01 lead-ingestion  │                │  /api/leads          ← form submit  │
│  02 post-call-route │                │  /api/voice/webhook  ← Retell       │
│  03 sms-followup    │                │  /api/sms/webhook    ← Twilio inbound│
│                     │                │  /api/chat           ← chat widget  │
└──────────┬──────────┘                │  /api/test/trigger-call ← dashboard │
           │                           └────────────────────────────────────┘
           │ create-phone-call
           ▼
┌──────────────────────┐    call_analyzed     ┌──────────────────────┐
│      Retell AI       │─────────────────────►│   Voice Webhook      │
│  AI Voice Agent      │                      │  (HMAC optional)     │
│  Qualifies leads     │                      └──────────────────────┘
│  Live-transfers hot  │
└──────────────────────┘

┌──────────────────────┐    ┌──────────────────────┐
│       Twilio         │    │     Claude API        │
│  Outbound SMS        │    │  Chat widget (Sofia)  │
│  Warm/no-answer      │    │  tool_use lead capture│
│  follow-up           │    │  CancunOrchestrator   │
└──────────────────────┘    └──────────────────────┘
```

---

## Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| **Frontend** | Next.js 14 (App Router) | Landing page, dashboard, chat widget |
| **Database** | Supabase (PostgreSQL) | Leads, calls, messages, consent logs |
| **Voice AI** | Retell AI | Outbound AI phone calls, qualification, live transfer |
| **Orchestration** | n8n | Connects all services via webhooks (3 workflows) |
| **SMS** | Twilio | Outbound follow-up, inbound response handling |
| **AI Chat** | Claude API (Sonnet) | Chat widget + multi-tool orchestrator |
| **Consent** | TrustedForm | TCPA compliance certificate capture |
| **Hosting** | Vercel | Edge-deployed Next.js |

---

## n8n Workflows

Three workflows handle the full automation pipeline:

```
workflow-01-lead-ingestion
  Trigger: POST /webhook/lead-ingestion  (called by /api/leads)
  ├── Respond 200 immediately
  ├── Wait 10 seconds
  ├── Retell API → create outbound phone call
  │     from: $vars.RETELL_FROM_NUMBER
  │     to:   $json.body.phone
  │     metadata: { lead_id }
  │     dynamic_vars: { lead_name, dental_need, timeline, budget }
  └── Supabase → update lead status: "call_scheduled"

workflow-02-post-call-routing
  Trigger: POST /webhook/post-call  (called by /api/voice/webhook after call_analyzed)
  ├── Respond 200 immediately
  ├── Switch on $json.body.outcome:
  │     qualified_hot / live_transferred → Update lead + SMS founder
  │     qualified_warm                  → Update lead + fetch lead + SMS lead
  │     no_answer                       → Wait 2h + retry call
  │     (fallback)                      → Update lead: cold
  └── All Supabase nodes reference: $('Webhook').item.json.body.lead_id

workflow-03-sms-followup
  Trigger: POST /webhook/sms-followup
  ├── Switch on $json.body.template:
  │     warm_followup    → SMS lead (Sofia warm message)
  │     no_answer_retry  → SMS lead (callback request)
  └── Supabase → log to messages table
```

### Import Instructions

1. In n8n: **Settings → Import Workflow** → upload each JSON from `workflows/`
2. Set credentials by exact name:

| Credential Name | Type | Used By |
|-----------------|------|---------|
| `Supabase-API` | Supabase (service_role key) | All Supabase nodes |
| `RetellAI-API` | HTTP Header Auth (`Authorization: Bearer KEY`) | HTTP Request nodes |
| `Twilio-Account` | Twilio API | Twilio SMS nodes |

3. Set n8n Variables:

| Variable | Value |
|----------|-------|
| `RETELL_FROM_NUMBER` | Your Retell phone number (E.164) |
| `RETELL_AGENT_ID` | Your Retell agent ID |
| `TWILIO_FROM_NUMBER` | Your Twilio number |
| `FOUNDER_PHONE` | Phone for hot-lead SMS alerts |
| `APP_URL` | Your Next.js app URL |
| `DASHBOARD_SECRET` | Matches `DASHBOARD_SECRET` in Vercel |

4. Activate all three workflows (toggle ON)

> **n8n quirk:** When importing, the Supabase node's Table and Field dropdowns will be empty — you must select them manually from the dropdowns in each node. The JSON stores the values but n8n requires a live lookup to populate these fields.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/leads` | — | Create lead, log TCPA consent, notify n8n |
| `GET` | `/api/leads` | — | List leads (paginated, filterable by status) |
| `POST` | `/api/voice/webhook` | HMAC (opt-in) | Retell call events: started / ended / analyzed |
| `POST` | `/api/sms/webhook` | Twilio sig | Inbound SMS from leads |
| `POST` | `/api/chat` | — | Claude chat with Sofia (tool_use lead capture) |
| `POST` | `/api/test/trigger-call` | Cookie / Header secret | Trigger Retell call from dashboard |

---

## What's Live

| Feature | Status | Notes |
|---------|--------|-------|
| Lead capture form | ✅ Live | Zod validation, TCPA consent |
| TrustedForm TCPA cert | ✅ Live | Degrades gracefully if key absent |
| AI voice calling (Retell) | ✅ Live | Outbound, qualifies leads by phone |
| Retell webhook handler | ✅ Live | All 3 events: started / ended / analyzed |
| Post-call SMS routing | ✅ Live | Hot → founder alert, warm → lead SMS |
| Supabase persistence | ✅ Live | Leads, calls, transcripts, decisions |
| Dashboard pipeline | ✅ Live | Real data, 30s auto-refresh |
| Trigger test call button | ✅ Live | Calls Retell API directly |
| Chat widget (Sofia) | ✅ Live | Claude tool_use loop, captures leads |
| n8n workflows (3) | ✅ Importable | All `.body.` references corrected |
| Email sequences | 🔲 Planned | — |

---

## Setup

```bash
# 1. Install
cd cancun-ai-sales/web && npm install

# 2. Configure
cp .env.example .env.local
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RETELL_API_KEY,
#          RETELL_AGENT_ID, RETELL_FROM_NUMBER, ANTHROPIC_API_KEY,
#          TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
#          DASHBOARD_SECRET, N8N_POSTCALL_WEBHOOK_URL

# 3. Run database migrations
npx supabase db push

# 4. Start dev server
npm run dev
# → http://localhost:3000        landing page
# → http://localhost:3000/dashboard   pipeline dashboard

# 5. Import n8n workflows (see section above)
```

---

## Project Structure

```
cancun-ai-sales/
├── web/                            # Next.js 14 app
│   ├── app/
│   │   ├── page.tsx                # Landing page (lead form + TrustedForm)
│   │   ├── dashboard/page.tsx      # Pipeline kanban dashboard
│   │   └── api/
│   │       ├── leads/route.ts      # Lead CRUD + n8n notification
│   │       ├── voice/webhook/      # Retell event handler (3 events)
│   │       ├── sms/webhook/        # Twilio inbound SMS
│   │       ├── chat/route.ts       # Claude Sofia with tool_use
│   │       └── test/trigger-call/  # Dashboard call button
│   ├── components/ChatWidget.tsx   # Floating chat UI
│   └── lib/
│       ├── supabase.ts             # Admin + anon Supabase clients
│       └── types.ts                # Shared TypeScript types
├── agents/
│   ├── voice-qualifier/prompt.md   # Retell agent script + analysis schema
│   └── orchestrator/
│       ├── config.ts               # System prompt + LeadContext types
│       └── index.ts                # CancunOrchestrator (tool_use loop)
├── workflows/                      # n8n workflow JSON (ready to import)
│   ├── workflow-01-lead-ingestion.json
│   ├── workflow-02-post-call-routing.json
│   └── workflow-03-sms-followup.json
└── supabase/
    ├── migrations/001_initial.sql
    └── seed.sql
```

---

## How It Adapts to Other Verticals

The architecture is intentionally vertical-agnostic. To adapt to a different industry:

1. **Landing page** — swap dental checkboxes for your qualification questions
2. **Retell agent prompt** (`agents/voice-qualifier/prompt.md`) — rewrite the script and `custom_analysis_data` schema
3. **Voice webhook** (`/api/voice/webhook`) — update `LEAD_STATUS_MAP` and `CALL_OUTCOME_MAP`
4. **n8n workflows** — update Switch node outcomes and SMS templates
5. **Chat widget** (`/api/chat`) — swap Sofia's system prompt

Works for: solar, insurance, real estate, SaaS demos, or any high-ticket inbound/outbound sales flow.
