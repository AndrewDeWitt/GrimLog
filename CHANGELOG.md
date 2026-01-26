# Changelog

This file contains the **last 30 versions**. For older entries, see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

---

## [4.90.4] - 2026-01-19 - Brief Faction Selector

### Added

- **Faction dropdown on brief page:**
  - Required faction selector above the army list textarea
  - Fetches factions from `/api/factions` on page load
  - Styled to match Mechanicus theme with custom dropdown arrow
  - Button shows "Select a Faction" when no faction selected

- **Backend faction validation:**
  - `/api/brief/submit` now requires `factionId` in request body
  - Returns 400 error if faction not selected
  - Passes `factionId` to army parser for filtered datasheet matching

### Changed

- **Improved army parsing accuracy:**
  - Parser now filters datasheets by selected faction
  - Subfactions automatically include parent faction datasheets (e.g., Blood Angels gets Space Marines)
  - Reduces false matches from similarly-named units across factions

### Files Modified

- `app/brief/page.tsx` - Added faction state, fetch, dropdown UI, and submit validation
- `app/api/brief/submit/route.ts` - Added factionId to interface, validation, and parser call

### Verification

- ✅ `npm run lint` passes (only pre-existing warnings)
- ✅ `npx tsc --noEmit` compiles successfully

---

## [4.90.3] - 2026-01-19 - Brief Reliability: Timeout Handling & Polling Optimization

### Added

- **Auto-fail stuck briefs:**
  - Status endpoint now detects briefs stuck in pending/processing for >15 minutes
  - Automatically marks them as failed with "Generation timed out. Please try again."
  - Prevents indefinite "Generating..." state when background processing errors

- **Null guard for BriefReport:**
  - Component now handles null `analysis` prop gracefully during loading states
  - Prevents "Cannot destructure property 'faction' of 'analysis' as it is null" error

### Changed

- **Optimized polling intervals:**
  - Removed idle polling entirely - only polls when there are pending briefs
  - Initial polling: 20 seconds (since we know generation takes ~2 minutes)
  - After ~2 minutes: speeds up to 10 seconds as completion approaches
  - `triggerRefresh()` automatically starts polling when a new brief is submitted
  - **Before:** 12+ requests/min continuous (even when idle)
  - **After:** 0 requests/min when idle, 3-6 req/min when generating

### Files Modified

- `app/api/brief/status/route.ts` - Added 15-minute timeout detection
- `lib/brief/BriefNotificationContext.tsx` - Optimized polling logic
- `components/BriefReport.tsx` - Added null guard for analysis prop

### Verification

- ✅ `npm run lint` passes
- ✅ `npx tsc --noEmit` compiles successfully

---

## [4.90.2] - 2026-01-19 - Dead Code Cleanup: Brief Analyze Endpoint

### Removed

- **Deleted `/api/brief/analyze` endpoint (1,602 lines of dead code):**
  - Endpoint was completely unused after migration to async brief generation via `/api/brief/submit`
  - Submit endpoint calls `generateBrief()` directly from `lib/briefGenerator.ts` - no HTTP call needed
  - All business logic already extracted to `lib/briefGenerator.ts`

- **Deleted `docs/api/DOSSIER_ANALYZE_ENDPOINT.md`:**
  - Obsolete documentation for removed endpoint

### Changed

- **Configuration:**
  - `vercel.json` - Removed timeout config for deleted route

- **Documentation updates:**
  - `docs/features/LANGFUSE_OBSERVABILITY.md` - Removed analyze endpoint from traced endpoints table
  - `docs/features/API_SECURITY.md` - Updated rate limit and protected endpoints tables to reference `/submit`
  - `docs/features/TACTICAL_DOSSIER.md` - Updated to reference direct function calls via `/submit` flow
  - `docs/features/DOSSIER_CREDITS_SYSTEM.md` - Updated code example to reference `/submit`
  - `docs/features/COMPETITIVE_CONTEXT_PASTE.md` - Updated related docs link
  - `docs/README.md` - Updated API index and version history links
  - `docs/api/DOSSIER_HISTORY_API.md` - Updated auto-save reference and related docs
  - `docs/api/DOSSIER_ASYNC_ENDPOINTS.md` - Updated related docs link
  - `docs/api/USER_CREDITS_ENDPOINT.md` - Updated related docs link
  - `PRODUCTION_CHECKLIST.md` - Updated rate limit table

- **Code comments:**
  - `scripts/security-test.ps1` - Updated test to use `/api/brief/submit`
  - `app/api/brief/generate-spirit-icon/route.ts` - Updated comment
  - `lib/competitiveContextParser.ts` - Updated comment
  - `app/api/competitive/parse-from-text/route.ts` - Updated comment

### Verification

- ✅ `npm run lint` passes (only pre-existing warnings)
- ✅ `npx tsc --noEmit` compiles successfully
- ✅ Only CHANGELOG files contain historical `/api/brief/analyze` references

---

## [4.90.1] - 2026-01-19 - Full Langfuse Logging for Army Parse

### Changed

- **gemini-army-parse Langfuse Generation:**
  - Removed truncation from input logging - full system prompt and user content now captured
  - Removed truncation from output logging - complete AI response now captured
  - Added `systemPromptLength` and `userContentLength` to metadata for verification
  - Enables complete input/output visibility for evals and debugging

### Files Modified

- `lib/armyListParser.ts` - Full input/output logging in Langfuse generation

---

## [4.90.0] - 2026-01-19 - Langfuse LLM Cost Tracking

### Added

