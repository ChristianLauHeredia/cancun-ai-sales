import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse, Lead } from "@/lib/types";

const createLeadSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20),
  country: z.string().default("US"),
  state: z.string().optional(),
  city: z.string().optional(),
  dental_needs: z.array(z.string()).optional(),
  preferred_timeline: z.string().optional(),
  estimated_budget: z.string().optional(),
  source: z.string().default("landing_page"),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  consent_tcpa: z.boolean(),
  trusted_form_cert_url: z.string().url().optional(),
  ip_address: z.string().optional(),
});

function normalizePhone(phone: string, country: string): string {
  const stripped = phone.replace(/[^\d+]/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (stripped.length >= 11) return "+" + stripped;
  if (stripped.length === 10 && (country === "US" || country === "CA")) return "+1" + stripped;
  if (stripped.length === 10 && country === "MX") return "+52" + stripped;
  return "+" + stripped;
}

async function notifyN8n(url: string, payload: unknown): Promise<void> {
  if (!url) {
    console.error("[notifyN8n] N8N_LEAD_WEBHOOK_URL is not set");
    return;
  }
  try {
    console.log("[notifyN8n] calling", url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[notifyN8n] response", res.status);
  } catch (err) {
    console.error("[notifyN8n] error", err);
  }
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Lead>>> {
  const body = await req.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { consent_tcpa, trusted_form_cert_url, ip_address, ...leadData } =
    parsed.data;

  leadData.phone = normalizePhone(leadData.phone, leadData.country);

  if (!consent_tcpa) {
    return NextResponse.json(
      { success: false, error: "TCPA consent is required" },
      { status: 400 }
    );
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({ ...leadData, status: "new" })
    .select()
    .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { success: false, error: "Failed to create lead" },
      { status: 500 }
    );
  }

  const resolvedIp =
    ip_address ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

  await supabaseAdmin.from("consent_logs").insert([
    {
      lead_id: lead.id,
      consent_type: "tcpa_call",
      ip_address: resolvedIp,
      consent_text:
        "I consent to receive calls, including automated calls, from Cancun Dental Partners at the phone number provided.",
      trusted_form_cert_url: trusted_form_cert_url ?? null,
    },
    {
      lead_id: lead.id,
      consent_type: "tcpa_sms",
      ip_address: resolvedIp,
      consent_text:
        "I consent to receive SMS messages from Cancun Dental Partners. Reply STOP to opt out.",
    },
  ]);

  // Trigger n8n lead ingestion workflow — kicks off the AI voice call
  notifyN8n(process.env.N8N_LEAD_WEBHOOK_URL ?? "", {
    lead_id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    phone: lead.phone,
    email: lead.email,
    dental_needs: lead.dental_needs,
    preferred_timeline: lead.preferred_timeline,
    estimated_budget: lead.estimated_budget,
    source: lead.source,
  });

  return NextResponse.json({ success: true, data: lead }, { status: 201 });
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Lead[]>>> {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25"), 100);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch leads" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    meta: { total: count ?? 0, page, limit },
  });
}
