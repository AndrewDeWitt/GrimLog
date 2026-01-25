# Langfuse Integration for Grimlog

**Last Updated:** 2026-01-19
**Status:** Complete

## Overview

Langfuse has been integrated across all AI endpoints in Grimlog to trace LLM operations, game state, and admin tools. As of v4.90.0, **LLM cost tracking** is fully implemented with automatic token counting and cost calculation. As of v4.90.1, **gemini-army-parse** logs full input/output without truncation for evals and debugging.

## Traced Endpoints

| Endpoint | Provider | Purpose |
|----------|----------|---------|
| `/api/analyze` | OpenAI / Gemini | Voice command analysis & game state updates |
| `/api/armies/parse` | OpenAI / Gemini | Army list parsing from text/images |
| `/api/dossier/submit` | Gemini | Dossier generation (army parse + analysis + suggestions) |
| `/api/tactical-advisor` | Gemini | AI-powered tactical suggestions |
| `/api/admin/icons/generate` | Gemini | Unit icon generation (admin only) |

## LLM Cost Tracking (v4.90.0+)

### How It Works

All Gemini API calls now extract token usage from responses and pass it to Langfuse generations:

```typescript
// Extract token usage from Gemini response
const usage = {
  input: response.usageMetadata?.promptTokenCount || 0,
  output: response.usageMetadata?.candidatesTokenCount || 0,
  total: response.usageMetadata?.totalTokenCount || 0
};

// Pass to Langfuse generation
generation.end({
  usage: { input: usage.input, output: usage.output, total: usage.total }
});
```

For streaming responses, token usage is extracted from the last chunk:
```typescript
let lastChunk: any = null;
for await (const chunk of stream) {
  responseText += chunk.text || '';
  lastChunk = chunk;
}

// Gemini includes usage metadata in final streamed chunk
if (lastChunk?.usageMetadata) {
  usage = {
    input: lastChunk.usageMetadata.promptTokenCount || 0,
    output: lastChunk.usageMetadata.candidatesTokenCount || 0,
    total: lastChunk.usageMetadata.totalTokenCount || 0
  };
}
```

### One-Time Pricing Setup

To enable automatic cost calculation in Langfuse, run the pricing setup script:

```bash
npx tsx scripts/setup-langfuse-models.ts
```

This configures Gemini model pricing in Langfuse:
| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|-----------------|
| gemini-3-flash-preview | $0.50 | $3.00 |
| gemini-3-pro-preview | $2.00 | $12.00 |

### Unified Dossier Trace

The dossier generation flow creates **one trace** with all LLM calls:

```
dossier-strategic-analysis-background
├── parse-army-list (span)
│   └── gemini-army-parse (generation) ← Token usage + cost
├── run-local-analysis (span)
├── db-lookup-faction-detachment
├── enrich-army-from-database
├── fetch-faction-competitive-context
├── fetch-detachment-context
├── fetch-faction-datasheets
├── gemini-dossier-analysis (generation) ← Token usage + cost
├── parse-ai-response
├── generate-list-suggestions
│   └── gemini-suggestions (generation) ← Token usage + cost
└── save-dossier-to-database
```

### Files with Token Tracking

| File | LLM Calls | Notes |
|------|-----------|-------|
| `app/api/analyze/route.ts` | 1 | Voice analysis |
| `lib/dossierGenerator.ts` | 2 | Analysis + suggestions (streaming) |
| `app/api/dossier/submit/route.ts` | - | Creates unified trace |
| `lib/dossierGenerator.ts` | 2 | Analysis + suggestions (streaming) |
| `lib/armyListParser.ts` | 1 | Army parsing (full I/O logging) |
| `lib/intentOrchestrator.ts` | 1 | Intent classification |
| `app/api/tactical-advisor/route.ts` | 1 | Tactical suggestions |
| `app/api/armies/parse/route.ts` | 1 | Army parsing via API |
| `lib/competitiveContextParser.ts` | 1 | Competitive context |

### Full Input/Output Logging (v4.90.1+)

The `gemini-army-parse` generation in `lib/armyListParser.ts` logs **complete input and output** without truncation:

- **Input:** Full system prompt (including all datasheet context) and complete army list text
- **Output:** Complete JSON response from Gemini
- **Metadata:** Includes `systemPromptLength` and `userContentLength` for verification

This enables:
- **Evals:** Compare full prompts and outputs across runs
- **Debugging:** See exactly what context was provided and what was returned
- **Regression testing:** Detect changes in AI behavior with identical inputs

