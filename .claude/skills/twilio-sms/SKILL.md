# Twilio SMS Skill

## Send Outbound SMS

```typescript
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendSMS(to: string, body: string): Promise<string> {
  const message = await client.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER!, // must be a purchased Twilio number
    to  // E.164 format: +1XXXXXXXXXX
  })
  return message.sid
}
```

---

## Inbound Webhook Handler

Twilio POSTs **form-encoded** body, not JSON. Common mistake to use `req.json()` — use `req.formData()`.

```typescript
// app/api/sms/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioRequest } from '@/lib/twilio/verify'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const params = Object.fromEntries(formData.entries()) as Record<string, string>

  // Verify signature before processing
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const url = process.env.TWILIO_SMS_WEBHOOK_URL! // full https:// URL
  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { From, To, Body, MessageSid } = params

  // Process inbound SMS...

  // Respond with TwiML (or empty 200 to ignore)
  return new NextResponse('<Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  })
}
```

**Key inbound fields:**
| Field | Description |
|-------|-------------|
| `From` | Sender's phone number (E.164) |
| `To` | Your Twilio number that received the message |
| `Body` | Text content of the SMS |
| `MessageSid` | Unique message ID |
| `NumMedia` | Count of attached media (MMS) |

---

## Webhook Signature Verification

```typescript
// lib/twilio/verify.ts
import { validateRequest } from 'twilio'

export function validateTwilioRequest(
  signature: string,
  url: string,        // full webhook URL with https://
  params: Record<string, string>  // parsed form body as plain object
): boolean {
  return validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
}
```

**Important:** The `url` must exactly match the URL Twilio has configured for the webhook — including protocol, domain, path, and query string. A mismatch causes valid requests to fail verification.

---

## SMS Templates for This Project

```typescript
// lib/twilio/templates.ts
export const SMS_TEMPLATES = {
  warm_followup: (name: string) =>
    `Hi ${name}, this is Sofia from Cancun Dental Care! We just tried calling you about your inquiry. We'd love to chat — when's a good time to call? Reply STOP to opt out.`,

  no_answer_retry: (name: string) =>
    `Hi ${name}, we tried reaching you earlier about your dental inquiry. We'll try again shortly! Questions? Reply to this message. Reply STOP to opt out.`,

  founder_hot_alert: (name: string, dentalNeed: string, phone: string) =>
    `🔥 HOT LEAD: ${name} | ${dentalNeed} | ${phone}`
} as const

export type TemplateName = keyof typeof SMS_TEMPLATES
```

---

## E.164 Format Helper

```typescript
// lib/twilio/format.ts
export function toE164(phone: string, defaultCountryCode = '1'): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Already has country code (11 digits for US/CA)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // 10-digit US/CA number — prepend country code
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`
  }

  throw new Error(`Cannot normalize phone number: ${phone}`)
}
```

---

## Gotchas

- Twilio webhooks send **form-encoded** body, not JSON — `req.formData()` not `req.json()`
- Must respond within **15 seconds** or Twilio marks the webhook delivery as failed and may retry
- Twilio **will retry** failed webhooks (unlike Retell) — make handlers idempotent using `MessageSid`
- Sandbox numbers can only send to verified test recipients — use a real number for testing beyond sandbox
- `TWILIO_FROM_NUMBER` must be a purchased Twilio number, not your personal number
- For scheduled message sequences: use n8n Wait nodes, not `setTimeout` in an API route (process will not stay alive)
- `validateRequest` uses the raw form params object — do not pre-process or reorder fields before passing them in
- The webhook URL in `validateRequest` must include trailing slash if that's how Twilio has it configured
