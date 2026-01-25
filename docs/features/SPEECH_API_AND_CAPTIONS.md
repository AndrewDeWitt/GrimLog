# Speech API & Header Captions

**Last Updated:** 2025-12-21
**Status:** Complete

## Overview
We replaced Whisper-based live transcription with the browser's Web Speech API (Chrome/Edge) and redesigned the UI to show stable, readable captions in the header. Analysis is now triggered with smarter batching and we consolidated to a single `/api/analyze` endpoint that accepts transcription text.

**v4.40.0 Update:** Added Warhammer 40K vocabulary recognition with phonetic corrections to fix common speech-to-text errors for domain-specific terminology.

## Table of Contents
- Changes at a glance
- UX improvements
- Technical architecture
- Warhammer vocabulary corrections
- Tuning knobs
- Accessibility
- Related documentation

## Changes at a glance
- Switched to Web Speech API for real-time, free transcription
- Header caption bar with on-demand dropdown history (no flicker)
- Buffered sentence assembly (no micro-fragments)
- Smarter server-side triggers (batch size, word count, silence)
- `/api/analyze` now accepts `transcription` text (FormData)
- Removed `/api/transcribe` endpoint
- PostgreSQL datasource enabled via `DATABASE_URL`
- **NEW v4.40.0:** Phonetic correction system for Warhammer 40K terms

## UX improvements
- Static header line shows the entire current sentence (truncated only at container width)
- Dropdown (▼) reveals last 5 spoken lines for quick recall
- Live text grows smoothly as you speak; finalizes only when a full thought is detected
- Mobile-first: single-line caption stays compact; history available on tap

## Technical architecture
- Client: `lib/speechRecognition.ts`
  - Aggregates multiple Speech API results per event
  - Maintains a persistent buffer for final chunks
  - **Applies Warhammer vocabulary corrections before emitting** (v4.40.0)
  - Flushes buffer when punctuation, completion phrases, or ≥12 words, else 1.2s debounce
  - Emits live preview = buffer + current interim (both corrected)
- UI: `components/HeaderSpeechStatus.tsx`
  - Full-width single-line caption with ellipsis
  - Dropdown history (last 5 entries)
- API: `app/api/analyze/route.ts`
  - Accepts `transcription` (text) + `sessionId` (+ optional `armyContext`)
  - Validates transcription, stores transcript, fetches last 20 transcripts
  - Smart trigger check (server-side) → only run GPT when meaningful
- Triggers: `lib/analysisTriggers.ts`
  - Min transcripts for completion phrase: 2
  - Long silence: 8s
  - Batch size: 4 transcripts (≥5s since last)
  - Word-count trigger: ≥15 words (≥3s since last)
  - Safety cap: 20s

## Warhammer vocabulary corrections (v4.40.0)

The Web Speech API doesn't support custom vocabulary, so we apply post-processing corrections to fix common Warhammer 40K speech-to-text errors.

### Architecture

```
User speaks → Web Speech API → Raw transcript
                                    ↓
                         applyAllCorrections()
                                    ↓
                         Corrected transcript → UI + Server
```

### Key files

- `lib/warhammerCorrections.ts`: Core correction dictionary and functions
  - 200+ phonetic corrections for Tyranids, Space Marines, Necrons, etc.
  - Game terms: stratagems, phases, secondary objectives
  - `applyPhoneticCorrections()`: Phrase-level matching
  - `addSessionVocabulary()`: Runtime vocabulary additions
  
- `lib/generatedVocabulary.ts`: Auto-generated from Wahapedia data
  - 1,971 total vocabulary terms
  - 687 phonetic variations
  - Regenerate with: `npx tsx scripts/generateVocabulary.ts`

- `lib/contextBuilder.ts`: Dynamic AI context
  - `buildPhoneticHintsPrompt()`: Session-specific hints for current army units
  - AI prompts include pronunciation guidance for active units

### Common corrections

| Misheard (Speech API) | Corrected |
|-----------------------|-----------|
| "term against", "tournaments" | Termagants |
| "tyranno flex" | Tyrannofex |
| "intercesses", "inter cessors" | Intercessors |
| "oath of movement" | Oath of Moment |
| "strata gems", "strategy gem" | Stratagem |
| "elderly", "el dari" | Aeldari |
| "corn" | Khorne |

### Adding new corrections

1. Edit `lib/warhammerCorrections.ts`:
```typescript
export const PHONETIC_CORRECTIONS: Record<string, string> = {
  // Add new corrections here
  "new misheard phrase": "Correct Term",
};
```

2. Or regenerate from updated Wahapedia data:
```bash
npx tsx scripts/generateVocabulary.ts
```

### Session-specific vocabulary

For dynamic corrections based on current army:
```typescript
import { addSessionVocabulary, clearSessionVocabulary } from '@/lib/warhammerCorrections';

// When session loads
addSessionVocabulary("custom misheard", "Custom Unit Name");

// When session ends
clearSessionVocabulary();
```

## Tuning knobs
- Real-time buffer:
  - Word threshold: 12
  - Debounce: 1200ms
  - Punctuation/completion phrases flush immediately
- Server triggers (in `lib/analysisTriggers.ts`):
  - `MIN_TRANSCRIPTS_FOR_COMPLETION = 2`
  - `LONG_SILENCE_THRESHOLD = 8000`
  - `MIN_TRANSCRIPTS_FOR_BATCH = 4`
  - `MIN_TIME_FOR_BATCH = 5000`
  - `MIN_WORDS_FOR_ANALYSIS = 15`
  - `MAX_TIME_BETWEEN_ANALYSES = 20000`

## Accessibility
- Header caption is exposed via `aria-live="polite"`
- Dropdown is keyboard-accessible and closes on outside click
- High-contrast colors; readable at small sizes

## Related Documentation
- `docs/api/ANALYZE_ENDPOINT.md` – update: text input
- `docs/guides/CONTEXT_SYSTEM_GUIDE.md` – triggers & batching
- `docs/guides/AUDIO_VAD_GUIDE.md` – complementary background (now browser STT)`
