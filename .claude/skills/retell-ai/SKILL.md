# Retell AI Skill

## API Reference (v2)

**Base URL:** `https://api.retellai.com`  
**Auth:** `Authorization: Bearer {RETELL_API_KEY}`

### Create Phone Call
```
POST /v2/create-phone-call
```
```json
{
  "from_number": "+12125551234",
  "to_number": "+19175550000",
  "agent_id": "agent_abc123",
  "metadata": { "lead_id": "uuid", "lead_name": "John" },
  "retell_llm_dynamic_variables": {
    "lead_name": "John",
    "dental_need": "implants",
    "lead_city": "Miami"
  }
}
```
Response: `{ "call_id": "call_xyz", "status": "registered" }`

### Get Call
```
GET /v2/get-call/{call_id}
```

### List Calls
```
GET /v2/list-calls
```

---

## Webhook Events

Retell POSTs to your registered webhook URL for every call event.

### `call_started`
```json
{
  "event": "call_started",
  "call": {
    "call_id": "call_xyz",
    "agent_id": "agent_abc123",
    "call_status": "ongoing",
    "metadata": { "lead_id": "uuid" },
    "start_timestamp": 1700000000000
  }
}
```

### `call_ended`
```json
{
  "event": "call_ended",
  "call": {
    "call_id": "call_xyz",
    "call_status": "ended",
    "end_timestamp": 1700000060000,
    "duration_ms": 60000,
    "metadata": { "lead_id": "uuid" }
  }
}
```
**WARNING: transcript is NOT available in `call_ended`. Never read transcript here.**

### `call_analyzed`
```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "call_xyz",
    "call_status": "ended",
    "transcript": [
      { "role": "agent", "content": "Hi, is this John?" },
      { "role": "user", "content": "Yes, speaking." }
    ],
    "call_analysis": {
      "call_summary": "Lead is interested in implants, budget ~$3k",
      "user_sentiment": "Positive",
      "call_successful": true,
      "custom_analysis_data": {
        "outcome": "hot",
        "dental_need": "implants",
        "budget": "3000",
        "timeline": "3 months"
      }
    },
    "metadata": { "lead_id": "uuid" }
  }
}
```
**`call_analyzed` is the only event where transcript and outcome are available.**

### `call_status` values
| Value | Meaning |
|-------|---------|
| `registered` | Call created, not yet dialing |
| `ongoing` | Call in progress |
| `ended` | Call completed normally |
| `error` | Call failed (no answer counts as ended, not error) |

### Where data lives
- **Transcript:** `call.transcript` — array of `{ role: "agent" | "user", content: string }`
- **Outcome:** `call.call_analysis.custom_analysis_data` — you define this shape in the agent prompt

---

## Webhook Signature Verification

```typescript
import crypto from 'crypto'

function verifyRetellSignature(
  payload: string,       // raw request body as string
  signature: string,     // req.headers['x-retell-signature']
  apiKey: string
): boolean {
  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
```

---

## Agent Configuration

**`agent_id`:** Found in Retell dashboard → Agents → select agent → copy ID from URL or settings panel.

**`retell_llm_dynamic_variables`:** Injected into the agent's prompt at call time. Use this to personalize the script:
```typescript
retell_llm_dynamic_variables: {
  lead_name: lead.name,
  dental_need: lead.dental_need,
  lead_city: lead.city
}
// In agent prompt: "Ask {{lead_name}} about their {{dental_need}} needs"
```

**`metadata`:** Passed through the call lifecycle and returned in webhook payloads. Not injected into agent prompt. Use for your own backend tracking:
```typescript
metadata: {
  lead_id: lead.id,
  campaign_id: "dental-q1"
}
```

---

## TypeScript Types

```typescript
export interface RetellTranscriptEntry {
  role: 'agent' | 'user'
  content: string
}

export interface RetellCallAnalysis {
  call_summary?: string
  user_sentiment?: 'Positive' | 'Neutral' | 'Negative'
  call_successful?: boolean
  custom_analysis_data?: {
    outcome: 'hot' | 'warm' | 'cold' | 'no_answer'
    dental_need?: string
    budget?: string
    timeline?: string
  }
}

export interface RetellCall {
  call_id: string
  agent_id: string
  call_status: 'registered' | 'ongoing' | 'ended' | 'error'
  metadata?: Record<string, unknown>
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
  transcript?: RetellTranscriptEntry[]
  call_analysis?: RetellCallAnalysis
}

export type RetellWebhookEvent =
  | { event: 'call_started'; call: RetellCall }
  | { event: 'call_ended'; call: RetellCall }
  | { event: 'call_analyzed'; call: RetellCall }

export interface RetellCallPayload {
  from_number: string
  to_number: string
  agent_id: string
  metadata?: Record<string, unknown>
  retell_llm_dynamic_variables?: Record<string, string>
}
```

---

## Gotchas

- `call_ended` fires before analysis is complete — **never read transcript from `call_ended`**
- Always use `call_analyzed` for transcript and outcome data
- Phone numbers must be E.164 format: `+1XXXXXXXXXX` — no dashes, spaces, or parentheses
- `metadata` is for your backend tracking only, not visible to the agent
- `retell_llm_dynamic_variables` is what gets injected into the agent prompt
- Retell webhooks **do NOT retry on failure** — respond 200 immediately and process async
- Test calls can be triggered from the Retell dashboard without a real phone (use "Test Call" button)
- No-answer calls still trigger `call_ended` and `call_analyzed` with `call_successful: false`
