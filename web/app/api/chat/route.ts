import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ApiResponse, ChatMessage } from "@/lib/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a friendly patient coordinator for Cancun Dental Partners. Your role is to help patients from the US and Canada learn about dental tourism in Cancun and get connected with our partner clinics.

Key facts to share:
- Patients save 60-80% compared to US/Canada prices
- Our partner clinics are staffed by US/Canadian-trained dentists
- All clinics meet international standards with modern equipment
- We offer full travel concierge support

Common procedures with Cancun savings:
- Dental implants: $4,500 US → $900-1,500 Cancun (save 65-80%)
- Porcelain veneers: $1,500/tooth US → $350-500/tooth Cancun (save 65-75%)
- All-on-4 implants: $25,000+ US → $8,000-12,000 Cancun (save 50-65%)
- Dental crown: $1,200 US → $350-500 Cancun (save 58-70%)
- Root canal: $1,500 US → $350-500 Cancun (save 65-75%)

Your goals (in order):
1. Answer their dental questions clearly and helpfully
2. Address any concerns about safety, quality, or travel logistics
3. Learn about their dental needs, budget range, and timeline
4. Collect their name, email, and phone number when they show interest
5. Offer to schedule a free consultation call

Be warm, conversational, and never pushy. If they want to stop: respect it immediately. Always be honest about what you know and don't know. Never give specific medical diagnoses.`;

const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "capture_lead",
    description:
      "Save the patient's contact information when they express interest in learning more or scheduling a consultation.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        dental_needs: { type: "array", items: { type: "string" } },
        preferred_timeline: { type: "string" },
        estimated_budget: { type: "string" },
      },
      required: ["first_name", "phone"],
    },
  },
];

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  visitor_id: z.string().optional(),
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ message: string; lead_captured?: boolean }>>> {
  const body = await req.json();
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const { messages } = parsed.data;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: CHAT_TOOLS,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  let leadCaptured = false;
  let replyText = "";

  for (const block of response.content) {
    if (block.type === "text") {
      replyText = block.text;
    }

    if (block.type === "tool_use" && block.name === "capture_lead") {
      const input = block.input as Record<string, unknown>;

      const leadPayload = {
        first_name: input.first_name as string,
        last_name: (input.last_name as string) ?? "",
        email: input.email as string | undefined,
        phone: input.phone as string,
        dental_needs: input.dental_needs as string[] | undefined,
        preferred_timeline: input.preferred_timeline as string | undefined,
        estimated_budget: input.estimated_budget as string | undefined,
        source: "chat",
        consent_tcpa: true,
      };

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await fetch(`${appUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });

      leadCaptured = true;
    }
  }

  if (!replyText && response.stop_reason === "tool_use") {
    replyText =
      "Thanks! I've saved your information. One of our patient coordinators will reach out shortly. Is there anything else you'd like to know?";
  }

  return NextResponse.json({
    success: true,
    data: { message: replyText, lead_captured: leadCaptured },
  });
}
