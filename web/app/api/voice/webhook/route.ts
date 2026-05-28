import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface RetellCallEvent {
  event: string;
  call: {
    call_id: string;
    agent_id: string;
    call_status: string;
    call_type: string;
    metadata?: {
      lead_id?: string;
    };
    transcript?: string;
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
  };
}

const OUTCOME_MAP: Record<string, string> = {
  qualified_hot: "answered_qualified",
  qualified_warm: "answered_qualified",
  qualified_cold: "answered_not_qualified",
  voicemail: "voicemail",
  no_answer: "no_answer",
  live_transferred: "live_transferred",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-retell-signature");
  if (secret !== process.env.RETELL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event: RetellCallEvent = await req.json();
  const { call } = event;
  const leadId = call.metadata?.lead_id;

  if (!leadId) {
    return NextResponse.json({ received: true });
  }

  if (event.event === "call_ended") {
    const analysis = call.call_analysis;
    const customData = analysis?.custom_analysis_data;
    const qualificationOutcome = customData?.qualification_outcome ?? "no_answer";
    const outcome = OUTCOME_MAP[qualificationOutcome] ?? "no_answer";

    await supabaseAdmin.from("calls").insert({
      lead_id: leadId,
      retell_call_id: call.call_id,
      agent_id: call.agent_id,
      direction: "outbound",
      status: "completed",
      outcome,
      duration_seconds: call.duration_ms ? Math.floor(call.duration_ms / 1000) : null,
      transcript: call.transcript ? { text: call.transcript } : null,
      summary: analysis?.call_summary ?? null,
      sentiment: analysis?.user_sentiment ?? null,
      qualification_data: customData ?? null,
      recording_url: call.recording_url ?? null,
      started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
      ended_at: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null,
    });

    const newStatus =
      qualificationOutcome === "qualified_hot"
        ? "qualified_hot"
        : qualificationOutcome === "qualified_warm"
        ? "qualified_warm"
        : qualificationOutcome === "live_transferred"
        ? "converted"
        : "no_answer";

    await supabaseAdmin
      .from("leads")
      .update({ status: newStatus })
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
  }

  return NextResponse.json({ received: true });
}
