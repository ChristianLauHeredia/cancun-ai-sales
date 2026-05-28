# Claude Tool Use Skill

## Basic Tool Use Pattern (non-streaming)

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const tools: Anthropic.Tool[] = [
  {
    name: 'get_lead_info',
    description: 'Fetch lead and call history from database',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: 'UUID of the lead' }
      },
      required: ['lead_id']
    }
  }
]

async function runWithTools(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ]

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      return textBlock?.text ?? ''
    }

    if (response.stop_reason === 'tool_use') {
      // Add assistant turn
      messages.push({ role: 'assistant', content: response.content })

      // Execute all tool calls (may be multiple in one response)
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map(async (toolUse) => {
            const result = await executeTool(toolUse.name, toolUse.input)
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            }
          })
      )

      // Add tool results turn
      messages.push({ role: 'user', content: toolResults })
    }
  }
}

async function executeTool(name: string, input: unknown): Promise<unknown> {
  const parsed = toolInputSchema.parse(input) // always validate with Zod
  switch (name) {
    case 'get_lead_info': return getLeadInfo(parsed.lead_id)
    default: throw new Error(`Unknown tool: ${name}`)
  }
}
```

---

## Streaming Tool Use in Next.js Route Handler

```typescript
// app/api/chat/route.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { messages } = await req.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages
      })

      for await (const event of anthropicStream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        if (event.type === 'message_stop') {
          const finalMessage = await anthropicStream.getFinalMessage()

          if (finalMessage.stop_reason === 'tool_use') {
            // Execute tools and continue stream
            const toolResults = await executeToolsFromMessage(finalMessage)
            // Recursive: continue conversation with tool results
            // In practice, use a loop rather than recursion for safety
          }
        }
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
```

---

## The Orchestrator Pattern (our use case)

```typescript
// agents/orchestrator/index.ts
const ORCHESTRATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_lead_info',
    description: 'Fetch lead details and full call/message history from Supabase',
    input_schema: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'] }
  },
  {
    name: 'update_lead_status',
    description: 'Update lead status in Supabase',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        status: { type: 'string', enum: ['new', 'called', 'hot', 'warm', 'cold', 'converted'] }
      },
      required: ['lead_id', 'status']
    }
  },
  {
    name: 'send_sms',
    description: 'Send SMS to lead via Twilio through n8n webhook',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        template: { type: 'string', enum: ['warm_followup', 'no_answer_retry', 'founder_hot_alert'] }
      },
      required: ['lead_id', 'template']
    }
  },
  {
    name: 'trigger_call',
    description: 'Create a new Retell AI phone call for the lead',
    input_schema: {
      type: 'object',
      properties: { lead_id: { type: 'string' } },
      required: ['lead_id']
    }
  },
  {
    name: 'get_call_transcript',
    description: 'Fetch call transcript from calls table in Supabase',
    input_schema: {
      type: 'object',
      properties: { call_id: { type: 'string' } },
      required: ['call_id']
    }
  }
]

// Claude analyzes lead state → returns recommended action via tool call
// We execute it → loop until stop_reason is "end_turn" (text response = decision made)
```

---

## System Prompt Pattern for Dental Tourism Chat

```typescript
const SOFIA_SYSTEM_PROMPT = `You are Sofia, a bilingual (English/Spanish) dental tourism specialist for Cancun Dental Care. Your goal is to qualify leads and capture their contact information.

You need to collect: name, email, phone number, and dental need (e.g., implants, veneers, cleaning, whitening).

Call the create_lead tool ONLY when you have collected all three contact fields (name, email, phone). Do not call it before then.

Tone: warm, professional, genuinely helpful. Not pushy or salesy. Keep responses concise — this is a chat, not an essay. Use Spanish if the user writes in Spanish.

If asked about pricing, give approximate ranges but emphasize that exact quotes require a free consultation.`
```

---

## Tool Definition Helper (Zod → Anthropic)

```typescript
import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'

function zodToAnthropicTool<T extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  schema: T
): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: zodToJsonSchema(schema) as Anthropic.Tool['input_schema']
  }
}

// Then validate tool input before executing:
function safeExecuteTool<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input) // throws ZodError on invalid input
}
```

---

## Gotchas

- `max_tokens` must be at least 1024 for tool use — Claude needs tokens to reason about which tool to call
- **Always validate tool input with Zod** before executing — Claude can hallucinate field names or types
- `tool_result` content must be a `string` — use `JSON.stringify(result)` for objects
- Claude may call **multiple tools in one response** — `response.content` is an array, filter for `type === 'tool_use'` and handle all of them
- `stop_reason === 'tool_use'` → loop continues; `stop_reason === 'end_turn'` → done, extract text
- Do not use `tool_choice: { type: 'any' }` in production — it forces a tool call and may loop unexpectedly
- Prompt caching: add `cache_control: { type: 'ephemeral' }` to system prompt and large tool definitions to cut costs on repeated calls
