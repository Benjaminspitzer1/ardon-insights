import { NextRequest, NextResponse } from "next/server";
import { claude, MODEL } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { systemPrompt, message, history = [] } = await req.json();

  const messages = [
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ content });
}
