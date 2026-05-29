import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse } from "@/lib/types";

const triggerCallSchema = z.object({
  lead_id: z.string().uuid(),
});

interface RetellCallResponse {
  call_id: string;
  status: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ call_id: string }>>> {
  const dashboardSecret = process.env.DASHBOARD_SECRET;
  const headerSecret = req.headers.get("x-dashboard-secret");
  const cookieSecret = req.cookies.get("dashboard_auth")?.value;
  const isAuthorized =
    !dashboardSecret ||
    headerSecret === dashboardSecret ||
    cookieSecret === dashboardSecret;

  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = triggerCallSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "lead_id is required" },
      { status: 400 }
    );
  }

  const { lead_id } = parsed.data;

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("id, first_name, last_name, phone, dental_needs, city")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { success: false, error: "Lead not found" },
      { status: 404 }
    );
  }

  const retellApiKey = process.env.RETELL_API_KEY;
  const retellAgentId = process.env.RETELL_AGENT_ID;
  const fromNumber = process.env.RETELL_FROM_NUMBER;

  if (!retellApiKey || !retellAgentId || !fromNumber) {
    return NextResponse.json(
      { success: false, error: "Retell not configured" },
      { status: 503 }
    );
  }

  const retellRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${retellApiKey}`,
    },
    body: JSON.stringify({
      from_number: fromNumber,
      to_number: lead.phone,
      agent_id: retellAgentId,
      metadata: { lead_id: lead.id },
      retell_llm_dynamic_variables: {
        lead_name: lead.first_name,
        dental_need: lead.dental_needs?.[0] ?? "dental care",
        lead_city: lead.city ?? "",
      },
    }),
  });

  if (!retellRes.ok) {
    const errText = await retellRes.text();
    return NextResponse.json(
      { success: false, error: `Retell API error: ${errText}` },
      { status: 502 }
    );
  }

  const retellData = (await retellRes.json()) as RetellCallResponse;

  await supabaseAdmin
    .from("leads")
    .update({ status: "call_scheduled" })
    .eq("id", lead_id);

  await supabaseAdmin.from("calls").insert({
    lead_id,
    retell_call_id: retellData.call_id,
    agent_id: retellAgentId,
    direction: "outbound",
    status: "registered",
  });

  return NextResponse.json({ success: true, data: { call_id: retellData.call_id } });
}
