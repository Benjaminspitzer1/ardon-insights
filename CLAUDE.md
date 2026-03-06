# Ardon Insights — Claude Code Instructions

## Project
AI-first investment front office portal covering deal flow, underwriting, and market research.

## Stack
- Next.js 15 (App Router, src/ layout)
- TypeScript
- Tailwind CSS v4
- Anthropic SDK (`claude-sonnet-4-6`) via `src/lib/claude.ts`
- lucide-react for icons

## Key Paths
- `src/app/page.tsx` — Dashboard / home
- `src/app/(portal)/deal-flow/` — Deal pipeline
- `src/app/(portal)/underwriting/` — Memo generation
- `src/app/(portal)/market-research/` — Market intelligence
- `src/app/api/ai/route.ts` — Shared AI POST endpoint
- `src/components/AIChat.tsx` — Reusable AI chat panel
- `src/lib/claude.ts` — Anthropic client singleton
- `.env.local` — ANTHROPIC_API_KEY (never commit)

## Dev
```
npm run dev   # http://localhost:3000
```

## Conventions
- AI calls go through `/api/ai` route (server-side, keeps key safe)
- Use `cn()` from `src/lib/utils.ts` for conditional classes
- CSS custom properties for theming (defined in globals.css)
- No ORM yet — add when persistence is needed
