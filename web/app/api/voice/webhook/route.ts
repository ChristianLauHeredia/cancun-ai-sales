import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface RetellCall {
  call_id: string;
  agent_id: string;
  call_status: string;
  metadata?: { lead_id?: string };
  transcript?: Array<{ role: string; content: string }>;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    custom_analysis_data?: {
      qualification_outcome?: string;
      dental_needs?: string[];
      timeline?: string;
      budget?: string;
      ready_to_transfer?: boolean;
    };
  };
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  recording_url?: string;
}

interface RetellWebhookEvent {
  event: "call_started" | "call_ended" | "call_analyzed";
  call: RetellCall;
}

const LEAD_STATUS_MAP: Record<string, string> = {
  qualified_hot: "qualified_hot",
  qualified_warm: "qualified_warm",
  qualified_cold: "qualified_cold",
  no_answer: "no_answer",
  live_transferred: "converted",
};

const CALL_OUTCOME_MAP: Record<string, string> = {
  qualified_hot: "answered_qualified",
  qualified_warm: "answered_qualified",
  qualified_cold: "answered_not_qualified",
  no_answer: "no_answer",
  voicemail: "voicemail",
  live_transferred: "live_transferred",
};

function verifySignature(rawBody: string, signature: string): boolean {
  if (!process.env.RETELL_API_KEY) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RETELL_API_KEY)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

async function notifyN8n(url: string, payload: unknown): Promise<void> {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // n8n notification is best-effort — don't fail the webhook
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature") ?? "";

  if (process.env.RETELL_VERIFY_SIGNATURE === "true" && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Respond 200 immediately — Retell does not retry on failure
  const event: RetellWebhookEvent = JSON.parse(rawBody);
  const { call } = event;
  const leadId = call.metadata?.lead_id;

  if (!leadId) {
    return NextResponse.json({ received: true });
  }

  if (event.event === "call_started") {
    await supabaseAdmin
      .from("leads")
      .update({ status: "call_in_progress" })
      .eq("id", leadId);
  }

  if (event.event === "call_ended") {
    // Only update duration here — transcript/analysis not available yet
    await supabaseAdmin.from("calls").upsert(
      {
        lead_id: leadId,
        retell_call_id: call.call_id,
        agent_id: call.agent_id,
        direction: "outbound",
        status: "completed",
        duration_seconds: call.duration_ms
          ? Math.floor(call.duration_ms / 1000)
          : null,
        recording_url: call.recording_url ?? null,
        started_at: call.start_timestamp
          ? new Date(call.start_timestamp).toISOString()
          : null,
        ended_at: call.end_timestamp
          ? new Date(call.end_timestamp).toISOString()
          : null,
      },
      { onConflict: "retell_call_id" }
    );
  }

  if (event.event === "call_analyzed") {
    // Transcript and outcome are only guaranteed here
    const analysis = call.call_analysis;
    const customData = analysis?.custom_analysis_data;
    const qualificationOutcome =
      customData?.qualification_outcome ?? "no_answer";

    await supabaseAdmin.from("calls").upsert(
      {
        lead_id: leadId,
        retell_call_id: call.call_id,
        agent_id: call.agent_id,
        direction: "outbound",
        status: "completed",
        outcome: CALL_OUTCOME_MAP[qualificationOutcome] ?? "no_answer",
        duration_seconds: call.duration_ms
          ? Math.floor(call.duration_ms / 1000)
          : null,
        transcript: call.transcript ?? null,
        summary: analysis?.call_summary ?? null,
        sentiment: analysis?.user_sentiment ?? null,
        qualification_data: customData ?? null,
        recording_url: call.recording_url ?? null,
        started_at: call.start_timestamp
          ? new Date(call.start_timestamp).toISOString()
          : null,
        ended_at: call.end_timestamp
          ? new Date(call.end_timestamp).toISOString()
          : null,
      },
      { onConflict: "retell_call_id" }
    );

    const newLeadStatus =
      LEAD_STATUS_MAP[qualificationOutcome] ?? "no_answer";

    await supabaseAdmin
      .from("leads")
      .update({ status: newLeadStatus })
      .eq("id", leadId);

    await supabaseAdmin.from("agent_decisions").insert({
      lead_id: leadId,
      agent_type: "voice_qualifier",
      decision: qualificationOutcome,
      reasoning: analysis?.call_summary ?? "Call completed",
      confidence: qualificationOutcome === "qualified_hot" ? 0.9 : 0.7,
      output_data: customData ?? {},
      model_used: "retell-ai",
    });

    // Notify n8n to trigger post-call routing workflow
    await notifyN8n(process.env.N8N_POSTCALL_WEBHOOK_URL ?? "", {
      lead_id: leadId,
      call_id: call.call_id,
      outcome: qualificationOutcome,
      dental_needs: customData?.dental_needs,
      timeline: customData?.timeline,
      budget: customData?.budget,
    });
  }

  return NextResponse.json({ received: true });
}
