"use client";

import { useState } from "react";
import { FileSearch, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AIChat from "@/components/AIChat";

export default function UnderwritingPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateMemo() {
    if (!company.trim()) return;
    setLoading(true);
    setMemo("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: "You are a senior investment analyst. Generate a concise investment memo with: Executive Summary, Business Overview, Market Opportunity, Financial Highlights, Key Risks, and Investment Thesis. Use markdown formatting.",
          message: `Generate an investment memo for: ${company}`,
        }),
      });
      const data = await res.json();
      setMemo(data.content);
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
            <FileSearch className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">Underwriting</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Investment Memo Generator</h1>
          <button
            onClick={() => setChatOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "white" }}
          >
            AI Assistant
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="font-semibold mb-4">Company / Deal Details</h2>
            <textarea
              className="w-full rounded-lg p-3 text-sm resize-none outline-none focus:ring-1 mb-4"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                minHeight: "120px",
              }}
              placeholder="Enter company name, sector, stage, and any known financials..."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <button
              onClick={generateMemo}
              disabled={loading || !company.trim()}
              className="w-full py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {loading ? "Generating..." : "Generate Memo"}
            </button>
          </div>

          <div className="rounded-xl border p-6 overflow-auto" style={{ borderColor: "var(--border)", background: "var(--surface)", minHeight: "300px" }}>
            {memo ? (
              <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "var(--font-geist-mono)" }}>
                {memo}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--muted)" }}>
                Memo output will appear here
              </div>
            )}
          </div>
        </div>
      </main>

      {chatOpen && (
        <AIChat
          context="investment underwriting and financial analysis"
          systemPrompt="You are a senior investment analyst specializing in underwriting. Help with financial modeling, risk assessment, valuation frameworks, due diligence questions, and investment thesis development."
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
