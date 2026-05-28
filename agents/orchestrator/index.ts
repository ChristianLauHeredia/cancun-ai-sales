import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ORCHESTRATOR_SYSTEM = `You are the Lead Orchestration AI for Cancun Dental Partners. You analyze a lead's current state and decide the optimal next action.

Your process:
1. Call get_lead_info to understand where the lead is in the funnel
2. Based on what you find, decide the best next step (send_sms, trigger_call, or update_lead_status)
3. Execute that action using the available tools
4. Return a brief summary of what you did and why

TCPA rules (non-negotiable):
- Never contact a lead without consent_tcpa = true
- Respect do-not-call hours: 9am–9pm in the lead's local timezone
- No more than 3 call attempts per 48h window

Lead routing logic:
- qualified_hot → call trigger_call immediately, then SMS founder alert
- qualified_warm → send warm_followup SMS
- no_answer → send no_answer_retry SMS, schedule retry call
- qualified_cold → update status to follow_up only`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_lead_info",
    description: "Fetch lead details and call history from Supabase",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "update_lead_status",
    description: "Update the lead's status in Supabase",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        status: {
          type: "string",
          enum: [
            "new",
            "consent_recorded",
            "call_scheduled",
            "call_in_progress",
            "qualified_hot",
            "qualified_warm",
            "qualified_cold",
            "no_answer",
            "follow_up",
            "converted",
            "lost",
            "opted_out",
          ],
        },
      },
      required: ["lead_id", "status"],
    },
  },
  {
    name: "send_sms",
    description: "Send an SMS to the lead via the n8n SMS webhook",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        template: {
          type: "string",
          enum: ["warm_followup", "no_answer_retry", "founder_hot_alert"],
        },
      },
      required: ["lead_id", "template"],
    },
  },
  {
    name: "trigger_call",
    description: "Initiate a new Retell AI phone call for this lead",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "get_call_transcript",
    description: "Fetch the most recent call transcript for a lead",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
      },
      required: ["lead_id"],
    },
  },
];

const getLeadInfoSchema = z.object({ lead_id: z.string().uuid() });
const updateStatusSchema = z.object({
  lead_id: z.string().uuid(),
  status: z.string(),
});
const sendSmsSchema = z.object({
  lead_id: z.string().uuid(),
  template: z.enum(["warm_followup", "no_answer_retry", "founder_hot_alert"]),
});
const triggerCallSchema = z.object({ lead_id: z.string().uuid() });
const getTranscriptSchema = z.object({ lead_id: z.string().uuid() });

async function execTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "get_lead_info": {
      const { lead_id } = getLeadInfoSchema.parse(input);
      const [leadResult, callsResult] = await Promise.all([
        supabase.from("leads").select("*").eq("id", lead_id).single(),
        supabase
          .from("calls")
          .select("id, outcome, duration_seconds, started_at, summary, sentiment")
          .eq("lead_id", lead_id)
          .order("started_at", { ascending: false })
          .limit(5),
      ]);
      return { lead: leadResult.data, calls: callsResult.data ?? [] };
    }

    case "update_lead_status": {
      const { lead_id, status } = updateStatusSchema.parse(input);
      const { error } = await supabase
        .from("leads")
        .update({ status })
        .eq("id", lead_id);
      return { success: !error, error: error?.message };
    }

    case "send_sms": {
      const { lead_id, template } = sendSmsSchema.parse(input);
      const webhookUrl = process.env.N8N_SMS_WEBHOOK_URL;
      if (!webhookUrl) return { success: false, error: "N8N_SMS_WEBHOOK_URL not set" };
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id, template }),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    case "trigger_call": {
      const { lead_id } = triggerCallSchema.parse(input);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const secret = process.env.DASHBOARD_SECRET;
      if (!secret) return { success: false, error: "DASHBOARD_SECRET not set" };
      const res = await fetch(`${appUrl}/api/test/trigger-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-secret": secret,
        },
        body: JSON.stringify({ lead_id }),
      });
      return await res.json();
    }

    case "get_call_transcript": {
      const { lead_id } = getTranscriptSchema.parse(input);
      const { data } = await supabase
        .from("calls")
        .select("id, transcript, summary, outcome, started_at")
        .eq("lead_id", lead_id)
        .not("transcript", "is", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
      return data ?? { error: "No transcript found" };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export class CancunOrchestrator {
  async decideNextAction(leadId: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Analyze lead ${leadId} and take the optimal next action to move them through the sales funnel.`,
      },
    ];

    while (true) {
      const response = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        system: ORCHESTRATOR_SYSTEM,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock?.type === "text" ? textBlock.text : "Done.";
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          response.content
            .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
            .map(async (toolUse) => {
              const result = await execTool(toolUse.name, toolUse.input);
              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              };
            })
        );

        messages.push({ role: "user", content: toolResults });
      }
    }
  }
}

export default CancunOrchestrator;
