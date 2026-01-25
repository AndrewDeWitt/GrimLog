# Tactical Dossier (War Room)

**Last Updated:** 2026-01-19 (v4.90.4)
**Status:** Complete

## Overview

The Tactical Dossier is a standalone army analysis tool that generates comprehensive tactical reports for Warhammer 40K army lists. Select your faction, paste your army list text, submit, and receive a detailed tactical analysis with AI-powered recommendations. Generation runs in the background - you'll be notified when it's ready.

**New in v4.90.4:** Faction Selector - Required faction dropdown before submitting army lists. Improves parsing accuracy by filtering datasheets to the selected faction. Subfactions automatically include parent faction datasheets (e.g., Space Wolves includes Space Marines units).

**New in v4.86.0:** Simplified Report - Removed "Detailed Analysis" section (Playstyle, Combat Focus, Meta Readiness, Strengths/Weaknesses summary, Collection Gaps). These were redundant with content in Unit Profiles and Army Quirks. Reduced AI token usage by ~200 tokens per generation. Fixed Langfuse to log full prompt/response JSON for better debugging.

**New in v4.83.0:** Matchup Guide - Replaced Strategic Assessment's dense text paragraph with a scannable Matchup Guide showing performance vs 8 opponent archetypes. Color-coded ratings (green/yellow/red), expandable tips, sorted by favorability. Updated archetypes for 10th Edition: replaced `psyker_heavy`/`balanced` with `skirmish_msu`/`attrition`.

**New in v4.81.0:** Share Icon Relocation - Share button moved from sticky footer to Army Identity Card (top-right corner). Only visible to dossier owners. Export button removed (reserved for premium). Responsive sizing for mobile/desktop.

**New in v4.80.0:** Role-Specific Colors - Each tactical role section (Hammers, Anvils, Skirmishers, etc.) now has distinct border accent colors matching its theme (red, blue, yellow, purple, green, cyan, amber). Increased spacing between role sections for clearer visual separation.

**New in v4.79.0:** Section Theming & Unit Profile Styling - Each section now has its own distinct color theme (amber, green, orange, blue, cyan, purple) with matching corner accents and icons. Unit Profile cards updated with corner accents, larger text sizes for better mobile/desktop readability, and monospace points display.

**New in v4.78.0:** Report Restructure - Dossier report restructured to prioritize high-value content for competitive players. Army Quirks expanded from 2 to 4 with grim dark Mechanicus styling. All sections now fully collapsible for easy scanning. Unit Profiles expanded by default with inline strengths/weaknesses per role group. New section order: Quirks → Unit Profiles → List Modifications → Strategic Assessment → Synergies → Detailed Analysis (collapsed).

**New in v4.76.0:** Mobile-First Report View - The dossier report page (`/dossier/[id]`) has been refactored for mobile-first design. Army identity card redesigned with larger spirit icon and clearer faction/detachment hierarchy. All body text updated from `grimlog-steel` to `gray-300` for better contrast and accessibility. Navigation simplified to use the global gear menu.

