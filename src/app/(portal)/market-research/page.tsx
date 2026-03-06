"use client";

import { useState } from "react";
import { BarChart3, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import AIChat from "@/components/AIChat";

export default function MarketResearchPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function runResearch() {
    if (!query.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: "You are an expert market research analyst. Provide structured market intelligence including: Market Size & Growth, Key Players, Trends & Tailwinds, Headwinds & Risks, and Investment Implications. Use markdown formatting with clear sections.",
          message: query,
        }),
      });
      const data = await res.json();
      setResult(data.content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--muted)" }}>
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <span className="font-semibold">Market Research</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <button
            onClick={() => setChatOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "white" }}
          >
            AI Assistant
          </button>
        </div>

        <div className="rounded-xl border p-6 mb-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-3 rounded-lg px-4 py-2 border" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted)" }} />
              <input
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="e.g. AI infrastructure market in 2025, climate tech deal flow, SaaS multiples..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runResearch()}
              />
            </div>
            <button
              onClick={runResearch}
              disabled={loading || !query.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {loading ? "Researching..." : "Research"}
            </button>
          </div>
        </div>

        {result && (
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "var(--font-geist-sans)" }}>
              {result}
            </pre>
          </div>
        )}

        {!result && !loading && (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30 text-violet-400" />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Ask about any market, sector, or investment theme
            </p>
          </div>
        )}
      </main>

      {chatOpen && (
        <AIChat
          context="market research and sector analysis"
          systemPrompt="You are an expert market research analyst with deep knowledge across tech, healthcare, fintech, and other sectors. Help with market sizing, competitor analysis, trend identification, and investment thesis development."
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
