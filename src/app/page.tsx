import Link from "next/link";
import { TrendingUp, FileSearch, BarChart3, Zap, ArrowRight } from "lucide-react";

const modules = [
  {
    href: "/deal-flow",
    icon: TrendingUp,
    title: "Deal Flow",
    description: "Track and evaluate investment opportunities through AI-assisted pipeline management.",
    color: "text-blue-400",
    border: "border-blue-500/20 hover:border-blue-500/50",
  },
  {
    href: "/underwriting",
    icon: FileSearch,
    title: "Underwriting",
    description: "AI-powered financial analysis, risk scoring, and memo generation.",
    color: "text-emerald-400",
    border: "border-emerald-500/20 hover:border-emerald-500/50",
  },
  {
    href: "/market-research",
    icon: BarChart3,
    title: "Market Research",
    description: "Real-time sector intelligence, competitor analysis, and trend synthesis.",
    color: "text-violet-400",
    border: "border-violet-500/20 hover:border-violet-500/50",
  },
];

const stats = [
  { label: "Active Deals", value: "0" },
  { label: "Pipeline Value", value: "$0" },
  { label: "Memos Generated", value: "0" },
  { label: "Markets Tracked", value: "0" },
];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Ardon Insights</span>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--accent-muted)", color: "#93c5fd" }}>
            AI-First
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Investment Front Office
          </h1>
          <p className="text-lg" style={{ color: "var(--muted)" }}>
            AI-powered deal management, underwriting, and market intelligence — all in one place.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-2xl font-bold mb-1">{s.value}</div>
              <div className="text-sm" style={{ color: "var(--muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Modules */}
        <div className="grid md:grid-cols-3 gap-6">
          {modules.map(({ href, icon: Icon, title, description, color, border }) => (
            <Link
              key={href}
              href={href}
              className={`group rounded-xl p-6 border transition-all duration-200 ${border}`}
              style={{ background: "var(--surface)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <Icon className={`w-6 h-6 ${color}`} />
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted)" }} />
              </div>
              <h2 className="text-lg font-semibold mb-2">{title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
