"use client";

import { useState } from "react";
import type { LeadFormData } from "@/lib/types";
import ChatWidget from "@/components/ChatWidget";

const DENTAL_NEEDS_OPTIONS = [
  { value: "dental_implants", label: "Dental Implants" },
  { value: "veneers", label: "Veneers" },
  { value: "crowns", label: "Crowns" },
  { value: "all_on_4", label: "All-on-4 / Full Arch" },
  { value: "root_canal", label: "Root Canal" },
  { value: "whitening", label: "Teeth Whitening" },
  { value: "cosmetic", label: "Cosmetic Dentistry" },
  { value: "cleaning", label: "Cleaning & Check-up" },
  { value: "other", label: "Other" },
];

const PRICING_COMPARISON = [
  { procedure: "Dental Implant", us: "$4,500", cancun: "$900–1,500", savings: "70%" },
  { procedure: "Porcelain Crown", us: "$1,200", cancun: "$350–500", savings: "65%" },
  { procedure: "Veneers (per tooth)", us: "$1,500", cancun: "$350–500", savings: "67%" },
  { procedure: "All-on-4 Implants", us: "$25,000+", cancun: "$8,000–12,000", savings: "55%" },
  { procedure: "Root Canal", us: "$1,500", cancun: "$350–500", savings: "70%" },
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function LandingPage() {
  const [form, setForm] = useState<Partial<LeadFormData>>({
    dental_needs: [],
    consent_tcpa: false,
  });
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleDentalNeed(value: string) {
    const current = form.dental_needs ?? [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setForm({ ...form, dental_needs: updated });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent_tcpa) {
      setErrorMsg("You must agree to be contacted to proceed.");
      return;
    }

    setFormState("submitting");
    setErrorMsg("");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source: "landing_page" }),
    });

    if (res.ok) {
      setFormState("success");
    } else {
      const data = await res.json();
      setFormState("error");
      setErrorMsg(data.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦷</span>
            <span className="font-bold text-gray-900">Cancun Dental Partners</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#savings" className="hover:text-gray-900">Savings</a>
            <a href="#how-it-works" className="hover:text-gray-900">How It Works</a>
            <a href="#contact" className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700">
              Get Free Quote
            </a>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-teal-700 to-teal-900 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-teal-600 text-teal-100 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              Save 60–80% vs. US Prices
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              World-Class Dental Care.<br />
              <span className="text-teal-300">Cancun Prices.</span>
            </h1>
            <p className="text-teal-100 text-lg mb-8">
              Get the same procedures as top US clinics at a fraction of the cost.
              Our AI matches you with certified specialists in Cancun — plus full travel support.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              {["✓ US-trained dentists", "✓ International standards", "✓ Full travel concierge", "✓ Price guarantee"].map((item) => (
                <span key={item} className="text-teal-200">{item}</span>
              ))}
            </div>
          </div>

          {formState === "success" ? (
            <div className="bg-white text-gray-900 rounded-2xl p-8 shadow-xl text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">You're on the list!</h2>
              <p className="text-gray-600 mb-4">
                Our AI coordinator will call you within 5 minutes to answer your questions and help you get started.
              </p>
              <p className="text-sm text-gray-500">
                Average savings for patients like you: <span className="font-semibold text-teal-600">$4,200</span>
              </p>
            </div>
          ) : (
            <form
              id="contact"
              onSubmit={handleSubmit}
              className="bg-white text-gray-900 rounded-2xl p-8 shadow-xl"
            >
              <h2 className="text-xl font-bold mb-1">Get Your Free Savings Estimate</h2>
              <p className="text-gray-500 text-sm mb-6">No commitment. Response in under 5 minutes.</p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">First Name *</label>
                  <input
                    required
                    type="text"
                    value={form.first_name ?? ""}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Sarah"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Last Name *</label>
                  <input
                    required
                    type="text"
                    value={form.last_name ?? ""}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Johnson"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 block mb-1">Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="sarah@email.com"
                />
              </div>

              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 block mb-2">What procedures are you interested in?</label>
                <div className="flex flex-wrap gap-2">
                  {DENTAL_NEEDS_OPTIONS.map((opt) => {
                    const selected = form.dental_needs?.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleDentalNeed(opt.value)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          selected
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "border-gray-200 text-gray-600 hover:border-teal-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-700 block mb-1">When are you looking to get treatment?</label>
                <select
                  value={form.preferred_timeline ?? ""}
                  onChange={(e) => setForm({ ...form, preferred_timeline: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select timeline...</option>
                  <option value="asap">As soon as possible</option>
                  <option value="1-3 months">1–3 months</option>
                  <option value="3-6 months">3–6 months</option>
                  <option value="6+ months">6+ months</option>
                  <option value="not_sure">Not sure yet</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="flex items-start gap-2 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consent_tcpa ?? false}
                    onChange={(e) => setForm({ ...form, consent_tcpa: e.target.checked })}
                    className="mt-0.5 accent-teal-600"
                  />
                  <span>
                    I consent to receive calls and SMS from Cancun Dental Partners about dental procedures. I understand I can opt out at any time by replying STOP.
                  </span>
                </label>
              </div>

              {errorMsg && (
                <p className="text-red-500 text-xs mb-3">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={formState === "submitting"}
                className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formState === "submitting" ? "Sending..." : "Get My Free Estimate →"}
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                🔒 Your information is secure and never sold
              </p>
            </form>
          )}
        </div>
      </section>

      <section id="savings" className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">See How Much You Can Save</h2>
          <p className="text-center text-gray-500 mb-10">Average savings for US and Canadian patients</p>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
              <thead>
                <tr className="bg-teal-700 text-white text-sm">
                  <th className="py-3 px-4 text-left font-semibold">Procedure</th>
                  <th className="py-3 px-4 text-center font-semibold">US Price</th>
                  <th className="py-3 px-4 text-center font-semibold">Cancun Price</th>
                  <th className="py-3 px-4 text-center font-semibold">You Save</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_COMPARISON.map((row, i) => (
                  <tr key={row.procedure} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="py-3 px-4 font-medium text-gray-800">{row.procedure}</td>
                    <td className="py-3 px-4 text-center text-gray-500">{row.us}</td>
                    <td className="py-3 px-4 text-center text-teal-600 font-semibold">{row.cancun}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                        {row.savings}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Fill the form", desc: "Tell us your dental needs in 60 seconds" },
              { step: "2", title: "AI calls you", desc: "Our AI coordinator calls within 5 minutes to answer questions" },
              { step: "3", title: "Get matched", desc: "We match you with the best clinic for your needs & budget" },
              { step: "4", title: "Travel & save", desc: "Fly to Cancun, get world-class care, save thousands" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm">
        <p>© 2026 Cancun Dental Partners. All rights reserved.</p>
        <p className="mt-1">
          <a href="/dashboard" className="hover:text-white">Admin Dashboard</a>
        </p>
      </footer>
      <ChatWidget />
    </div>
  );
}
