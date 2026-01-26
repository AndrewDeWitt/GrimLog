# Grimlog Documentation

**Version:** 4.90.6
**Last Updated:** 2026-01-26
**Status:** Production Ready

## 📚 Complete Documentation Index

This is the central hub for all Grimlog documentation. Everything you need to know is organized here.

---

## 🚀 Quick Start

**New to Grimlog?** Start here:

1. **[Main README](../README.md)** - Project overview and installation
2. **[Quick Start Guide](../QUICKSTART.md)** - Get running in 5 minutes
3. **[Configuration Guide](guides/CONFIGURATION_GUIDE.md)** - Essential settings

---

## 📖 User Guides

**HOW TO use features:**

- **[Session Setup Guide](guides/SESSION_SETUP_GUIDE.md)** ⭐ NEW - How to create battles with armies
  - Army selection flow
  - Automatic unit initialization
  - Prerequisites and validation
  - Troubleshooting setup issues

- **[Army Import Guide](guides/ARMY_IMPORT_GUIDE.md)** - AI-powered army list parsing ⭐ UPDATED v4.29.1
  - Faction-first import flow (select faction before upload)
  - Dynamic faction dropdown with datasheet counts
  - Optimized parsing with faction filtering
  - Subfaction support (Space Wolves includes Space Marines datasheets)
  - ⭐ **FIXED v4.29.1** - Datasheet linking now works correctly for subfactions
  - Enhanced review UI with per-component confidence indicators
  - Post-processing weapon matching for profile variants
  - Proper wargear classification (Storm Shield, Death Totem)
  - Supported formats (images, PDFs, text)
  - Review process and validation

- **[Faction Data Import Guide](guides/FACTION_DATA_IMPORT_GUIDE.md)** ⭐ NEW v4.22.0 - Complete faction data import system
  - Scraping from Wahapedia (automated)
  - Manual JSON import
  - Admin UI import/export
  - JSON schema reference
  - Command-line tools

- **[Faction Integration Master Template](guides/FACTION_MASTER_TEMPLATE.md)** ⭐ NEW v4.52.0 - Standardized workflow for adding new factions
  - Step-by-step checklist for data acquisition
  - Scraping, parsing, and seeding commands
  - Data verification and icon management
  - Troubleshooting common import issues

- **[Wahapedia Scraping Guide](guides/WAHAPEDIA_SCRAPING_GUIDE.md)** ⭐ UPDATED v4.66.0 - How to scrape rules data from Wahapedia
  - **Multi-signal Legends/Forge World detection** (CSS class, URL, name patterns)
  - **Quality scoring system** (0-100) with metadata files
  - Scraping datasheets, stratagems, and detachments
  - Caching system with content hashing
  - Database seeding
  - Troubleshooting scraping issues

- **[Competitive Context Guide](guides/COMPETITIVE_CONTEXT_GUIDE.md)** ⭐ UPDATED v4.67.0 - Populate unit tier rankings from competitive sources
  - Add sources via Admin UI (YouTube, Goonhammer, Reddit)
  - Multi-stage pipeline: fetch → curate → extract → aggregate
  - AI-powered context extraction with Gemini 3 Flash
  - Conflict resolution when sources disagree
  - Incremental processing (add more sources anytime)
  - Troubleshooting common issues (yt-dlp, Whisper)

- **[Unit Management View Guide](guides/UNIT_MANAGEMENT_VIEW_GUIDE.md)** ⭐ DEPRECATED
  - Historical guide for the v4.5.0 Unit Management View layout
  - Replaced by the Unit Health Sheet + Unit Health Guide

- **[Unit Health Guide](guides/UNIT_HEALTH_GUIDE.md)** ⭐ UPDATED v4.32.4 - Unit Health Sheet (bottom sheet)
  - Attacker/Defender tabs with always-visible army strength
  - All Units grid with expandable inline controls
  - Individual Models grid (per-model wound controls)
  - Mixed wounds support via per-model MAX WOUNDS edits (wargear/loadout)
  - Repair tooling: Sync Models for legacy/partial per-model data

- **[Per-Model Wound Tracking Guide](guides/PER_MODEL_WOUND_TRACKING_GUIDE.md)** - Individual model tracking with smart distribution
  - Per-model health states and roles
  - Smart damage distribution
  - Role-specific targeting (sergeant, heavy weapon, etc.)
  - Voice command examples
  - Visual model grid interface
  - ⭐ **UPDATED v3.13.0** - Manual per-model controls, modal interface, wound pips

- **[Character Attachments Guide](guides/CHARACTER_ATTACHMENTS_GUIDE.md)** ⭐ UPDATED v4.31.0 - Configure and use character attachments
  - Full-page attachment editor with sticky header/footer
  - Squad numbering for duplicate units (Squad 1, Squad 2, etc.)
  - ID-based storage for reliable differentiation
  - Character display with parent units
  - Voice command targeting
  - Battle Ready presets for matchup pivots

- **[Audio & VAD Guide](guides/AUDIO_VAD_GUIDE.md)** - Complete audio capture and voice detection system
  - How VAD works
  - Multi-layer validation
  - Environment-specific tuning
  - Troubleshooting audio issues

- **[Context System Guide](guides/CONTEXT_SYSTEM_GUIDE.md)** - Context-aware analysis and smart triggers
  - Dual-endpoint system (transcribe vs analyze)
  - 5 smart analysis triggers
  - Conversation context
  - Cost optimization

- **[Validation Guide](guides/VALIDATION_GUIDE.md)** - Game rule validation system
  - AI-driven validation
  - Validation severities
  - Rules implemented
  - Override mechanism

- **[Configuration Guide](guides/CONFIGURATION_GUIDE.md)** - All configuration options
  - VAD settings
  - Analysis triggers
  - Validation thresholds
  - Environment tuning

- **[Datasheet Import Guide](guides/DATASHEET_IMPORT_GUIDE.md)** - Import official 10th edition datasheets
  - Scraping Wahapedia
  - LLM-powered parsing
  - Database import
  - Validation and testing
  - Expanding to other factions

- **[Datasheet Parser Guide](guides/DATASHEET_PARSER_GUIDE.md)** ⭐ UPDATED v4.28.0 - Enhanced parser with parallel processing
  - Smart caching and modes
  - **NEW: compositionData** - Structured unit composition with per-model wounds
  - **NEW: wargearEffects** - Stat modifications from wargear abilities
  - **NEW: --start-from=N** - Resume parsing after crashes
  - Command-line usage and troubleshooting

- **[Tactical Map User Guide](guides/TACTICAL_MAP_GUIDE.md)** ⭐ UPDATED v3.10.0 - Visual battlefield and objective tracking
  - Opening the map via split bar chart
  - Understanding deployment zones
  - Round indicators and timeline panel
  - Controlling objectives with popup selector
  - Split bar chart visualization
  - Objective timeline history
  - Optimistic UI updates
  - Mobile usage tips

- **[Tactical Advisor User Guide](guides/TACTICAL_ADVISOR_USER_GUIDE.md)** ⭐ NEW - AI-powered tactical analysis
  - Opening the advisor (keyboard shortcut `Shift+S`, menu button)
  - Understanding perspectives (Your Army vs Opponent)
  - Quick Tips vs Detailed Analysis modes
  - Reading suggestion cards and priorities
  - Mobile/tablet usage
  - Troubleshooting

- **[Strategic Assistant User Guide](guides/STRATEGIC_ASSISTANT_USER_GUIDE.md)** ⚠️ DEPRECATED - Replaced by Tactical Advisor
  - Historical guide for the old static rules filtering system
  - See [Tactical Advisor](features/TACTICAL_ADVISOR.md) for the new AI-powered system

- **[PDF Rules Import Guide](guides/PDF_RULES_IMPORT_GUIDE.md)** ⭐ NEW - Import stratagems from PDF rulebooks
  - Two-step extraction and import process
  - Using Python + GPT-5-mini Vision
  - Reviewing and editing extracted text
  - Cost estimates and parallel processing
  - Troubleshooting PDF extraction

- **[Rules System Guide](guides/RULES_SYSTEM_GUIDE.md)** ⭐ NEW v4.0.0 - Rules-based gameplay enhancement
  - Mission selection and tracking
  - Automatic secondary VP calculation
  - CP validation (max 2 CP/turn)
  - Proactive phase reminders
  - Damaged state detection
  - See also: [Rules Extensibility Guide](guides/RULES_EXTENSIBILITY_GUIDE.md)

- **[Testing Gemini Integration](guides/TESTING_GEMINI_INTEGRATION.md)** ⭐ NEW v4.4.0 - Test and compare AI providers
  - Provider switching instructions
  - Test cases for validation
  - Performance comparison between OpenAI and Gemini
  - Debugging response structures
  - Console log interpretation

---

## 🔌 API Documentation

**Technical API reference:**

- **[Transcribe Endpoint](api/TRANSCRIBE_ENDPOINT.md)** - `POST /api/transcribe`
  - Fast transcription-only endpoint
  - Build conversation context
  - Request/response formats

- **[Faction Detachments Endpoint](api/FACTION_DETACHMENTS_ENDPOINT.md)** ⭐ UPDATED v4.24.0 - `GET /api/factions/[id]/detachments`
  - Fetch available detachments for a faction
  - Includes parent faction detachments (e.g., Space Wolves gets Space Marines detachments)
  - Used in army import and detail pages
  - Filtered and sorted detachment list
  - Query optimization with distinct

- **[Unit Abilities Endpoint](api/UNIT_ABILITIES_ENDPOINT.md)** ⭐ UPDATED v4.6.0 - `GET /api/sessions/[id]/units/abilities`
  - Phase-aware ability filtering
  - Pre-computed army vs unit abilities separation
  - Cross-faction ability validation
  - Request/response formats with phase metadata
  - Examples and error handling
  - Validation rules

- **[Competitive Context Lookup Endpoint](api/COMPETITIVE_CONTEXT_LOOKUP_ENDPOINT.md)** ⭐ NEW v4.49.0 - Lookup scoped competitive context with fallback
  - Query by datasheet ID with optional `factionId` and `detachmentId`
  - Fallback logic: detachment → faction → generic
  - Returns `matchType` to indicate scope level
- **[Competitive Create From Text API](api/COMPETITIVE_CREATE_FROM_TEXT.md)** ⭐ NEW - Create sources from pasted text
- **[Datasheet Sources API](api/ADMIN_DATASHEET_SOURCES_API.md)** ⭐ NEW - CRUD for datasheet content sources
- **[Analyze Endpoint](api/ANALYZE_ENDPOINT.md)** - `POST /api/analyze` ⭐ UPDATED v4.4.0
  - Full analysis with AI and tools
  - Multi-provider support (OpenAI/Gemini)
  - Context-aware decisions
  - Tool execution
  - Complete workflow

- **[Units Endpoint](api/UNITS_ENDPOINT.md)** - `GET/POST/PATCH/DELETE /api/sessions/[id]/units`
  - Fetch unit instances
  - Initialize units from armies
  - Manual health updates
  - Unit removal

- **[CP Spent Endpoint](api/CP_SPENT_ENDPOINT.md)** ⭐ NEW - `GET /api/sessions/[id]/cp-spent`
  - Real-time CP spending statistics
  - Per-round and cumulative totals
  - Tracks stratagems and manual adjustments
  - Round boundary detection

- **[Session Stratagems Endpoint](api/SESSION_STRATAGEMS_ENDPOINT.md)** ⭐ NEW v4.38.0 - `GET /api/sessions/[id]/stratagems`
  - Phase-filtered stratagem lookup
  - Core + Faction stratagem retrieval
  - Reactive stratagem handling
  - Availability status per stratagem

- **[Datasheets API](api/DATASHEETS_API.md)** - Query datasheets, weapons, abilities, stratagems
  - Get single datasheet
  - Search datasheets
  - List faction datasheets
  - Lookup weapons and abilities
  - Get stratagems

