# Cancun AI Sales Platform

AI-powered outbound sales system for dental tourism — connecting American and Canadian patients with dental clinics in Cancun through AI voice calling, automated follow-up, and CRM integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Landing Page                              │
│                   (Next.js + TrustedForm)                        │
│              Lead opts in → consent recorded                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
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
       ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     n8n Workflows                                │
│   lead-ingestion → voice-qualification → sms-followup            │
│              → pipeline-update → dashboard-sync                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Dashboard (Next.js)                           │
│         Pipeline view | Call logs | Conversion metrics            │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Retell AI** | AI voice calling — qualifies leads and live-transfers hot leads |
| **n8n** | Workflow orchestration — connects all platforms via webhooks |
| **Supabase** | PostgreSQL database — leads, calls, messages, consent tracking |
| **Claude API** | Chat assistant + multi-agent orchestration |
| **OpenAI API** | Embeddings for lead scoring and knowledge base |
| **Twilio** | SMS/email follow-up for non-answering leads |
| **Next.js 14** | Landing page, chat widget, and admin dashboard |
| **TrustedForm** | TCPA consent documentation |

## Project Structure

```
cancun-ai-sales/
├── web/                    # Next.js application
│   ├── app/
│   │   ├── page.tsx        # Landing page (lead capture)
│   │   ├── dashboard/      # Admin dashboard
│   │   ├── chat/           # AI chat widget
│   │   └── api/            # Backend endpoints
│   ├── components/         # React components
│   └── lib/                # Shared utilities & clients
├── agents/                 # AI agent configurations
│   ├── voice-qualifier/    # Retell AI voice agent
│   ├── chat-assistant/     # Claude-powered chat
│   └── orchestrator/       # Multi-agent decision engine
├── workflows/              # n8n exported workflows
├── supabase/               # Database migrations & seeds
└── docs/                   # Architecture & compliance docs
```

## Lead Pipeline

```
[Opt-in] → [Consent Logged] → [AI Voice Call] → [Qualified?]
                                                      │
                                          ┌───────────┼───────────┐
                                          ▼           ▼           ▼
                                    [Hot Lead]   [Warm Lead]  [No Answer]
                                        │           │            │
                                        ▼           ▼            ▼
                                  [Live Transfer] [Email    [SMS Follow-up
                                   to Founder]    Sequence]  + Retry Call]
```

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (or local via Docker)
- Retell AI API key
- Claude API key (Anthropic)
- Twilio account (for SMS)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/yourusername/cancun-ai-sales.git
cd cancun-ai-sales/web
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your API keys

# 3. Run database migrations
npx supabase db push

# 4. Start development server
npm run dev

# 5. Import n8n workflows
# See workflows/README.md for import instructions
```

## Features

### AI Voice Agent (Retell AI)
- Calls opted-in leads using a natural-sounding AI voice
- Qualifies leads based on dental needs, timeline, and budget
- Live-transfers hot leads directly to the sales team
- Logs call transcripts and outcomes to Supabase

### AI Chat Assistant (Claude API)
- Embeddable chat widget for the landing page
- Answers questions about dental procedures, pricing, and travel
- Collects lead information conversationally
- Hands off to human agent when needed

### Multi-Agent Orchestrator
- Decides optimal contact strategy per lead (call, SMS, email, chat)
- Adapts based on lead behavior (opened email? answered call? visited page?)
- Scores leads using engagement signals
- Routes high-intent leads for immediate follow-up

### Automated Follow-up (Twilio + n8n)
- SMS sequences for non-answering leads
- Email drip campaigns with personalized content
- Re-engagement campaigns for cold leads
- All automations triggered via n8n workflows

### TCPA Compliance
- TrustedForm consent certificates on every opt-in
- Consent records stored in Supabase with timestamps
- Call recordings with disclosure
- Opt-out handling across all channels

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leads` | Create new lead from landing page |
| GET | `/api/leads` | List leads with filtering |
| PATCH | `/api/leads/[id]` | Update lead status |
| POST | `/api/voice/webhook` | Retell AI call events |
| POST | `/api/chat` | Claude chat completion |
| POST | `/api/sms/webhook` | Twilio inbound SMS |
| POST | `/api/webhooks/n8n` | n8n workflow triggers |

## License

MIT
