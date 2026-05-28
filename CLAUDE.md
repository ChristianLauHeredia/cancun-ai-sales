# Cancun AI Sales — Claude Code Guide

## Project Overview
AI-powered outbound sales system for dental tourism. Connects US/Canadian patients with Cancun clinics via AI voice calling, automated follow-up, and CRM. Built as a demo for Cancun AI Ventures AI Specialist position.

## Stack
- Next.js 14 (App Router, TypeScript strict)
- Supabase (PostgreSQL backend)
- Retell AI (AI voice calling)
- n8n (workflow orchestration)
- Twilio (SMS)
- Claude API (chat + orchestration)
- TrustedForm (TCPA consent)

## Skills — Read Before Working On Each Area

| Area | Skill |
|------|-------|
| Retell AI integration | .claude/skills/retell-ai/SKILL.md |
| n8n workflow JSON | .claude/skills/n8n-workflows/SKILL.md |
| Supabase + Next.js | .claude/skills/supabase-nextjs/SKILL.md |
| Claude tool use / orchestrator | .claude/skills/claude-tool-use/SKILL.md |
| Twilio SMS | .claude/skills/twilio-sms/SKILL.md |
| TrustedForm consent | .claude/skills/trustedform/SKILL.md |

## Code Rules
- TypeScript strict, no `any`
- Zod validation on all API inputs
- Environment variables never hardcoded
- Try/catch on every API route
- Respond 200 fast on webhooks, process async
- service_role key only in server-side code, never NEXT_PUBLIC_

## Build Order
1. supabase/migrations/ — schema first
2. web/app/api/leads/route.ts
3. web/app/page.tsx (landing + form)
4. web/app/api/voice/webhook/route.ts
5. agents/voice-qualifier/prompt.md
6. agents/orchestrator/index.ts
7. workflows/*.json
8. web/app/dashboard/page.tsx
9. web/components/ChatWidget.tsx
10. README.md

## Key Environment Variables
See .env.example — never commit real values.