- **[Armies Endpoint](api/ARMIES_ENDPOINT.md)** ⭐ UPDATED v4.26.0 - `GET/POST /api/armies` and `/api/armies/[id]`
  - Army listing and detail payloads
  - Detachment + attachments configuration
  - Units sub-resource

- **[Army Export Endpoint](api/ARMY_EXPORT_ENDPOINT.md)** ⭐ NEW v4.29.0 - `GET /api/armies/[id]/export`
  - Generate styled HTML army roster
  - Download as file with `?format=download`
  - Includes units, stratagems, enhancements, character attachments

- **[Parse Armies Endpoint](api/PARSE_ARMIES_ENDPOINT.md)** ⭐ UPDATED v4.24.0 - `POST /api/armies/parse`
  - AI-powered army list parsing
  - Responses API with Structured Outputs
  - Enhanced weapon matching with post-processing
  - Profile variant detection (strike/sweep, frag/krak)
  - Proper wargear classification
  - All 528 weapons sent to AI (removed 200 limit)
  - Datasheet matching with confidence scores
  - Weapon profile extraction
  - Ability matching

- **[Tactical Advisor API](api/TACTICAL_ADVISOR_API.md)** ⭐ NEW - `POST /api/tactical-advisor`
  - AI-powered tactical advice generation
  - Game state analysis with Gemini 3 Flash
  - Request/response formats with suggestion structure
  - Context building and prompt engineering
  - Error handling and retry logic

- **[Dossier Async Endpoints](api/DOSSIER_ASYNC_ENDPOINTS.md)** ⭐ UPDATED v4.70.0 - Async dossier generation
  - `POST /api/dossier/submit` - Background dossier generation
  - `GET /api/dossier/status` - Poll for completion status
  - `POST /api/dossier/dismiss` - Dismiss notifications
  - Direct function calls via `lib/dossierGenerator.ts`
  - Full Langfuse observability

- **[Dossier History & Sharing API](api/DOSSIER_HISTORY_API.md)** - Dossier management endpoints
  - `GET/PATCH/DELETE /api/dossier/[id]` - CRUD operations
  - `GET /api/dossier/list` - User history with pagination
  - `GET /api/dossier/public` - Public gallery with filtering
  - `GET /api/dossier/share/[token]` - Share token access
  - Visibility controls (private, link, public)
  - View counting for popularity sorting

- **[Dossier Async Endpoints](api/DOSSIER_ASYNC_ENDPOINTS.md)** ⭐ NEW v4.70.0 - Background generation endpoints
  - `POST /api/dossier/submit` - Quick submission, returns immediately
  - `GET /api/dossier/status` - Poll for pending/completed/failed dossiers
  - `POST /api/dossier/dismiss` - Mark notification as acknowledged
  - Smart polling with active/idle intervals
  - Database-persisted notification state

- **[Strategic Assistant API](api/STRATEGIC_ASSISTANT_API.md)** ⚠️ DEPRECATED - Replaced by Tactical Advisor API
  - Historical API documentation for static rules filtering
  - See [Tactical Advisor API](api/TACTICAL_ADVISOR_API.md) for new endpoint

- **[Manual Action Endpoint](api/MANUAL_ACTION_ENDPOINT.md)** ⭐ NEW - `POST /api/sessions/[id]/manual-action`
- **[Sessions Endpoint](api/SESSIONS_ENDPOINT.md)** ⭐ UPDATED v4.26.0 - `GET/POST /api/sessions`
  - Create new sessions with optional `attackerAttachments`
  - Initializes unit instances with attachments applied to characters

- **[Army Attachment Presets Endpoint](api/ARMY_ATTACHMENT_PRESETS_ENDPOINT.md)** ⭐ NEW v4.26.0 - `GET/POST/PATCH/DELETE /api/armies/[id]/attachment-presets`
  - CRUD for per-army attachment presets
  - Default preset support

  - Unified endpoint for manual UI actions
  - Reuses voice command logic
  - Request/response formats
  - All supported tools
  - Validation and error handling

- **[Missions API](api/MISSIONS_API.md)** ⭐ NEW v4.0.0 - `GET/POST /api/missions`
  - Fetch all available primary missions
  - Set mission for game session
  - Mission object structure
  - Request/response formats

- **[User Credits Endpoint](api/USER_CREDITS_ENDPOINT.md)** ⭐ NEW v4.58.0 - `GET /api/users/credits`
  - Fetch current user's dossier credit balance
  - Returns admin status for UI display logic
  - Authentication required

- **[Admin Users Endpoint](api/ADMIN_USERS_ENDPOINT.md)** ⭐ NEW v4.58.0 - `/api/admin/users`
  - List all users with credits (GET)
  - Adjust user credits (PATCH `/api/admin/users/[id]/credits`)
  - Admin authorization required

- **[Admin API](api/ADMIN_API.md)** ⭐ NEW v4.20.0 - Admin CRUD for Factions, Detachments, Stratagems
  - Full CRUD endpoints for factions, detachments, stratagems
  - Nested routes: `/api/admin/factions/[id]/detachments`, etc.
  - Bulk export/import operations
  - Admin authorization required

- **[Admin Icons Generate Endpoint](api/ADMIN_ICONS_GENERATE_ENDPOINT.md)** - `POST /api/admin/icons/generate`
  - Generate unit icons via Gemini image model
  - Upload to Supabase Storage with global mapping
  - Admin authorization required

- **[Admin Icons Delete Endpoint](api/ADMIN_ICONS_DELETE_ENDPOINT.md)** ⭐ NEW v4.37.0 - `DELETE /api/admin/icons/delete`
  - Delete icons from Supabase Storage and database
  - Allows regeneration of unsatisfactory icons
  - Admin authorization required

- **[Icons Resolve Endpoint](api/ICONS_RESOLVE_ENDPOINT.md)** - `GET/POST /api/icons/resolve`
  - Single and batch icon lookup
  - Cache busting via updatedAt timestamp
  - Fallback to filesystem icons

---

## ⭐ Features

**WHAT each feature is:**

### Core Systems (v4.0.0)

- **[Attacker vs Defender Terminology](features/ATTACKER_DEFENDER_TERMINOLOGY.md)** ⭐ NEW v4.0.0 - Consistent role-based terminology
  - Complete refactor from "Your/Opponent" to "Attacker/Defender"
  - Database schema changes
  - AI system integration
  - **BREAKING CHANGE** - See [Migration Guide](MIGRATION_V3_TO_V4.md)

### Game Features

- **[Points Tiers](features/POINTS_TIERS.md)** ⭐ UPDATED v4.32.3 - Comprehensive tier-based pricing system
  - **Simple tiers:** Variable model counts (e.g., 5 models = 170pts, 10 models = 340pts)
  - **Composition tiers:** Multi-model-type units (e.g., Wolf Guard Headtakers + Hunting Wolves)
  - **Add-on tiers:** Optional models with flat costs (e.g., Outrider Squad + Invader ATV +60pts)
  - Generic patterns work across all factions
  - Extracted from Wahapedia data without API costs
  - Replaces inaccurate proportional scaling

- **[Dossier Credits System](features/DOSSIER_CREDITS_SYSTEM.md)** ⭐ NEW v4.58.0 - Usage-based access control
  - 2 free generations for new Google sign-ups
  - Credit tracking per user in database
  - Admin bypass with unlimited generations
  - Admin panel for credit management
  - UI enforcement with helpful messaging

- **[Dossier Gallery](features/DOSSIER_GALLERY.md)** ⭐ NEW v4.73.0 - Public dossier showcase
  - CRT terminal header with green glow and scanlines
  - Showcase cards with spirit icon as hero image
  - Color-coded borders based on army archetype
  - Fixed header with scrollable card grid
  - Responsive grid (2/3/4 columns)

- **[My Dossiers Gallery](features/MY_DOSSIERS_GALLERY.md)** ⭐ NEW v4.75.0 - Private dossier management
  - Gallery-style layout matching Public Gallery aesthetic
  - Orange theme for private gallery (vs green public)
  - Bulk actions: multi-select delete, visibility change
  - Inline rename and search by name/tagline
  - Visual distinction for private dossiers (dimmed, lock icon)
  - Mobile filter panel with visibility filter

- **[Dossier Editing & Versioning](features/DOSSIER_EDITING_VERSIONING.md)** ⭐ NEW v4.87.0 - User content editing with version history
  - Inline editing of all AI-generated content (quirks, units, matchups, suggestions)
  - Every save creates a version snapshot with optional label/changelog
  - Version history panel with restore functionality
  - Original AI-generated v1 always preserved
  - localStorage auto-save with WIP recovery

- **[API Security](features/API_SECURITY.md)** ⭐ UPDATED v4.88.0 - Comprehensive API protection
  - **Global rate limiting** (120 req/min) on ALL API endpoints via middleware
  - **Endpoint-specific limits** for expensive AI operations (5-60 req/min)
  - Authentication, authorization, input validation, RLS defense-in-depth

- **[Admin Panel](features/ADMIN_PANEL.md)** ⭐ NEW v4.20.0 - Faction, Detachment & Stratagem management
  - Hierarchical view: Factions → Detachments → Stratagems
  - Full CRUD operations for all entity types
  - Admin-only access with `isAdmin` authorization
  - Bulk export/import for JSON data management
  - Spot-check data after mass imports
  - **NEW v4.58.0:** User Credits management panel

- **[Admin Datasheets Management](features/ADMIN_DATASHEETS_MANAGEMENT.md)** ⭐ NEW v4.23.0 - Full datasheet CRUD in admin panel
  - Dedicated `/admin/datasheets` page with advanced filtering
  - Faction detail page integration with expandable datasheets section
  - Create, edit, enable/disable, delete datasheets
  - Icon integration from Icon Generator (matched by name + faction)
  - Version tracking on each save

- **[Competitive Context Pipeline](features/COMPETITIVE_CONTEXT_PIPELINE.md)** ⭐ NEW v4.67.0 - Multi-source competitive context aggregation
  - YouTube transcript parsing via Whisper
  - Article scraping (Goonhammer, etc.)
  - AI extraction with Gemini 3 Flash
  - Two-table architecture (source preservation + synthesized view)
  - Conflict detection and resolution
- **[Competitive Context Paste](features/COMPETITIVE_CONTEXT_PASTE.md)** ⭐ v4.46.0 - Import insights via manual transcript paste
- **[Competitive Context Database](features/COMPETITIVE_CONTEXT_DATABASE.md)** ⭐ UPDATED v4.65.0 - Direct database pipeline with audio chunking
- **[Datasheet Versioning System](features/DATASHEET_VERSIONING_SYSTEM.md)** ⭐ v4.19.0 - Custom datasheets with version history
  - Create custom datasheets from scratch or fork existing ones
  - Full version history with "wayback machine" for balance updates
  - Share datasheets via private links or public library
  - Source filter tabs (ALL / OFFICIAL / MY DATASHEETS)
  - Action menu with Fork, Edit, Share, Delete options

- **[Marketing Homepage](features/MARKETING_HOMEPAGE.md)** ⭐ NEW v4.63.0 - Public-facing landing page with conversion-focused UX
  - "2 Free Analyses" banner with terminal green grimdark aesthetic
  - Interactive sample dossier preview ("Try Before You Buy")
  - Multiple sign-up CTAs throughout the page
  - Auto-redirect for logged-in users to dossier gallery
  - Mobile-first responsive design optimized for phones
  - Route separation: `/` (marketing) vs `/dossier` (functional tool)