- **LLM Cost Tracking via Langfuse:**
  - All Gemini API calls now extract and report token usage (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`)
  - Token counts passed to Langfuse `generation.end()` for automatic cost calculation
  - Console logging of token usage for all LLM calls

- **Unified Brief Trace:**
  - Single trace (`brief-strategic-analysis-background`) encompasses entire brief generation flow
  - Army parsing step (`gemini-army-parse`) now tracked within same trace as brief analysis
  - Three LLM generations in one trace: army parse → brief analysis → suggestions

- **Langfuse Model Pricing Setup Script:**
  - New `scripts/setup-langfuse-models.ts` for one-time Langfuse pricing configuration
  - Configures Gemini model pricing: `gemini-3-flash-preview`, `gemini-3-pro-preview`
  - Run with: `npx tsx scripts/setup-langfuse-models.ts`

### Changed

- **Files with Token Tracking:**
  - `app/api/analyze/route.ts` - Voice analysis Gemini calls
  - `app/api/brief/analyze/route.ts` - Brief analysis + suggestions (streaming)
  - `app/api/brief/submit/route.ts` - Creates unified trace for background processing
  - `app/api/tactical-advisor/route.ts` - Tactical suggestions
  - `app/api/armies/parse/route.ts` - Army parsing via API
  - `lib/briefGenerator.ts` - Background brief generation (streaming)
  - `lib/armyListParser.ts` - Army parsing for brief flow
  - `lib/intentOrchestrator.ts` - Intent classification
  - `lib/competitiveContextParser.ts` - Competitive context extraction

- **Trace Architecture:**
  - `generateBrief()` accepts optional `trace` parameter for unified tracing
  - `parseArmyListFromText()` accepts optional `trace` parameter
  - Background brief flow creates trace at top level, passes to all steps

### Documentation

- Updated [Langfuse Observability](docs/features/LANGFUSE_OBSERVABILITY.md) with LLM cost tracking section

---

## [4.89.1] - 2026-01-18 - ESLint Error Fixes

### Fixed

- **Unsafe Regex Patterns (11 errors):**
  - Added bounded quantifiers (`\s{0,10}`, `\s{0,20}`) to prevent potential ReDoS
  - Added anchors (`^...$`) to dice formula and unit size patterns
  - Files: `armies/parse/route.ts`, `UnitBuilder.tsx`, `armyListParser.ts`, `damageCalculation.ts`, `briefAnalysis.ts`, `weaponRulesEngine.ts`, `migrate-weapon-data.ts`, `patchPointsTiers.ts`
  - Added eslint-disable comments with justification (controlled datasheet input)

- **ESLint Rule Definition Errors (2 errors):**
  - `api/brief/[id]/route.ts`: Replaced `any` type with `Record<string, unknown>`
  - `lib/auth/adminAuth.ts`: Renamed unused deprecated function with `_` prefix

- **React Unescaped Entities (2 errors):**
  - `BriefHistoryDropdown.tsx`: Escaped `"` as `&quot;` in JSX

### Changed

- **Capture Group Optimization:**
  - `damageCalculation.ts`: Changed outer group to non-capturing `(?:...)`, updated reference from `match[4]` to `match[3]`

---

## [4.89.0] - 2026-01-18 - Security Scanning & DevSecOps

### Added

- **Security Scanning Workflow:**
  - `npm run security:audit` - Dependency vulnerability scanning
  - `npm run security:secrets` - Gitleaks secret detection
  - `npm run security:semgrep` - Static code analysis
  - `npm run security:all` - Run all security checks

- **Pre-commit Hooks (Husky):**
  - Automatic secret detection before commits via Gitleaks
  - ESLint with security rules on staged files via lint-staged
  - Blocks commits containing hardcoded secrets

- **GitHub Actions Security Pipeline:**
  - `.github/workflows/security.yml` - Automated CI security scanning
  - Runs on push/PR to master + weekly scheduled scans
  - npm audit, Gitleaks, Semgrep, ESLint security checks

- **ESLint Security Plugin:**
  - Added `eslint-plugin-security` with 14 security rules
  - Detects: object injection, unsafe regex, eval, child_process, etc.
  - Flat config format (`eslint.config.mjs`)

- **Gitleaks Configuration:**
  - `.gitleaks.toml` with Supabase-specific secret patterns
  - Custom rules for service role keys and JWT secrets

### Changed

- **ESLint Configuration:**
  - Migrated from `.eslintrc.json` to `eslint.config.mjs` (flat config)
  - `npm run lint` now uses ESLint directly instead of `next lint`

### Fixed

- **Supabase Database Security (TacLog + TacLogProd):**
  - Disabled RLS on all 43 tables (not needed for Prisma-only access)
  - Removed orphaned RLS policies
  - Revoked `anon` and `authenticated` role access to all tables
  - Direct PostgREST access now blocked; Prisma connection unaffected

### Documentation

- Added [Security Scanning Guide](docs/guides/SECURITY_SCANNING_GUIDE.md)

---

## [4.88.0] - 2026-01-18 - Security Hardening & Production Readiness

### Security Fixes

- **CRITICAL: Authorization Bypass Fixed**
  - `POST /api/sessions/[id]/manual-action` now verifies session ownership
  - Previously any authenticated user could manipulate any session
  - Added `verifySessionAccess()` check using shared utility from parent route

- **Database Security:**
  - Enabled RLS on `BriefGeneration` table (was ERROR, now INFO)
  - Defense-in-depth: direct client access blocked even if anon key exposed

- **Input Validation:**
  - All `JSON.parse()` calls now wrapped in try-catch with safe defaults
  - Numeric query params (`limit`, `offset`, `minPoints`, `maxPoints`) validated against NaN
  - Removed `error.meta` from client responses (was leaking DB schema)

- **Debug Logging:**
  - Gemini response logging in `aiProvider.ts` now gated to development mode only

### Added

- **Global API Rate Limiting:**
  - All API routes now rate-limited at 120 req/min per user (or IP if unauthenticated)
  - Applied via Next.js middleware using Vercel KV/Redis (when configured)
  - Fails open if KV unavailable (individual endpoint limits still apply)

- **Public Endpoint Rate Limiting:**
  - `/api/brief/public`, `/api/armies/public`, `/api/datasheets/public`
  - 60 req/min per IP address
  - Returns 429 with `Retry-After` header when exceeded

- **Rate Limit Headers:**
  - `X-RateLimit-Remaining` added to all API responses (when KV configured)
  - `Retry-After` header on 429 responses

### Changed

- **Rate Limit Configuration:**
  - Added `publicGallery` limit (60/min) to `lib/rateLimit.ts`
  - Added `globalApi` limit (120/min) to both in-memory and Redis configs
  - Exported `verifySessionAccess()` from session route for reuse

### Files Modified

- `app/api/sessions/[id]/route.ts` - Export `verifySessionAccess()`
- `app/api/sessions/[id]/manual-action/route.ts` - Add authorization check
- `lib/aiProvider.ts` - Gate debug logging to development
- `lib/rateLimit.ts` - Add `publicGallery` and `globalApi` configs
- `lib/rateLimitRedis.ts` - Add `globalApi` Redis limiter
- `lib/datasheetHelpers.ts` - Add `safeJsonParse()` helper
- `app/api/armies/import/[shareToken]/route.ts` - Safe JSON parsing
- `app/api/armies/route.ts` - Remove `error.meta` from response
- `app/api/armies/public/route.ts` - Rate limiting + safe numeric parsing
- `app/api/brief/public/route.ts` - Rate limiting + safe numeric parsing
- `app/api/datasheets/public/route.ts` - Rate limiting + safe JSON/numeric parsing
- `middleware.ts` - Global API rate limiting

### Database Migrations

- `enable_rls_brief_generation` - Enable RLS on BriefGeneration table

---

## [4.87.0] - 2026-01-18 - Brief Editing & Versioning System

### Added
- **Brief Editing System:**
  - Inline editing for all AI-generated content (quirks, unit summaries, matchups, list suggestions)
  - Edit mode toggle via kebab menu (⋮) with Edit, History, Share options
  - EditableText component for inline text/multiline editing
  - EditableSelect component for dropdown fields (roles, archetypes, ratings)

- **Version History:**
  - Every save creates a version snapshot (simplified from separate Save/Version buttons)
  - SaveVersionModal with optional label and changelog fields
  - BriefVersionHistoryPanel slide-out showing all versions
  - Restore any previous version (creates new version with restored content)
  - v1 "AI Generated" snapshot auto-created on brief generation
  - Synthetic v1 display for legacy briefs created before versioning

- **Auto-Save & Recovery:**
  - localStorage auto-save every 30 seconds while editing
  - WIPRecoveryModal prompts to restore unsaved work on page load
  - beforeunload warning when leaving with unsaved changes

- **UI Components:**
  - BriefActionsMenu (kebab menu) consolidating Edit, History, Share
  - BriefEditToolbar with stacked Editing/Unsaved labels (mobile-optimized)
  - Full-width "Remove" buttons on own row (quirks, matchups) - clearer, harder to accidentally click

### Fixed
- **listSuggestions null bug:** Only send edited fields in PATCH payload (was overwriting with null)
- **Hydration error:** Changed nested button to div with role="button" in MatchupGuide
- **Toolbar overflow:** Stacked layout and reduced padding for mobile screens
- **Dropdown scrollbars:** Removed max-height constraint from EditableSelect

### Changed
- **Simplified versioning:** Removed separate "Save" vs "Save as Version" - all saves create versions
- **Remove button styling:** Brighter red background (20% opacity), clearer visibility

### Database
- Added `BriefVersion` model for version snapshots
- Added `currentVersion`, `isEdited`, `lastEditedAt` fields to `BriefGeneration`

### API
- Extended `PATCH /api/brief/[id]` for content edits with optional version creation
- Added `GET/POST /api/brief/[id]/versions` for version management
- Added `POST /api/brief/[id]/versions/[versionNumber]/restore` for restoration

### Technical
- **New Files:**
  - `components/brief/BriefActionsMenu.tsx`
  - `components/brief/BriefEditToolbar.tsx`
  - `components/brief/EditableText.tsx`
  - `components/brief/EditableSelect.tsx`
  - `components/brief/SaveVersionModal.tsx`
  - `components/brief/BriefVersionHistoryPanel.tsx`
  - `components/brief/WIPRecoveryModal.tsx`
  - `hooks/useBriefAutoSave.ts`
  - `app/api/brief/[id]/versions/route.ts`
  - `app/api/brief/[id]/versions/[versionNumber]/route.ts`
  - `app/api/brief/[id]/versions/[versionNumber]/restore/route.ts`

- **Modified Files:**
  - `app/brief/[id]/page.tsx` - Edit mode state, version management, WIP recovery
  - `components/BriefReport.tsx` - Pass edit mode props to children
  - `components/brief/report/ArmyQuirksGrid.tsx` - Inline editing, add/remove quirks
  - `components/brief/report/UnitRoleGroup.tsx` - Editable role dropdown, tactical summary
  - `components/brief/report/ListSuggestionsSection.tsx` - Editable suggestions
  - `components/brief/report/MatchupGuide.tsx` - Editable matchups with dropdowns
  - `lib/briefGenerator.ts` - Auto-create v1 snapshot on generation
  - `prisma/schema.prisma` - BriefVersion model

---

## [4.86.0] - 2026-01-18 - Brief Simplification & Langfuse Full Logging

### Removed
- **Detailed Analysis Section:**
  - Removed entire "Detailed Analysis" collapsible from brief report UI
  - Removed `PlaystyleCombatSection` component (Playstyle blend, Combat Focus slider, Meta Readiness)
  - Removed `StrengthsWeaknesses` summary component (redundant with inline S&W in Unit Profiles)
  - Removed `CollectionGapsSection` component
  - Strengths & Weaknesses remain visible contextually within each role group in Unit Profiles

- **AI Schema Fields:**
  - Removed `playstyleBlend` from viralInsights (grinder/alpha_strike percentages)
  - Removed `combatSpectrum` from viralInsights (melee/ranged percentage)
  - Reduced token usage by ~200 tokens per generation

### Fixed
- **Langfuse Full JSON Logging:**
  - System prompt now logged in full (was truncated to 500 chars)
  - User prompt now logged in full (was showing only char count)
  - AI response now logged in full (was showing only char count)
  - Enables proper debugging and prompt iteration in Langfuse traces

### Technical
- **Deleted Files:**
  - `components/brief/report/PlaystyleCombatSection.tsx`
  - `components/brief/report/StrengthsWeaknesses.tsx`
  - `components/brief/report/CollectionGapsSection.tsx`

- **Modified Files:**
  - `components/BriefReport.tsx` - Removed Detailed Analysis section and unused imports
  - `components/brief/report/index.ts` - Removed deleted component exports
  - `lib/briefGenerator.ts` - Removed playstyle/combatSpectrum from schema, fixed Langfuse logging
  - `lib/briefAnalysis.ts` - Removed PlaystyleArchetype type, updated ViralInsights interfaces and parsing
  - `lib/briefExport.ts` - Removed playstyle section from HTML export

---

## [4.85.0] - 2026-01-17 - Matchup Guide Mobile UX & Accessibility

### Fixed
- **Schema Mismatch:** Updated AI schema archetypes to match component
  - `psyker_heavy` → `skirmish_msu` (fixes "❓" fallback icons)
  - `balanced` → `attrition`

### Changed
- **Accessibility Improvements:**
  - Increased all text sizes from `text-xs` to `text-sm` for better readability
  - Brightened preview text from `text-gray-400` to `text-gray-200`
  - Removed all text truncation - full content always visible

- **Visual Hierarchy:**
  - Color-coded archetype labels (each type has unique color for quick scanning)
    - Horde (amber), Elite (blue), Vehicles (purple), Monsters (emerald)
    - Skirmish (cyan), Melee Rush (red), Gunline (orange), Attrition (slate)
  - Stronger dividers between matchups (30% opacity vs 10%)
  - Increased vertical spacing between rows for clearer separation

- **Mobile UX:**
  - Reduced container padding for more content space
  - Removed left indentation on expanded content

- **Interaction Changes:**
  - Removed "Show more/less" - all matchups always visible
  - Multi-select expansion - can open multiple matchups simultaneously

### Technical
- **Modified Files:**
  - `lib/briefGenerator.ts` (fixed archetype enum)
  - `components/brief/report/MatchupGuide.tsx` (all UI/UX changes)

---

## [4.84.0] - 2026-01-17 - Matchup Guide Enhancements (Win Conditions & Battle Plans)

### Added
- **Win Condition Framework:** Each matchup now includes a strategic win condition enum
  - `outscore`: Win on Primary/Secondary when you can't kill efficiently
  - `tabling`: Mathematical removal of opponent's army is achievable
  - `attrition`: Grind them down over 5 turns
  - `alpha_strike`: Cripple them T1-2 before they respond
  - `denial`: Prevent their win condition (kill scoring, screen deep strike)
  - Displayed as color-coded badge in UI (blue/red/amber/purple/cyan)

- **Battle Plan Field:** One-sentence synthesis combining:
  - Target priority (what to kill/do to win)
  - Commitment window (when to do it)
  - Resource to deplete (if applicable: CP, Fate Dice, Cabal Points, Miracle Dice)
  - Example: "Alpha strike their Characters T1-2 to collapse Cabal Point generation, then outscore on Primary"

- **Stat Check Awareness (Prompt Enhancement):** AI now identifies binary pass/fail thresholds
  - "Can you kill their toughest model in one turn?" (Knights, C'tan, Avatar)
  - Halve-damage and damage reduction awareness (D6 → D3 weapon degradation)
  - Conclusions included in matchup reasoning

- **Resource Economy Guidance (Prompt Enhancement):** AI identifies opponent's limiting resource
  - Aeldari: Fate Dice (finite pool, bait on chaff)
  - Thousand Sons: Cabal Points (kill Characters to reduce generation)
  - Sisters: Miracle Dice (deny easy kills to limit generation)
  - All armies: CP (bait defensive strats on low-value units)

- **Phased Tips Enhancement:** keyTips now include temporal markers
  - DEPLOYMENT: Positioning and reserves
  - EARLY GAME (T1-2): Screening, bait plays, resource denial
  - COMMITMENT (T2-3): When to drop reserves, commit charges
  - TARGET PRIORITY: What to kill first and why

- **`DISABLE_SPIRIT_ICON` Environment Variable:** Set to `true` to skip spirit icon generation during testing
  - Reduces costs when iterating on brief prompts
  - Affects both `/api/brief/analyze` route and background processor

- **Comprehensive Langfuse Tracing:** Added detailed spans to brief generation
  - `db-lookup-faction-detachment`
  - `enrich-army-from-database`
  - `fetch-faction-competitive-context`
  - `fetch-detachment-context`
  - `fetch-faction-datasheets`
  - `parse-ai-response`
  - `save-brief-to-database`
  - Applied to both route handler and background generator

### Changed
- **Matchup UI:** Battle plan shown as preview text when collapsed, highlighted when expanded
- **Tips Label:** Renamed from "Tips" to "Phased Tips" in expanded matchup view

### Technical
- **Modified Files:**
  - `lib/briefGenerator.ts` (schema: added winCondition, battlePlan; tracing spans)
  - `lib/briefAnalysis.ts` (types + prompt guidance for stat checks, resource economy, phased tips)
  - `lib/types.ts` (added competitiveContext to ParsedDatasheet interface)
  - `app/api/brief/analyze/route.ts` (schema update, tracing spans, DISABLE_SPIRIT_ICON check)
  - `components/brief/report/MatchupGuide.tsx` (winCondition badge, battlePlan display)

---

## [4.83.0] - 2026-01-16 - Matchup Guide (Replaces Strategic Assessment)

### Changed
- **Strategic Assessment → Matchup Guide:** Replaced dense text paragraph with scannable matchup ratings
  - Shows performance vs 8 opponent archetypes with color-coded bars (green/yellow/red)
  - Each matchup includes rating, reasoning, and actionable tips
  - Sorted by favorability (best matchups first)
  - Default shows top 4, expandable to see all 8
  - Removed archetype tags (SKEW, MELEE FOCUSED) - funStats already convey this better

- **Updated Matchup Archetypes for 10th Edition:**
  - Removed `psyker_heavy` → Replaced with `skirmish_msu` (Drukhari, Aeldari MSU)
  - Removed `balanced` → Replaced with `attrition` (Death Guard, Necrons grind armies)
  - Full list: horde, elite, vehicles, monsters, skirmish, melee rush, gunline, attrition

- **AI Prompt Enhancement:** Added explicit guidance requiring all 8 matchups with list-specific analysis
  - Good/bad examples to prevent generic faction advice
  - Each matchup must include specific unit names, stratagems, and tactical tips

### Added
- **New Component:** `components/brief/report/MatchupGuide.tsx`
  - Expandable matchup rows with icons and rating bars
  - Fallback handling for legacy archetype values (backward compatible)

### Technical
- **Modified Files:**
  - `components/brief/report/MatchupGuide.tsx` (NEW)
  - `components/brief/report/index.ts` (added export)
  - `components/BriefReport.tsx` (replaced Strategic Assessment section)
  - `lib/briefAnalysis.ts` (updated types + prompt guidance)
  - `app/api/brief/analyze/route.ts` (updated JSON schema enum)

---

## [4.82.0] - 2026-01-15 - Brief Report UX Improvements

### Changed
- **Unit Profile Cards (UnitRoleGroup):**
  - Removed text truncation from unit names - full names now display
  - Removed text truncation from tactical summaries - full text visible
  - Changed tactical summary from italic amber to regular gray-200 for better readability
  - Removed decorative curly quotes from summaries
  - Reorganized unit header layout: name on own line, points + role combined below with dot separator
  - Cleaner visual hierarchy with semantic h4 for unit names

- **List Modifications Section (ListSuggestionsSection):**
  - Made suggestion titles more prominent: larger (text-base), bolder (font-bold), semantic h4 tag
  - Removed title truncation
  - Softened chip backgrounds: `bg-red-500/10`, `bg-green-500/10`, `bg-amber-500/10`
  - Brightened chip text: unit names now `text-gray-100` for better contrast
  - Lighter accent colors for points: `text-red-300`, `text-green-300`
  - Changed labels (Addresses, Analysis, Trade-offs, Reasoning) from dark gray to `text-taclog-orange`
  - Improved body text contrast: `text-gray-200` for trade-offs and reasoning
  - Increased chip padding and spacing for better touch targets
  - Enhanced arrow in enhancement chips with proper arrow entity

### Technical
- **Modified Files:**
  - `components/brief/report/UnitRoleGroup.tsx`:
    - Removed `truncate` and `line-clamp-*` classes
    - Changed `text-taclog-amber italic` to `text-gray-200`
    - Restructured header flex layout
  - `components/brief/report/ListSuggestionsSection.tsx`:
    - Updated all chip styling classes
    - Changed label colors from `text-gray-400` to `text-taclog-orange`
    - Increased header padding and title font size

---

## [4.81.0] - 2026-01-15 - Brief Share Icon Relocation

### Changed
- **Share Button Moved to Army Identity Card:**
  - Removed sticky footer bar with Share/Export buttons
  - Share icon now appears in top-right corner of the Army Identity Card
  - Only visible to brief owner (`isOwner` check)
  - Uses standard share icon (three connected nodes)
  - Responsive sizing: 24px (mobile) → 32px (desktop)

- **Export Button Removed:**
  - Export functionality removed from brief view page UI
  - Reserved as potential premium feature

### Technical
- **Modified Files:**
  - `app/brief/[id]/page.tsx`:
    - Removed sticky footer component (lines 217-238)
    - Added share button inside Army Identity Card with absolute positioning
    - Added `pr-10` padding to text container to prevent collision with share icon
    - Removed `pb-20` padding from scrollable content area

---

## [4.80.0] - 2026-01-15 - Unit Profile Role-Specific Colors

### Changed
- **Role Section Visual Separation:**
  - Each tactical role (Hammers, Anvils, Skirmishers, etc.) now has distinct border accent colors
  - Hammers: Red, Anvils: Blue, Skirmishers: Yellow, Support: Purple, Scoring: Green, Utility/Screening: Cyan, Specialists: Amber
  - Increased spacing between role sections (`space-y-4`) for better visual separation

### Technical
- **Modified Files:**
  - `components/ui/Collapsible.tsx` - Added `red` and `yellow` to SectionColor type and SECTION_COLORS config, exported SectionColor type
  - `components/brief/report/UnitRoleGroup.tsx` - Added `sectionColor` field to ROLE_CONFIG mapping each role to its section color
  - `components/BriefReport.tsx` - Pass `color={config.sectionColor}` to role Collapsibles, increased spacing from `space-y-2` to `space-y-4`

---

## [4.79.0] - 2026-01-15 - Brief Section Theming & Unit Profile Styling

### Added
- **Section Color Theming:**
  - Each brief section now has its own distinct color theme with corner accents
  - Color prop added to Collapsible component: `green`, `orange`, `amber`, `blue`, `cyan`, `purple`
  - All sections display themed corner brackets, title text, and borders

- **New Section Icons:**
  - Army Quirks: ✦ (amber theme)
  - Unit Profiles: ⬢ (green theme)
  - List Modifications: ⇄ (orange theme)
  - Strategic Assessment: ◎ (blue theme)
  - Unit Synergies: ⟷ (cyan theme)
  - Detailed Analysis: ≡ (purple theme)

### Changed
- **Unit Profile Card Styling:**
  - Added orange corner accents to unit cards (matching List Modifications style)
  - Increased text sizes across all elements (one Tailwind size bump)
  - Unit name: sm → base (mobile), base → lg (desktop)
  - Points: xs → sm (mobile), xs → base (desktop), now uses monospace font
  - Role badge: xs → sm (mobile), sm → base (desktop)
  - Tactical summary: xs → sm (mobile), sm → base (desktop)
  - Unit icons: 12×12 → 14×14 (mobile), 14×14 → 16×16 (desktop)
  - Emoji icons: xl → 2xl (mobile), 2xl → 3xl (desktop)

### Technical
- **Modified Files:**
  - `components/ui/Collapsible.tsx` - Added `color` prop with 6 theme options, all sections now have corner accents
  - `components/BriefReport.tsx` - Updated all section icons and added color props
  - `components/brief/report/UnitRoleGroup.tsx` - Corner accents, increased text/icon sizes, monospace points

---

## [4.78.0] - 2026-01-15 - Brief Report Restructure

### Added
- **4 Army Quirks (expanded from 2):**
  - AI schema updated to generate funStat3 and funStat4
  - Parsing updated to include all 4 quirks in funStats array
  - Prompt instructions updated to request 4 mechanical attributes

- **Inline Strengths & Weaknesses per Role Group:**
  - UnitRoleGroup now receives `relevantStrengths` and `relevantWeaknesses` props
  - S&W filtered by unit name matching per role group
  - Displayed as compact badges above unit cards
  - Green checkmark badges for strengths, amber/red for weaknesses
  - Tooltips show full descriptions

- **Exported Type Definitions:**
  - `StrategicStrength` interface exported from briefAnalysis.ts
  - `StrategicWeakness` interface exported from briefAnalysis.ts
  - Enables type-safe cross-component usage

### Changed
- **All Sections Now Fully Collapsible:**
  - Army Quirks wrapped in Collapsible (defaultOpen: true)
  - Unit Profiles wrapped in Collapsible (defaultOpen: true)
  - Strategic Assessment wrapped in Collapsible (defaultOpen: true)
  - Unit Synergies wrapped in Collapsible (defaultOpen: false)
  - Detailed Analysis section (defaultOpen: false) containing:
    - PlaystyleCombatSection
    - StrengthsWeaknesses summary
    - CollectionGapsSection

- **New Section Order (Top to Bottom):**
  1. Army Quirks (4 cards, expanded)
  2. Unit Profiles by Role (expanded with inline S&W)
  3. List Modifications (featured, expanded)
  4. Strategic Assessment (expanded)
  5. Unit Synergies (collapsed)
  6. Detailed Analysis (collapsed)

- **Army Quirks Grim Dark Restyling:**
  - Mechanicus corner accents (orange borders, absolute positioned)
  - Header with emoji and name separated from content
  - Value displayed in orange badge
  - No text truncation (full descriptions visible)
  - Consistent styling with List Modifications cards

### Technical
- **Modified Files:**
  - `lib/briefGenerator.ts` - Added funStat3/4 to DOSSIER_RESPONSE_SCHEMA and required array
  - `lib/briefAnalysis.ts` - Extended ViralInsightsRaw, parseViralInsights, updated prompt from 2→4 quirks
  - `components/brief/report/ArmyQuirksGrid.tsx` - Complete restyling, removed .slice(0,2)
  - `components/BriefReport.tsx` - Wrapped all sections in Collapsible, new section order
  - `components/brief/report/UnitRoleGroup.tsx` - Added inline S&W display with new props

---

## [4.77.0] - 2026-01-15 - List Modifications Section Enhancement

### Changed
- **List Modifications Prominence:**
  - Moved section to first position in collapsible container (was last)
  - Now expanded by default (`defaultOpen: true`)
  - Added "featured" variant styling with orange corner accents
  - New swap arrows icon (⇄) reflecting unit trade concept

- **Collapsible Component - Featured Variant:**
  - New `variant="featured"` prop for prominent sections
  - Mechanicus-style corner accents (orange, 2px borders)
  - Orange border color scheme vs green for default
  - Larger icon size (text-3xl) with white color
  - Orange title text and chevron

- **ListSuggestionsSection Mobile Styling:**
  - Vertical stacking layout (`flex-col`) for cleaner mobile display
  - Mechanicus terminal aesthetic with corner accents on cards
  - Monospace labels: ADDRESSES:, TRADE-OFFS:, REASONING:
  - Collapsible [ANALYSIS] section for details
  - Compact padding (p-2 max) for mobile efficiency

### Technical
- **Modified Components:**
  - `components/ui/Collapsible.tsx` - Added featured variant with corner accents
  - `components/BriefReport.tsx` - Reordered sections, added featured variant
  - `components/brief/report/ListSuggestionsSection.tsx` - Complete restyling

---

## [4.76.0] - 2026-01-14 - Brief Report Mobile-First Refactor

### Changed
- **Army Identity Card Redesign:**
  - Larger spirit icon (24x24 mobile, 28x28 desktop) without decorative corner brackets
  - Faction name now primary emphasis (orange, uppercase)
  - Detachment on separate line (amber-400)
  - Tagline toned down to secondary gray text
  - Removed stats badges (points/units/models) from identity card
  - Stronger card border (border-2 border-taclog-steel/50)

- **Text Contrast Improvements (Accessibility):**
  - All body text changed from `taclog-steel` to `gray-300` for better readability
  - Updated across all report components:
    - PlaystyleCombatSection (playstyle descriptions, combat spectrum text)
    - ArmyQuirksGrid (quirk descriptions)
    - StrengthsWeaknesses (detail text, expand button)
    - CollectionGapsSection (suggestions, empty state)
    - ListSuggestionsSection (arrows, details, tradeoffs, reasoning)
    - UnitRoleGroup (points cost, tactical reasoning)
    - BriefReport (instruction text, footer)

- **Navigation Simplified:**
  - Removed back button / breadcrumb navigation
  - Users navigate via gear menu → "MY DOSSIERS" (consistent with global nav pattern)

- **Floating Action Bar:**
  - Share and Export buttons moved to fixed bottom bar
  - Consistent positioning across all scroll positions

### Removed
- Decorative corner brackets on spirit icon
- Stats badges from identity card header
- Separate back navigation elements

---

## [4.75.0] - 2026-01-13 - My Briefs Page Redesign

### Added
- **Gallery-Style My Briefs Page:**
  - Grid layout matching Public Gallery (2→3→4 columns responsive)
  - CRT terminal aesthetic with orange theme (vs green for public)
  - Scanlines overlay and atmospheric gradients
  - Corner bracket accents on header

- **Rich Filtering System:**
  - Search by name/tagline (300ms debounced)
  - Faction filter with icons
  - Detachment filter (when faction selected)
  - Points range filter (All, 1000, 1500, 2000)
  - Visibility filter (Private/Link/Public)
  - Sort options (Newest/Most Views/Oldest)

- **Bulk Actions:**
  - Selection mode toggle in header
  - Multi-select briefs with checkbox overlay
  - Bulk delete with confirmation
  - Bulk visibility change (Private/Link/Public)
  - Fixed bottom toolbar when items selected
  - Select All / Clear selection buttons

- **Inline Rename:**
  - Click brief title to edit
  - Save on Enter/blur, Cancel on Escape
  - Optimistic UI update with API sync

- **Visual Distinction for Private Briefs:**
  - Reduced opacity (80%)
  - Grayscale filter on hero image (30%)
  - Lock icon badge in top-left
  - Steel-colored border (vs archetype color)

- **Mobile Optimizations:**
  - Faction dropdown always visible
  - Filter button with active count badge
  - Slide-up panel for all filters + search + visibility
  - Safe area insets for notched phones

- **New API Endpoint:**
  - `POST /api/brief/bulk` - Bulk delete or visibility change

### Changed
- **API Response (`/api/brief/list`):**
  - Added `detachment` filter parameter
  - Added `minPoints`/`maxPoints` filter parameters
  - Added `sort` parameter (recent/popular/oldest)
  - Added `search` parameter (searches listName)
  - Added `visibility` filter parameter
  - Response includes `detachments[]` and `factionMeta`

### Technical
- **New Components:**
  - `components/brief/BriefCard.tsx` - Reusable gallery card with selection/rename
  - `components/brief/BulkActionsToolbar.tsx` - Fixed bottom bulk actions bar
  - `components/brief/MyBriefsMobileFilterPanel.tsx` - Mobile filter slide-up panel

- **Modified Files:**
  - `app/brief/history/page.tsx` - Complete rewrite with gallery layout
  - `app/api/brief/list/route.ts` - Extended with filters, sort, search
  - `components/brief/index.ts` - Export new components

---

## [4.74.0] - 2026-01-12 - Gallery Filter Redesign

### Added
- **Icon-Rich Filter Dropdowns:**
  - New `GalleryFilterDropdown` component with portal-based dropdown
  - Faction icons displayed in dropdown (custom URL or SVG fallback)
  - Green terminal styling with corner accents and search capability
  - Keyboard navigation support (Arrow keys, Enter, Escape)

- **New Filter Components:**
  - `FactionIconImage` - Renders custom faction icons with SVG fallback
  - `PointsRangeDropdown` - Filter by points (All, 1000, 1500, 2000)
  - `MobileFilterPanel` - Slide-up panel for mobile filter controls

- **Detachment Filter:**
  - Filter briefs by detachment name
  - Only visible when a specific faction is selected
  - Clears automatically when faction changes

- **Admin Icon Upload:**
  - Faction admin page now has dedicated icon URL input
  - Preview shows custom icon or fallback SVG
  - Icon URLs stored in faction `metaData.iconUrl`

- **Mobile-First Design:**
  - Faction dropdown always visible with filter button on right
  - Other filters (Detachment, Points, Sort) in slide-up panel
  - Inline chip selection for Points and Sort
  - Scrollable list for Detachment options

### Changed
- **API Response:**
  - Added `detachments: string[]` array for filter options
  - Added `factionMeta: Record<string, { iconUrl?: string }>` for icons
  - New query params: `detachment`, `minPoints`, `maxPoints`

- **Points Ranges:** Simplified to All, 1000, 1500, 2000

- **Icon Contrast:** Added `text-green-400` and drop-shadow to SVG fallback for better visibility on dark backgrounds

### Technical
- **New Files:**
  - `components/gallery/GalleryFilterDropdown.tsx`
  - `components/gallery/FactionIconImage.tsx`
  - `components/gallery/PointsRangeDropdown.tsx`
  - `components/gallery/MobileFilterPanel.tsx`
  - `components/gallery/index.ts`

- **Modified Files:**
  - `app/brief/gallery/page.tsx` - Replaced native selects with new components
  - `app/admin/factions/[id]/page.tsx` - Added icon URL upload UI
  - `app/api/brief/public/route.ts` - Added filter params and metadata

---

## [4.73.0] - 2026-01-12 - Brief Gallery Revamp

### Added
- **CRT Terminal Header:**
  - Green terminal aesthetic with scanlines overlay
  - Corner bracket accents matching Warhammer 40K tech-priest style
  - Subtle green glow effect behind header
  - "++ TACTICAL INTELLIGENCE ARCHIVE ++" subtitle

- **Showcase Card Design:**
  - Spirit icon as hero element (full square, hover zoom effect)
  - Color-coded borders based on archetype (purple=elite, green=horde, etc.)
  - Points badge (orange, top-left corner)
  - View count badge (top-right corner)
  - Archetype badge with icon overlay on image
  - Title at bottom with gradient overlay for readability
  - Tagline in footer section

- **Fixed Layout System:**
  - Header section always visible (fixed position)
  - Only card grid area scrolls
  - Clean separation between navigation and content

- **Visual Effects:**
  - Page-wide scanlines overlay (3% opacity CRT effect)
  - Atmospheric green/orange radial gradients
  - Card hover: scale effect, orange border, shadow glow

### Changed
- **Generate Button:** Simplified to clean orange button with subtle hover glow
- **Card Grid:** 2 columns on mobile, 3 on tablet, 4 on desktop
- **API Response:** Added `playstyleBlend`, `combatSpectrum`, `totalWounds` fields

### Technical
- **Files Modified:**
  - `app/brief/gallery/page.tsx` - Complete UI redesign
  - `app/api/brief/public/route.ts` - Extended response fields

---

## [4.72.0] - 2026-01-12 - Brief Page Max-Width Layout

### Changed
- **Brief Page Layout:**
  - Added max-width constraint (1200px) to content area for better readability on large screens
  - Content is now centered horizontally on wide displays
  - Background gradient still extends full width for visual continuity
  - Smaller screens (<1200px) unaffected - content uses full available width

### Technical
- **Files Modified:**
  - `app/brief/page.tsx` - Added centered max-width container wrapper

---

## [4.71.0] - 2026-01-11 - Brief Page & Navigation UI Polish

### Changed
- **Brief Page Redesign:**
  - Removed "Tactical Brief" header for cleaner look
  - Added minimal status bar with "Ready" indicator and pulsing dot
  - Changed label to "Paste Army List Below" for clearer guidance
  - Moved credits display near the submit button
  - Added "Browse Gallery →" link below submit button
  - Improved placeholder text visibility (`taclog-light-steel/50`)
  - Improved secondary text readability (`taclog-light-steel` instead of `taclog-steel`)
  - Removed distracting textarea focus glow, kept button glow

- **Global Header Improvements:**
  - Fixed header height to `h-12` (48px) for consistency
  - Made TACLOG logo larger (`text-2xl`)
  - Improved vertical centering with optical offset (`mt-1`)
  - Removed unnecessary `h-full` from nav for proper auto-sizing

- **Hamburger Menu Button Fix:**
  - Fixed button rendering as rectangle (32x44) instead of square
  - Button now renders as proper 36x36 square (`w-9 h-9`)
  - Cog icon enlarged to 28px (`w-7 h-7`) for better visibility
  - Added `touch-size-override` CSS class to prevent mobile min-height override

### Technical
- **Files Modified:**
  - `app/brief/page.tsx` - Brief page UI improvements
  - `components/GlobalHeader.tsx` - Header sizing and centering
  - `components/HamburgerMenu.tsx` - Button square sizing fix
  - `app/globals.css` - Added `.touch-size-override` utility class

- **CSS Addition:**
  - New `.touch-size-override` class in media query for touch devices
  - Allows buttons to bypass the 44px min-height requirement when exact sizing is needed

---

## [4.70.0] - 2026-01-11 - Async Brief Generation

### Added
- **Async Background Processing:**
  - Brief generation now runs in the background using Next.js `after()` API
  - User submits and redirects to gallery immediately (no more 3-5 min blocking)
  - Direct function calls for parsing and analysis (no internal HTTP requests)

- **Smart Notification System:**
  - Header badge shows generation status: "X Generating" (amber) → "Ready!" (green) → "Failed" (red)
  - Toast notifications for completions (auto-hides after 10 seconds, badge persists)
  - Click badge to navigate directly to completed brief
  - Database-persisted notification state via `notificationDismissedAt` field

- **Smart Polling:**
  - Active mode: Polls every 5 seconds when briefs are generating
  - Idle mode: Polls every 60 seconds when nothing pending
  - Local dismiss tracking prevents re-showing dismissed notifications

- **New API Endpoints:**
  - `POST /api/brief/submit` - Quick submission, returns immediately with brief ID
  - `GET /api/brief/status` - Polling endpoint for pending/completed/failed briefs
  - `POST /api/brief/dismiss` - Mark notification as acknowledged

### Changed
- **Simplified Brief Page:**
  - Removed file upload (paste text only)
  - Removed optional settings (faction hint, list name)
  - Cleaner single-purpose interface

- **Status Endpoint Filtering:**
  - Only returns completions from last 24 hours (prevents old brief flooding)
  - Limited to 5 items per category to prevent UI overwhelm

### Technical
- **Files Created:**
  - `lib/armyListParser.ts` - Extracted core parsing logic for direct calls
  - `lib/briefGenerator.ts` - Extracted core analysis logic for direct calls
  - `app/api/brief/submit/route.ts` - Async submission endpoint
  - `app/api/brief/status/route.ts` - Status polling endpoint
  - `app/api/brief/dismiss/route.ts` - Notification dismiss endpoint
  - `lib/brief/BriefNotificationContext.tsx` - Global notification state
  - `components/PendingBriefBadge.tsx` - Header status badge
  - `components/BriefNotificationToast.tsx` - Completion toast

- **Database Schema:**
  - Added `notificationDismissedAt` field to `BriefGeneration` model

---

## [4.69.0] - 2026-01-11 - Brief Recommendations Redesign

### Changed
- **4 Independent Suggestions:**
  - List modification suggestions redesigned from "2 major + 2 tweak" to 4 complete, independent options
  - Each option is self-contained and results in a valid ~2000pt list
  - Users pick ONE option that fits their collection (not combined)
  - Simplified interface: `title`, `removeUnits`, `addUnits`, `addEnhancements`, `pointsDelta`, `reasoning`

- **Available Datasheets in Both LLM Calls:**
  - Strategic analysis (LLM call #1) now receives the full faction datasheet list
  - Prevents hallucination of Legends/discontinued units in `collectionRecommendations`
  - Both analysis and suggestions calls have consistent unit availability data

### Fixed
- **Parent Faction Detachment Lookup:**
  - Space Wolves using "Stormlance Task Force" now correctly fetches Space Marines stratagems/enhancements
  - `fetchDetachmentContext` searches both the faction AND its parent faction
  - Properly combines faction filter with detachment name filter using AND/OR logic

- **Legends Unit Hallucination:**
  - LLM no longer suggests units like "Wolf Lord on Thunderwolf" (Legends)
  - System prompt explicitly warns: "ONLY suggest units from AVAILABLE FACTION UNITS list"
  - Data-driven approach: if unit has no datasheet, it cannot be suggested

### Technical
- **Files Modified:**
  - `app/api/brief/analyze/route.ts`: Moved `fetchFactionDatasheets` before strategic analysis
  - `lib/briefAnalysis.ts`: Added `availableDatasheets` param to `buildBriefUserPrompt`
  - `lib/briefSuggestions.ts`: Simplified `ListSuggestion` interface, updated prompts
  - `lib/fetchDetachmentContext.ts`: Parent faction lookup with proper AND/OR query structure
  - `components/BriefReport.tsx`: Updated UI for 4-option layout

---

## [4.68.0] - 2026-01-10 - Brief Analysis Quality Improvements

### Added
- **Uniqueness Framework in System Prompt:**
  - AI now explicitly identifies what makes each list unique before analysis
  - Good/bad examples guide AI toward list-specific insights vs generic faction advice
  - Critical rule: One leader per unit (prevents illegal dual-attachment suggestions)

- **Synergy Reasoning Preservation:**
  - Competitive context synergies now include full "why" explanations in prompts
  - Example: "Arjac typically leads the large Terminator unit" now reaches the AI
  - Previously only unit names were passed, losing critical tactical guidance

### Fixed
- **DisplayName Mismatch Bug:**
  - Unit role lookups now use `displayName` (e.g., "Wolf Guard Terminators (340pts)")
  - Previously used `unitName` which didn't match AI output keys
  - Fixed in both `briefAnalysis.ts` and `BriefReport.tsx`

- **Identical Unit Differentiation:**
  - Units with same name AND same points now get A/B/C suffixes
  - Example: "Wulfen with Storm Shields (200pts) A" vs "Wulfen with Storm Shields (200pts) B"
  - AI can now provide different tactical summaries for truly identical units
  - Created `generateUniqueDisplayNames()` helper function for consistency

- **Leader Attachment Rules:**
  - Added explicit "one leader per unit" guidance in system prompt and schema descriptions
  - BAD example: "Attach Logan and Arjac here" (illegal in 10th Edition)
  - GOOD example: Different leaders distributed across eligible units

### Technical
- **New `displayName` Field:**
  - Added to `UnitEngagementProfile` interface
  - Generated consistently in both `analyzeBrief()` and `buildBriefContext()`
  - Handles three cases: unique names, same name/different points, same name/same points

- **Files Modified:**
  - `lib/briefAnalysis.ts`: Interface, helper function, synergy formatting, system prompt
  - `components/BriefReport.tsx`: Lookups now use `unit.displayName`
  - `app/api/brief/analyze/route.ts`: Schema descriptions with leader rules

---

## [4.67.0] - 2026-01-10 - Competitive Context Pipeline

### Added
- **Complete Competitive Context Pipeline:**
  - Multi-source aggregation system for unit tier rankings
  - YouTube transcript processing via Whisper transcription
  - Goonhammer/article parsing via web scraping
  - AI-powered context extraction using Gemini 3 Flash
  - Conflict detection and resolution when sources disagree

- **Admin UI Source Management:**
  - Add competitive sources at faction level (`/admin/factions/[id]`)
  - Source types: YouTube, Reddit, articles, forums
  - Optional detachment-specific source tagging
  - Status tracking: pending → fetched → curated → extracted

- **Two-Table Architecture:**
  - `DatasheetSource` - preserves individual source opinions (never overwritten)
  - `DatasheetCompetitiveContext` - synthesized view across all sources
  - Tracks source count, conflicts, and resolution reasoning

### Fixed
- **yt-dlp HLS Fragment Download Errors:**
  - Updated format selector to avoid HLS (m3u8) streams
  - Format: `ba[protocol!=m3u8_native]/ba/b[protocol!=m3u8_native]/b`
  - Resolves "fragment not found" errors on YouTube downloads

- **SQL Column Name Mismatch:**
  - Fixed `sourceId` → `competitiveSourceId` in aggregation queries
  - Affected `db_get_datasheets_with_sources()` and `db_get_datasheet_sources_for_aggregation()`

### Technical
- **Pipeline Commands:**
  ```bash
  # Full pipeline
  python scripts/youtube_transcribe.py --process-all

  # Aggregate for faction
  python scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"
  ```

- **Results (Space Wolves):**
  - 36 units with competitive context
  - 3 S-tier: Logan Grimnar, Thunderwolf Cavalry, Wolf Guard Terminators
  - 9 A-tier: Arjac, Bjorn, Blood Claws, Wulfen, etc.
  - Synthesized from 3 competitive sources

---

## [4.66.0] - 2026-01-10 - Wahapedia Scraper Hardening

### Added
- **Multi-Signal Legends Detection System:**
  - CSS class detection on link elements (weight: 10) - highest reliability
  - URL pattern matching (weight: 5) - `/legends/`, `/fw/` paths
  - Name pattern matching (weight: 3) - "(Legendary)", "Relic", "Sicaran", etc.
  - Hardcoded fallback list (weight: 2) - validation for edge cases
  - Weighted scoring system with confidence levels (high/medium/low)

- **Robust Element-Based Classification:**
  - `detectLegendsFromElement()` - checks CSS classes on link and parent `.ArmyType_line`
  - `detectLegendsFromNameAndUrl()` - simple fallback when no DOM context
  - `detectClassificationFromPage()` - scoped to `.dsOuterFrame` to avoid sidebar false positives

- **Pre-Parsing Quality System:**
  - Cheerio extraction for stats, weapons, keywords, abilities
  - Quality score (0-100) based on data completeness
  - Content hashing (SHA-256) for cache freshness detection
  - Per-datasheet metadata files (`.meta.json`)

- **Type Definitions Module (`wahapediaTypes.ts`):**
  - Shared interfaces: `DatasheetLink`, `UnitClassification`, `CacheMetadata`
  - Selector strategy configurations with confidence levels
  - Detection signal types for debugging

- **Validation Schemas Module (`wahapediaValidation.ts`):**
  - Zod schemas with 40K-specific domain constraints
  - Stats validation: T1-14, W1-30, OC0-8, Save 2+-6+
  - Cross-validation between Cheerio and LLM output

### Fixed
- **False Positive Legends Detection:**
  - Previously used `$('body')[0]` which matched sidebar navigation classes
  - Now correctly checks link element's parent (`.ArmyType_line`) for `.sLegendary` class
  - Fixed 95 Space Wolves units incorrectly flagged as Legends

- **Page Classification Scoping:**
  - `detectClassificationFromPage()` now only checks within `.dsOuterFrame`
  - Prevents false positives from sidebar filter controls on datasheet pages

### Technical
- **Files Added:**
  - `scripts/wahapediaTypes.ts` - shared type definitions
  - `scripts/wahapediaValidation.ts` - Zod validation schemas

- **Files Modified:**
  - `scripts/scrapeWahapedia.ts` - major refactoring for robust detection

- **Detection Stats Example:**
  - 169 total links found on Space Marines index
  - 72 Legends units correctly skipped (via `css_class`)
  - 2 Forge World units correctly skipped
  - 95 tournament-legal datasheets scraped successfully

---

## [4.65.0] - 2026-01-09 - Python Pipeline Direct Database Integration

### Added
- **Direct Database Connection for Python Pipeline:**
  - `scripts/youtube_transcribe.py` now connects directly to Supabase PostgreSQL
  - Uses `psycopg2` with `DATABASE_URL` from `.env.local`
  - Eliminates dependency on Next.js server for pipeline operations
  - New database helper functions: `db_get_pending_sources()`, `db_update_source_status()`, `db_create_datasheet_links()`, etc.

- **Audio Chunking for Long YouTube Videos:**
  - Automatically splits audio files > 20MB or > 15 minutes duration
  - 10-minute chunks sent individually to Whisper API (25MB limit)
  - Transcripts merged seamlessly with proper paragraph breaks
  - Uses ffmpeg for lossless audio splitting

- **Retry Logic with Exponential Backoff:**
  - `requests_with_retry()` helper for all Gemini API calls
  - Handles transient connection drops (`RemoteDisconnected`, `ChunkedEncodingError`)
  - Exponential backoff: 1s → 2s → 4s between retries
  - Maximum 3 retry attempts before failure

- **Parent Faction Detachments in Admin UI:**
  - Divergent factions (Space Wolves, Blood Angels, Dark Angels) now show parent faction detachments
  - Grouped dropdown: own detachments first, then parent detachments in separate group
  - API endpoint `/api/admin/factions/[id]` returns `parentFaction.detachments`

### Changed
- **Column Name Correction:**
  - Fixed `sourceId` → `competitiveSourceId` in `DatasheetSource` table queries
  - Aligns with Prisma schema column naming

- **Extraction Schema for Structured Synergies:**
  - Synergies now use `{unit: string, why: string}` format instead of plain strings
  - Provides reasoning for each synergy recommendation

### Fixed
- **Broken Loop Logic in `extract_pending_links`:**
  - Removed duplicate nested loop iterating over same `pending_links` array
  - Proper error handling with continue on individual link failures
  - Status updates now use direct database queries instead of API calls

- **Audio File Size Validation:**
  - Pre-check file size before Whisper upload
  - Automatic compression with ffmpeg if file exceeds 20MB
  - Converts to opus codec at 48kbps for smaller file sizes

### Technical
- **Files Modified:**
  - `scripts/youtube_transcribe.py` - Major refactoring for direct DB access
  - `app/api/admin/factions/[id]/route.ts` - Added parent faction detachments to response
  - `app/admin/factions/[id]/page.tsx` - Grouped detachments dropdown UI

- **Dependencies:**
  - Added `psycopg2` for direct PostgreSQL connection
  - Requires `ffmpeg` installed for audio processing

---

## [4.64.0] - 2026-01-09 - Enhanced Brief Competitive Context

### Added
- **Comprehensive Competitive Context in Brief Analysis:**
  - Unit-level fields now sent to AI: `bestTargets`, `avoidTargets`, `phasePriority`, `pointsEfficiency`, `competitiveNotes`
  - Faction-level meta context: `metaTier`, `metaPosition`, `playstyleArchetype`, `strengths`, `weaknesses`
  - Faction matchup data: `favorableMatchups`, `unfavorableMatchups`
  - Unit recommendations: `mustTakeUnits`, `avoidUnits`, `sleepHitUnits`, `recommendedDetachments`

- **FactionCompetitiveContext Integration:**
  - New faction-level competitive context section in brief prompts
  - Includes meta tier ranking (S/A/B/C/D/F) and position (top tier, gatekeeper, mid tier, struggling)
  - Playstyle archetype classification (aggressive_melee, gunline, balanced, etc.)

### Changed
- **Case-Insensitive Datasheet Matching:**
  - Fixed competitive context not appearing for units with case differences (e.g., "Bjorn the Fell-Handed" vs "Bjorn The Fell-handed")
  - Prisma queries now use `mode: 'insensitive'` for datasheet name matching

- **Extended BriefContext Interface:**
  - Added `factionContext` field for faction-level competitive data
  - Extended unit competitive context with `avoidTargets`, `phasePriority`, `pointsEfficiency` fields

### Fixed
- **Gemini Response Handling:**
  - Filter out thinking parts (`part.thought === true`) from Gemini responses to prevent JSON parsing errors
  - Increased `maxOutputTokens` from 16384 to 32768 in army parser to prevent truncation
  - Added truncation detection via `finishReason` checking

### Technical
- **Files Modified:**
  - `lib/briefAnalysis.ts` - Extended interfaces, added `formatFactionContext()` helper, enhanced `formatUnitCard()`
  - `app/api/brief/analyze/route.ts` - Fetch `UnitCompetitiveContext` and `FactionCompetitiveContext`, case-insensitive queries
  - `app/api/armies/parse/route.ts` - Gemini thought signature filtering, increased token limit

---

## [4.63.0] - 2026-01-08 - Marketing Homepage & Route Separation

### Added
- **Marketing Homepage (`/`):**
  - Public-facing landing page with grimdark aesthetic
  - "2 Free Analyses" banner with terminal green styling (terminal/cogitator aesthetic)
  - Integrated "Sign Up Free" CTA button in banner
  - Interactive sample brief preview with collapsible sections
  - Multiple conversion points throughout the page
  - Mobile-first responsive design optimized for phones

- **Route Separation:**
  - `/` - Marketing homepage (public, redirects logged-in users to gallery)
  - `/brief` - Functional brief generation tool (requires authentication)
  - `/brief/gallery` - Landing page for logged-in users (public brief gallery)

### Changed
- **Homepage UX:**
  - Separated marketing content from functional features
  - "2 Free Analyses" banner redesigned with grimdark terminal green aesthetic
  - Removed emoji from banner (replaced with geometric checkmark icon)
  - Banner text: "++ TACTICAL SUBSIDY ++ NO SURCHARGE ++" (IP-safe military terminology)
  - CTA buttons use emerald-700 styling (grimdark, not bright lime)
  - Sample preview CTA changed from "Generate Your Own Brief" to "Sign Up Free"

- **Authentication Flow:**
  - Logged-in users automatically redirected from `/` to `/brief/gallery`
  - Unauthenticated users redirected from `/brief` to `/` (marketing page)
  - Auth modal opens from all CTAs (banner, sample preview, features section)

- **Navigation:**
  - Updated internal links to reflect new route structure
  - Session tracker moved to `/sessions/live` (previously at `/`)
  - Calculator "BACK TO BATTLE" link updated to `/sessions/live`

### Technical
- **Components:**
  - `app/page.tsx` - New marketing homepage with conditional rendering
  - `components/brief/BriefHero.tsx` - Redesigned banner with integrated CTA
  - `components/brief/BriefSamplePreview.tsx` - Added `ctaLabel` and `ctaVariant` props
  - Updated `BriefHero` to accept `onAnalyzeClick` for auth modal integration

- **Styling:**
  - Terminal green color scheme (`green-400`/`green-500`) for banner
  - Emerald-700 CTA buttons (`emerald-700`/`emerald-600`) for grimdark aesthetic
  - CRT scanline overlay effect on banner
  - Corner bracket accents (targeting reticle style)
  - Reduced glow effects (5% opacity background, 5px radius text glow)

- **Mobile Optimization:**
  - Responsive text sizing (`text-lg` → `text-xl`/`text-2xl`)
  - Tighter padding on mobile (`px-4 py-3` → `px-8 py-4`)
  - Centered text layout when icon hidden
  - Banner max-width constraint (`max-w-sm` on mobile)
  - Shorter subtext for narrow screens

### Notes
- Marketing homepage focuses on conversion with clear value proposition
- Sample brief preview provides "Try Before You Buy" experience
- All CTAs lead to auth modal (handles both sign-up and sign-in)
- IP-safe terminology used throughout (no Games Workshop trademarks)

---

## [4.62.0] - 2026-01-07 - Brief History & Public Sharing

### Added
- **Brief History System:**
  - All brief generations are now automatically saved to database after successful analysis.
  - New `BriefGeneration` model stores complete analysis data (local analysis, strategic analysis, suggestions) in JSONB columns.
  - Permanent URLs: `/brief/{id}` for bookmarkable, shareable brief links.
  - Auto-redirect to permanent URL after generation completes.

- **Share & Visibility Controls:**
  - Three visibility levels: `private` (owner only), `link` (shareable via token), `public` (listed in gallery).
  - Share modal with copy link button, visibility toggle, and social share options (Twitter, Discord).
  - Share tokens generate unique URLs: `/brief/share/{token}` for link-based sharing.
  - View counting tracks popularity for gallery sorting.

- **History & Gallery Pages:**
  - `/brief/history` - View all your past briefs with thumbnails, faction filters, and quick actions.
  - `/brief/gallery` - Browse public briefs with faction filtering and sorting (recent/popular).
  - History dropdown in navigation menu for quick access to recent briefs.
  - Delete functionality for user's own briefs.

- **Navigation Integration:**
  - Added "MY DOSSIERS" and "PUBLIC GALLERY" links to main navigation menu.
  - History dropdown component shows recent briefs with spirit icons.

### Changed
- **Auto-Save on Generation:**
  - `/api/brief/analyze` now automatically saves brief to database after successful generation.
  - Returns `briefId` in response for immediate redirect.
  - Failed saves don't block brief display (graceful degradation).

- **Brief View Pages:**
  - `/brief/[id]` - View saved brief by ID (respects visibility settings).
  - `/brief/share/[token]` - Access shared brief via token (no auth required).
  - Both pages use same `BriefReport` component for consistent display.

### Technical
- **Database:**
  - Added `BriefGeneration` model to Prisma schema with hybrid columns (indexed metadata + JSONB for complex data).
  - Migration applied via Supabase MCP tool.
  - Indexes on `userId`, `faction`, `visibility`, `shareToken` for fast queries.

- **API Endpoints:**
  - `GET/PATCH/DELETE /api/brief/[id]` - CRUD operations for briefs.
  - `GET /api/brief/list` - List user's brief history with pagination.
  - `GET /api/brief/public` - Browse public gallery with filtering and sorting.
  - `GET /api/brief/share/[token]` - Access shared brief by token.

- **Components:**
  - `BriefShareModal` - Share controls with visibility settings and link copying.
  - `BriefHistoryDropdown` - Quick access dropdown for recent briefs.
  - Updated `BriefReport` to accept `briefId` prop and show share button.

- **Updated Files:**
  - `prisma/schema.prisma` - Added `BriefGeneration` model.
  - `app/api/brief/analyze/route.ts` - Auto-save after generation.
  - `app/api/brief/[id]/route.ts` - CRUD endpoints.
  - `app/api/brief/list/route.ts` - History endpoint.
  - `app/api/brief/public/route.ts` - Gallery endpoint.
  - `app/api/brief/share/[token]/route.ts` - Share token endpoint.
  - `components/BriefReport.tsx` - Share button and modal integration.
  - `components/brief/BriefShareModal.tsx` - New share modal component.
  - `components/brief/BriefHistoryDropdown.tsx` - New history dropdown.
  - `components/HamburgerMenu.tsx` - Added navigation links.
  - `app/brief/page.tsx` - Redirect to permanent URL after generation.
  - `app/brief/history/page.tsx` - New history page.
  - `app/brief/gallery/page.tsx` - New gallery page.
  - `app/brief/[id]/page.tsx` - New view page.
  - `app/brief/share/[token]/page.tsx` - New share token view page.

### Notes
- Briefs are automatically saved with `private` visibility by default.
- Share tokens are generated automatically when visibility is set to `link` or `public`.
- Public gallery shows briefs sorted by view count (popular) or creation date (recent).
- History page supports faction filtering and pagination for large histories.

---

## [4.61.1] - 2026-01-07 - Army Quirks Unit-Focused & Suggestions Error Handling

### Changed
- **Army Quirks Now Unit-Focused:**
  - Updated AI prompts to generate quirks based on unit composition rather than faction/detachment mechanics.
  - Quirks now highlight quantifiable unit characteristics: model counts with specific saves, weapon loadouts, points investment in unit types, deployment capability breakdowns.
  - Removed detachment/faction-based quirk examples (e.g., "Saga Stacking") from guidance.
  - Added explicit BAD examples for detachment rules to prevent AI from generating them.

- **Suggestions Generation Improvements:**
  - Added proper JSON extraction with `extractFirstJsonBlock()` to handle truncated responses gracefully.
  - Changed suggestions `thinkingLevel` from `'high'` to `'medium'` (suggestions don't need deep reasoning).
  - Increased `maxOutputTokens` from 8192 to 10000 to prevent truncation.
  - Suggestions failures now log warnings instead of crashing the main brief generation.

### Technical
- **Updated:** `lib/briefAnalysis.ts` - Unit-focused quirk guidance in system prompt
- **Updated:** `app/api/brief/analyze/route.ts` - Unit-focused quirk schema descriptions + suggestions error handling

### Notes
- Army Quirks now answer "What do the UNITS bring?" not "What does the detachment do?"
- Good quirk examples: "Invuln Wall: 21/50 models", "Deep Strike Points: 520pts", "Thunder Hammer Dense: 15 S8 attacks"
- Bad quirk examples: "Saga Stacking: 2 Sagas", "Oath Target Bonus" (these are detachment rules, not unit quirks)

---

## [4.61.0] - 2026-01-07 - Gemini 3 Pro Upgrade for Tactical Brief

### Changed
- **AI Model Upgrade:**
  - Switched brief strategic analysis from `gemini-3-flash-preview` to `gemini-3-pro-preview` for deeper reasoning.
  - Added `thinkingConfig: { thinkingLevel: 'high' }` to both main analysis and suggestions LLM calls.
  - Removed explicit temperature settings to use Gemini 3 default (1.0) per Google's recommendations.

- **Prompt Optimization for Gemini 3:**
  - Streamlined system prompt from ~130 lines to ~30 lines for Gemini 3's reasoning model.
  - Restructured user prompt with data context first, instructions at end (Gemini 3 best practice).
  - Added explicit context anchor: "Based on all the army data above..."

- **Army Parse Endpoint Fix:**
  - Added `thinkingConfig: { thinkingLevel: 'minimal' }` to army parsing to prevent thought signature interference with JSON output.
  - Fixes JSON parse errors caused by Gemini 3's default thinking mode.

- **Sample Brief Updated:**
  - New sample output "The Frost-Clad Avalanche" showcases Gemini 3 Pro's improved analysis quality.
  - Richer executive summaries, more actionable tactical fun stats, specific mitigation strategies.

### Technical
- **Updated:** `app/api/brief/analyze/route.ts` - Model upgrade + thinking config
- **Updated:** `app/api/armies/parse/route.ts` - Thinking level minimal for JSON extraction
- **Updated:** `lib/briefAnalysis.ts` - Optimized prompts for Gemini 3
- **Updated:** `data/sample-brief-response.json` - New Gemini 3 Pro sample output

### Notes
- Gemini 3 Pro pricing: $2/$12 per 1M tokens (vs Flash at $0.50/$3)
- Thinking level `high` enables deep reasoning for strategic analysis
- Thinking level `minimal` for parsing ensures clean JSON without thought signatures

---

## [4.60.1] - 2026-01-06 - Brief Landing Page Simplification

### Changed
- **Hero Section Streamlined:**
  - Removed feature cards (MathHammer, Meta Insights, Role Analysis, Gap Analysis) from hero.
  - Hero now prominently features just the "2 Free Generations" banner with tagline.
  - Sample brief report is now immediately visible as the featured content.

- **Conversion Focus:**
  - Landing page now leads with value (free generations + sample output visible).
  - Removed intermediate CTAs - sample report is shown directly, not behind a button.
  - Cleaner visual hierarchy: banner → sample → form.

### Removed
- Feature cards from `BriefHero` (MathHammer, Role Analysis, Meta Insights, Gap Analysis).
- `FeatureCard` component (no longer used).
- Scroll indicator and atmospheric background from hero.

### Technical
- **Updated:** `components/brief/BriefHero.tsx` - Simplified to banner + tagline only.

---

## [4.60.0] - 2026-01-06 - Tactical Brief Landing Page UX Refresh

### Added
- **Brief Landing Hero:**
  - New `/brief` hero section that frames the feature as a premium service.
  - Mobile-first 2×2 feature grid with primary/secondary CTAs.

- **Interactive Sample Brief Preview:**
  - New collapsible sample report preview section (no iframe) to show realistic output before sign-in.
  - Uses static sample output in `data/sample-brief-response.json`.

### Changed
- **"Try Before You Buy" Conversion Flow:**
  - Users can explore sample output and prep their input before signing in.
  - Authentication is prompted at generation time, aligned with the 2 free credits model.

- **Mobile Readability:**
  - Increased mobile typography across hero, sample preview, and input form.
  - Reduced unnecessary padding so content uses available width on phones.

- **Visual Design (Grimdark, Less "AI UI"):**
  - Removed distracting background glow ("lens flare") from brief hero.
  - Improved contrast choices across brief landing sections.

### Fixed
- **Tailwind v4 Theme Token Mismatch:**
  - Added kebab-case `@theme` color aliases so classes like `text-taclog-light-steel` resolve correctly (previously could fall back to default text).

### Technical
- **New:** `components/brief/BriefHero.tsx`
- **New:** `components/brief/BriefSamplePreview.tsx`
- **New:** `data/sample-brief-response.json`
- **Updated:** `app/brief/page.tsx`, `components/brief/index.ts`, `app/globals.css`

---

## [4.59.0] - 2026-01-05 - Environment Separation & Auth Specialization

### Added
- **Environment Isolation:**
  - Established separate Supabase projects for development (`lelfaceyultzvztdndzs`) and production (`qzpsnwhjztydbbgcufrk`).
  - Created `env.example` template with dedicated sections for both environments to prevent credential leakage.
  - Added comprehensive multi-environment setup guide to `VERCEL_DEPLOYMENT.md`.

- **Google OAuth Dedicated Apps:**
  - Supported separate Google Cloud Console OAuth apps for dev (`TacLog-Dev`) and prod (`TacLog-Prod`).
  - Updated `SUPABASE_AUTH_SETUP.md` with instructions for configuring separate redirect URIs per environment.

### Fixed
- **Production Redirect Issue:**
  - Resolved bug where production OAuth would incorrectly redirect users to `localhost:3000`.
  - Fixed by updating Supabase "Site URL" and "Redirect URLs" in the production project dashboard.
  - Corrected Vercel environment variables to use production Supabase keys instead of development keys.

### Changed
- **Authentication Specialization:**
  - Standardized on Google OAuth as the sole authentication provider.
  - Removed Microsoft and Discord OAuth support from the codebase to reduce complexity and attack surface.
  - Simplified `AuthContext` API (removed provider parameter from `signIn`).

### Technical
- **New:** `env.example` - Environment variable template for all contributors.
- **Updated:** `lib/auth/AuthContext.tsx` - Removed unused OAuth providers, simplified `signIn`.
- **Updated:** `components/AuthModal.tsx` - Updated to use simplified auth call.
- **Updated:** `VERCEL_DEPLOYMENT.md` - Added detailed environment separation guide.
- **Updated:** `SUPABASE_AUTH_SETUP.md` - Reflected Google-only strategy and separate project setup.
- **Reset:** TacLog (dev) database wiped and ready for fresh schema sync.

---

## [4.58.0] - 2026-01-04 - Production Security & Brief Credits System

### Added
- **Brief Credits System:**
  - Users receive 2 free brief generations upon Google sign-up.
  - Credits tracked per-user in database (`briefCredits` field on `User` model).
  - Admin bypass: admins have unlimited generations.
  - Credits displayed in brief page header with remaining count.
  - Button disabled when credits depleted with helpful messaging.

- **Admin User Management Panel:**
  - New `/admin/users` page for managing user credits.
  - View all users with email, admin status, and credit balance.
  - Quick +1/-1 buttons for adjusting credits.
  - Set exact credit value via input field.
  - Admin-only access enforced via middleware.

- **API Security Hardening:**
  - All LLM endpoints now require authentication via `requireAuth()`.
  - Proper 401 responses for unauthenticated requests (was returning 500).
  - Admin endpoints use `withAdminAuth()` wrapper for double protection.
  - Security test script (`scripts/security-test.ps1`) with 19 endpoint tests.

- **New API Endpoints:**
  - `GET /api/users/credits` - Fetch current user's credit balance and admin status.
  - `GET /api/admin/users` - List all users with credits (admin only).
  - `PATCH /api/admin/users/[id]/credits` - Adjust user credits (admin only).

- **LLM Output Token Limits:**
  - `/api/brief/analyze` main analysis: 24,576 tokens (~100KB max).
  - `/api/brief/analyze` suggestions: 8,192 tokens (~32KB max).
  - `/api/armies/parse` army parsing: 16,384 tokens (~64KB max).
  - `/api/analyze` voice commands: 8,192 tokens (~32KB max).
  - Prevents runaway generation and excessive API costs.

### Changed
- **Route Protection:**
  - Middleware now enforces admin-only access to `/sessions`, `/armies`, `/datasheets`, `/calculator`, `/admin`.
  - Non-admin users redirected to `/brief` from admin routes.
  - Unauthenticated API requests return 401 JSON response (not redirect).

- **HamburgerMenu Navigation:**
  - Navigation links conditionally shown based on admin status.
  - Loading state while checking admin status prevents flash.
  - Brief link available to all authenticated users.
  - Admin links (Sessions, Armies, Datasheets, Admin panels) only shown to admins.

- **Landing Page Behavior:**
  - Root page (`/`) redirects non-admins to `/brief`.
  - Admins see full game tracker UI.
  - Loading state while determining admin status.

- **AuthModal Simplified:**
  - Only Google sign-in supported (removed email/password, other providers).
  - Messaging about 2 free generations for new sign-ups.

### Security
- Removed `scripts/grant-admin.ts` - admin grants now require direct database access.
- All 6 critical LLM endpoints return 401 for unauthenticated requests.
- All admin endpoints return 401/403 for non-admin users.
- API security verified via automated test suite.

### Technical
- New: `lib/briefCredits.ts` - Credit management functions (check, deduct, get, set, adjust).
- New: `app/api/users/credits/route.ts` - User credits endpoint.
- New: `app/api/admin/users/route.ts` - Admin users list endpoint.
- New: `app/api/admin/users/[id]/credits/route.ts` - Admin credit adjustment endpoint.
- New: `app/admin/users/page.tsx` - Admin user management UI.
- New: `scripts/security-test.ps1` - Automated API security tests.
- New: `prisma/manual_migrations/add_brief_credits.sql` - Database migration.
- Updated: `prisma/schema.prisma` - Added `briefCredits` field to User model.
- Updated: `middleware.ts` - Route protection with admin checks.
- Updated: `app/brief/page.tsx` - Credits display and enforcement.
- Updated: `components/HamburgerMenu.tsx` - Conditional navigation.
- Updated: `components/AuthModal.tsx` - Google-only authentication.
- Updated: All LLM endpoints - Added `requireAuth()` and proper error handling.

### Database Migration Required
```sql
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "briefCredits" INTEGER NOT NULL DEFAULT 2;
```

---

## [4.57.0] - 2026-01-03 - List Modification Suggestions & Unified Spirit Icon Generation

### Added
- **List Modification Suggestions:**
  - AI-powered army list improvement recommendations integrated into brief analysis.
  - Two independent suggestions per analysis (Option 1, Option 2) - user can implement either.
  - Supports complex swaps: remove 1+ units, add 1+ units within a single suggestion.
  - Suggestions include: unit names, points costs, key capabilities, and tactical rationale.
  - Full faction datasheet context sent to LLM - can suggest adding more of existing units.
  - Strategic analysis output included in suggestion prompt for context-aware recommendations.
  - Rendered in BriefReport UI with remove/add unit sections and points delta.

- **Unified Backend Spirit Icon Generation:**
  - Spirit icon generation moved from frontend `useEffect` to backend `/api/brief/analyze`.
  - Prevents duplicate icon generation (was generating twice per analysis).
  - `generateSpiritIconInternal()` function for internal use with Langfuse trace nesting.
  - Spirit icon URL returned alongside strategic analysis in single API response.

- **HTML Export List Suggestions:**
  - List modification suggestions section added to exported HTML reports.
  - Unit icons displayed for suggested units (fetched from database).
  - Placeholder icons (`+`/`−`) shown when icons not yet generated.
  - Full CSS styling matching the app UI aesthetic.

### Changed
- **Streaming LLM Responses:**
  - Both strategic analysis and suggestion LLM calls use `generateContentStream` to prevent timeouts.
  - Provides progress updates during long-running analysis.
  - Prevents idle connection drops on large prompts (5+ minute analyses).

- **Suggestion Schema:**
  - `removeUnits` and `addUnits` are arrays (support multiple units per suggestion).
  - Each suggestion is independent - not cumulative like previous design.
  - Exactly 2 suggestions enforced via schema `minItems: 2, maxItems: 2`.

### Technical
- New: `lib/briefSuggestions.ts` - Datasheet fetching, prompt building, schema definition.
- Updated: `app/api/brief/analyze/route.ts` - Second LLM call for suggestions, spirit icon integration, streaming.
- Updated: `app/api/brief/generate-spirit-icon/route.ts` - Extracted `generateSpiritIconInternal()` function.
- Updated: `components/BriefReport.tsx` - Suggestions UI, icon fetching for suggestion units.
- Updated: `lib/briefExport.ts` - HTML export with suggestions section and unit icons.
- Updated: `app/brief/page.tsx` - State management for suggestions and spirit icon URL.
- Updated: `lib/briefAnalysis.ts` - Exported suggestion types.

### Langfuse Observability
- All LLM calls traced: strategic analysis, list suggestions, spirit icon generation.
- Nested traces for internal spirit icon generation calls.
- Detailed metadata: prompt sizes, response lengths, faction/detachment tags.

---

## [4.56.0] - 2026-01-02 - Enhanced Brief Analysis Prompts & Competitive Context Integration

### Added
- **Competitive Context Integration:**
  - Brief analysis now fetches and includes competitive context data (tier, synergies, counters, playstyle notes) when available.
  - Competitive context is displayed in unit cards within the AI prompt for enhanced strategic analysis.
  - Falls back gracefully when competitive context data is not available (no breaking changes).

- **Enhanced Weakness Schema:**
  - Added `specificCounterArmies` field to weakness objects - identifies which opponent armies exploit each weakness.
  - Added `mitigationStrategy` field to weakness objects - provides theory-crafting options for addressing vulnerabilities.
  - Weaknesses now focus on theoretical counterplay scenarios rather than specific gameplay sequences.

- **Improved Stratagem Formatting:**
  - Stratagems in detachment context now include tactical usage hints (e.g., "Use when: X situation").
  - Better guidance for LLM on when and how to leverage detachment-specific stratagems.

### Changed
- **Refined Prompt Guidance:**
  - Updated system prompt to focus on theory-crafting and available options rather than specific gameplay sequences.
  - Tactical Highlights guidance emphasizes referencing specific game mechanics and rules rather than detailed turn-by-turn plans.
  - Strengths/Weaknesses guidance focuses on theoretical synergies and counterplay scenarios that can be inferred from rules.
  - Removed overly specific tactical sequences that require actual gameplay data the LLM doesn't have access to.

- **Enhanced User Prompt:**
  - Added explicit detachment-specific analysis requirements.
  - Added specific questions for fun stats to ensure they reference game mechanics.
  - Better integration of detachment rules, stratagems, and enhancements into analysis.

### Technical
- Updated: `app/api/brief/analyze/route.ts` - Added competitive context fetching from `DatasheetCompetitiveContext` table with fallback to `Datasheet` fields. Updated weakness schema to include `specificCounterArmies` and `mitigationStrategy`.
- Updated: `lib/briefAnalysis.ts` - Enhanced `buildBriefSystemPrompt()` with refined guidance for actionable but theory-focused insights. Updated `buildBriefUserPrompt()` with detachment-specific requirements. Added competitive context to `BriefContext` interface and `formatUnitCard()`.
- Updated: `lib/fetchDetachmentContext.ts` - Enhanced `formatDetachmentContextForPrompt()` to include tactical usage hints for stratagems.
- Documentation: Updated `docs/features/TACTICAL_DOSSIER.md` and `docs/api/DOSSIER_ANALYZE_ENDPOINT.md`

---

## [4.55.0] - 2026-01-01 - Enriched AI Strategic Analysis & Faction Rules

### Added
- **Enriched Faction/Detachment Context:**
  - AI analysis now receives full detachment rules, stratagems, and enhancements from the database.
  - Prevents LLM hallucinations and reliance on stale training data.
  - Context includes:
    - Detachment ability name and full description.
    - All faction-level rules (e.g., Oath of Moment, Synapse).
    - Full list of detachment stratagems with costs, timing, targets, and effects.
    - Full list of detachment enhancements with points costs and restrictions.
  - New `fetchDetachmentContext()` utility using Prisma for efficient parallel database queries.
  - Automated formatting of database rules into markdown for the LLM prompt.

### Technical
- New: `lib/fetchDetachmentContext.ts`
- Updated: `app/api/brief/analyze/route.ts` - Added context fetch and prompt injection.
- Updated: `lib/briefAnalysis.ts` - Expanded `buildBriefUserPrompt` to accept detachment context.
- Documentation: Updated `docs/features/TACTICAL_DOSSIER.md`

---