Note: Image content is logged as `[image content - base64 data]` to avoid storing large base64 strings.

### Viewing Costs in Langfuse

1. Navigate to **Tracing** in Langfuse
2. Click on a trace to see all generations
3. Each generation shows:
   - **Input Tokens** - Prompt token count
   - **Output Tokens** - Completion token count
   - **Total Tokens** - Combined count
   - **Cost** - Calculated USD cost (after running setup script)

4. Use **Analytics** for aggregated cost views:
   - Cost by model
   - Cost by trace name
   - Cost over time

## What's Being Tracked

### 1. **Analyze Endpoint (OpenAI/Gemini)**
- **Whisper Transcriptions** - All audio-to-text conversions
- **GPT-5/Gemini Completions** - Function calling and tool selection
- Token usage and costs for each call

### 2. **Tactical Advisor (Gemini)**
- **Context Building** - Session, units, stratagems, objectives
- **Gemini Analysis** - Full prompt/response with tactical suggestions
- **Game State** - Phase, round, turn, CP, VP, objectives
- Tags: `tactical-advisor`, `perspective-{type}`, `detail-{level}`

### 3. **Admin Icon Generation (Gemini)**
- **Image Fetch** - Source image retrieval
- **Gemini Image Generation** - Prompt and model config
- **Processing Steps** - Sharp resize, Supabase upload, DB upsert
- Tags: `admin`, `icon-generation`, `faction-{name}`

### 4. **Game State Metadata**
Each trace includes a complete game state snapshot:
```json
{
  "sessionId": "...",
  "battleRound": 1,
  "currentPhase": "Command",
  "currentPlayerTurn": "player",
  "playerCommandPoints": 10,
  "opponentCommandPoints": 10,
  "playerVictoryPoints": 0,
  "opponentVictoryPoints": 0,
  "objectivesHeld": {
    "player": 2,
    "opponent": 1,
    "contested": 0
  }
}
```

### 3. **Tool Execution Tracking**
- All 11 AI tool calls are tracked in a separate span
- Tool names, arguments, and results are logged
- Success/failure status for each tool

### 4. **Tags for Easy Filtering**
- `session-{sessionId}` - Filter by game session
- `round-{number}` - Filter by battle round
- `phase-{name}` - Filter by game phase
- `event-detected` or `no-event` - Whether AI detected a game event

## Setup Instructions

### 1. Add Environment Variables

Add these to your `.env.local` file:

```env
# Langfuse Configuration
LANGFUSE_SECRET_KEY=sk-lf-83a04991-4715-443c-aa5d-80c0e943606d
LANGFUSE_PUBLIC_KEY=pk-lf-8d7e8f3c-3a8b-44bd-b5b9-9d8f20e68b26
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

**Important:** Make sure your `OPENAI_API_KEY` is also set in `.env.local`.

### 2. Test the Integration

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Start a game session** and use voice commands

3. **View traces in Langfuse:**
   - Go to https://us.cloud.langfuse.com
   - Navigate to your project
   - You'll see traces appear for each audio analysis

## What You'll See in Langfuse

### Trace Structures

**Analyze Endpoint:**
```
📊 analyze-game-speech (main trace)
  ├── 🎤 gatekeeper-and-intent-classification (generation)
  │   └── Combined validation + intent classification
  ├── 🤖 openai-analyze / gemini-analyze (generation)
  │   ├── Input: [System Prompt, User Message]
  │   │   ├── Full system prompt with game rules
  │   │   ├── Army context (if available)
  │   │   ├── Conversation history
  │   │   └── Current transcription
  │   ├── Output: Assistant response with tool calls
  │   ├── Usage: Token counts and cost
  │   └── Metadata: Tool names, context tier
  └── 🔧 execute-tool-calls (span)
      ├── tool-change_phase (event)
      ├── tool-log_stratagem_use (event)
      └── ... (one event per tool call)
```

**Tactical Advisor Endpoint:**
```
🎯 tactical-advisor (main trace)
  ├── 📋 build-tactical-context (span)
  │   └── Metadata: unit counts, stratagems, phase
  └── 🤖 gemini-tactical-analysis (generation)
      ├── Input: [System Prompt, User Prompt]
      │   ├── Tactical system prompt (quick/detailed)
      │   └── Full game state context
      ├── Output: JSON tactical suggestions
      └── Metadata: temperature, maxOutputTokens
