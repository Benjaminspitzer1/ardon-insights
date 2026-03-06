"use client";

import { useState } from "react";
import { TrendingUp, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AIChat from "@/components/AIChat";

const deals = [
  { name: "Project Alpha", stage: "Initial Review", sector: "Tech", amount: "$12M", status: "active" },
  { name: "Project Beta", stage: "Due Diligence", sector: "Healthcare", amount: "$8M", status: "active" },
  { name: "Project Gamma", stage: "Term Sheet", sector: "Fintech", amount: "$25M", status: "hot" },
];

const stageColors: Record<string, string> = {
  "Initial Review": "text-blue-400 bg-blue-400/10",
  "Due Diligence": "text-yellow-400 bg-yellow-400/10",
  "Term Sheet": "text-emerald-400 bg-emerald-400/10",
};

export default function DealFlowPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--muted)" }}>
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="font-semibold">Deal Flow</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setChatOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "white" }}
            >
              AI Assistant
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80" style={{ borderColor: "var(--border)" }}>
              <Plus className="w-4 h-4" /> Add Deal
            </button>
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                {["Deal", "Stage", "Sector", "Amount", ""].map((h) => (
                  <th key={h} className="px-6 py-4 font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.name} className="border-b last:border-0 hover:opacity-80 transition-opacity cursor-pointer" style={{ borderColor: "var(--border)" }}>
                  <td className="px-6 py-4 font-medium">{deal.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageColors[deal.stage]}`}>
                      {deal.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4" style={{ color: "var(--muted)" }}>{deal.sector}</td>
                  <td className="px-6 py-4 font-mono">{deal.amount}</td>
                  <td className="px-6 py-4">
                    {deal.status === "hot" && (
                      <span className="text-xs text-orange-400 font-medium">HOT</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {chatOpen && (
        <AIChat
          context="deal flow pipeline management"
          systemPrompt="You are an expert investment analyst helping with deal flow management. Help evaluate deals, suggest pipeline stages, identify risks, and provide investment thesis frameworks."
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
