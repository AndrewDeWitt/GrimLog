# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grimlog is an AI-powered tactical logger for Warhammer 40K tabletop games. It features voice-activated phase tracking, per-model wound tracking, damage calculation (MathHammer), character attachments, official datasheet integration, rules validation, and multi-provider AI support (OpenAI GPT + Google Gemini).

## Build & Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint

# Generate Prisma client (runs automatically on postinstall)
npx prisma generate

# Push schema changes to database
npx prisma db push

# Seed unit templates
npm run seed
# or: tsx prisma/seed-unit-templates.ts

# Type check without emit
npx tsc --noEmit
```

## Architecture

### Dual-Endpoint AI Design
- **`/api/transcribe`** - Fast transcription-only endpoint called every ~5 seconds for VAD
- **`/api/analyze`** - Context-aware AI analysis with tool calling, triggered by smart conditions

### Smart Analysis Triggers (5 triggers)
1. Priority keywords (immediate)
2. Completion phrases (immediate)
3. Long silence (10s)
4. Min transcripts (3+ transcripts + 8s)
5. Max time safety (30s)

### Multi-Layer Validation
1. Client audio analysis (RMS, dB, peak amplitude)
2. Server file check (size validation)
3. Transcription validation (quality, hallucinations)
4. Validation is advisory, never blocking - user always has final authority

### AI Provider System
- Configured via `AI_PROVIDER` env var (`openai` or `google`)
- OpenAI: GPT-5-mini (analysis) + GPT-5-nano (intent)
- Google: Gemini 2.5 Flash (both analysis and intent)
- All 25+ AI tools work with both providers
- Tool definitions: `lib/aiTools.ts` (OpenAI) and `lib/aiToolsGemini.ts` (Gemini)
- Tool execution: `lib/toolHandlers.ts`

### Key Libraries
| File | Purpose |
|------|---------|
| `lib/aiTools.ts` | AI tool definitions for OpenAI |
| `lib/aiToolsGemini.ts` | AI tool definitions for Gemini |
| `lib/toolHandlers.ts` | Tool execution logic |
| `lib/audioCapture.ts` | VAD and audio recording |
| `lib/audioValidation.ts` | Multi-layer audio validation |
| `lib/analysisTriggers.ts` | Smart trigger detection |
| `lib/validationHelpers.ts` | Game state validation |
| `lib/langfuse.ts` | LLM observability |
| `lib/damageCalculation.ts` | MathHammer combat stats |
| `lib/contextBuilder.ts` | AI context assembly |
| `lib/prisma.ts` | Database client singleton |

### API Route Organization
- `/api/analyze/` - AI analysis with tool calling
- `/api/transcribe/` - Fast transcription only
- `/api/sessions/[id]/` - Session CRUD and game state
- `/api/armies/[id]/` - Army management
- `/api/datasheets/` - Unit datasheet lookups
- `/api/stratagems/` - Stratagem database
- `/api/admin/` - Admin-only data management
- `/api/dossier/` - Tactical dossier generation

### Database Models (Prisma)
Core models: `GameSession`, `TranscriptHistory`, `TimelineEvent`, `Army`, `Unit`, `UnitInstance`, `Datasheet`, `StratagemData`, `Ability`, `Weapon`

User system: `User` (Supabase Auth integration), `Player`, armies and sessions owned by users

Competitive context system: `CompetitiveSource`, `UnitCompetitiveContext`, `DatasheetCompetitiveContext`

## Code Standards

### TypeScript
- Strict mode enabled
- Use proper types, avoid `any` without justification
- Prefer interfaces over types for object shapes

### React/Next.js
- App Router (not Pages Router)
- Server Components by default, Client Components when needed
- Use `"use client"` directive only when necessary

### API Response Format
```typescript
return NextResponse.json({
  success: true,
  data: { /* result */ },
  validation?: { /* optional validation info */ }
}, { status: 200 });
```

### Error Handling Pattern
```typescript
try {
  // Operation
  return { success: true, data: result };
} catch (error) {
  console.error('Context:', error);
  return { success: false, error: error.message };
}
```

## Testing Checklist

Before claiming a feature is complete:
1. Linter passes (`npm run lint`)
2. TypeScript compiles (`npx tsc --noEmit`)
3. Manual testing in browser
4. Check console for errors
5. Verify Langfuse traces (if AI feature)
6. Test edge cases (empty input, errors, etc.)

## Documentation Standards

- User guides go in `docs/guides/`
- API docs go in `docs/api/`
- Feature docs go in `docs/features/`
- Always update `CHANGELOG.md` after completing features
- Use `SCREAMING_SNAKE_CASE` for doc filenames (e.g., `AUDIO_VAD_GUIDE.md`)

## Environment Variables

Key variables (see `env.example` for full list):
- `AI_PROVIDER` - `openai` or `google`
- `OPENAI_API_KEY` - Required for OpenAI
- `GOOGLE_API_KEY` - Required for Gemini
- `DATABASE_URL` - Supabase PostgreSQL (pooled connection)
- `DIRECT_URL` - Direct connection for migrations
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Auth
- `LANGFUSE_*` - LLM observability (optional)

## Security Practices

**NEVER document actual sensitive values in code, comments, or documentation files.** This includes:
- API keys, tokens, or secrets (even expired/rotated ones)
- Database connection strings with credentials
- Passwords or authentication tokens
- Private URLs with embedded credentials
- JWT secrets or encryption keys
- Any string that resembles a real credential pattern

**Instead, always use:**
- Placeholder text: `your-api-key-here`, `<API_KEY>`, `sk-...`
- Reference to env vars: "Set `OPENAI_API_KEY` in your `.env` file"
- Generic examples: `https://example.supabase.co`

**Why:** Security scanners (gitleaks, etc.) flag credential patterns. Even "example" credentials in docs can trigger false positives and create noise, or worse, accidentally expose real values if copy-pasted incorrectly.