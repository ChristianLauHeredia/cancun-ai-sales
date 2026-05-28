import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function parseTwilioBody(text: string): Record<string, string> {
  return Object.fromEntries(
    text.split("&").map((pair) => {
      const [key, value] = pair.split("=");
      return [decodeURIComponent(key), decodeURIComponent(value ?? "")];
    })
  );
}

const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "cancel", "quit", "end"]);
const OPT_IN_KEYWORDS = new Set(["yes", "start", "unstop"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const text = await req.text();
  const params = parseTwilioBody(text);

  const fromNumber = params["From"];
  const body = (params["Body"] ?? "").trim().toLowerCase();
  const messageSid = params["MessageSid"];

  if (!fromNumber) {
    return new NextResponse("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, status")
    .eq("phone", fromNumber)
    .limit(1);

  const lead = leads?.[0];

  await supabaseAdmin.from("messages").insert({
    lead_id: lead?.id ?? null,
    channel: "sms",
    direction: "inbound",
    from_number: fromNumber,
    body: params["Body"] ?? "",
    external_id: messageSid,
    status: "read",
    sent_at: new Date().toISOString(),
  });

  if (OPT_OUT_KEYWORDS.has(body) && lead) {
    await supabaseAdmin
      .from("leads")
      .update({ status: "opted_out" })
      .eq("id", lead.id);

    await supabaseAdmin.from("consent_logs").insert({
      lead_id: lead.id,
      consent_type: "tcpa_sms",
      granted: false,
      consent_text: "Opted out via SMS STOP command",
      revoked_at: new Date().toISOString(),
    });
  }

  if (OPT_IN_KEYWORDS.has(body) && lead && lead.status === "no_answer") {
    await supabaseAdmin
      .from("leads")
      .update({ status: "follow_up" })
      .eq("id", lead.id);
  }

  return new NextResponse("<Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