- **[Tactical Dossier (War Room)](features/TACTICAL_DOSSIER.md)** ⭐ UPDATED v4.68.0 - Army list analysis and report generation (Gemini 3 Pro)
  - Three-pillar analysis: MathHammer, Meta Context, Objective Ecology
  - Role-based unit grouping and analysis
  - Threat assessment with strengths/weaknesses
  - Collection gaps and recommendations
  - HTML export for sharing on Reddit/Discord
  - **v4.68.0:** Analysis quality improvements - unique displayNames, synergy reasoning, leader attachment rules
  - **v4.60.0:** Dossier landing page UX refresh (hero + interactive sample preview; mobile readability improvements)
  - **v4.57.0:** List Modification Suggestions - AI-powered army improvement options with unit swaps
  - **v4.54.0:** Narrative tactical summaries with weaknesses; database-verified leader attachment validation
  - **v4.51.0:** Army Spirit hero section with AI-generated icons, playstyle blend, fun stats
  - **v4.44.0:** AI Strategic Analysis with Gemini 3 Flash (matchups, secondaries, archetype)
  - **v4.45.0:** Removed radar chart, improved response handling

- **[Damage Calculator (MathHammer)](features/DAMAGE_CALCULATOR.md)** ⭐ v4.13.0 - Statistical damage calculation tool
  - Quick modal and full-page interfaces
  - Game-aware unit and weapon selection
  - Complete modifier system (rerolls, cover, special abilities)
  - Real-time statistical calculations with probability breakdown
  - Voice command integration (`estimate_damage` tool)
  - Supports all 10th Edition combat mechanics
- **[Unit Icon Generation](features/UNIT_ICON_GENERATION.md)** ⭐ UPDATED v4.37.0 - Gemini-powered stylized icons with per-user storage
  - Bold comic book style with waist-up framing for weapon/armor visibility
  - Cache busting ensures regenerated icons display immediately
  - Delete functionality to remove and regenerate unsatisfactory icons
  - Admin dashboard for searching, selecting, generating, and deleting icons
  - Inline ✎ buttons on datasheets and unit cards
  - Google Custom Search + Gemini image generation with automatic resizing

- **[MathHammer Calculator Enhancement](features/MATHHAMMER_CALCULATOR_ENHANCEMENT.md)** ⭐ v4.14.0 - Math fixes and probability distributions
  - Corrected 10th Edition rules (Lethal Hits, Sustained Hits, Anti-X)
  - Kill probability distributions with visual bars
  - Core stratagems integration (7 calculator-relevant stratagems)
  - Stratagem toggles UI with CP tracking
  - Mortal wounds tracked separately

- **[AI Damage Calculator](features/AI_DAMAGE_CALCULATOR.md)** ⭐ NEW v4.15.0 - Voice-activated damage calculations
  - Ask "How much damage does [Unit] do to [Target]?" via voice
  - Weapon Rules Engine with phase-aware weapon selection
  - Extra Attacks handling (added IN ADDITION to main weapon)
  - All-weapon comparison showing damage for every option
  - Timeline integration with clickable damage events
  - Results modal with transparent breakdowns

- **[Global Navigation System](features/GLOBAL_NAVIGATION.md)** ⭐ v4.12.0 - Unified navigation architecture
  - Persistent header system for multi-page app structure
  - Context-aware game controls (Return to Battle)
  - "Dataslate" menu redesign with grimdark tactical aesthetic
  - Smart routing wrapper for header visibility

- **[Army Management UI](features/ARMY_MANAGEMENT_UI.md)** ⭐ NEW v4.11.0 - Army list and detail screens
- **[Army Register: Tactics & Attachments](features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md)** ⭐ UPDATED v4.31.0
  - Units-first view with full roster display
  - Tactics modal (detachment + stratagems quick-glance)
  - **NEW v4.31.0:** Full-page attachments editor (replaces modal)
  - **NEW v4.31.0:** Squad numbering for duplicate units
  - Roster shows all units with wounds breakdown

- **[Army HTML Export](features/ARMY_HTML_EXPORT.md)** ⭐ NEW v4.29.0 - Download styled army roster
  - One-click HTML export from army detail page
  - Dark grimdark theme with gold accents
  - Print-friendly CSS (auto-converts to light theme)
  - Includes composition, weapons, stratagems, abilities

  - Sorting and filtering armies by name, points, or date
  - Faction icons and professional visual design
  - Expandable stratagem lists with accurate counts
  - Enhanced stratagem cards for easy scanning
  - Character attachment interface

- **[Modal Standardization](features/MODAL_STANDARDIZATION.md)** ⭐ NEW v4.39.0 - Unified bottom sheet modal pattern
  - All 20 modals converted to consistent bottom sheet style
  - Slide-up animation with rounded top corners
  - Light slate theme for improved readability
  - Matches UnitHealthSheet.tsx visual language
  - Mobile-first design with backdrop blur

- **[Stratagem Quick Reference](features/STRATAGEM_QUICK_REFERENCE.md)** ⭐ NEW v4.38.0 - Phase-filtered stratagem lookup during gameplay
  - STRATAGEMS button in defender/attacker panels
  - Core + Faction stratagems filtered by current phase
  - Expandable cards with full stratagem details
  - Reactive stratagem and CP affordability indicators
  - Read-only reference mode

- **[Stratagem & Detachment System](features/STRATAGEM_DETACHMENT_SYSTEM.md)** ⭐ NEW v4.10.0 - Detachment-based stratagem filtering
  - Required detachment selection in army import flow
  - Live detachment switching with instant stratagem updates
  - 213+ stratagems scraped for Space Marines and divergent chapters
  - Smart filtering: shows only detachment-specific + Core stratagems
  - Boarding Actions exclusion (main gameplay only)

- **[Faction System](features/FACTION_SYSTEM.md)** ⭐ UPDATED v4.22.0 - Complete faction data with import system
  - 26 factions with complete detachments, stratagems, and enhancements
  - Space Marine chapters as separate factions (Blood Angels, Dark Angels, Space Wolves, Deathwatch)
  - Wahapedia scraper for automated data extraction
  - JSON import/export system
  - Admin UI for imports and exports

- **[Stratagem Tracking System](features/STRATAGEM_TRACKING.md)** ⭐ v4.7.0 - Complete stratagem logging and data system (see v4.10.0 update)
  - Wahapedia scraping for 213+ stratagems with detachment linking
  - Timeline visualization with Attacker/Defender badges and CP cost display
  - Automatic StratagemData linking for full rule lookup
  - Detachment system for army lists with validation
  - Space Marines, Space Wolves, and Tyranids support

- **[Phase-Aware Abilities](features/PHASE_AWARE_ABILITIES.md)** ⭐ NEW v3.9.0 - Contextual ability filtering by game phase
  - LLM-powered phase metadata extraction from ability descriptions
  - Multi-phase support and reactive ability detection
  - Timing window indicators and keyword tracking
  - New API endpoint with phase filtering
  - React hook with built-in caching
  - Visual indicators for ability types, phases, and timing

- **[Unit Health Sheet](features/UNIT_HEALTH_SHEET.md)** ⭐ NEW v4.32.4 - Bottom-sheet unit management UI
  - Attacker/Defender tabs with always-visible army strength
  - Phase Abilities / All Units toggle inside the sheet
  - Dense unit grid + generated unit icons
  - Expanded unit controls (models/wounds/battleshock/destroy)
  - Individual Models grid with mixed wound support (MAX WOUNDS edits)
  - Sync Models repair workflow for legacy/partial per-model data

- **[Unit Health View Revamp](features/UNIT_HEALTH_VIEW_REVAMP.md)** ⭐ DEPRECATED v4.32.4 - Replaced by Unit Health Sheet

- **[Unit Management View](features/UNIT_MANAGEMENT_VIEW_V3.9.md)** ⭐ DEPRECATED v4.5.0 - Previous dual-mode system
  - ⚠️ Replaced by Unit Health View Revamp
  - Management mode removed in v4.5.0
  - Filters and search removed in v4.5.0
  - See migration notes in revamp documentation

- **[Turn Order System](features/TURN_ORDER_SYSTEM.md)** ⭐ v3.11.0 - Attacker/defender turn tracking with smart round progression
  - First player selection during game setup (roll-off winner)
  - Round/turn dropdown selector (Rounds 1-5, attacker and defender)
  - Role-based color coding (green for attacker, red for defender)
  - Automatic round advancement when defender ends turn
  - Voice AI contextually understands "end of my turn"
  - Jump to any round/turn for error correction
  - Optimistic UI updates for instant responsiveness

- **[Optimistic UI Controls](features/OPTIMISTIC_UI_CONTROLS.md)** ⭐ NEW v3.8.3 - Instant feedback for all interactions
  - Simplified click-to-edit CP/VP controls (no more button arrays)
  - Mobile-optimized inline inputs with number pad support
  - Optimistic updates for all interactions (CP, VP, phases, objectives, secondaries)
  - Pattern-based cache invalidation system
  - 100ms debounced API calls for efficiency
  - Automatic rollback on API failures
  - Fixed "timeline one behind" bug

- **[UI Prominence Enhancement](UI_PROMINENCE_ENHANCEMENT_V3.8.2.md)** ⭐ v3.8.2 - Interactive depth system and visual clarity
  - Grimdark button depth with subtle shadows (no bright glows)
  - Hover-lift effects on all interactive elements
  - Color-coded event timeline (7 distinct event types)
  - Scored secondary objectives transformation (vibrant backgrounds, golden VP)
  - Responsive secondary card design (fixed overflow issues)
  - Enhanced button prominence across all components