```

**Admin Icon Generation:**
```
🎨 admin-icon-generation (main trace)
  ├── 📥 fetch-source-image (span)
  ├── 🖼️ gemini-image-generation (generation)
  │   ├── Input: prompt + image reference
  │   └── Output: generated image metadata
  ├── ⚙️ image-processing (span)
  │   └── Sharp resize to 256x256
  ├── ☁️ supabase-upload (span)
  └── 💾 database-upsert (span)
```

### Detailed Prompt Visibility

Each trace now captures the **complete conversation context** sent to GPT-5:

**System Prompt includes:**
- Warhammer 40K game rules and phases
- Army context (player's units and stratagems)
- Last 5 transcriptions for conversation continuity
- Instructions for tool usage

**User Message:**
- Current transcribed audio text

**Response:**
- Tool calls chosen by AI
- Arguments for each tool
- Finish reason (tool_calls, stop, etc.)

### What's Now Visible (That Wasn't Before)

✅ **Full System Prompt** - See the exact instructions sent to GPT-5  
✅ **Conversation History** - View last 5 transcriptions in context  
✅ **Army Context** - See what units/stratagems are in the prompt  
✅ **Token Usage** - Prompt tokens, completion tokens, total  
✅ **Individual Tool Calls** - Each tool execution as separate event  
✅ **Tool Arguments** - Exact parameters passed to each function  
✅ **Tool Results** - Success/failure and data returned  
✅ **Whisper Output** - See what Whisper transcribed from audio  

### Searchable Data
- **Filter by session:** Tag `session-{id}`
- **Filter by round:** Tag `round-{number}`
- **Filter by phase:** Tag `phase-{name}`
- **View game state:** Check metadata for complete state snapshot
- **Cost tracking:** See token usage and $ cost per request

## Files Modified

1. ✅ **lib/langfuse.ts** - Langfuse client configuration
2. ✅ **app/api/analyze/route.ts** - Voice analysis with full tracing
3. ✅ **app/api/armies/parse/route.ts** - Army parsing with tracing
4. ✅ **app/api/tactical-advisor/route.ts** - Tactical AI with full tracing
5. ✅ **app/api/admin/icons/generate/route.ts** - Icon generation with tracing
6. ✅ **package.json** - Added `langfuse` and `@langfuse/openai`

## Benefits

✨ **Complete Observability** - See every AI decision and tool call  
📊 **Cost Tracking** - Monitor OpenAI spending per session  
🐛 **Debugging** - Understand why AI made certain decisions  
📈 **Analytics** - Track usage patterns and game statistics  
🔍 **Searchable History** - Find specific game moments by tags  

## Tracing Pattern

All endpoints follow this pattern:

```typescript
import { langfuse } from '@/lib/langfuse';

export async function POST(request: NextRequest) {
  let trace: any = null;
  
  try {
    const user = await requireAuth();
    
    // Create trace with user context
    trace = langfuse.trace({
      name: "your-endpoint",
      userId: user.id,
      metadata: { /* request details */ },
      tags: ['your-tag']
    });
    
    // Create spans for operations
    const span = trace.span({ name: "operation" });
    // ... do work ...
    span.end({ metadata: { result } });
    
    // Create generations for LLM calls
    const generation = trace.generation({
      name: "llm-call",
      model: "model-name",
      input: [{ role: 'system', content: prompt }]
    });
    // ... call LLM ...
    generation.update({ output: response });
    generation.end();
    
    // Update trace with final results
    trace.update({ output: result });
    
    // Flush async (don't block response)
    langfuse.flushAsync().catch(console.error);
    
    return NextResponse.json(result);
  } catch (error) {
    if (trace) {
      trace.update({ level: "ERROR", metadata: { error: error.message } });
      langfuse.flushAsync().catch(console.error);
    }
    // ... error handling ...
  }
}
```

## Custom Dashboards

In Langfuse, create custom dashboards to:
- Track average game duration
- Monitor most-used stratagems
- Analyze CP spending patterns
- View transcription accuracy
- Compare tactical advisor usage by perspective
- Track icon generation success rates

## Troubleshooting

### No traces appearing?
1. Check `.env.local` has all Langfuse variables
2. Restart dev server after adding env vars
3. Check browser console for errors
4. Verify API keys are valid

### Traces delayed?
- Traces are flushed async - may take a few seconds to appear
- Check Langfuse status page if delays persist

---

**Built by the Machine God's blessing** ⚙️

