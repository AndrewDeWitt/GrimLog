# Testing Google Gemini Integration

## Quick Test Guide

### Issue Found & Fixed

**Problem:** Gemini wasn't returning function calls - always got `toolCallsExecuted: 0`

**Root Cause:** I had the API parameters structured incorrectly:
- ❌ **Wrong**: `tools` at top level, `systemInstruction` at top level
- ✅ **Correct**: Both `tools` and `systemInstruction` inside the `config` object

**Fixed in:** `app/api/analyze/route.ts` and `lib/intentOrchestrator.ts`

### Test Instructions

1. **Ensure your `.env.local` has:**
   ```bash
   AI_PROVIDER=google
   GOOGLE_API_KEY=your_key_here
   ```

2. **Restart your dev server:**
   ```bash
   npm run dev
   ```

3. **Start a game session and test these voice commands:**

   **Test 1: Simple State Change**
   - Say: "All right start of the attacker's command phase, both players get 1 CP"
   - Expected: Should execute `update_command_points` tool calls
   - Check console for: `🤖 Using AI Provider: GOOGLE`

   **Test 2: Phase Transition**
   - Say: "Moving to shooting phase"
   - Expected: Should execute `change_phase` tool call
   
   **Test 3: Unit Health**
   - Say: "My Terminators took 3 wounds"
   - Expected: Should execute `update_unit_health` tool call

4. **Check the console logs:**
   ```
   🤖 Using AI Provider: GOOGLE
   📊 Model: gemini-2.5-flash
   🔍 Extracting Gemini function calls...
   📦 Full Gemini response: {...}
      Found X candidate(s)
      Found Y part(s) in content
      ✅ Found function call: {...}
   🎯 Extracted N function call(s)
   ```

5. **Verify in Langfuse:**
   - Check that metadata includes `"provider": "google"`
   - Check that model is `"gemini-2.5-flash"`
   - Check that `toolCallsExecuted` > 0 for game-related commands

### What to Look For

**✅ Success Indicators:**
- Console shows "Using AI Provider: GOOGLE"
- Function calls are extracted (not 0)
- Tool execution happens (commands update game state)
- Timeline shows events
- Langfuse traces show provider metadata

**❌ Failure Indicators:**
- No function calls extracted (0 tools)
- Console shows "No candidates found in response"
- Console shows "No content.parts found in candidate"
- No tools execute despite valid game commands

### Debugging

If you still see `toolCallsExecuted: 0`:

1. **Check console for response structure:**
   - Look for the `📦 Full Gemini response` log
   - Verify it has `candidates` array
   - Verify candidates have `content.parts`
   - Check if parts have `functionCall` property

2. **Check API key:**
   ```bash
   # In console, you should see this at startup
   🤖 Using AI Provider: GOOGLE
   📊 Model: gemini-2.5-flash
   ```

3. **Verify Gemini is receiving tools:**
   - Tools should be passed as: `config: { tools: [{ functionDeclarations: GEMINI_TOOLS }] }`
   - System instruction should be in config too

4. **Common issues:**
   - Missing `GOOGLE_API_KEY` - Check .env.local
   - Wrong `AI_PROVIDER` value - Must be exactly "google" (lowercase)
   - API quota exhausted - Check Google AI Studio dashboard

### Switch Back to OpenAI

If you need to revert to OpenAI:

```bash
# .env.local
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Restart dev server and it will use OpenAI instead.

### Expected Console Output (Google)

```
🤖 Using AI Provider: GOOGLE
📊 Model: gemini-2.5-flash
🔄 Starting Gemini call for gatekeeper + intent...
  └─ Gemini API call: 234ms
  └─ Parsing response: 2ms
🚦 Gatekeeper: ALLOWED (0.95 confidence)
🎯 Intent: SIMPLE_STATE → minimal
   Reasoning: Command point update requires only session state
⏱️ Context Building: 45ms
⏱️ gemini-2.5-flash Analysis: 567ms
🔍 Extracting Gemini function calls...
📦 Full Gemini response: {...}
   Found 1 candidate(s)
   Found 1 part(s) in content
   ✅ Found function call: {name: "update_command_points", ...}
🎯 Extracted 1 function call(s)
Executing 1 tool calls in parallel...
Executing tool: update_command_points {...}
```

### Next Steps

Once function calling works:
1. Test all tool categories (state, combat, objectives, secondaries)
2. Compare performance vs OpenAI
3. Check token usage in Google AI Studio
4. Verify Langfuse traces are complete
5. Document any differences in behavior

### Known Differences

**Gemini vs OpenAI:**
- Gemini uses single model for both intent and analysis
- OpenAI uses gpt-5-nano (fast) for intent, gpt-5-mini for analysis
- Gemini structured output uses different schema format (Type enums)
- Gemini doesn't provide call IDs (we generate them with crypto.randomUUID)
- Response structure is different (candidates vs output array)

Both providers should produce identical tool execution results!

