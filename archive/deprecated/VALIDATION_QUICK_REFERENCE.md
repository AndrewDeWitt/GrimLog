# Validation System - Quick Reference

## 🎯 What We Built

An **AI-driven validation system** that checks game actions against Warhammer 40K rules and current game state, providing contextual warnings with manual override capability.

---

## 🏗️ Architecture Overview

```
User Speech
    ↓
Whisper Transcription
    ↓
AI Analysis (with full game state context)
    ↓
Tool Execution (with validation checks)
    ↓
Validation Result (if any issues detected)
    ↓
UI Toast (with override option)
    ↓
User Override (optional)
```

---

## 📂 Key Files

### Backend (✅ Complete):
- **`lib/rulesReference.ts`** - Warhammer rules cheat sheet for AI
- **`lib/validationHelpers.ts`** - Validation logic functions
- **`lib/types.ts`** - TypeScript interfaces for validation
- **`lib/toolHandlers.ts`** - Tool execution with validation
- **`app/api/analyze/route.ts`** - AI prompt with game context

### Frontend (🚧 To Do):
- **`components/ValidationToast.tsx`** - Toast component (created, needs integration)
- **`app/sessions/[id]/page.tsx`** - Main session UI (needs validation display)

---

## 🔧 How Validation Works

### 1. Game Context Fetching
```typescript
const context = await fetchGameContext(sessionId);
// Returns: session, recent stratagems, objectives
```

### 2. Validation Check
```typescript
const validation = validateStratagemUse(
  stratagemName,
  usedBy,
  phase,
  context
);
```

### 3. Validation Result
```typescript
{
  severity: 'warning',
  message: '"Transhuman" may have already been used...',
  rule: 'duplicate_stratagem_this_phase',
  suggestion: 'Check if stratagem has "once per phase" restriction',
  requiresOverride: true
}
```

### 4. Attached to Tool Result
```typescript
{
  toolName: 'log_stratagem_use',
  success: true,
  message: 'Transhuman Physiology used...',
  data: { ... },
  validation: { ... } // ← Validation result here
}
```

---

## 🎨 Validation Severities

| Severity | Icon | Color | Use Case | Auto-Dismiss |
|----------|------|-------|----------|--------------|
| **valid** | ✓ | Green | No issues | N/A |
| **info** | ℹ | Blue | FYI, unusual but ok | Yes (10s) |
| **warning** | ⚠ | Amber | Suspicious, verify | No (manual) |
| **error** | ✕ | Red | Rule violation | No (manual) |
| **critical** | 🚨 | Dark Red | Severe mistake | No (manual) |

---

## 🎮 Example Validations

### ✅ Valid Action
```
User: "Using Transhuman on my Terminators"
CP Available: 2 CP
Recent Stratagems: None
→ No validation warning
```

### ⚠️ Warning
```
User: "Using Transhuman on my Terminators"
CP Available: 2 CP
Recent Stratagems: Transhuman (this phase)
→ WARNING: "Transhuman" may have already been used this phase
```

### ❌ Error
```
User: "Using Transhuman on my Terminators"
CP Available: 0 CP
Recent Stratagems: None
→ ERROR: Insufficient CP (has 0 CP, needs 2 CP)
```

### 🚨 Critical
```
User: "Moving to Battle Round 1"
Current Round: 3
→ CRITICAL: Cannot go backwards from Round 3 to Round 1
```

---

## 🔑 Key Features

### 1. Context-Aware AI
AI receives:
- Current phase, round, turn
- CP counts (player & opponent)
- Victory points
- Objectives held
- Recent stratagems used
- Recent conversation history
- Full rules cheat sheet

### 2. Always Execute
Actions are **always executed**, even with errors. Validation is advisory only.

### 3. User Override
Users can click **"Override & Accept"** to acknowledge any warning/error.

### 4. Tiered Responses
- **Info**: Auto-dismiss after 10s
- **Warning/Error**: Require user action (dismiss or override)
- **Critical**: Highlight severe issues, but still allow override

---

## 🚀 How to Integrate (UI)

### Step 1: Add state to session page
```typescript
const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
```

### Step 2: Check tool results for validation
```typescript
const toolResults = analysisResult.toolCalls || [];
const warnings = toolResults
  .filter(tr => tr.validation)
  .map(tr => ({
    id: generateId(),
    validation: tr.validation,
    toolName: tr.toolName,
    toolMessage: tr.message
  }));

setValidationWarnings(prev => [...prev, ...warnings]);
```

### Step 3: Render ValidationToast components
```typescript
{validationWarnings.map(warning => (
  <ValidationToast
    key={warning.id}
    validation={warning.validation}
    toolName={warning.toolName}
    toolMessage={warning.toolMessage}
    isVisible={true}
    onClose={() => removeWarning(warning.id)}
    onOverride={() => handleOverride(warning.id)}
  />
))}
```

### Step 4: Handle override
```typescript
const handleOverride = (warningId: string) => {
  // Log override event (optional)
  console.log('User overrode validation:', warningId);
  
  // Remove warning from UI
  removeWarning(warningId);
  
  // Could also: update database, mark as overridden, etc.
};
```

---

## 📊 Validation Rules Reference

### Phase Transitions
- ✅ Command → Movement → Shooting → Charge → Fight
- ⚠️ Skipping phases (e.g., Command → Shooting)
- ❌ Going backwards (e.g., Shooting → Movement)

### Command Points
- ✅ Gaining 1-2 CP per turn
- ⚠️ Gaining >2 CP (unusual but possible)
- 🚨 Gaining >3 CP (impossible)
- ❌ Spending more CP than available

### Stratagems
- ⚠️ Using same stratagem twice in same phase
- ℹ️ Using same stratagem twice in same turn
- ❌ Using stratagem with insufficient CP

### Battle Rounds
- ✅ Round 1 → 2 → 3 → 4 → 5
- ❌ Skipping rounds (e.g., 2 → 4)
- 🚨 Going backwards (e.g., 3 → 2)

---

## 🧪 Testing Commands

```bash
# No tests yet - manual testing required

# Test scenarios:
# 1. Try spending CP with 0 CP available
# 2. Try using same stratagem twice in phase
# 3. Try going backwards in phases
# 4. Try skipping a battle round
# 5. Try gaining 5 CP in one action
```

---

## 💡 Design Philosophy

1. **AI is the Driver**: Rules are text-based, not hard-coded TypeScript
2. **User is the Authority**: Every validation can be overridden
3. **Context Matters**: AI knows full game state before making decisions
4. **Fail Gracefully**: Always execute, warn about issues
5. **Learn Over Time**: Track overrides to improve AI accuracy

---

## 🔮 Future Enhancements (Phase 5)

- RAG system for rule lookups (pgvector)
- Validation event tracking/analytics
- Rule violation history view
- AI learning from overrides
- Custom house rules support
- Stratagem database with restrictions




