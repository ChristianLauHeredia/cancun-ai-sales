"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Lead, LeadStatus } from "@/lib/types";

const STATUS_LABELS: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  consent_recorded: { label: "Consent", color: "bg-indigo-100 text-indigo-700" },
  call_scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-700" },
  call_in_progress: { label: "In Call", color: "bg-yellow-100 text-yellow-700" },
  qualified_hot: { label: "🔥 Hot", color: "bg-red-100 text-red-700" },
  qualified_warm: { label: "🌤 Warm", color: "bg-orange-100 text-orange-700" },
  qualified_cold: { label: "❄️ Cold", color: "bg-sky-100 text-sky-700" },
  no_answer: { label: "No Answer", color: "bg-gray-100 text-gray-600" },
  follow_up: { label: "Follow Up", color: "bg-violet-100 text-violet-700" },
  converted: { label: "✅ Converted", color: "bg-green-100 text-green-700" },
  lost: { label: "Lost", color: "bg-zinc-100 text-zinc-500" },
  opted_out: { label: "Opted Out", color: "bg-rose-100 text-rose-500" },
};

const PIPELINE_COLS: LeadStatus[][] = [
  ["new", "consent_recorded"],
  ["call_scheduled", "call_in_progress"],
  ["qualified_hot", "qualified_warm", "qualified_cold"],
  ["no_answer", "follow_up"],
  ["converted", "lost", "opted_out"],
];

const COL_LABELS = ["Incoming", "Calling", "Qualified", "Follow-up", "Closed"];

function scoreColor(score: number) {
  if (score >= 75) return "text-red-600";
  if (score >= 50) return "text-orange-500";
  if (score >= 25) return "text-yellow-500";
  return "text-gray-400";
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const secret = searchParams.get("secret");
  const dashboardSecret = process.env.NEXT_PUBLIC_DASHBOARD_SECRET;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchLeads = useCallback(() => {
    const url = statusFilter
      ? `/api/leads?status=${statusFilter}&limit=100`
      : "/api/leads?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setLeads(d.data);
          setLastRefresh(new Date());
        }
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  if (dashboardSecret && secret !== dashboardSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="font-bold text-gray-900 mb-1">Access Restricted</h2>
          <p className="text-sm text-gray-500">Append <code className="bg-gray-100 px-1 rounded">?secret=YOUR_SECRET</code> to the URL.</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: leads.length,
    hot: leads.filter((l) => l.status === "qualified_hot").length,
    converted: leads.filter((l) => l.status === "converted").length,
    avgScore: leads.length
      ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length)
      : 0,
  };

  function leadsByStatus(statuses: LeadStatus[]) {
    return leads.filter((l) => statuses.includes(l.status as LeadStatus));
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🦷</span>
          <div>
            <h1 className="font-bold text-gray-900">Sales Pipeline</h1>
            <p className="text-xs text-gray-500">Cancun Dental Partners</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchLeads}
            className="text-xs text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 rounded-lg px-2.5 py-1 transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setView("pipeline")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "pipeline" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "table" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Table
          </button>
        </div>
      </header>

      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, icon: "👥" },
          { label: "Hot Leads", value: stats.hot, icon: "🔥" },
          { label: "Converted", value: stats.converted, icon: "✅" },
          { label: "Avg Score", value: stats.avgScore, icon: "📊" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Loading leads...</div>
      ) : view === "pipeline" ? (
        <div className="px-6 pb-8">
          <div className="grid grid-cols-5 gap-3">
            {PIPELINE_COLS.map((statuses, colIdx) => (
              <div key={colIdx} className="min-w-0">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  {COL_LABELS[colIdx]}
                  <span className="ml-1 text-gray-400">({leadsByStatus(statuses).length})</span>
                </div>
                <div className="space-y-2">
                  {leadsByStatus(statuses).map((lead) => (
                    <LeadCard key={lead.id} lead={lead} dashboardSecret={secret ?? ""} onCallTriggered={fetchLeads} />
                  ))}
                  {leadsByStatus(statuses).length === 0 && (
                    <div className="text-center text-gray-300 text-xs py-6 border border-dashed border-gray-200 rounded-xl">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-6 pb-8">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-3 px-4 text-left font-medium">Name</th>
                  <th className="py-3 px-4 text-left font-medium">Phone</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Score</th>
                  <th className="py-3 px-4 text-left font-medium">Needs</th>
                  <th className="py-3 px-4 text-left font-medium">Source</th>
                  <th className="py-3 px-4 text-left font-medium">Created</th>
                  <th className="py-3 px-4 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{lead.phone}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[lead.status as LeadStatus]?.color}`}>
                        {STATUS_LABELS[lead.status as LeadStatus]?.label ?? lead.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-bold ${scoreColor(lead.score)}`}>
                      {lead.score}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {lead.dental_needs?.join(", ") ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{lead.source}</td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <TriggerCallButton
                        leadId={lead.id}
                        dashboardSecret={secret ?? ""}
                        onSuccess={fetchLeads}
                      />
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No leads found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TriggerCallButton({
  leadId,
  dashboardSecret,
  onSuccess,
}: {
  leadId: string;
  dashboardSecret: string;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function triggerCall() {
    setState("loading");
    try {
      const res = await fetch("/api/test/trigger-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-secret": dashboardSecret,
        },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (data.success) {
        setState("success");
        onSuccess();
        setTimeout(() => setState("idle"), 3000);
      } else {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const labels = {
    idle: "📞 Call",
    loading: "Dialing…",
    success: "✅ Called",
    error: "❌ Failed",
  };

  const colors = {
    idle: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200",
    loading: "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed",
    success: "bg-green-50 text-green-700 border-green-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <button
      onClick={triggerCall}
      disabled={state === "loading"}
      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${colors[state]}`}
    >
      {labels[state]}
    </button>
  );
}

function LeadCard({
  lead,
  dashboardSecret,
  onCallTriggered,
}: {
  lead: Lead;
  dashboardSecret: string;
  onCallTriggered: () => void;
}) {
  const statusMeta = STATUS_LABELS[lead.status as LeadStatus];
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm">
      <div className="font-semibold text-gray-900 truncate">
        {lead.first_name} {lead.last_name}
      </div>
      <div className="text-gray-400 text-xs truncate">{lead.phone}</div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta?.color ?? "bg-gray-100 text-gray-500"}`}>
          {statusMeta?.label ?? lead.status}
        </span>
        <span className={`text-xs font-bold ${scoreColor(lead.score)}`}>
          {lead.score}
        </span>
      </div>
      {lead.dental_needs && lead.dental_needs.length > 0 && (
        <div className="mt-1.5 text-xs text-gray-400 truncate">
          {lead.dental_needs[0]}{lead.dental_needs.length > 1 ? ` +${lead.dental_needs.length - 1}` : ""}
        </div>
      )}
      <div className="mt-2">
        <TriggerCallButton
          leadId={lead.id}
          dashboardSecret={dashboardSecret}
          onSuccess={onCallTriggered}
        />
      </div>
    </div>
  );
}
