# TrustedForm Skill

## Script Embedding (plain HTML)

```html
<script>
  (function() {
    var field = 'xxTrustedFormCertUrl';
    var provideReferrer = false;
    var invertFieldSensitivity = false;
    var tf = document.createElement('script');
    tf.type = 'text/javascript'; tf.async = true;
    tf.src = 'http' + ('https:' == document.location.protocol ? 's' : '') +
      '://api.trustedform.com/trustedform.js?provide_referrer=' + escape(provideReferrer) +
      '&field=' + escape(field) + '&l=' + new Date().getTime() + Math.random() +
      '&invert_field_sensitivity=' + invertFieldSensitivity;
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(tf, s);
  })();
</script>
<input type="hidden" name="xxTrustedFormCertUrl" id="xxTrustedFormCertUrl" />
```

The TrustedForm JS automatically populates the hidden input with the certificate URL after loading.

---

## In React/Next.js

```typescript
// components/LeadForm.tsx
'use client'
import { useEffect, useRef } from 'react'

export function LeadForm() {
  const certUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_TRUSTEDFORM_TOKEN) {
      console.warn('TrustedForm not configured — skipping consent script')
      return
    }

    const field = 'xxTrustedFormCertUrl'
    const tf = document.createElement('script')
    tf.type = 'text/javascript'
    tf.async = true
    tf.src = `https://api.trustedform.com/trustedform.js?field=${encodeURIComponent(field)}&l=${Date.now()}${Math.random()}`

    // Capture cert URL once script populates the hidden field
    tf.onload = () => {
      const input = document.getElementById(field) as HTMLInputElement | null
      if (input?.value) certUrlRef.current = input.value
    }

    document.head.appendChild(tf)
    return () => { document.head.removeChild(tf) }
  }, [])

  async function handleSubmit(formData: FormData) {
    const certUrl = certUrlRef.current ??
      (document.getElementById('xxTrustedFormCertUrl') as HTMLInputElement)?.value ?? null

    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        dental_need: formData.get('dental_need'),
        trusted_form_cert_url: certUrl
      })
    })
  }

  return (
    <form action={handleSubmit}>
      {/* form fields */}
      <input type="hidden" name="xxTrustedFormCertUrl" id="xxTrustedFormCertUrl" />
    </form>
  )
}
```

---

## Claiming a Certificate (API)

Call this from `/api/leads` route after inserting the lead to Supabase. Must claim within 72 hours.

```typescript
// lib/trustedform/claim.ts
export async function claimTrustedFormCert(
  certUrl: string,
  leadId: string
): Promise<void> {
  if (!process.env.TRUSTEDFORM_API_KEY) {
    console.warn('TrustedForm API key not configured — skipping claim')
    return
  }

  // Extract cert ID from URL (last path segment)
  const certId = certUrl.split('/').pop()
  if (!certId) throw new Error(`Invalid TrustedForm cert URL: ${certUrl}`)

  const credentials = Buffer.from(`API:${process.env.TRUSTEDFORM_API_KEY}`).toString('base64')

  const response = await fetch(`https://cert.trustedform.com/${certId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reference: leadId,
      vendor: 'cancun-ai-sales'
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TrustedForm claim failed ${response.status}: ${body}`)
  }
}
```

---

## What to Store in `consent_logs`

```typescript
// In /api/leads/route.ts — extract from request before inserting
const consentLog = {
  lead_id: newLead.id,
  trusted_form_cert_url: body.trusted_form_cert_url,
  ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
  user_agent: req.headers.get('user-agent') ?? null,
  page_url: req.headers.get('referer') ?? null,
  consented_at: new Date().toISOString()
}

await supabase.from('consent_logs').insert(consentLog)

// Then claim the cert (non-blocking — fire and forget or background)
claimTrustedFormCert(body.trusted_form_cert_url, newLead.id).catch(console.error)
```

**Schema for `consent_logs`:**
```sql
CREATE TABLE consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  trusted_form_cert_url TEXT,
  ip_address INET,
  user_agent TEXT,
  page_url TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Gotchas

- Certificate must be claimed within **72 hours** of creation or it expires permanently
- Claiming is **idempotent** — safe to retry on failure (POST to same cert ID again)
- The cert URL IS the certificate — the last path segment is the cert ID: `https://cert.trustedform.com/{certId}`
- In development: TrustedForm script does not generate real certificates on `localhost` — test with a staging domain or use a mock cert URL for DB testing
- `NEXT_PUBLIC_TRUSTEDFORM_TOKEN` is used to conditionally load the script; the actual `TRUSTEDFORM_API_KEY` is server-side only for claiming
- Always do graceful degradation — if the cert URL is missing (script blocked, ad blocker, etc.), still capture the lead but log the missing cert
- Claiming is async — fire-and-forget is acceptable; the cert expiry window is 72 hours, not seconds