- **[UI Color System](features/UI_COLOR_SYSTEM.md)** - Grimdark Mechanicus color palette and interactive design
  - Muted sage green replaces bright neon (#a8c5a0 vs #00ff41)
  - Consistent player (green) vs opponent (red) theming
  - 40-50% improved contrast ratios (WCAG AA compliant)
  - Optimized for distance viewing (4+ feet on tablets)
  - Interactive depth system with button shadows

- **[Round/Phase Controls Redesign](features/ROUND_PHASE_CONTROLS_REDESIGN.md)** ⭐ NEW v4.42.1 - Light grimdark controls optimized for iPad/mobile
  - Neutral slate control surfaces (no background tinting)
  - ATT/DEF chip as sole colored turn indicator (red/green badges)
  - Always-visible round/phase context (no truncation)
  - SVG visual aids (gladius/shield, per-phase icons)
  - Removed redundant elements (time icon, 1st/2nd text)
  - Compact 44px height for mobile thumb targets
  - Event timeline color palette and scoring state transformations

- **[Google Gemini Integration](features/GOOGLE_GEMINI_INTEGRATION.md)** ⭐ NEW v4.4.0 - Multi-provider AI support
  - Switch between OpenAI and Google Gemini via environment variable
  - All 24 AI tools supported on both providers
  - Structured output for JSON and function calling
  - Provider abstraction layer with response normalization
  - Full Langfuse observability for both providers
  - Cost comparison and performance analysis
  - See also: [Testing Guide](guides/TESTING_GEMINI_INTEGRATION.md)

- **[Voice Analysis Orchestrator](features/ORCHESTRATOR_OPTIMIZATION.md)** ⭐ ENHANCED v4.4.0 - Multi-provider tool-specific context optimization
  - Intent classification supports both OpenAI (gpt-5-nano) and Gemini (gemini-2.5-flash)
  - Six-tier context system (minimal/units_only/unit_names/objectives/secondaries/full)
  - Request deduplication prevents race conditions
  - Tool-aware intent classification with explicit mappings
  - 30-70% token reduction on most operations
  - 50-70% faster for simple operations
  - Zero duplicate request processing

- **[Analyze Performance Optimization](features/ANALYZE_PERFORMANCE_OPTIMIZATION.md)** ⭐ UPDATED v4.4.0 - 88-95% faster response times with multi-provider support
  - Optimized GPT-5 reasoning effort (minimal/low vs default medium)
  - Combined gatekeeper + intent classification (single AI call)
  - Removed observeOpenAI wrapper overhead (10-15s per call eliminated)
  - Reduced 44-second responses to 5 seconds in production
  - Detailed timing logs for diagnostics
  - Provider selection and validation

- **[Responses API Integration](features/RESPONSES_API_MIGRATION.md)** ⭐ NEW - Modern OpenAI API with structured outputs
  - Migrated from Chat Completions to Responses API
  - Internally-tagged tool definitions
  - Better caching (40-80% improvement)
  - 3% better model intelligence
  - Future-proof for next-gen models

- **[Tool Calling with Structured Outputs](features/TOOL_CALLING_STRUCTURED_OUTPUTS.md)** ⭐ NEW - Enforced tool execution behavior
  - Tool-calling agent (not conversational)
  - JSON schema validation on all tools
  - Direct execution using fuzzy matching
  - Automatic cache invalidation
  - No clarifying questions

- **[Army Parser Datasheet System](features/ARMY_PARSER_DATASHEET_SYSTEM.md)** ⭐ UPDATED v4.30.0 - AI army list parsing with comprehensive matching
  - **NEW v4.30.0:** Improved AI exact-match emphasis preventing similar-name confusion (Logan Grimnar ≠ Ragnar Blackmane)
  - **NEW v4.30.0:** Alphabetically sorted datasheets for better AI attention
  - **NEW v4.30.0:** Enhanced Langfuse logging with full unit match details
  - **NEW v4.30.0:** Fixed wargear review flagging (only unmatched/low confidence)
  - Enhanced review UI with per-component confidence indicators
  - Post-processing weapon matching for profile variants
  - Proper wargear classification (Storm Shield, Death Totem)
  - Faction and name validation to prevent mismatches
  - Automatic review flagging for low-confidence matches
  - Responses API with Structured Outputs
  - Full datasheet matching with stats
  - Confidence scoring and review flags

- **[Datasheet Integration](features/DATASHEET_INTEGRATION.md)** - Official 10th edition rules database
  - Wahapedia scraping system
  - LLM-powered parsing
  - Normalized database schema
  - Rules validation engine
  - AI context enhancement

- **[Gatekeeper Validation](features/GATEKEEPER_VALIDATION.md)** - LLM-based cost optimization system
  - Filters non-game conversation before expensive analysis
  - 50-70% cost savings on API calls
  - Context-aware classification
  - Fail-open design
  - Confidence-based filtering

- **[Timeline Animations](features/TIMELINE_ANIMATIONS.md)** - Reverse chronological timeline with epic animations
  - Newest-first event display
  - Slide down bounce entrance
  - Glowing pulse effects
  - Smart state persistence
  - Performance optimizations

- **[Whisper Timestamps](features/WHISPER_TIMESTAMPS.md)** - Accurate event timestamps from audio segments
  - Segment-level timestamp extraction
  - True chronological event ordering
  - No duplicate timestamps
  - Timestamp matching algorithm

- **[Smart Unit Matching](features/SMART_UNIT_MATCHING.md)** - Fuzzy matching for unit names and nicknames
  - Common nickname recognition
  - Fuzzy string matching
  - Ambiguity detection
  - User learning feedback

- **[Game State Correction & Revert System](features/REVERT_SYSTEM.md)** ⭐ NEW v4.5.0 - Comprehensive undo and correction system
  - Voice-activated reverts: "undo", "take back", "actually it was X not Y"
  - Manual UI controls: "⎌ UNDO" button on every timeline event
  - Full audit trail with soft deletes (events never permanently deleted)
  - Intelligent cascade detection warns about subsequent events
  - Complete state restoration: CP, VP, phases, objectives, unit health, status effects
  - Expandable revert details show all affected events
  - Grouped consecutive reverts for clean timeline
  - Distinct amber color coding for revert actions
  - 100% state revertibility for all tracked game changes

- **[Secondary Objectives System](features/SECONDARY_OBJECTIVES_SYSTEM.md)** ⭐ UPDATED v4.6.1 - Chapter Approved 2025-26 secondary missions
  - 19 fully-integrated secondary missions with database storage
  - Voice command scoring with 7 specialized AI tools
  - Smart scoring guardrails (tactical once-per-turn, turn caps)
  - **NEW v4.6.1** - [Secondary Selection Modal Redesign](features/SECONDARY_SELECTION_MODAL_REDESIGN.md) - Grim dark UI overhaul
  - Full-screen modal with dynamic player color theming
  - High-contrast white text on dark backgrounds for readability
  - Mobile-first responsive design (stacked on phones, side-by-side on tablets)
  - Unified interface replacing 6+ legacy components
  - Discard/redraw with CP tracking (1 extra CP per turn)
  - Restore functionality to undo accidental discards

- **[Per-Model Wound Tracking](features/PER_MODEL_WOUND_TRACKING.md)** ⭐ NEW - Granular model-level health tracking
  - Individual model states with role awareness
  - Smart damage distribution algorithm
  - Character attachment system
  - Visual model grid display
  - Voice command integration
  - Auto-initialization and backward compatibility

- **[Tactical Advisor](features/TACTICAL_ADVISOR.md)** ⭐ NEW - AI-powered tactical analysis system
  - Dynamic game state analysis with Gemini 3 Flash
  - Dual perspective toggle (Your Army / Opponent)
  - Quick Tips and Detailed Analysis modes
  - Priority-based suggestions with category classification
  - Context-aware recommendations (unit health, CP, objectives, stratagems)
  - Light-colored suggestion cards for improved readability
  - Keyboard shortcut integration (`Shift+S`)

- **[Strategic Assistant](features/STRATEGIC_ASSISTANT.md)** ⚠️ DEPRECATED - Replaced by Tactical Advisor
  - Historical documentation for static rules filtering system
  - See [Tactical Advisor](features/TACTICAL_ADVISOR.md) for new AI-powered system

- **[Mission System](features/MISSION_SYSTEM.md)** ⭐ NEW v4.0.0 - Primary mission tracking and scoring
  - 7 tournament missions from Chapter Approved
  - Mission selection UI with details
  - Automatic VP calculation based on objectives
  - Mission-aware AI prompts
  - Scoring phase reminders

- **[Secondary Auto-Calculation](features/SECONDARY_OBJECTIVES_AUTO_CALCULATION.md)** ⭐ NEW v4.0.0 - Intelligent secondary scoring
  - 6 specialized auto-calculation tools
  - Rules-based VP calculation (Assassination, Bring It Down, etc.)
  - Validation (active check, max VP, per-turn caps)
  - Progress tracking by round
  - Voice integration

- **[Manual UI Controls](features/MANUAL_UI_CONTROLS.md)** ⭐ NEW - Comprehensive manual alternatives for all voice actions
  - Phase control with dropdown and next button
  - Victory Points and Command Points adjusters
  - Secondary Objectives modal
  - Stratagem Logger modal
  - Tactical Map integration
  - Unified manual action API

- **[Tactical Map System](features/TACTICAL_MAP.md)** ⭐ UPDATED v3.10.0 - Visual battlefield representation with deployment zones
  - 2 verified deployment types (Hammer and Anvil, Search and Destroy)
  - Always horizontal 60×44 orientation
  - Interactive objective markers with 2×2 grid popup
  - Attacker/Defender terminology matching official cards
  - Full-screen portal rendering (z-index 9999)
  - Round indicators (1-5) with visual state tracking
  - Objective timeline panel with battle history
  - Optimistic UI updates for instant feedback
  - Split bar chart visualization on dashboard
  - Smart popup positioning for edge objectives
  - Mobile-first design with touch optimization

- **[Unit Health Tracking](features/UNIT_HEALTH_TRACKING.md)** - Real-time unit health monitoring
- **[Unit Management View](features/UNIT_MANAGEMENT_VIEW_V3.9.md)** ⭐ NEW v3.13.0 - Comprehensive unit management with filters and phase actions
- **[Speech API & Header Captions](features/SPEECH_API_AND_CAPTIONS.md)** ⭐ UPDATED v4.40.0 - Browser speech + stable captions
  - Web Speech API for real-time, free transcription
  - Static header captions with dropdown history
  - Buffered sentence assembly (no flicker)
  - Consolidated `/api/analyze` text input
  - **NEW v4.40.0:** Warhammer 40K vocabulary recognition with phonetic corrections
  - Model and wound tracking
  - Visual health bars
  - Half-strength warnings
  - Voice + manual controls
  - Battlefield role organization

- **[AI Tool Calling](features/AI_TOOL_CALLING.md)** - 14 intelligent tools for game tracking
  - Tool definitions
  - Execution flow
  - Adding new tools
  - Unit health tools

- **[Langfuse Observability](features/LANGFUSE_OBSERVABILITY.md)** ⭐ UPDATED v4.90.0 - Complete LLM tracing and cost monitoring
  - **NEW:** Token usage extraction and cost calculation for all Gemini calls
  - **NEW:** Unified dossier trace (army parse → analysis → suggestions)
  - Setup script for model pricing configuration (`scripts/setup-langfuse-models.ts`)
  - Trace structure and debugging

- **[Vertex AI Migration](features/VERTEX_AI_MIGRATION.md)** ⭐ UPDATED v4.90.6 - Production-grade Vertex AI with Workload Identity Federation
  - Zero-secret authentication using WIF (no API keys in production)
  - **NEW v4.90.6:** Service account impersonation for local development (mirrors production)
  - **NEW v4.90.6:** Global endpoint support for Gemini 3 preview models
  - **NEW v4.90.6:** JSON sanitization for control character handling
  - **NEW v4.90.6:** Streaming error recovery with partial object fallback
  - Migrated to Vercel AI SDK (`@ai-sdk/google-vertex`)
  - Complete setup guide with GCP Console instructions

- **[Session Management](features/SESSION_MANAGEMENT.md)** - Complete game session lifecycle
  - Creating and resuming sessions
  - Session persistence
  - Timeline tracking
  - Replay system

- **[Game State Tracking](features/GAME_STATE_TRACKING.md)** - Real-time game state
  - CP/VP tracking
  - Objective control
  - Secondary objectives
  - Dashboard UI

---

## 🏗️ Architecture

**System design and structure:**

- **[Architecture Overview](ARCHITECTURE.md)** - Complete system architecture
  - Tech stack
  - Component hierarchy
  - Data flow
  - Design decisions

- **[Project Status](PROJECT_STATUS.md)** - Current project state
  - Features implemented
  - Technical details
  - Performance metrics
  - Roadmap

---

## 🐛 Troubleshooting

**FIX common problems:**

- **[Unit Health Sync Issues](troubleshooting/UNIT_HEALTH_SYNC_ISSUES.md)** ⭐ NEW v4.41.0 - Fix modelsArray/currentModels mismatches and UI refresh issues
- **[Session Creation Undefined ID](troubleshooting/SESSION_CREATION_UNDEFINED_ID.md)** - Session not loading after creation (Fixed in v3.4.1)
- **[React Hook Order Error](troubleshooting/REACT_HOOK_ORDER_ERROR.md)** - Fix "change in the order of Hooks called by …" runtime errors
- **[Mixed Wound Units Setup](troubleshooting/MIXED_WOUND_UNITS_SETUP.md)** - Configure units with different wound profiles
- **[Per-Model Manual Controls](troubleshooting/PER_MODEL_MANUAL_CONTROLS.md)** - Troubleshoot per-model tracking
- **[Per-Model Wound Calculation Fix](troubleshooting/PER_MODEL_WOUND_CALCULATION_FIX.md)** - Fix wound calculation errors
- **Audio/VAD Issues** - See [Audio Guide § Troubleshooting](guides/AUDIO_VAD_GUIDE.md#troubleshooting)
- **AI Detection Issues** - See [Context Guide § Testing](guides/CONTEXT_SYSTEM_GUIDE.md#testing)
- **Validation Issues** - See [Validation Guide § Troubleshooting](guides/VALIDATION_GUIDE.md#troubleshooting)
- **Main README Troubleshooting** - See [README § Troubleshooting](../README.md#troubleshooting)

---

## 💻 Development

**For contributors:**

- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
  - Code standards
  - Documentation rules
  - PR process
  - Development workflow

- **[Documentation Standards](DOCUMENTATION_STANDARDS.md)** ⭐ - Complete documentation rulebook
  - 10 mandatory rules
  - File naming conventions
  - Post-feature checklist
  - Examples and violations

- **[Security Scanning Guide](guides/SECURITY_SCANNING_GUIDE.md)** ⭐ NEW v4.89.0 - DevSecOps workflow
  - npm audit, Gitleaks, Semgrep, ESLint security
  - Pre-commit hooks (Husky)
  - GitHub Actions CI pipeline
  - Supabase security configuration

- **[CHANGELOG](../CHANGELOG.md)** - Version history
  - Recent changes
  - Breaking changes
  - Upgrade guides

---

## 📊 Documentation Organization

### Current Structure

```
docs/
├── README.md                          # This file
├── ARCHITECTURE.md                    # System architecture
├── PROJECT_STATUS.md                  # Current state
│
├── guides/                           # User guides (HOW TO)
│   ├── SESSION_SETUP_GUIDE.md       # ⭐ NEW - Session creation
│   ├── ARMY_IMPORT_GUIDE.md         # ⭐ NEW - Army list parsing
│   ├── AUDIO_VAD_GUIDE.md           # Audio & VAD system
│   ├── CONTEXT_SYSTEM_GUIDE.md      # Context & analysis
│   ├── VALIDATION_GUIDE.md          # Validation system
│   └── CONFIGURATION_GUIDE.md       # All settings
│
├── api/                              # API documentation
│   ├── TRANSCRIBE_ENDPOINT.md       # /api/transcribe
│   ├── ANALYZE_ENDPOINT.md          # /api/analyze
│   ├── UNITS_ENDPOINT.md            # ⭐ NEW - /api/sessions/[id]/units
│   ├── PARSE_ARMIES_ENDPOINT.md     # ⭐ NEW - /api/armies/parse
│   ├── DATASHEETS_API.md            # ⭐ NEW - Datasheet queries
│   ├── STRATEGIC_ASSISTANT_API.md   # ⭐ NEW - Strategic rules API
│   └── MANUAL_ACTION_ENDPOINT.md    # ⭐ NEW - Manual UI action API
│
├── troubleshooting/                  # Troubleshooting guides (FIX)
│   ├── UNIT_HEALTH_SYNC_ISSUES.md   # ⭐ NEW v4.41.0 - Unit health sync fixes
│   ├── MIXED_WOUND_UNITS_SETUP.md   # Mixed wound configuration
│   ├── PER_MODEL_MANUAL_CONTROLS.md # Per-model tracking issues
│   ├── PER_MODEL_WOUND_CALCULATION_FIX.md # Wound calculation fixes
│   ├── REACT_HOOK_ORDER_ERROR.md    # React hook errors
│   └── SESSION_CREATION_UNDEFINED_ID.md  # Session creation bug
│
└── features/                         # Feature documentation
    ├── FACTION_SYSTEM.md            # ⭐ NEW - Faction hierarchy system
    ├── ARMY_PARSER_DATASHEET_SYSTEM.md  # ⭐ NEW - Army parsing with datasheets
    ├── DATASHEET_INTEGRATION.md     # ⭐ NEW - Wahapedia datasheet system
    ├── GATEKEEPER_VALIDATION.md     # ⭐ NEW - LLM cost optimization
    ├── MANUAL_UI_CONTROLS.md        # ⭐ NEW - Manual controls for all actions
    ├── ROUND_PHASE_CONTROLS_REDESIGN.md  # ⭐ NEW v4.42.1 - Light grimdark controls
    ├── TACTICAL_MAP.md              # ⭐ NEW - Visual battlefield system
    ├── TIMELINE_ANIMATIONS.md       # Reverse timeline & animations
    ├── WHISPER_TIMESTAMPS.md        # Segment-level timestamps
    ├── SMART_UNIT_MATCHING.md       # Fuzzy unit name matching
    ├── UNIT_HEALTH_TRACKING.md      # Unit health system
    ├── AI_TOOL_CALLING.md           # AI tools
    ├── LANGFUSE_OBSERVABILITY.md    # LLM tracing
    ├── SESSION_MANAGEMENT.md        # Sessions
    ├── SPEECH_API_AND_CAPTIONS.md   # Browser Speech API
    └── GAME_STATE_TRACKING.md       # Game state
```

### Documentation Types

**4 Types:**

1. **Guides** - Step-by-step HOW TO use features
2. **API Docs** - Technical reference for endpoints
3. **Features** - WHAT features are and how they work
4. **Troubleshooting** - FIX problems and debug issues

---

## 🎯 Find Documentation By...

### By Task

**"I want to set up Grimlog"**
→ [Main README](../README.md) → [Quick Start](../QUICKSTART.md)

**"I want to create a battle session"** ⭐  
→ [Session Setup Guide](guides/SESSION_SETUP_GUIDE.md)

**"I want to import my army list"** ⭐  
→ [Army Import Guide](guides/ARMY_IMPORT_GUIDE.md) → [Army Parser Feature](features/ARMY_PARSER_DATASHEET_SYSTEM.md)

**"I want to create custom datasheets"** ⭐ NEW  
→ [Datasheet Versioning System](features/DATASHEET_VERSIONING_SYSTEM.md)

**"I want to track unit health"** ⭐  
→ [Unit Health Tracking](features/UNIT_HEALTH_TRACKING.md)

**"I want to manually control game actions"** ⭐ NEW  
→ [Manual UI Controls](features/MANUAL_UI_CONTROLS.md) → [Tactical Map](features/TACTICAL_MAP.md)

**"I want tactical advice for my game"** ⭐ NEW  
→ [Tactical Advisor User Guide](guides/TACTICAL_ADVISOR_USER_GUIDE.md) → [Tactical Advisor Feature](features/TACTICAL_ADVISOR.md)

**"I want to analyze my army list"** ⭐ NEW  
→ [Tactical Dossier](features/TACTICAL_DOSSIER.md)

**"I want to configure audio/VAD"**
→ [Audio Guide](guides/AUDIO_VAD_GUIDE.md) → [Configuration Guide](guides/CONFIGURATION_GUIDE.md)

**"I want to understand how analysis works"**
→ [Context System Guide](guides/CONTEXT_SYSTEM_GUIDE.md)

**"I want to optimize API costs"** ⭐ NEW  
→ [Gatekeeper Validation](features/GATEKEEPER_VALIDATION.md)

**"I want to add a new AI tool"**
→ [AI Tool Calling](features/AI_TOOL_CALLING.md)

**"I want to debug AI issues"**
→ [Langfuse Observability](features/LANGFUSE_OBSERVABILITY.md)

**"Audio isn't working"**
→ [Audio Guide § Troubleshooting](guides/AUDIO_VAD_GUIDE.md#troubleshooting)

**"I want to parse datasheets faster"** ⭐ NEW  
→ [Datasheet Parser Guide](guides/DATASHEET_PARSER_GUIDE.md)

**"I want to contribute"**
→ [Contributing Guide](../CONTRIBUTING.md)

### By User Type

**New User:**
1. [Main README](../README.md)
2. [Quick Start](../QUICKSTART.md)
3. [Audio Guide](guides/AUDIO_VAD_GUIDE.md)

**Developer:**
1. [Architecture](ARCHITECTURE.md)
2. [Contributing](../CONTRIBUTING.md)
3. [API Docs](api/)

**Contributor:**
1. [Contributing](../CONTRIBUTING.md)
2. [Project Status](PROJECT_STATUS.md)
3. [CHANGELOG](../CHANGELOG.md)

**Debugger:**
1. [Troubleshooting Guides](guides/)
2. [Langfuse Observability](features/LANGFUSE_OBSERVABILITY.md)
3. [Project Status](PROJECT_STATUS.md)

### By Topic

**Audio/Voice:**
- [Audio & VAD Guide](guides/AUDIO_VAD_GUIDE.md)
- [Main README § Voice Activity Detection](../README.md#voice-activity-detection)

**AI & Analysis:**
- [Context System Guide](guides/CONTEXT_SYSTEM_GUIDE.md)
- [Gatekeeper Validation](features/GATEKEEPER_VALIDATION.md) ⭐ NEW
- [AI Tool Calling](features/AI_TOOL_CALLING.md)
- [Langfuse Observability](features/LANGFUSE_OBSERVABILITY.md)

**Validation:**
- [Validation Guide](guides/VALIDATION_GUIDE.md)

**Sessions:**
- [Session Setup Guide](guides/SESSION_SETUP_GUIDE.md) ⭐ NEW
- [Session Management](features/SESSION_MANAGEMENT.md)

**Timeline & Events:** ⭐ NEW
- [Timeline Animations](features/TIMELINE_ANIMATIONS.md)
- [Event Log Unit Icons](features/EVENT_LOG_UNIT_ICONS.md) ⭐ NEW v4.42.0
- [Whisper Timestamps](features/WHISPER_TIMESTAMPS.md)

**Unit Tracking:** ⭐ NEW
- [Unit Health Tracking](features/UNIT_HEALTH_TRACKING.md)
- [Smart Unit Matching](features/SMART_UNIT_MATCHING.md)
- [Units API](api/UNITS_ENDPOINT.md)

**Army Management:** ⭐ NEW
- [Army Import Guide](guides/ARMY_IMPORT_GUIDE.md)
- [Army Parser Datasheet System](features/ARMY_PARSER_DATASHEET_SYSTEM.md)
- [Parse Armies API](api/PARSE_ARMIES_ENDPOINT.md)

**Datasheet Parsing:** ⭐ NEW
- [Datasheet Parser Guide](guides/DATASHEET_PARSER_GUIDE.md)
- [Datasheet Import Guide](guides/DATASHEET_IMPORT_GUIDE.md)
- [Datasheet Integration](features/DATASHEET_INTEGRATION.md)

**Game State:**
- [Game State Tracking](features/GAME_STATE_TRACKING.md)

**Configuration:**
- [Configuration Guide](guides/CONFIGURATION_GUIDE.md)

---

## 📈 Recent Updates

### Version 4.63.0 (January 8, 2026) ⭐ LATEST
**Marketing Homepage & Route Separation:**
- ✅ **Marketing Homepage** - Public-facing landing page (`/`) with grimdark terminal green "2 Free Analyses" banner
- ✅ **Route Separation** - `/` (marketing) vs `/dossier` (functional tool) vs `/dossier/gallery` (logged-in landing)
- ✅ **Grimdark Aesthetic** - Terminal green styling, CRT scanlines, corner brackets, emerald-700 CTAs
- ✅ **Multiple CTAs** - Sign-up buttons in banner, sample preview, and features section
- ✅ **Auto-Redirect** - Logged-in users automatically sent to gallery, unauthenticated redirected from `/dossier` to `/`
- ✅ **Mobile-First** - Optimized for phones with responsive text, centered layouts, hidden icons
- ✅ See [Marketing Homepage](features/MARKETING_HOMEPAGE.md) for details

### Version 4.61.0 (January 7, 2026)
**Gemini 3 Pro Upgrade for Tactical Dossier:**
- ✅ **AI Model Upgrade** - Switched from `gemini-3-flash-preview` to `gemini-3-pro-preview` for deeper reasoning
- ✅ **Thinking Config** - Added `thinkingLevel: 'high'` for strategic analysis, `minimal` for army parsing
- ✅ **Prompt Optimization** - Streamlined prompts for Gemini 3's reasoning model (context-first structure)
- ✅ **Sample Output Updated** - "The Frost-Clad Avalanche" showcases improved analysis quality
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) for details

### Version 4.60.0 (January 6, 2026)
**Tactical Dossier Landing Page UX Refresh:**
- ✅ **True Landing Page** - Hero + "Try Before You Buy" flow for `/dossier`
- ✅ **Interactive Sample Preview** - Collapsible sample dossier output (no iframe)
- ✅ **Mobile Readability** - Increased mobile typography and full-width layouts
- ✅ **Reduced Visual Noise** - Removed distracting "lens flare" background glow
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) for details

### Version 4.59.0 (January 5, 2026)
**Environment Separation & Auth Specialization:**
- ✅ See [CHANGELOG](../CHANGELOG.md) for details

### Version 4.58.0 (January 4, 2026)
**Production Security & Dossier Credits System:**
- ✅ **Dossier Credits** - 2 free generations for Google sign-ups, admin bypass
- ✅ **API Security Hardening** - All LLM endpoints require authentication
- ✅ **Admin User Management** - New `/admin/users` panel for credit management
- ✅ **Proper Error Responses** - 401/403 instead of 500 for auth failures
- ✅ **LLM Token Limits** - Prevents runaway generation and cost overruns
- ✅ **Security Test Suite** - 19 automated endpoint tests
- ✅ See [Dossier Credits System](features/DOSSIER_CREDITS_SYSTEM.md) and [API Security](features/API_SECURITY.md) for details

### Version 4.57.0 (January 3, 2026)
**List Modification Suggestions & Unified Spirit Icon Generation:**
- ✅ **List Modification Suggestions** - AI-powered army improvement recommendations with 2 independent options
- ✅ **Complex Swap Support** - Single suggestion can remove multiple units and add multiple units
- ✅ **Full Datasheet Context** - LLM sees all faction units, can suggest adding more of existing units
- ✅ **Unified Spirit Icon** - Generation moved to backend, eliminates duplicate generation
- ✅ **Streaming LLM Responses** - Prevents timeouts on large analyses (5+ minutes)
- ✅ **HTML Export Enhancement** - Suggestions section with unit icons in exported reports
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) and [Dossier API](api/DOSSIER_ASYNC_ENDPOINTS.md) for details

### Version 4.56.0 (January 2, 2026)
**Enhanced Dossier Analysis Prompts & Competitive Context Integration:**
- ✅ **Competitive Context Integration** - Dossier analysis now includes tier rankings, synergies, and counter matchups when available
- ✅ **Enhanced Weakness Schema** - Added `specificCounterArmies` and `mitigationStrategy` fields for more actionable vulnerability analysis
- ✅ **Refined Prompt Guidance** - Focus on theory-crafting and available options rather than specific gameplay sequences
- ✅ **Improved Stratagem Formatting** - Tactical usage hints help LLM understand when to leverage detachment-specific stratagems
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) and [Dossier API](api/DOSSIER_ASYNC_ENDPOINTS.md) for details

### Version 4.54.0 (December 31, 2025)
**Narrative Tactical Summaries & Leader Rules Accuracy:**
- ✅ **Narrative Unit Summaries** - Overhauled unit guides to use plain English advice (no numbers) including weaknesses and counterpoints
- ✅ **Leader Attachment Accuracy** - Recommendations now powered by verified database rules, preventing character attachment hallucinations
- ✅ **Server-Side Enrichment** - New enrichment layer ensures analysis is based on official rules even when parsed data is imperfect
- ✅ **Full Datasheet Context** - Removed 150-char truncation on abilities; AI now receives complete rules text for improved strategic depth
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) for details

### Version 4.53.0 (December 31, 2025)

### Version 4.51.0 (December 30, 2025)
**Dossier Army Spirit & Viral Insights:**
- ✅ **Army Spirit Hero Section** - AI-generated unique icons, taglines, and spirit descriptions
- ✅ **Playstyle Blend Analysis** - Primary/secondary archetypes (Alpha Strike, Counterpunch, Castle, etc.)
- ✅ **Combat Spectrum** - Melee ↔ Shooting slider visualization
- ✅ **Dynamic Fun Stats** - AI picks 3-4 creative stats unique to each army
- ✅ **Icon Generation API** - Gemini image generation with Supabase Storage persistence
- ✅ **Streamlined Sections** - Removed redundant sections, consolidated to 9 focused components
- ✅ **HTML Export Major Enhancement** - All images embedded as base64 data URIs for 100% offline sharing; added static synergy network visualization; high-contrast layout parity with React UI
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) for details

### Version 4.50.0 (December 29, 2025)
**Competitive Context UI Enhancements:**
- ✅ See [Competitive Context Database](features/COMPETITIVE_CONTEXT_DATABASE.md) for details

### Version 4.49.0 (December 29, 2025)
**Faction/Detachment-Specific Competitive Context:**
- ✅ **Scoped Context Storage** - New `DatasheetCompetitiveContext` table stores context per `(datasheet, faction, detachment)` combination
- ✅ **Three Scope Levels** - Generic (all armies), Faction-specific, Detachment-specific
- ✅ **Intelligent Fallback** - Lookup tries detachment → faction → generic
- ✅ **Detachment Tagging** - Sources can be tagged with specific detachments via UI dropdown
- ✅ **Batch Aggregation** - `--aggregate-all --faction-name "Space Wolves"` processes all units at once
- ✅ **Enhanced Robustness** - 65536 max output tokens, 10-minute timeouts, JSON repair for truncated responses
- ✅ **Langfuse Tracing** - Full observability for curation pipeline
- ✅ **43 Units Aggregated** - Complete Space Wolves competitive context (S/A/B/C tier ratings)
- ✅ See [Competitive Context Database](features/COMPETITIVE_CONTEXT_DATABASE.md) for details

### Version 4.48.0 (December 28, 2025)
**Faction-Level Competitive Sources Pipeline:**
- ✅ **Faction-Level Sources** - Sources now added at faction level, AI identifies and links relevant datasheets
- ✅ **Multi-Stage Pipeline** - `--fetch-pending` → `--curate-pending` → `--extract-pending` → `--aggregate`
- ✅ **Multi-Source Support** - YouTube, Reddit, Articles, Forums all supported with dedicated scrapers
- ✅ **Context Aggregation** - Synthesizes all sources into final competitive context on datasheets
- ✅ **Enhanced Modal** - Datasheet editor fetches fresh data, shows linked sources and extraction status
- ✅ See [Competitive Context Database](features/COMPETITIVE_CONTEXT_DATABASE.md) for details

### Version 4.47.0 (December 27, 2025)
**Competitive Context Database & Offline Fetching:**
- ✅ **Database Extension** - New `DatasheetSource` table links individual YouTube/article sources to specific units
- ✅ **Admin Management UI** - New dashboard at `/admin/competitive-context` with advanced datasheet search/filtering
- ✅ **Offline Batch Processing** - Python script now supports `--fetch-pending` flag for automated transcript fetching and context extraction
- ✅ **Bulk Update API** - High-performance endpoint for synchronizing script results with the central database
- ✅ See [Competitive Context Database](features/COMPETITIVE_CONTEXT_DATABASE.md) for details

### Version 4.46.0 (December 27, 2025)
**Competitive Context Paste & Model Upgrade:**
- ✅ **Paste Transcript Workflow** - Replaced flaky Node.js YouTube fetching with robust manual paste interface
- ✅ **Gemini 3 Flash Upgrade** - Upgraded all extraction endpoints to `gemini-3-flash-preview`
- ✅ **Noise-Tolerant Parsing** - AI now handles messy auto-transcripts and phonetic misspellings
- ✅ **Limitless Context** - Removed context window limits for large transcripts (up to 500k chars)
- ✅ See [Competitive Context Paste](features/COMPETITIVE_CONTEXT_PASTE.md) and [API Docs](api/COMPETITIVE_CREATE_FROM_TEXT.md)

### Version 4.45.0 (December 25, 2025)
**Dossier Analysis Improvements:**
- ✅ **Removed Radar Chart** - Removed "Army Profile" radar chart from UI and HTML export in favor of more actionable role-based analysis
- ✅ **Removed Token Limit** - Removed `maxOutputTokens: 30000` limit, allowing Gemini to use default maximum for comprehensive responses
- ✅ **Truncation Detection** - Added pre-parse validation to detect truncated responses with clear error messages
- ✅ **Fixed JSON Parse Errors** - Resolved `SyntaxError: Unterminated string in JSON` errors from truncated AI responses
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) and [Dossier API](api/DOSSIER_ASYNC_ENDPOINTS.md) for details

