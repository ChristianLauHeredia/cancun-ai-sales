# n8n Workflows Skill

## Workflow JSON Structure

```json
{
  "name": "workflow-01-lead-ingestion",
  "nodes": [...],
  "connections": {...},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null
}
```

### Node Structure
```json
{
  "id": "uuid-string",
  "name": "Human Readable Name",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 1,
  "position": [250, 300],
  "parameters": { ... },
  "credentials": {
    "supabaseApi": { "id": "cred-id", "name": "Supabase-API" }
  }
}
```

### Connections Structure
```json
{
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Wait", "type": "main", "index": 0 }]]
    },
    "Wait": {
      "main": [[{ "node": "Create Retell Call", "type": "main", "index": 0 }]]
    }
  }
}
```

**Export from n8n UI:** Menu (⋮) → Download → saves as JSON. Commit to `workflows/` directory.

---

## Node Types Used In This Project

### Webhook — `n8n-nodes-base.webhook`
```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 1,
  "parameters": {
    "path": "lead-ingestion",
    "httpMethod": "POST",
    "responseMode": "responseNode",
    "options": {}
  }
}
```
`responseMode: "responseNode"` = use a "Respond to Webhook" node downstream for fast ACK.

### HTTP Request — `n8n-nodes-base.httpRequest`
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4,
  "parameters": {
    "method": "POST",
    "url": "https://api.retellai.com/v2/create-phone-call",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        { "name": "from_number", "value": "={{ $env.RETELL_FROM_NUMBER }}" },
        { "name": "to_number", "value": "={{ $json.phone }}" },
        { "name": "agent_id", "value": "={{ $env.RETELL_AGENT_ID }}" }
      ]
    }
  }
}
```

### Switch — `n8n-nodes-base.switch`
```json
{
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "parameters": {
    "mode": "rules",
    "rules": {
      "rules": [
        { "outputKey": "hot", "conditions": { "options": { "caseSensitive": false }, "conditions": [{ "leftValue": "={{ $json.outcome }}", "rightValue": "hot", "operator": { "type": "string", "operation": "equals" } }] } },
        { "outputKey": "warm", "conditions": { "conditions": [{ "leftValue": "={{ $json.outcome }}", "rightValue": "warm", "operator": { "type": "string", "operation": "equals" } }] } },
        { "outputKey": "no_answer", "conditions": { "conditions": [{ "leftValue": "={{ $json.outcome }}", "rightValue": "no_answer", "operator": { "type": "string", "operation": "equals" } }] } }
      ]
    },
    "fallbackOutput": "cold"
  }
}
```

### Wait — `n8n-nodes-base.wait`
```json
{
  "type": "n8n-nodes-base.wait",
  "parameters": {
    "amount": 10,
    "unit": "seconds"
  }
}
```
Units: `seconds`, `minutes`, `hours`, `days`.

### Set — `n8n-nodes-base.set`
```json
{
  "type": "n8n-nodes-base.set",
  "typeVersion": 3,
  "parameters": {
    "mode": "manual",
    "fields": {
      "values": [
        { "name": "retry_count", "type": "numberValue", "numberValue": "={{ ($json.retry_count ?? 0) + 1 }}" },
        { "name": "lead_id", "type": "stringValue", "stringValue": "={{ $json.lead_id }}" }
      ]
    }
  }
}
```

### Supabase — `n8n-nodes-base.supabase`
```json
{
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "parameters": {
    "operation": "update",
    "tableId": "leads",
    "filters": {
      "conditions": [{ "keyName": "id", "keyValue": "={{ $json.lead_id }}" }]
    },
    "dataToSend": "defineBelow",
    "fieldsUi": {
      "fieldValues": [
        { "fieldId": "status", "fieldValue": "called" }
      ]
    }
  },
  "credentials": {
    "supabaseApi": { "id": "...", "name": "Supabase-API" }
  }
}
```
Operations: `create`, `update`, `delete`, `get`, `getAll`.

### Twilio — `n8n-nodes-base.twilio`
```json
{
  "type": "n8n-nodes-base.twilio",
  "typeVersion": 1,
  "parameters": {
    "operation": "send",
    "from": "={{ $env.TWILIO_FROM_NUMBER }}",
    "to": "={{ $json.phone }}",
    "message": "Hi {{ $json.name }}, this is Sofia from Cancun Dental Care..."
  },
  "credentials": {
    "twilioApi": { "id": "...", "name": "Twilio-Account" }
  }
}
```

### Code — `n8n-nodes-base.code`
```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "jsCode": "const items = $input.all();\nreturn items.map(item => ({ json: { ...item.json, processed: true } }));"
  }
}
```
Always return `[{ json: {...} }]` array.

---

## Expression Syntax

```javascript
// Previous node output
{{ $json.fieldName }}