**New in v4.70.0:** Async Generation - Dossier generation now runs in the background. Submit your list and browse freely - a header badge shows "X Generating" while processing, then "Ready!" when complete. Click the badge to view your dossier instantly. Simplified input to paste-only (removed file upload and optional settings). See [Async Generation](#async-generation-v4700) for details.

**New in v4.69.0:** Recommendations Redesign - List suggestions now provide 4 complete, independent options (instead of 2 major + 2 tweak). Each option is self-contained and results in a valid ~2000pt list. Fixed parent faction detachment lookup (Space Wolves now correctly fetches Space Marines detachment rules). Eliminated Legends unit hallucinations through data-driven approach. See [List Modification Suggestions](#list-modification-suggestions) for details.

**New in v4.68.0:** Analysis Quality Improvements - AI analysis now receives full synergy reasoning (not just unit names), correctly differentiates identical units with A/B suffixes, and enforces one-leader-per-unit rules. See [Analysis Quality](#analysis-quality-v4680) for details.

**New in v4.62.0:** Dossier History & Sharing - All dossier generations are automatically saved with permanent URLs (`/dossier/{id}`). Share dossiers via link tokens or make them public in the gallery. Browse your history or explore public dossiers from the navigation menu.

**New in v4.61.0:** Gemini 3 Pro Upgrade - Strategic analysis now powered by `gemini-3-pro-preview` with `thinkingLevel: 'high'` for deeper reasoning. Prompts optimized for Gemini 3's reasoning model. Produces richer executive summaries, more actionable fun stats, and specific mitigation strategies.

**New in v4.60.0:** Dossier Landing Page UX Refresh - `/dossier` now functions as a true landing page with a mobile-first hero, an interactive sample dossier preview (no iframes), and a simplified "Try Before You Buy" flow that encourages sign-in only when generating.

**New in v4.58.0:** Dossier Credits System - Users receive 2 free generations on sign-up. Admins have unlimited access. Credits displayed in header with remaining count. See [Dossier Credits System](DOSSIER_CREDITS_SYSTEM.md) for details.

**New in v4.57.0:** List Modification Suggestions - AI-powered recommendations for improving your army list. Two independent options showing unit swaps/additions with points impact and tactical rationale. Spirit icon generation unified on backend (no more duplicate generation). Suggestions included in HTML export with unit icons.

**New in v4.56.0:** Enhanced prompt guidance focusing on theory-crafting and available options rather than specific gameplay sequences. Competitive context integration (when available) provides tier rankings, synergies, and counter matchups. Enhanced weakness schema with specific counter armies and mitigation strategies.

**New in v4.55.0:** Enriched Faction/Detachment context. The AI now receives full database rules for detachment abilities, stratagems, enhancements, and faction rules, ensuring analysis is based on current game data rather than stale training cutoff.

**New in v4.54.0:** Narrative tactical summaries (plain English, no numbers), weakness/counterpoint inclusion for all units, and accurate Leader Attachment rules powered by database enrichment.

**New in v4.53.0:** AI-generated unit tactical summaries, AI tactical role assignments, expanded role system (`utility`, `specialist`), and enhanced playstyle assessment guidance. 

**New in v4.51.0:** Army Spirit hero section with AI-generated unique icons, playstyle blend analysis, combat spectrum visualization, and dynamic "fun stats" for viral shareability. Streamlined to 9 focused sections.

**New in v4.45.0:** Removed radar chart visualization in favor of more actionable role-based analysis and AI insights.

**New in v4.44.0:** AI Strategic Analysis powered by Gemini provides executive summaries, matchup considerations, and secondary objective recommendations. (Upgraded to Gemini 3 Pro in v4.61.0)

## Table of Contents

- [Features](#features)
- [Async Generation (v4.70.0)](#async-generation-v4700)
- [Landing Page UX (Try Before You Buy)](#landing-page-ux-try-before-you-buy)
- [How to Use](#how-to-use)
- [Army Spirit (Viral Insights)](#army-spirit-viral-insights)
- [Three-Pillar Analysis](#three-pillar-analysis)
- [AI Strategic Analysis](#ai-strategic-analysis)
- [Analysis Quality (v4.68.0)](#analysis-quality-v4680)
- [List Modification Suggestions](#list-modification-suggestions)
- [HTML Export](#html-export)
- [Report Structure (v4.79.0)](#report-structure-v4790)
- [Technical Architecture](#technical-architecture)
- [Related Documentation](#related-documentation)

## Features

- **Faction Selector** ⭐ v4.90.4: Required faction dropdown before submitting, improves parsing accuracy, subfaction support
- **Simplified Report** ⭐ v4.86.0: Removed redundant "Detailed Analysis" section (Playstyle, Combat Focus, Meta Readiness, S&W summary)
- **Role-Specific Colors** ⭐ v4.80.0: Each tactical role section has distinct border colors (Hammers=red, Anvils=blue, Skirmishers=yellow, Support=purple, Scoring=green, Utility/Screening=cyan, Specialists=amber)
- **Section Theming** ⭐ v4.79.0: Each section has distinct color theme with corner accents (amber, green, orange, blue, cyan, purple)
- **Unit Profile Styling** ⭐ v4.79.0: Corner accents, larger text sizes, monospace points, improved mobile/desktop readability
- **Report Restructure** ⭐ v4.78.0: Prioritized high-value content (Unit Profiles, List Modifications), all sections collapsible
- **4 Army Quirks** ⭐ v4.78.0: Expanded from 2 to 4, grim dark Mechanicus styling, full text visible
- **Inline Strengths/Weaknesses** ⭐ v4.78.0: S&W displayed per unit role group as compact badges
- **Share Icon in Army Card** ⭐ v4.81.0: Share icon positioned in Army Identity Card (top-right), owner-only visibility
- **Mobile-First Report View** ⭐ v4.76.0: Redesigned `/dossier/[id]` page with larger icons, improved text contrast
- **Async Background Generation** ⭐ v4.70.0: Submit and browse freely - notified when ready
- **Paste Text Input**: Simple paste-only interface (file upload removed in v4.70.0)
- **Landing Page UX (Try Before You Buy)** ⭐ v4.60.0: Hero + interactive sample preview; sign-in encouraged at generation time
- **Army Spirit Hero Section** ⭐ v4.51.0: AI-generated icon, tagline, army quirks
- **MathHammer Analysis**: Damage output vs common target profiles (MEQ, TEQ, Vehicles, Monsters)
- **Meta Context Analysis**: Role distribution, keyword counts, detachment synergy
- **Objective Ecology**: OC totals, action units, mobility tiers, durability scoring
- **AI-Assigned Tactical Roles** ⭐ v4.53.0: Units dynamically grouped by battlefield purpose:
  - `hammer`: Primary damage dealers
  - `anvil`: Durable objective holders
  - `skirmisher`: Mobile harassment units
  - `support`: Buffing characters
  - `scoring`: Dedicated action/objective units
  - `screening`: Cheap blockers
  - `utility`: Special tricks (Lone Op, Infiltrate)
  - `specialist`: Dedicated anti-tank or snipers
- **AI Unit Summaries** ⭐ v4.54.0: 2-3 sentence tactical guides in plain English (no numbers) including weaknesses/counterpoints.
- **Leader Attachment Validation** ⭐ v4.54.0: Accurate attachment rules powered by database enrichment preventing hallucinations.
- **Threat Assessment**: Overall rating with strengths/weaknesses
- **Collection Gaps**: Actionable recommendations for army improvements
- **HTML Export**: Self-contained shareable document
- **AI Strategic Analysis** ⭐ v4.44.0: Gemini-powered strategic insights with matchup considerations
- **List Modification Suggestions** ⭐ v4.57.0: AI-powered army improvement recommendations with unit swap options
- **Dossier History** ⭐ v4.62.0: Automatic saving with permanent URLs, history page, and quick access dropdown
- **Public Sharing** ⭐ v4.62.0: Share via link tokens or make public in gallery, view counting, social share buttons

## Async Generation (v4.70.0)

⭐ **New in v4.70.0**

Dossier generation now runs entirely in the background, allowing users to continue browsing while their analysis processes.

### How It Works

1. **Select Faction**: Choose your faction from the dropdown (required)
2. **Submit**: Paste your army list and click "Analyze Army"
3. **Redirect**: You're immediately redirected to the gallery
4. **Processing**: Generation runs in the background (2-3 minutes)
5. **Notification**: Header badge shows status, toast appears when complete
6. **View**: Click the badge to navigate directly to your dossier

### Header Badge States

| State | Appearance | Action |
|-------|------------|--------|
| **Generating** | Amber, spinning icon, "X Generating" | Click to view gallery |
| **Ready** | Green, checkmark, "Ready!" (pulses) | Click to view dossier |
| **Failed** | Red, X icon, "Failed" | Click to retry |

### Smart Polling

⭐ **Updated v4.90.3** - Optimized for rate limits and realistic generation times (~2 min)

The notification system uses adaptive polling that only runs when needed:

- **No idle polling**: Only polls when there are pending dossiers (0 requests when idle)
- **Initial phase (first ~2 min)**: Polls every 20 seconds (we know generation takes time)
- **Completion phase (after ~2 min)**: Speeds up to 10 seconds as completion approaches
- **Auto-start**: `triggerRefresh()` automatically starts polling when a new dossier is submitted
- **Local tracking**: Dismissed notifications won't reappear even before API updates

### Timeout Handling

⭐ **New in v4.90.3**

If a dossier gets stuck in pending/processing state (e.g., background processing error):

- **15-minute timeout**: Status endpoint detects dossiers stuck for >15 minutes
- **Auto-fail**: Marks them as failed with "Generation timed out. Please try again."
- **User notification**: Failed dossiers appear in the notification badge for dismissal

### Technical Implementation

- **Background processing**: Uses Next.js `after()` API for non-blocking execution
- **Direct function calls**: No internal HTTP requests - parsing and analysis run directly
- **Database persistence**: Notification state stored via `notificationDismissedAt` field
- **24-hour window**: Only completions from the last 24 hours show as notifications

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dossier/submit` | POST | Quick submission, returns dossier ID immediately |
| `/api/dossier/status` | GET | Poll for pending/completed/failed dossiers |
| `/api/dossier/dismiss` | POST | Mark notification as acknowledged |

See [Dossier Submit Endpoint](../api/DOSSIER_SUBMIT_ENDPOINT.md) for API details.

## Landing Page UX (Try Before You Buy)

⭐ **New in v4.60.0**

The `/dossier` page is designed to convert cold traffic by showing the value of the Tactical Dossier before asking for authentication.

### UX Goals

- **Professional product framing**: Dossier feels like a premium service, not a raw tool form.
- **Try before sign-in**: Users can explore a realistic sample output and prep their input before authentication.
- **Mobile-first readability**: Larger mobile typography and full-width layout avoid cramped “tiny print” UX.
- **Grimdark, not “AI aesthetic”**: Reduced distracting glow/flare effects; higher contrast text choices.

### Page Structure

1. **Hero** (`components/dossier/DossierHero.tsx`)
   - 2×2 feature grid on mobile
   - Primary CTA: “Analyze Your List”
   - Secondary CTA: “See Sample Report”
2. **Interactive Sample Preview** (`components/dossier/DossierSamplePreview.tsx`)
   - Displays key sections (Army Spirit, assessment, strengths/weaknesses, matchups, unit summaries, list improvements)
   - Collapsible sections optimized for mobile scanning
   - Uses `data/sample-dossier-response.json` as representative output
3. **Form** (`app/dossier/page.tsx`)
   - Paste text or upload file
   - Optional settings collapsed by default
   - Clear messaging for unauthenticated users (sign-in prompt) and users with no credits

### Authentication & Credits UX

- **Unauthenticated users**:
  - Can view the sample preview and use the form UI
  - Are prompted to sign in when attempting to generate a dossier
- **Authenticated users**:
  - See remaining credits in the header
  - Generate is disabled when credits are depleted (with clear messaging)

## How to Use

1. Navigate to `/dossier` from the main menu
2. Paste your army list text into the input area
3. Click "Generate Dossier"
4. You'll be redirected to the gallery - watch the header badge for progress
5. When "Ready!" appears, click the badge to view your dossier
6. Click "Export HTML" to download a shareable report

## Army Spirit (Viral Insights)

⭐ **New in v4.51.0**

The Army Spirit hero section provides shareable, "viral-ready" content about the army's identity and playstyle. All content is AI-generated based on the army composition.

### Components

| Component | Description |
|-----------|-------------|
| **Army Spirit Icon** | Unique grimdark comic-book style icon generated for each army |
| **Tagline** | 2-5 word phrase capturing battlefield identity (e.g., "The Iron Tide") |
| **Spirit Description** | Evocative one-liner about how the army "feels" on tabletop |
| **Army Quirks** | 4 mechanical attributes that make THIS army composition unique (⭐ v4.78.0: expanded from 2) |

> **Note (v4.86.0):** Playstyle Blend and Combat Spectrum were removed as they were redundant with Army Quirks and other analysis sections.

### Army Quirks Examples

⭐ **Updated v4.61.1:** Army Quirks now focus on **unit composition** characteristics rather than faction/detachment mechanics.

The AI highlights unique mechanical attributes that make each army composition different based on **what the units themselves bring**:

**GOOD Examples (Unit-Based):**
- "Invuln Wall 🛡️: 21/50 models - Over 40% of models have 4+ invulnerable saves via Storm Shields"
- "Deep Strike Investment ⚡: 520pts - Large reserve threat arriving behind enemy lines"
- "Thunder Hammer Dense ⚔️: 15 S8 attacks - Heavy melee loadout across multiple units"
- "Terminator Core 🛡️: 60% points - Majority of army in 2+ saves"
- "Character Density 👑: 5 characters - Aura coverage everywhere"

**BAD Examples (Detachment/Faction-Based - Avoided):**
- ❌ "Saga Stacking: 2 Sagas" (detachment rule, not unit composition)
- ❌ "Oath Target Bonus" (faction ability, not unit stat)
- ❌ "Combat Doctrine Sequencing" (detachment mechanic, not unit characteristic)

Quirks should answer: **"What do the UNITS in this list bring?"** not **"What does the detachment/faction do?"**

### Icon Generation

Icons are generated using Gemini's image generation (`gemini-3-pro-image-preview`):

1. AI generates a detailed prompt based on army composition
2. Prompt includes faction colors, grimdark atmosphere, comic book style
3. Image generated at 256x256 PNG
4. Stored permanently in Supabase Storage
5. Cached by hash to avoid regenerating identical armies

See [Army Spirit Icon API](../api/DOSSIER_GENERATE_SPIRIT_ICON_ENDPOINT.md) for endpoint details.

## Three-Pillar Analysis

### Pillar 1: MathHammer

Calculates statistical damage output using the existing damage calculation engine:

| Target Profile | Toughness | Save | Wounds |
|---------------|-----------|------|--------|
| MEQ (Marine Equivalent) | T4 | 3+ | 2 |
| TEQ (Terminator Equivalent) | T5 | 2+ (4++) | 3 |
| Vehicle | T10 | 3+ | 12 |
| Monster | T12 | 4+ | 16 |

**Outputs:**
- Per-unit damage profiles (ranged vs melee)
- Threat rating per unit (low/medium/high/extreme)
- Primary role classification (Anti-Tank, Anti-Infantry, etc.)
- Anti-tank and anti-infantry unit lists

### Pillar 2: Meta Context

Analyzes army composition and synergies:

- **Role Distribution**: Count of units by battlefield role (Battleline, HQ, etc.)
- **Keyword Counts**: Important keyword presence (INFANTRY, CHARACTER, etc.)
- **Special Capabilities**: Deep Strike, Scouts, Infiltrators, Psykers, Transports
- **Character Analysis**: Leader units and attachment potential
- **Detachment Synergy**: Score (0-100) based on faction/detachment fit

### Pillar 3: Objective Ecology

Evaluates scoring potential and board control:

- **Objective Control**: Total OC, OC per unit, high-OC units
- **Action Units**: INFANTRY units suitable for performing actions
- **Mobility Tiers**: Slow (<6"), Medium (6-10"), Fast (>10"), Flying
- **Durability**: Total wounds, effective wounds (adjusted for saves), per-unit durability tiers

## AI Strategic Analysis

⭐ **New in v4.44.0** | **Upgraded v4.61.0**

After local analysis completes, the dossier calls `analyzeDossier()` directly (via `/api/dossier/submit` background processing) to generate AI-powered strategic insights using **Gemini 3 Pro** with `thinkingLevel: 'high'` for deep reasoning.

### What the AI Provides

| Section | Description |
|---------|-------------|
| **Executive Summary** | 2-3 sentence overview of the army's strategic identity |
| **Army Archetype** | Classification (horde, elite, balanced, skew, etc.) with explanation |
| **Statistical Breakdown** | Toughness distribution, damage profile, mobility capabilities |
| **Strategic Strengths** | Key advantages with relevant units identified |
| **Strategic Weaknesses** | Vulnerabilities with severity ratings and counterplay risks |
| **Matchup Considerations** | Performance vs common archetypes (horde, gunline, etc.) |
| **Secondary Recommendations** | Strong picks, avoid picks, and overall scoring potential |
| **Collection Recommendations** | Units to add with priority and alternatives |
| **Threat Assessment** | Overall threat level, peak phase, and counter-strategies |
| **Detachment Rules** ⭐ | (NEW v4.55.0) Full rules context from database: abilities, stratagems, and enhancements |

### Context Enrichment (v4.55.0+)

To prevent hallucinations and outdated advice, the analysis pipeline now performs a multi-step enrichment before calling Gemini:

1. **Unit Enrichment**: Each unit is matched against the database to get accurate keywords, abilities, and Leader Attachment rules.
2. **Competitive Context Enrichment** ⭐ NEW v4.56.0: When available, competitive context data is fetched and included:
   - **Tier Rankings**: S/A/B/C/D tier ratings from community sources.
   - **Synergies**: Known unit combinations and synergies from competitive play.
   - **Counters**: Opponent armies and units that counter this unit.
   - **Playstyle Notes**: Deployment and usage guidance from content creators.
3. **Rules Enrichment**: The detected Faction and Detachment are used to fetch current rules from the database:
   - **Detachment Ability**: Full text of the primary detachment rule.
   - **Stratagems**: List of all available detachment stratagems with timing, effects, and tactical usage hints.
   - **Enhancements**: All available upgrades with points costs and rules.
   - **Faction Rules**: Army-wide rules (e.g., Oath of Moment, For the Greater Good).

This ensures the AI can give theory-crafting advice based on rules and available options, such as "This list has access to 3 Hunting Packs, giving you flexibility to respond to different situations" or "Logan Grimnar's Howling Onslaught ability could be combined with deep striking Terminators for a powerful alpha strike option."

### Capability Detection

The AI receives comprehensive capability data including:

- **Deep Strike**: Detected via TERMINATOR, JUMP PACK, TELEPORT HOMER, DAEMON keywords
- **Scouts**: Detected via SCOUTS, SCOUT keywords
- **Infiltrate**: Detected via INFILTRATORS, INFILTRATE, PHOBOS keywords
- **FLY**: Detected via FLY keyword
- **Unit-Specific Abilities**: Abilities containing Deep Strike, Scout, Infiltrat are also checked

### Example Output

```json
{
  "executiveSummary": "This Space Wolves list is an aggressive melee-focused army built around elite Terminator blocks. It excels at crushing elite infantry but struggles against hordes.",
  "armyArchetype": {
    "primary": "elite",
    "secondary": "melee_focused",
    "description": "High-cost models with excellent melee profiles..."
  },
  "strategicStrengths": [
    {
      "title": "Elite Melee Threat",
      "description": "Multiple high-damage melee units can delete most targets in a single Fight phase.",
      "relevantUnits": ["Wolf Guard Terminators", "Thunderwolf Cavalry"]
    }
  ],
  "matchupConsiderations": [
    {
      "opponentArchetype": "horde_armies",
      "matchupRating": "unfavorable",
      "reasoning": "Low model count means you can be overwhelmed on objectives.",
      "keyTips": ["Focus on killing action units", "Don't overcommit Terminators to chaff"]
    }
  ]
}
```

### Langfuse Tracing

All AI calls are fully traced with:
- Context building spans with capability metadata
- Generation tracking with prompts and responses
- Tags for faction, archetype, and threat level filtering

See [Langfuse Observability](LANGFUSE_OBSERVABILITY.md) for trace debugging.

## Analysis Quality (v4.68.0)

⭐ **New in v4.68.0**

Several improvements ensure AI analysis is list-specific rather than generic faction advice.

### Unit Identification System

Units are now identified by unique `displayName` values that handle three cases:

| Scenario | Example |
|----------|---------|
| **Unique name** | `"Bjorn the Fell-Handed"` |
| **Same name, different points** | `"Wolf Guard Terminators (340pts)"` vs `"Wolf Guard Terminators (170pts)"` |
| **Same name AND same points** | `"Wulfen with Storm Shields (200pts) A"` vs `"Wulfen with Storm Shields (200pts) B"` |

The `generateUniqueDisplayNames()` helper function ensures consistency between local analysis and AI prompts, so the AI's output keys correctly match the frontend lookups.

### Synergy Reasoning Preservation

Competitive context synergies now include full tactical explanations, not just unit names:

**Before (v4.67.0):**
```
Key Synergies: Wolf Guard Terminators, Arjac Rockfist
```

**After (v4.68.0):**
```
Synergies:
  - Wolf Guard Terminators: Logan can lead them to provide ablative wounds or use his ability to deliver them from reserves in Battle Round 1
  - Arjac Rockfist: Arjac typically leads the large Terminator unit that Logan facilitates bringing onto the board early
```

This ensures critical tactical guidance like "Arjac leads the large Terminator unit" reaches the AI.

### Leader Attachment Rules

The AI now receives explicit guidance about 10th Edition leader attachment rules:

- **One leader per unit**: Each unit can only have ONE leader attached
- **Distribute leaders**: When multiple leaders and eligible units exist, each leader goes to a different unit
- **Bad example**: "Attach Logan and Arjac here" (ILLEGAL)
- **Good example**: "Arjac's brick - His Fight on Death triggers on every model" + "Logan's reserves - Use his Chapter Master Turn 1 ability"

This prevents AI suggestions that would create illegal army compositions.

### List-Specific Analysis Framework

The system prompt now includes a uniqueness framework requiring the AI to identify:

1. What's the single most unusual thing about this composition?
2. What does this list do BETTER than typical faction lists?
3. What does this list SACRIFICE compared to typical builds?
4. If you played against this 10 times, what would you learn to fear most?

Good/bad examples guide the AI toward specific insights rather than generic faction advice that any player would already know.

## List Modification Suggestions

⭐ **New in v4.57.0** | **Updated v4.69.0**

After generating the strategic analysis, the dossier provides AI-powered suggestions for improving the army list. These help users brainstorm modifications to fill gaps or lean into specific archetypes.

### How It Works

1. **Full Context**: The AI receives the complete strategic analysis output, plus full datasheets for ALL available faction units (not filtered by current list).
2. **Four Independent Options** ⭐ v4.69.0: Exactly 4 suggestions are generated. Each is a complete, self-contained modification that results in a valid ~2000pt list. Users pick ONE option that fits their collection.
3. **Complex Modifications Supported**: A single suggestion can involve removing multiple units, adding multiple units, AND adding enhancements to characters.
4. **Points Efficiency**: Each suggestion must result in 1990-2000pts. Unused points = bad suggestion.

### Suggestion Structure (v4.69.0)

| Field | Description |
|-------|-------------|
| **Title** | Short descriptive name (2-5 words), e.g., "Add Cavalry Leader" |
| **Priority** | `high`, `medium`, or `low` based on impact |
| **Remove Units** | Array of units to remove with names and points |
| **Add Units** | Array of units to add with names and points |
| **Add Enhancements** | Array of enhancements to add with name, points, and target character |
| **Points Delta** | Net points change (should be between -10 and +AVAILABLE_POINTS) |
| **Addresses Gap** | Which strategic weakness this addresses |
| **Tradeoffs** | What the army loses or risks with this change |
| **Reasoning** | Full explanation of why this improves the list |

### Data-Driven Unit Availability (v4.69.0)

To prevent hallucination of Legends or discontinued units:

1. **Both LLM calls receive the full datasheet list** - Strategic analysis and suggestions use the same available units data.
2. **Explicit availability rules** - LLM is instructed: "ONLY suggest units that have a full datasheet entry"
3. **No code filtering** - Availability is determined by database presence, not hardcoded lists

### Parent Faction Support (v4.69.0)

For subfactions using parent faction detachments (e.g., Space Wolves using Stormlance Task Force):

- `fetchDetachmentContext` searches both the faction AND its parent faction
- Stratagems and enhancements from parent faction detachments are correctly found
- Example: Space Wolves → Space Marines (parent) → Stormlance stratagems

### Example Suggestions

**Option 1 - Add TWC Leadership (High Priority):**
> Remove: Scout Squad (65pts)
> Add: Wolf Guard Battle Leader on Thunderwolf (100pts)
> Points Delta: +35pts
> Addresses: Leaderless Thunderwolves
> "Adds a character to lead the Thunderwolf Cavalry, enabling free stratagems and damage buffs."

**Option 2 - Ranged Anti-Tank (Medium Priority):**
> Remove: Intercessor Squad (80pts)
> Add: Long Fangs (145pts)
> Points Delta: +65pts
> Addresses: Ranged Anti-Tank Void
> "Provides dedicated anti-tank shooting to threaten vehicles from range without committing to melee."

### UI Display

Suggestions appear in the Dossier Report with:
- Option 1-4 headers with priority badges
- Short descriptive titles
- Unit visualization: removed units (red) → added units (green)
- Enhancement additions shown with target character
- Collapsible reasoning section for detailed explanation
- Points delta with +/- formatting

### HTML Export

List modification suggestions are included in the exported HTML report with:
- Full visual styling matching the app UI
- Unit icons embedded as base64 (or placeholder if not generated)
- Remove units shown in red, add units shown in green
- Enhancement additions with character targets
- Points delta with +/- formatting

## Dossier History & Sharing

⭐ **New in v4.62.0**

All dossier generations are automatically saved to the database after successful analysis, providing permanent URLs and sharing capabilities.

### Permanent URLs

- **`/dossier/{id}`** - Bookmarkable URL for your saved dossier. Works for owners and anyone with link access.
- **`/dossier/share/{token}`** - Shareable token-based URL. No authentication required to view.
- After generation completes, you're automatically redirected to the permanent URL.

### Visibility Levels

| Level | Description | Access |
|-------|-------------|--------|
| **Private** | Owner only | Only you can view via `/dossier/{id}` |
| **Link** | Shareable via token | Anyone with the share link can view |
| **Public** | Listed in gallery | Visible in public gallery + shareable via link |

### Share Modal

Click the **share icon** in the Army Identity Card (top-right corner, owner-only) to:
- Copy share link to clipboard
- Toggle visibility (private → link → public)
- Share to Twitter or Discord
- View current visibility status

### History Page

Navigate to **MY DOSSIERS** from the main menu to:
- See all your past dossier generations
- Filter by faction
- View thumbnails with spirit icons
- Quick actions: view, copy link, delete
- Pagination for large histories

### Public Gallery

Navigate to **PUBLIC GALLERY** from the main menu to:
- Browse all public dossiers
- Filter by faction
- Sort by recent (newest first) or popular (most views)
- Click any dossier to view full analysis

### View Counting

Public dossiers track view counts for popularity sorting. Each view increments the counter, helping discover trending lists.

## HTML Export

Generates a fully self-contained HTML file for offline viewing and sharing.

### Portability Features
- **Base64 Image Embedding**: ALL images (Army Spirit icon and unit icons) are embedded as data URIs. No internet connection is required to view the report once downloaded.
- **Static Synergy Network**: A static but representative version of the synergy network is included, showing connections, roles, and unit tiers.
- **Layout Parity**: The export layout mimics the `DossierReport.tsx` React component exactly, ensuring visual consistency between the app and the shared file.

### Accessibility & UX
- **High-Contrast Dark Theme**: Optimized for scanning in both dim and bright environments.
- **Readable Typography**: Standardized font weights and high-contrast color choices for labels and metadata.
- **Print-Friendly**: CSS includes print-specific media queries for physical tabletop reference.

The exported file can be shared via Discord, email, or any other platform without worrying about broken image links or data availability.

## Report Structure (v4.79.0)

⭐ **Updated v4.79.0** - Section Theming & Unit Profile Styling

The dossier report has been restructured to prioritize high-value content for competitive players seeking to improve their lists. Each section now has its own distinct color theme for easy visual scanning.

### Section Order & Theming (Top to Bottom)

| Section | Icon | Color | Default State | Purpose |
|---------|------|-------|--------------|---------|
| **Army Quirks** | ✦ | Amber | Expanded | 4 unique mechanical attributes with grim dark styling |
| **Unit Profiles by Role** | ⬢ | Green | Expanded | Units grouped by role with inline S&W badges |
| **List Modifications** | ⇄ | Orange | Expanded | AI-powered improvement suggestions |
| **Matchup Guide** | ⚔ | Blue | Expanded | Performance vs 8 opponent archetypes ⭐ v4.83.0 |
| **Unit Synergies** | ⟷ | Cyan | Collapsed | Interactive synergy network visualization |

> **Note (v4.86.0):** "Detailed Analysis" section removed. Playstyle/Combat Focus/Meta Readiness/Strengths summary were redundant with other sections.

### Inline Strengths & Weaknesses

Each unit role group (Hammers, Anvils, etc.) now displays relevant strengths and weaknesses as compact badges:

- **Strengths**: Green checkmark badges with title, full description in tooltip
- **Weaknesses**: Amber (moderate) or red (critical) warning badges
- Filtered by unit name matching within each role group
- Maximum 2 of each per role group to avoid clutter

### Army Quirks Styling

⭐ **v4.78.0 restyling** - Quirks now match the grim dark Mechanicus aesthetic:

- Orange corner accents (absolute positioned borders)
- Header with emoji and stat name
- Value displayed in orange badge
- Full descriptions visible (no truncation)
- 2×2 grid on desktop, stacked on mobile

### Collapsible Sections

All major sections are wrapped in the `Collapsible` component with color theming:

```tsx
<Collapsible title="Army Quirks" icon="✦" badge={4} badgeColor="amber" color="amber" defaultOpen={true}>
  <ArmyQuirksGrid funStats={funStats} />
</Collapsible>
```

The `color` prop supports: `green`, `orange`, `amber`, `blue`, `cyan`, `purple`. Each color theme applies:
- Corner accents (top corners full opacity, bottom corners muted)
- Title text color matching the theme
- Border color matching the theme
- Chevron icon color matching the theme

### Unit Profile Card Styling (v4.79.0)

⭐ **New in v4.79.0**

Unit profile cards have been updated for improved readability:

- **Corner Accents**: Orange bracket corners matching List Modifications style
- **Larger Text Sizes** (one Tailwind size bump):
  - Unit name: base (mobile) → lg (desktop)
  - Points: sm (mobile) → base (desktop), monospace font
  - Role badge: sm (mobile) → base (desktop)
  - Tactical summary: sm (mobile) → base (desktop)
- **Larger Icons**:
  - Custom images: 14×14 (mobile) → 16×16 (desktop)
  - Emoji fallbacks: 2xl (mobile) → 3xl (desktop)

## Technical Architecture

### Files Created/Updated

| File | Purpose |
|------|---------|
| `app/dossier/page.tsx` | Simplified paste-only form + async submission |
| `lib/dossierAnalysis.ts` | Three-pillar analysis engine + context builders |
| `lib/dossierExport.ts` | HTML export generator with base64 embedding + static synergy rendering |
| `lib/armyListParser.ts` | ⭐ v4.70.0 - Extracted core parsing logic for direct calls |
| `lib/dossierGenerator.ts` | ⭐ v4.70.0 - Extracted core analysis logic for direct calls |
| `lib/dossier/DossierNotificationContext.tsx` | ⭐ v4.70.0 - Global notification state with smart polling |
| `components/DossierReport.tsx` | UI display with export data preparation logic |
| `components/PendingDossierBadge.tsx` | ⭐ v4.70.0 - Header status badge (generating/ready/failed) |
| `components/DossierNotificationToast.tsx` | ⭐ v4.70.0 - Completion toast notifications |
| `components/dossier/DossierHero.tsx` | Dossier landing hero section (mobile-first) |
| `components/dossier/DossierSamplePreview.tsx` | Interactive sample dossier preview (no iframe) |
| `data/sample-dossier-response.json` | Static sample output used for preview rendering |
| `app/api/dossier/submit/route.ts` | ⭐ v4.70.0 - Async submission endpoint (returns immediately) |
| `app/api/dossier/status/route.ts` | ⭐ v4.70.0 - Polling endpoint for pending/completed status |
| `app/api/dossier/dismiss/route.ts` | ⭐ v4.70.0 - Mark notification as acknowledged |
| `lib/dossierGenerator.ts` | Core analysis logic with Gemini calls |
| `app/api/dossier/generate-spirit-icon/route.ts` | Army Spirit icon generation |
| `app/api/dossier/[id]/route.ts` | CRUD endpoints for saved dossiers |
| `app/api/dossier/list/route.ts` | User history endpoint |
| `app/api/dossier/public/route.ts` | Public gallery endpoint |
| `app/api/dossier/share/[token]/route.ts` | Share token access endpoint |
| `components/dossier/DossierShareModal.tsx` | Share modal with visibility controls |
| `components/dossier/DossierHistoryDropdown.tsx` | History dropdown component |
| `app/dossier/history/page.tsx` | History page |
| `app/dossier/gallery/page.tsx` | Public gallery page |
| `app/dossier/[id]/page.tsx` | View saved dossier page |
| `app/dossier/share/[token]/page.tsx` | Share token view page |

### Data Flow (Export)
```
User clicks EXPORT 
    → DossierReport prepares SynergyExportData (connections, units, tiers)
    → callback passed to DossierPage
    → DossierPage calls generateDossierHTML()
        → fetchImageAsBase64() fetches Spirit Icon URL → converts to data URI
        → fetchImagesAsBase64() fetches Unit Icons → converts to data URIs
        → generateUnitProfilesHTML() renders unit cards with embedded icons
        → generateSynergyNetworkHTML() renders static network visualization
        → generateDossierHTML() returns final self-contained string
    → Browser triggers download (.html)
```

### Types

```typescript
interface DossierAnalysis {
  faction: string | null;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  radarScores: RadarScores;
  mathHammer: MathHammerAnalysis;
  metaContext: MetaContextAnalysis;
  objectiveEcology: ObjectiveEcologyAnalysis;
  collectionGaps: CollectionGap[];
  keyStratagems: string[];
  threatAssessment: ThreatAssessment;
}

interface RadarScores {
  killingPower: number;    // 0-100
  durability: number;      // 0-100
  mobility: number;        // 0-100
  boardControl: number;    // 0-100
  flexibility: number;     // 0-100
}

// ⭐ NEW v4.44.0 - AI Strategic Analysis types
interface DossierStrategicAnalysis {
  executiveSummary: string;
  armyArchetype: {
    primary: string;
    secondary: string;
    description: string;
  };
  statisticalBreakdown: StatisticalBreakdown;
  strategicStrengths: StrategicStrength[];
  strategicWeaknesses: StrategicWeakness[];
  matchupConsiderations: MatchupConsideration[];
  secondaryRecommendations: SecondaryRecommendations;
  collectionRecommendations: CollectionRecommendation[];
  threatAssessment: ThreatAssessmentOutput;
  viralInsights: ViralInsights;  // ⭐ NEW v4.51.0
  unitTacticalSummaries: Record<string, string>; // ⭐ NEW v4.53.0
  unitRoleAssignments: Record<string, { role: TacticalRole; reasoning: string }>; // ⭐ NEW v4.53.0
}

// ⭐ NEW v4.51.0 - Viral Insights types
type PlaystyleArchetype = 
  | 'alpha_strike' | 'counterpunch' | 'castle' 
  | 'skirmisher' | 'grinder' | 'glass_cannon' | 'none';

// ⭐ NEW v4.53.0 - Expanded Tactical Roles
type TacticalRole = 
  | 'hammer' | 'anvil' | 'scoring' | 'screening' 
  | 'support' | 'skirmisher' | 'utility' | 'specialist';

interface FunStat {
  name: string;      // e.g., "Invuln Wall" (mechanical attribute)
  emoji: string;     // e.g., "🛡️"
  value: string;     // e.g., "4/5 Units" or "510pts" (quantified when possible)
  description: string;
}

interface ViralInsights {
  tagline: string;           // "The Iron Tide"
  spiritDescription: string; // Evocative one-liner
  funStats: FunStat[];       // 4 army quirks (mechanical attributes)
  armySpiritIconPrompt: string; // Prompt for icon generation
}

interface DossierContext {
  faction: string;
  detachment: string;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  radarScores: RadarScores;
  capabilities: {
    hasDeepStrike: boolean;
    hasScouts: boolean;
    hasInfiltrators: boolean;
    deepStrikeUnits: string[];
    scoutUnits: string[];
    infiltrateUnits: string[];
    flyUnits: string[];
  };
  mathHammer: { /* damage summaries */ };
  metaContext: { /* role distributions */ };
  objectiveEcology: { /* OC and action unit data */ };
  unitSummaries: UnitSummary[];
}
```

## Related Documentation

- [Dossier Async Endpoints](../api/DOSSIER_ASYNC_ENDPOINTS.md) - Submit/status/dismiss APIs
- [Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md) - How to import army lists
- [Damage Calculator](DAMAGE_CALCULATOR.md) - MathHammer calculation engine
- [Army Parser Datasheet System](ARMY_PARSER_DATASHEET_SYSTEM.md) - Parsing logic
- [MathHammer Calculator Enhancement](MATHHAMMER_CALCULATOR_ENHANCEMENT.md) - Damage math details
- [Unit Icon Generation](UNIT_ICON_GENERATION.md) - Related icon generation system
- [Langfuse Observability](LANGFUSE_OBSERVABILITY.md) - LLM trace debugging
