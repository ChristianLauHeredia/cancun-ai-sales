export type LeadStatus =
  | "new"
  | "consent_recorded"
  | "call_scheduled"
  | "call_in_progress"
  | "qualified_hot"
  | "qualified_warm"
  | "qualified_cold"
  | "no_answer"
  | "follow_up"
  | "converted"
  | "lost"
  | "opted_out";

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  country: string;
  state: string | null;
  city: string | null;
  source: string;
  status: LeadStatus;
  score: number;
  dental_needs: string[] | null;
  preferred_timeline: string | null;
  estimated_budget: string | null;
  notes: string | null;
  tags: string[] | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  assigned_to: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  lead_id: string;
  retell_call_id: string | null;
  agent_id: string;
  direction: string;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  transcript: Record<string, unknown> | null;
  summary: string | null;
  sentiment: string | null;
  qualification_data: Record<string, unknown> | null;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  channel: "voice" | "sms" | "email" | "chat" | "manual";
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface LeadFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dental_needs: string[];
  preferred_timeline: string;
  estimated_budget: string;
  consent_tcpa: boolean;
  trusted_form_cert_url?: string;
}