// Specific node by name
{{ $('Webhook').item.json.lead_id }}

// Current timestamp (ISO string)
{{ $now }}

// Conditional
{{ $json.outcome === 'hot' ? 'URGENT' : 'normal' }}

// Null coalescing
{{ $json.retry_count ?? 0 }}

// Environment variable
{{ $env.RETELL_API_KEY }}
```

---

## Credentials Pattern

Never hardcode credentials in workflow JSON. Reference by name:
```json
"credentials": {
  "supabaseApi": { "id": "credential-uuid", "name": "Supabase-API" }
}
```

**Required credential names for this project:**
| n8n Credential Name | Type | Used By |
|---------------------|------|---------|
| `RetellAI-API` | HTTP Header Auth | HTTP Request nodes calling Retell |
| `Twilio-Account` | Twilio API | Twilio nodes |
| `Supabase-API` | Supabase API | Supabase nodes (use service_role key) |
| `Claude-API` | HTTP Header Auth | HTTP Request nodes calling Anthropic |

---

## Our 3 Workflows

### workflow-01-lead-ingestion
**Trigger:** `POST /webhook/lead-ingestion`  
**Flow:**
1. Webhook → receive lead `{ name, phone, email, dental_need, cert_url }`
2. Respond to Webhook (200 ACK) ← happens immediately
3. Wait 10 seconds (avoid calling too fast after opt-in)
4. HTTP Request → POST Retell `/v2/create-phone-call` with lead metadata + dynamic vars
5. Supabase → update lead status to `called`, store `call_id`

**Key:** Pass `metadata: { lead_id }` and `retell_llm_dynamic_variables: { lead_name, dental_need }` to Retell call creation.

---

### workflow-02-post-call-routing
**Trigger:** `POST /webhook/post-call`  
**Payload:** `{ lead_id, call_id, outcome: "hot"|"warm"|"no_answer"|"cold", ... }`  
**Flow:**
1. Webhook → receive outcome
2. Respond to Webhook (200 ACK)
3. Switch node on `outcome` field → 4 branches:

**hot branch:**
- Twilio → SMS to founder: `"🔥 HOT LEAD: {name} | {dental_need} | {phone}"`
- Supabase → update lead status to `hot`

**warm branch:**
- Twilio → SMS to lead: `"Hi {name}, this is Sofia from Cancun Dental Care..."`
- Supabase → update lead status to `warm`

**no_answer branch:**
- Set node → increment `retry_count` (default 0)
- IF retry_count < 3: Wait 2 hours → HTTP Request to re-trigger workflow-01
- IF retry_count >= 3: Supabase → update status to `cold`

**cold branch:**
- Supabase → update lead status to `cold`

---

### workflow-03-sms-followup
**Trigger:** `POST /webhook/sms-followup`  
**Payload:** `{ lead_id, template: "warm_followup"|"no_answer_retry", phone, name }`  
**Flow:**
1. Webhook → receive request
2. Respond to Webhook (200 ACK)
3. Switch on `template`
4. Twilio → send personalized SMS from template
5. Supabase → insert into `messages` table (log)
6. Wait 24 hours → HTTP Request back to this webhook (schedule follow-up)

---

## File Structure

```
workflows/
├── workflow-01-lead-ingestion.json
├── workflow-02-post-call-routing.json
├── workflow-03-sms-followup.json
└── README.md   ← import instructions
```

**Import instructions (in README.md):**
1. n8n → Settings → Import Workflow → upload JSON
2. Configure credentials by name (must match names in credential table above)
3. Set environment variables in n8n settings
4. Activate workflow (toggle on)

---

## Gotchas

- Webhook URLs change between n8n cloud instances — always reference via env vars `N8N_LEAD_INGESTION_WEBHOOK_URL`, etc.
- Supabase node requires `service_role` key in credentials, not `anon`
- Always set `responseMode: "responseNode"` + add a "Respond to Webhook" node immediately after webhook trigger for fast ACK
- Switch node: use `"mode": "rules"` not expression mode — easier to read and debug in UI
- `$json` in a Code node refers to the first input item; use `$input.all()` for multi-item processing
- Wait node in cloud n8n pauses execution and resumes — does not block a worker thread
- n8n expressions use `{{ }}` not `${ }` — template literals don't work inside expression fields