### Version 4.44.0 (December 25, 2025)
**AI Strategic Dossier Analysis:**
- ✅ **AI-Powered Strategic Insights** - Gemini 3 Flash analyzes army composition
- ✅ **Executive Summary** - 2-3 sentence overview of army identity and playstyle
- ✅ **Army Archetype Classification** - Horde, elite, balanced, skew, etc. with explanation
- ✅ **Strategic Strengths/Weaknesses** - Detailed analysis with severity ratings
- ✅ **Matchup Considerations** - Performance vs common archetypes (horde, gunline, etc.)
- ✅ **Secondary Recommendations** - Strong picks, avoid picks, scoring potential
- ✅ **Collection Recommendations** - Units to add with priority and alternatives
- ✅ **Enhanced Capability Detection** - Deep Strike/Scouts/Infiltrate via keyword analysis
- ✅ **Full Langfuse Tracing** - Context spans, generation tracking, faction tags
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) and [Dossier API](api/DOSSIER_ASYNC_ENDPOINTS.md) for details

### Version 4.43.0 (December 24, 2025)
**Tactical Dossier (War Room):**
- ✅ **Army Analysis Page** - New `/dossier` page for comprehensive army evaluation
- ✅ **Three-Pillar Analysis** - MathHammer, Meta Context, Objective Ecology
- ✅ **Radar Chart** - 5-axis visualization (Killing Power, Durability, Mobility, Board Control, Flexibility)
- ✅ **Threat Assessment** - Overall rating with strengths and weaknesses
- ✅ **Collection Gaps** - Actionable recommendations for army improvements
- ✅ **HTML Export** - Self-contained shareable document
- ✅ See [Tactical Dossier](features/TACTICAL_DOSSIER.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.42.0 (December 22, 2025)
**Event Log Unit Icons with Action Indicators:**
- ✅ **Unit Icons in Timeline** - 48x48px icons displayed inline with event descriptions
- ✅ **Custom Icon Support** - User-uploaded icons with role-based emoji fallbacks
- ✅ **Action Category Borders** - Red (damage), amber (stratagem), purple (action), blue (status)
- ✅ **Badge Overlays** - Models killed, CP costs, action types, status indicators
- ✅ **Batch Icon Resolution** - Efficient loading using `useUnitIcons` hook
- ✅ See [Event Log Unit Icons](features/EVENT_LOG_UNIT_ICONS.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.40.0 (December 21, 2025)
**Warhammer 40K Vocabulary Recognition:**
- ✅ **Phonetic Correction System** - 200+ corrections for common speech-to-text errors
- ✅ **Vocabulary Generator** - Extracts 1,971 terms from Wahapedia data
- ✅ **Dynamic AI Context** - Session-aware phonetic hints for current army units
- ✅ **Real-time Display** - Corrected terms shown as user speaks
- ✅ Examples: "term against" → Termagants, "tyranno flex" → Tyrannofex
- ✅ See [Speech API & Captions](features/SPEECH_API_AND_CAPTIONS.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.39.2 (December 20, 2025)
**Speech Analysis Debounce & Context Capture Fix:**
- ✅ **Race Condition Fixed** - Partial speech no longer analyzed prematurely
- ✅ **Hybrid Debounce System** - 500ms buffer accumulates transcripts before AI analysis
- ✅ **AbortController Integration** - In-flight requests cancelled when new speech arrives
- ✅ **Complete Context** - Full sentences sent instead of fragmented partial requests
- ✅ See [Context System Guide](guides/CONTEXT_SYSTEM_GUIDE.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.39.0 (December 20, 2025)
**Modal Bottom Sheet Standardization:**
- ✅ **20 Modals Converted** - All modals now use consistent bottom sheet pattern
- ✅ **Light Slate Theme** - Improved readability with `bg-grimlog-slate-light`
- ✅ **Slide-Up Animation** - Smooth entrance from bottom of screen
- ✅ **Rounded Top Corners** - Consistent `rounded-t-xl` styling
- ✅ **Backdrop Blur** - Semi-transparent blur effect for depth
- ✅ **Neutral Colors** - Removed player-specific colors from stratagem reference
- ✅ See [Modal Standardization](features/MODAL_STANDARDIZATION.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.38.0 (December 20, 2025)
**Stratagem Quick Reference:**
- ✅ **STRATAGEMS Button** - New button in defender/attacker panels for quick access
- ✅ **Phase-Filtered Display** - Shows available stratagems for current game phase
- ✅ **Core + Faction Stratagems** - Loads universal stratagems plus army-specific ones
- ✅ **Expandable Cards** - Click to view full stratagem details (when, target, effect)
- ✅ **Reactive Handling** - Stratagems usable during opponent's turn properly highlighted
- ✅ **CP Affordability** - Visual indicators for stratagems player can afford
- ✅ See [Stratagem Quick Reference](features/STRATAGEM_QUICK_REFERENCE.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.37.0 (December 20, 2025)
**Icon Generation Improvements:**
- ✅ **Icon Delete Functionality** - Remove and regenerate unsatisfactory icons
- ✅ **Cache Busting** - Regenerated icons display immediately
- ✅ **Comic Book Style** - Bold illustration style for better icon clarity
- ✅ See [Unit Icon Generation](features/UNIT_ICON_GENERATION.md) for details

### Version 4.36.0 (January 18, 2025)
**AI Tactical Advisor:**
- ✅ **Complete Rework** - Strategic Assistant replaced with AI-powered Tactical Advisor
- ✅ **Gemini 3 Flash Integration** - Dynamic game state analysis with contextual suggestions
- ✅ **Dual Perspective** - Toggle between Your Army and Opponent perspectives
- ✅ **Two Detail Levels** - Quick Tips (3-5) or Detailed Analysis (5-10 suggestions)
- ✅ **Priority-Based Cards** - High/Medium/Low priority with color coding
- ✅ **Improved Scanability** - Event Log-style rows + unit icon strips in Quick Tips
- ✅ **Play the Mission** - Primary mission + objective marker context included in suggestions
- ✅ **Keyboard Shortcut** - `Shift+S` to open/close modal
- ✅ See [Tactical Advisor](features/TACTICAL_ADVISOR.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.32.1 (December 14, 2025)
**Subfaction Stratagem Resolution Fix:**
- ✅ **Fixed 0 Stratagems Bug** - Space Wolves and other subfaction armies now correctly show stratagems
- ✅ **Parent Faction Lookup** - Stratagem query includes both army faction AND parent faction
- ✅ **Detachment Access** - Subfactions can use parent faction detachments (e.g., Space Wolves using Stormlance Task Force)
- ✅ See [Armies Endpoint](api/ARMIES_ENDPOINT.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.31.0 (December 14, 2025)
**Attachments UX Overhaul:**
- ✅ **Full-Page Attachments Editor** - Dedicated `/armies/[id]/attachments` route with sticky header/footer
- ✅ **Squad Numbering** - Duplicate units now display as "Wolf Guard Terminators (Squad 1)", "(Squad 2)", etc.
- ✅ **ID-Based Storage** - Attachments stored by unit ID instead of name for reliable differentiation
- ✅ **Portal-Based Dropdowns** - Dropdowns escape scroll containers, no more clipping issues
- ✅ **Auto-Migration** - Legacy name-based attachments automatically converted to ID-based on load
- ✅ See [Character Attachments Guide](guides/CHARACTER_ATTACHMENTS_GUIDE.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.30.0 (December 14, 2025) 🎯
**Army Parser AI Matching & Logging Improvements:**
- ✅ **Fixed Wargear Review Flags** - Properly matched wargear (Storm Shield, Death Totem) no longer flagged as issues
- ✅ **AI Exact-Match Emphasis** - Logan Grimnar no longer confused with Ragnar Blackmane
- ✅ **Alphabetically Sorted Datasheets** - Better AI attention on similar names
- ✅ **Enhanced Langfuse Logging** - Full content, datasheet list, unit match details, problem matches
- ✅ **ID in Name Line** - Datasheet format now `[uuid] DATASHEET: "Name" (pts)` for unambiguous matching
- ✅ See [Army Parser Datasheet System](features/ARMY_PARSER_DATASHEET_SYSTEM.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.29.0 (December 14, 2025) 📄
**Army Roster HTML Export:**
- ✅ **One-Click Export** - New `📄 EXPORT` button in army detail page toolbar
- ✅ **Styled HTML Document** - Dark grimdark theme with Cinzel + Crimson Pro fonts
- ✅ **Complete Content** - Units, composition, wounds, weapons, abilities, stratagems, enhancements
- ✅ **Character Attachments** - Visual display of leader → unit relationships
- ✅ **Print-Ready** - Auto-converts to light theme when printing
- ✅ **Direct Download** - File saved as `{army-name}_roster.html`
- ✅ See [Army HTML Export](features/ARMY_HTML_EXPORT.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.28.0 (December 13, 2025) 📥
**Datasheet Import: Composition & Wargear Effects:**
- ✅ **Unit Composition Data** - Structured parsing for units with mixed wound profiles (Prime + regular models)
- ✅ **Wargear Stat Modifications** - Extract stat changes from wargear (Relic Shield → wounds: 6)
- ✅ **Resume Feature** - `--start-from=N` flag to resume parsing after crashes
- ✅ **144 Datasheets Updated** - Tyranids (48) + Space Marines (96) with full compositionData
- ✅ See [Datasheet Parser Guide](guides/DATASHEET_PARSER_GUIDE.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.27.0 (December 13, 2025)
**Army Screen Cleanup: Unified Attachments Modal:**
- ✅ **Units-First View** - Main content always shows the units roster (no tab switching)
- ✅ **Unified Attachments Modal** - Combined attachment editing + preset management in one place
- ✅ **Cleaner Toolbar** - Single "⭐ ATTACHMENTS" button opens the unified modal
- ✅ **Removed Complexity** - No more mobile tabs, sticky footer, or split-column layout
- ✅ See [Army Register: Tactics & Attachments](features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.26.0 (December 13, 2025)
**Army Register: Tactics & Battle Ready Presets:**
- ✅ **Tactics Modal** - Detachment + stratagems grouped Core vs Detachment with search
- ✅ **Roster Improvements** - Shows all units + roster wounds breakdown
- ✅ **Battle Ready Presets** - Named attachment loadouts + per-battle overrides in session setup
- ✅ **New APIs** - Sessions supports `attackerAttachments`; new preset CRUD endpoints
- ✅ See [Army Register: Tactics & Attachments](features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.24.0 (December 10, 2025)
**Army Parser Review UI & Weapon Matching Enhancements:**
- ✅ **Enhanced Review UI** - Per-component confidence indicators, inline issue display, "Mark as Reviewed" button
- ✅ **Weapon Matching Post-Processing** - Automatic base name matching for profile variants (strike/sweep, frag/krak)
- ✅ **Wargear Classification Fix** - Storm Shield, Death Totem now correctly classified as wargear (not weapons)
- ✅ **AI Prompt Improvements** - Comprehensive weapon naming conventions, all 528 weapons sent to AI
- ✅ **Detachment Access** - Subfactions (Space Wolves) now include parent faction detachments (Space Marines)
- ✅ **Review Flag Logic Fix** - Only shows review UI when actual issues detected (not AI's internal flags)
- ✅ See [Army Parser Datasheet System](features/ARMY_PARSER_DATASHEET_SYSTEM.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.23.0 (December 4, 2025)
**Faction Data Import System:**
- ✅ **26 Factions Imported** - All major factions with complete data
- ✅ **970 Stratagems** - Full stratagem database with CP costs, types, effects
- ✅ **654 Enhancements** - All enhancements with points costs
- ✅ **165 Detachments** - Complete detachment abilities
- ✅ **40 Army Rules** - Faction-level abilities (Synapse, Oath of Moment, etc.)
- ✅ **Wahapedia Scraper** - `scrapeWahapediaComplete.ts` for automated extraction
- ✅ **JSON Import System** - `importFaction.ts` with validation
- ✅ **Chapter Separation** - Blood Angels, Dark Angels, Space Wolves, Deathwatch as separate factions
- ✅ **Admin UI Import/Export** - Web interface for data management
- ✅ See [Faction Data Import Guide](guides/FACTION_DATA_IMPORT_GUIDE.md) for details

### Version 4.21.0 (December 1, 2025) 🏛️
**Flat Faction Architecture & Detachment Normalization:**
- ✅ **Flat Faction Model** - Removed parent/child hierarchy, all factions now top-level
- ✅ **Complete Rosters** - Each chapter has its own duplicated datasheet collection
- ✅ **Unit Restrictions** - `isEnabled` flag for chapter-specific restrictions (Black Templars no PSYKER, etc.)
- ✅ **Detachment Normalization** - 60 detachments created, 301 stratagems linked
- ✅ **Core Faction** - Universal stratagems centralized in new "Core" faction
- ✅ **Migration Scripts** - `migrateFactionHierarchy.ts`, `normalizeDetachments.ts`
- ✅ See [Faction System](features/FACTION_SYSTEM.md) for details

### Version 4.19.0 (November 29, 2025) 📋
**Datasheet Versioning & Custom Datasheets:**
- ✅ **Custom Datasheets** - Create from scratch or fork existing datasheets
- ✅ **Version History** - "Wayback machine" for tracking balance updates over time
- ✅ **Sharing System** - Private links or public library for community datasheets
- ✅ **Library UI** - Source tabs (ALL/OFFICIAL/MY DATASHEETS), action menus, visual badges
- ✅ **10+ New API Endpoints** - Full CRUD, versioning, sharing, and import functionality
- ✅ See [Datasheet Versioning System](features/DATASHEET_VERSIONING_SYSTEM.md) for details.

### Version 4.17.0 (November 28, 2025) ☁️
**Per-User Icon Storage (Vercel Blob):**
- ✅ **Per-User Cloud Storage** - Icons stored in Vercel Blob, each user has their own library.
- ✅ **Database Tracking** - New `UnitIcon` model links icons to users with blob URLs.
- ✅ **Icon Resolution API** - New `/api/icons/resolve` endpoint for user-specific icons.
- ✅ **Instant Updates** - Icons appear immediately after generation without page refresh.
- ✅ See [Unit Icon Generation](features/UNIT_ICON_GENERATION.md) for details.

### Version 4.16.0 (November 28, 2025) 🎨
**Unit Icon Generation Workflow:**
- ✅ **Admin Icon Dashboard** - Filter datasheets, run Google Custom Search, and generate icons with Gemini.
- ✅ **Inline ✎ Buttons** - One-click editing from datasheets and live unit cards.
- ✅ **Gemini Integration** - Uses `gemini-2.5-flash-image` (Nano Banana) for stylization.
- ✅ See [Unit Icon Generation](features/UNIT_ICON_GENERATION.md) for details.

### Version 4.15.0 (November 26, 2025) ⚔️
**AI Damage Calculator (Voice-Activated):**
- ✅ **Voice Damage Questions** - Ask "How much damage does [Unit] do to [Target]?"
- ✅ **Weapon Rules Engine** - Phase-aware weapon selection (melee for Fight, ranged for Shooting)
- ✅ **Extra Attacks Fix** - Weapons with EXTRA ATTACKS now added IN ADDITION to main weapon
- ✅ **All-Weapon Comparison** - See damage for every available weapon option
- ✅ **Timeline Integration** - Click damage_calc events to re-view calculations
- ✅ **Results Modal** - Transparent breakdowns showing weapon + extra attacks = total
- ✅ See [AI Damage Calculator](features/AI_DAMAGE_CALCULATOR.md) for details

### Version 4.14.0 (November 25, 2025) 🧮
**MathHammer Calculator Enhancement:**
- ✅ **Corrected Math Engine** - Fixed Lethal Hits, Sustained Hits, Anti-X per 10th Edition rules
- ✅ **Probability Distributions** - Kill probability calculations with visual bars
- ✅ **Core Stratagems** - 11 core stratagems with 7 calculator-relevant effects
- ✅ **Enhanced UI** - Stratagem toggles, CP tracking, mortal wounds display
- ✅ See [MathHammer Calculator Enhancement](features/MATHHAMMER_CALCULATOR_ENHANCEMENT.md) for details

### Version 4.12.0 (November 22, 2025) 🌍
**Global Navigation & Grimdark UI:**
- ✅ **Global Navigation** - Persistent header on all pages with context-aware controls
- ✅ **Dataslate Menu** - Floating grimdark menu panel with tactical aesthetics
- ✅ **Army Cogitator** - Redesigned `/armies` screen with unified toolbar and card drawers
- ✅ **Session Manager** - Redesigned `/sessions` screen with "Active Operations" focus
- ✅ **Smart Routing** - NavigationWrapper handles header switching automatically
- ✅ See [Global Navigation](features/GLOBAL_NAVIGATION.md) and [CHANGELOG](../CHANGELOG.md) for details

### Version 4.9.0 (November 19, 2025) 🏛️

**Divergent Chapter Support:**
- ✅ **Faction Hierarchy** - Parent/Child relationships (Space Wolves → Space Marines)
- ✅ **Smart Seeding** - Normalized faction names and keyword-based resolution
- ✅ **Enhanced Validation** - Rules-based unit borrowing with keyword restrictions
- ✅ **Data Cleanup** - Removed duplicate datasheets and fixed incorrect links
- ✅ See [Faction System](features/FACTION_SYSTEM.md) and [CHANGELOG](../CHANGELOG.md) for full details

### Version 4.8.0 (November 18, 2024) 🎯

**Faction Normalization & Import UX:**
- ✅ **Faction-First Import** - Select faction before upload for faster parsing
- ✅ **Dynamic Faction List** - Real-time datasheet counts from database
- ✅ **Optimized Parsing** - 80% faster with faction filtering
- ✅ **Subfaction Support** - Space Wolves gets shared Space Marine units
- ✅ **Stratagem Display** - Auto-loaded stratagems on army detail page

### Version 4.7.0 (November 18, 2024) 🎲

**Stratagem Tracking:**
- ✅ **Timeline Badges** - Attacker/Defender and CP cost indicators
- ✅ **Wahapedia Scraping** - 130+ stratagems with rules text
- ✅ **Detachment System** - Army list validation and linking
- ✅ **Data Linking** - Automatic connection to rule database

### Version 3.10.0 (October 31, 2025) 🗺️

**Tactical Map Major Update:**
- ✅ **Objective Timeline Panel** - View complete battle history of objective changes
- ✅ **Round Indicators** - Visual 1-5 round tracker in map header
- ✅ **Split Bar Chart** - New objective visualization on dashboard
- ✅ **Optimistic UI Updates** - Instant feedback, no lag on objective changes
- ✅ **Portal Rendering** - True full-screen modal (z-index 9999, above hamburger menu)
- ✅ **Enhanced Data Logging** - Tracks round, phase, previous state for analytics
- ✅ **Smart Popup Positioning** - Auto-flips based on available screen space
- ✅ **Shared Battlefield Control** - Single objective display between player panels
- ✅ **Mobile-First UX** - Bottom close button, tap feedback, natural discovery
- ✅ **Timeline Metadata** - Rich context for battle reports and pattern analysis
- ✅ See [Tactical Map](features/TACTICAL_MAP.md) and [CHANGELOG](../CHANGELOG.md) for full details

### Version 3.6.0 (October 26, 2025) 🗺️

**Tactical Map Redesign:**
- ✅ **Always Horizontal** - Fixed 60"×44" orientation (removed toggle)
- ✅ **2 Verified Deployments** - Hammer and Anvil, Search and Destroy (accurate to official cards)
- ✅ **Attacker/Defender Labels** - Changed from Your/Opponent to match official terminology
- ✅ **2×2 Grid Popup** - Compact state selector above objectives
- ✅ **Geometric Data Structure** - Rectangle, triangle, circle primitives with precise measurements
- ✅ **Visual Enhancements** - Center crosshairs, outer border, larger markers for mobile
- ✅ **Single Log Per Selection** - No more multiple entries from cycling states
- ✅ **Custom Line Styling** - Support for colored and dashed divider lines

### Version 3.5.0 (October 24, 2025) 🎮

**Manual UI Controls & Tactical Map:**
- ✅ **Manual Controls** - Every voice action now has manual UI alternative
- ✅ **Phase Control** - Dropdown selector and next phase button
- ✅ **Victory Points** - Manual +/- adjustment controls
- ✅ **Secondary Objectives** - Modal for setting/editing secondaries
- ✅ **Stratagem Logger** - Manual stratagem entry with CP validation
- ✅ **Tactical Map** - Visual battlefield with deployment zones and objectives
- ✅ See [Manual UI Controls](features/MANUAL_UI_CONTROLS.md) and [Tactical Map](features/TACTICAL_MAP.md) for details

### Version 3.4.1 (October 24, 2025) 🐛

**Bug Fixes:**
- ✅ **Session Creation Fix** - Fixed critical bug where new sessions failed to load after creation
- ✅ Corrected response parsing for POST `/api/sessions` endpoint
- ✅ Session ID now properly stored in localStorage
- ✅ Initial redirect flow works correctly with loaded session data
- ✅ See [troubleshooting docs](troubleshooting/SESSION_CREATION_UNDEFINED_ID.md) for technical details

### Version 3.4.0 (October 23, 2025)

**Strategic Assistant Feature:**
- ✅ Phase-aware rules panel with stratagems and abilities
- ✅ Two-column layout: Opportunities vs Threats
- ✅ Voice activation and AI integration
- ✅ PDF import pipeline with GPT-5-mini Vision
- ✅ Mobile-optimized design

### Version 3.2.0 (October 18, 2025)

**Army Parser Responses API Migration:**
- ✅ **Responses API Migration** - Chat Completions → Responses API with Structured Outputs
- ✅ **Comprehensive Datasheet Matching** - Full stats, weapons, abilities with confidence scores
- ✅ **Enhanced Import UI** - Expandable cards, weapon profiles, ability descriptions
- ✅ **Database Schema Changes** - Removed UnitTemplate, added datasheetId to Unit model
- ✅ **Session Optimization** - 90% reduction in database connections with createMany
- ✅ **Duplicate Unit Support** - Explicit AI instructions for handling duplicate units
- ✅ **Type Safety** - 100% type-safe with Structured Outputs vs ~90% with JSON mode

**Performance:**
- ✅ Session creation: 5.5s → <1s (82% faster)
- ✅ Database connections: 30 → 3 (90% reduction)
- ✅ Parse accuracy: Improved with full datasheet context

### Version 3.1.1 (October 17, 2025)

**Database Seeding Robustness:**
- ✅ **100% Import Success** - All 96 Space Marines datasheets imported successfully
- ✅ **Data Cleaning Pipeline** - Automatic null byte and empty string normalization
- ✅ **Duplicate Prevention** - Smart handling of weapons with multiple profiles
- ✅ **244 Weapons Imported** - Fully deduplicated across all units
- ✅ **184 Abilities Imported** - Normalized and ready for AI context

**Fixes:**
- ✅ Fixed null byte (`\x00`) handling causing PostgreSQL UTF-8 errors
- ✅ Fixed duplicate weapon constraint violations
- ✅ Fixed empty subfaction string validation errors
- ✅ Added comprehensive data sanitization before database insertion

### Version 3.1.0 (October 17, 2025)

**Parser Performance & Usability:**
- ✅ **Parallel Processing** - 5 concurrent API requests (80% faster)
- ✅ **Smart Caching** - Automatic skip of already-parsed datasheets
- ✅ **Real-time Progress** - Visual progress bar with batch visibility
- ✅ **OpenAI Responses API** - Migration for better performance and lower costs
- ✅ **Command-line Flags** - `--override-all`, `--retry-failed`, `--help`

**Performance:**
- ✅ Full faction parse: 96 seconds → 20 seconds
- ✅ Cached runs: 96 seconds → 2 seconds (98% improvement)
- ✅ 40-80% better cache utilization with Responses API

### Version 2.9.0 (October 9, 2025)

**Major Features Added:**
- ✅ **LLM Gatekeeper Validation** - Cost optimization system filters non-game conversation
- ✅ 50-70% reduction in API costs
- ✅ Context-aware classification with GPT-5-mini
- ✅ Enhanced Langfuse tracing with full prompt capture
- ✅ Confidence-based filtering (default 0.7 threshold)

**Cost Savings:**
- ✅ Gatekeeper check: ~$0.0001 per classification
- ✅ Full analysis saved: ~$0.015-0.03 per blocked call
- ✅ Expected ROI: 99% savings on filtered casual conversation

### Version 2.8.0 (October 8, 2025)

**Major Features Added:**
- ✅ Browser Speech Recognition (Chrome/Edge) - Zero-cost real-time transcription
- ✅ Static header captions with dropdown history
- ✅ Consolidated analysis pipeline with text input
- ✅ PostgreSQL database migration

### Version 2.7.0 (December 19, 2024)

**Major Features Added:**
- ✅ Unit Health UI redesign with compact/medium views
- ✅ Optimistic UI updates (<5ms responsiveness)
- ✅ Smart health displays adapting to unit types
- ✅ Unit role icon system with visual identification
- ✅ 96% faster updates, 40% more units visible

**See [CHANGELOG](../CHANGELOG.md) for complete details.**

---

## 📊 Documentation Statistics

- **Total Documentation Files:** ~41
- **User Guides:** 15
- **API Documentation:** 8
- **Troubleshooting Guides:** 6
- **Feature Documentation:** 19
- **Total Lines:** ~25,000+
- **Status:** ✅ Complete and organized

---

## 🎓 Learning Path

### Beginner (Getting Started)

1. [Main README](../README.md) - Understand what Grimlog is
2. [Quick Start](../QUICKSTART.md) - Get it running
3. [Audio Guide](guides/AUDIO_VAD_GUIDE.md) - Configure audio

### Intermediate (Understanding the System)

4. [Context System Guide](guides/CONTEXT_SYSTEM_GUIDE.md) - How analysis works
5. [Validation Guide](guides/VALIDATION_GUIDE.md) - How validation works
6. [Session Management](features/SESSION_MANAGEMENT.md) - How sessions work

### Advanced (Customization & Development)

7. [Architecture](ARCHITECTURE.md) - System design
8. [API Documentation](api/) - Endpoint reference
9. [Contributing](../CONTRIBUTING.md) - How to contribute
10. [Langfuse](features/LANGFUSE_OBSERVABILITY.md) - Advanced debugging

---

## 💡 Key Concepts

### Core Systems

1. **Dual-Endpoint Design**
   - Transcribe frequently (every 5s) → Build context
   - Analyze intelligently (smart triggers) → Make decisions

2. **Context-Aware Analysis**
   - AI receives 10-15 transcripts + game state
   - Smart triggers detect natural boundaries
   - 63% cost reduction vs. fixed intervals

3. **Multi-Layer Validation**
   - Client-side audio analysis
   - Server-side file validation
   - Transcription quality validation
   - 35% cost savings

4. **Always Execute Philosophy**
   - Actions never blocked by validation
   - User can always override
   - System is advisory, not restrictive

---

## 🆘 Getting Help

### If you can't find what you need:

1. **Check this index** - Navigation by task/topic/user type
2. **Search documentation** - Use browser find (Ctrl+F)
3. **Check troubleshooting** - In relevant guides
4. **Review Langfuse traces** - For AI issues
5. **Open GitHub issue** - For bugs or feature requests

---

## 🙏 Contributing to Documentation

Found an error? Documentation unclear? Want to add examples?

**See [Contributing Guide](../CONTRIBUTING.md) § Documentation Standards**

Key rules:
- Follow the 4 documentation types
- Use proper file naming
- Update after completing features
- Cross-reference related docs
- No temporary session notes

---

**Everything is documented and organized!** 🎉

Navigate with confidence. The Machine God illuminates the path. ⚙️