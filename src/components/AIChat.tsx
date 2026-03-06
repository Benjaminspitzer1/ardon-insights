"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  context: string;
  systemPrompt: string;
  onClose: () => void;
}

export default function AIChat({ systemPrompt, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, message: text, history: messages }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.content }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-2xl border w-full max-w-md"
        style={{ background: "var(--surface)", borderColor: "var(--border)", height: "560px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm">AI Assistant</span>
          </div>
          <button onClick={onClose} className="hover:opacity-70 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm mt-8" style={{ color: "var(--muted)" }}>
              Ask anything to get started.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "white" }
                    : { background: "var(--surface-2)", color: "var(--foreground)" }
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg px-4 py-2 text-sm outline-none border"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--foreground)" }}
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              autoFocus
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg transition-all disabled:opacity-40"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
