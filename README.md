# Cancun AI Sales Platform

> **Demo for Cancun AI Ventures AI Specialist position** — a production-ready AI outbound sales system for dental tourism connecting US/Canadian patients with Cancun clinics.

<!-- Loom walkthrough: [INSERT LOOM URL] -->

---

AI-powered outbound sales system: patients opt in → AI voice agent calls within minutes → qualifies them → live-transfers hot leads to the founder → automated follow-up via SMS/email for the rest.

## 5-Minute Quick Start

```bash
# 1. Install
cd cancun-ai-sales/web && npm install

# 2. Configure
cp .env.example .env.local
# Fill in your API keys (Supabase, Retell, Anthropic, Twilio)

# 3. Run database migrations
npx supabase db push

# 4. Start dev server
npm run dev

# 5. Import n8n workflows (in n8n UI: Settings → Import Workflow)
# workflows/lead-ingestion.json
# workflows/workflow-02-post-call-routing.json
# workflows/sms-followup.json
```

Visit `http://localhost:3000` for the landing page, `http://localhost:3000/dashboard?secret=YOUR_SECRET` for the dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Landing Page                              │
│                   (Next.js + TrustedForm)                        │
│              Lead opts in → consent recorded                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/leads → notifies n8n
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (Backend)                          │
│           leads | calls | messages | consent_logs                │
└──────┬───────────────┬────────────────┬─────────────────────────┘
       │               │                │
       ▼               ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│  Retell AI  │ │  Claude API │ │   Twilio     │
│ Voice Agent │ │ Chat + Orch │ │  SMS/Email   │
│ Qualifies   │ │ Assists +   │ │  Follow-up   │
│ leads by    │ │ orchestrates│ │  sequences   │
│ phone call  │ │ decisions   │ │              │
└──────┬──────┘ └──────┬──────┘ └──────┬───────┘
       │               │                │
       └───────────────┴────────────────┘
                           │ webhooks
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     n8n Workflows (3)                            │
│  01 lead-ingestion  →  02 post-call-routing  →  03 sms-followup │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Dashboard (Next.js)                           │
│    Pipeline kanban | Call logs | Trigger Test Call button         │
│    Auto-refreshes every 30s | DASHBOARD_SECRET protected          │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Retell AI** | AI voice calling — qualifies leads, live-transfers hot leads |
| **n8n** | Workflow orchestration — connects all platforms via webhooks |
| **Supabase** | PostgreSQL backend — leads, calls, messages, consent tracking |
| **Claude API** | Chat widget + multi-agent orchestration (tool_use loop) |
| **Twilio** | Outbound SMS follow-up sequences |
| **Next.js 16** | Landing page, chat widget, and admin dashboard |
| **TrustedForm** | TCPA consent certificate capture |

## What's Live vs Mocked

| Feature | Status | Notes |
|---------|--------|-------|
| Lead capture form | ✅ Live | Zod validation, TCPA consent log |
| TrustedForm cert | ✅ Live | Gracefully degrades if API key absent |
| Retell voice webhook | ✅ Live | HMAC verified, all 3 events handled |
| Supabase persistence | ✅ Live | All tables, RLS enabled |
| Dashboard pipeline | ✅ Live | Real data, 30s auto-refresh |
| Trigger Test Call button | ✅ Live | Calls Retell API, updates lead status |
| Chat widget (Sofia) | ✅ Live | Claude API, captures leads via tool_use |
| Twilio SMS | ✅ Live | Outbound via Twilio REST API |
| n8n workflows | ✅ Importable | 3 workflows ready to import |
| CancunOrchestrator | ✅ Live | Claude tool_use loop, 5 tools |
| Email sequences | 🔲 Planned | Not in scope for this demo |
| Retell agent config | 📄 Documented | `agents/voice-qualifier/prompt.md` |

## n8n Workflows

Import from `workflows/` into your n8n instance (Settings → Import Workflow):

| File | Trigger | What it does |
|------|---------|--------------|
| `lead-ingestion.json` | `/webhook/lead-ingestion` | Receives new lead → triggers Retell call |
| `workflow-02-post-call-routing.json` | `/webhook/post-call-routing` | Routes by outcome: hot→SMS founder, warm→SMS lead, no_answer→retry call, cold→follow_up |
| `sms-followup.json` | `/webhook/sms-followup` | Multi-step SMS sequence with Twilio |

After importing, copy each workflow's webhook URL into your `.env.local` as `N8N_*_WEBHOOK_URL`.

<!-- n8n workflow screenshot: [INSERT SCREENSHOT] -->

## How It Scales to Other Verticals

This system is intentionally vertical-agnostic. To adapt to another industry:

1. **Landing page** — swap dental needs checkboxes for your product's qualification questions
2. **Retell agent prompt** (`agents/voice-qualifier/prompt.md`) — rewrite the script and `custom_analysis_data` fields
3. **Voice webhook** (`/api/voice/webhook`) — the `LEAD_STATUS_MAP` and `CALL_OUTCOME_MAP` map Retell outcomes to your status enum
4. **n8n workflows** — update the Switch node outcomes and SMS templates
5. **Chat widget system prompt** (`/api/chat`) — swap Sofia's script for your industry context

The underlying architecture (lead → AI call → qualify → route → follow-up) works for solar, insurance, SaaS demos, real estate, or any high-ticket inbound/outbound sales flow.

## Project Structure

```
cancun-ai-sales/
├── web/                         # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx             # Landing page (lead capture + TrustedForm)
│   │   ├── dashboard/           # Admin pipeline dashboard
│   │   └── api/
│   │       ├── leads/           # Lead CRUD + n8n notification
│   │       ├── voice/webhook/   # Retell event handler (HMAC verified)
│   │       ├── sms/webhook/     # Twilio inbound SMS (form-encoded)
│   │       ├── chat/            # Claude chat with lead capture tool
│   │       └── test/trigger-call/ # Dashboard "Call" button endpoint
│   ├── components/
│   │   └── ChatWidget.tsx       # Floating chat UI (bottom-right)
│   └── lib/
│       ├── supabase.ts          # Supabase clients (admin + anon)
│       └── types.ts             # Shared TypeScript types
├── agents/
│   ├── voice-qualifier/         # Retell agent prompt + analysis schema
│   └── orchestrator/
│       ├── config.ts            # Detailed system prompt + LeadContext types
│       └── index.ts             # CancunOrchestrator (tool_use loop)
├── workflows/                   # n8n workflow JSON (ready to import)
├── supabase/
│   ├── migrations/001_initial.sql
│   └── seed.sql
└── .claude/skills/              # Claude Code skill files per integration
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/leads` | — | Create lead, log TCPA consent, notify n8n |
| GET | `/api/leads` | — | List leads (paginated, filterable by status) |
| POST | `/api/voice/webhook` | HMAC sig | Retell call events (started/ended/analyzed) |
| POST | `/api/sms/webhook` | Twilio sig | Inbound SMS from leads |
| POST | `/api/chat` | — | Claude chat completion with lead capture |
| POST | `/api/test/trigger-call` | `x-dashboard-secret` | Trigger Retell call for a lead |

## License

MIT
