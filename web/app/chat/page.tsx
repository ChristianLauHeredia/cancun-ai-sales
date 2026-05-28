"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your Cancun Dental Partners coordinator. I help patients from the US and Canada save 60-80% on dental procedures with our certified clinics in Cancun.\n\nWhat kind of dental treatment are you looking into?",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.message) {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: data.data.message },
        ]);
      }
    } else {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Sorry, I had a technical issue. Please try again.",
        },
      ]);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <header className="bg-teal-700 text-white px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-500 rounded-full flex items-center justify-center text-lg">
          🦷
        </div>
        <div>
          <div className="font-semibold text-sm">Cancun Dental Coordinator</div>
          <div className="text-xs text-teal-200">● Online</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
                🦷
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-teal-600 text-white rounded-br-none"
                  : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
              🦷
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3 max-w-2xl mx-auto w-full">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about procedures, pricing, or travel..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-teal-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-2">
          By chatting, you agree to our{" "}
          <a href="/" className="underline">terms</a>. Reply STOP to opt out.
        </p>
      </div>
    </div>
  );
}
