# Grimlog Documentation Map

**Version:** 4.55.0  
**Last Updated:** 2026-01-01

Quick reference guide to find the documentation you need.

## 🚀 Getting Started

**New to Grimlog?** Start here:

1. **[Main README](../README.md)** - Overview, installation, basic usage
2. **[Quick Start Guide](../QUICKSTART.md)** - Get running in 5 minutes
3. **[Documentation Index](README.md)** - Complete documentation overview

## 🎯 Feature Documentation

### Core Systems (v4.0.0)
- **[Attacker vs Defender Terminology](features/ATTACKER_DEFENDER_TERMINOLOGY.md)** ⭐ NEW v4.0.0
  - Consistent role-based terminology system
  - Database schema and AI integration
  - **BREAKING CHANGE** - See [Migration Guide](MIGRATION_V3_TO_V4.md)

### User Experience
- **[Optimistic UI Controls](features/OPTIMISTIC_UI_CONTROLS.md)** ⭐ v3.8.3
  - Instant feedback for all interactions
  - Simplified click-to-edit CP/VP controls
  - Pattern-based cache invalidation
  - Fixed "timeline one behind" bug

### AI & Analysis
- **[Analyze Performance Optimization](features/ANALYZE_PERFORMANCE_OPTIMIZATION.md)** ⭐
  - 88-95% faster response times (44s → 5s)
  - GPT-5 reasoning effort optimization
  - Combined gatekeeper + intent classification
  - Detailed performance analysis and timing logs

- **[AI Tool Calling System](features/AI_TOOL_CALLING_SETUP.md)**
  - How the 17 AI tools work
  - Tool definitions and execution flow
  - Adding new tools

- **[Voice Analysis Orchestrator](features/ORCHESTRATOR_OPTIMIZATION.md)** ⭐
  - Intelligent request routing with tiered context
  - Intent classification with gpt-5-nano
  - Request deduplication

- **[Langfuse Integration](features/LANGFUSE_INTEGRATION.md)** ⭐
  - Complete LLM observability setup
  - Trace structure and visualization
  - Cost tracking and performance monitoring
  - Debugging AI decisions

### Game Management
- **[AI Damage Calculator](features/AI_DAMAGE_CALCULATOR.md)** ⭐ NEW v4.15.0
  - Voice-activated damage questions ("How much damage does X do to Y?")
  - Weapon Rules Engine with phase-aware selection
  - Extra Attacks handled correctly (added to main weapon)
  - All-weapon comparison with damage breakdowns
  - Clickable timeline events for historical review

- **[MathHammer Calculator Enhancement](features/MATHHAMMER_CALCULATOR_ENHANCEMENT.md)** ⭐ v4.14.0
  - Corrected 10th Edition math (Lethal Hits, Sustained Hits, Anti-X)
  - Kill probability distributions with visual bars
  - Core stratagems integration (7 calculator-relevant)
  - Stratagem toggles UI with CP tracking

- **[Global Navigation System](features/GLOBAL_NAVIGATION.md)** ⭐ v4.12.0
  - Grimdark menu redesign
  - Unified header system
  - Navigation wrapper logic

- **[Secondary Objectives System](features/SECONDARY_OBJECTIVES_SYSTEM.md)** ⭐ NEW v4.6.0
  - GameRule-based schema migration
  - 19 missions from Chapter Approved 2025-26 v1.2
  - Manual and voice scoring with VP integration
  - Revert support with full VP restoration
  - Structured vpCalculation for accurate scoring

- **[Unit Health Sheet](features/UNIT_HEALTH_SHEET.md)** ⭐ NEW v4.32.4
  - Bottom-sheet unit health + phase abilities UI (iPad-first)
  - Attacker/Defender tabs with always-visible army strength
  - Dense unit grid with generated unit icons
  - Per-model grid with mixed wounds + MAX WOUNDS edits
  - Sync Models repair tooling for legacy/partial per-model data

- **[Unit Management View](features/UNIT_MANAGEMENT_VIEW_V3.9.md)** ⭐ DEPRECATED
  - Replaced by Unit Health Sheet

- **[Session System](features/SESSION_SYSTEM.md)**
  - Creating and managing game sessions
  - Session persistence and recovery
  - Timeline event tracking

- **[Game State Dashboard](features/GAME_STATE_DASHBOARD_GUIDE.md)**
  - CP/VP tracking
  - Objective control
  - Secondary objectives

## 🔄 Migration Guides

- **[Migration Guide v3 → v4](MIGRATION_V3_TO_V4.md)** ⭐ NEW - Upgrading to Attacker/Defender terminology
  - Breaking changes overview
  - Database migration SQL
  - Testing and verification
  - Rollback procedures

## 🐛 Troubleshooting

- **[Per-Model Wound Calculation Fix](troubleshooting/PER_MODEL_WOUND_CALCULATION_FIX.md)** ⭐ v3.13.0
  - Units not calculating model deaths from wounds
  - Wound-to-model conversion logic
  - Lazy initialization for backward compatibility

- **[Per-Model Manual Controls](troubleshooting/PER_MODEL_MANUAL_CONTROLS.md)** ⭐ NEW v3.13.0
  - Dead models showing in UI
  - Manual per-model control buttons
  - Optimistic updates in modal
  
- **[Mixed-Wound Units Setup](troubleshooting/MIXED_WOUND_UNITS_SETUP.md)** ⭐ NEW v3.13.0
  - Setting up units with mixed wounds (Raveners, Bladeguard, etc.)
  - Datasheet compositionData format
  - Total wound calculation
  - Initialization process

- **[Reload Bug Fix](troubleshooting/RELOAD_BUG_FIX.md)**
  - Fixes for page reload issues
  - Error handling improvements
  - Debugging techniques

- **[Main README - Troubleshooting](../README.md#troubleshooting)**
  - Microphone issues
  - AI detection problems
  - Database errors

## 📖 Reference

### Architecture
- **[Documentation Index](README.md)** - Tech stack, data flow, project structure

### Version History
- **[CHANGELOG](../CHANGELOG.md)** - Detailed version history with upgrade guides

### Recent Work
- **[CHANGELOG](../CHANGELOG.md)** - All version history and recent changes (replaces legacy session notes)

## 📁 File Organization

```
docs/
├── README.md                    # Main documentation index
├── DOCUMENTATION_MAP.md         # This file - quick navigation
├── archive/                     # Archived/deprecated documentation
├── features/                   # Feature-specific guides
│   ├── TACTICAL_DOSSIER.md      # ⭐ UPDATED v4.53.0
│   ├── LANGFUSE_INTEGRATION.md
│   ├── AI_TOOL_CALLING_SETUP.md
│   ├── SESSION_SYSTEM.md
│   └── GAME_STATE_DASHBOARD_GUIDE.md
└── troubleshooting/            # Problem-solving guides
    └── RELOAD_BUG_FIX.md
```

## 🔍 Find by Topic

### Audio & Voice
- Voice Activity Detection → [Main README](../README.md#voice-activity-detection)
- Microphone Issues → [Troubleshooting](../README.md#microphone-not-working)

### AI & LLMs
- AI Analysis Pipeline → [Main README](../README.md#ai-analysis-pipeline-with-langfuse-tracing)
- Tool Calling → [AI Tool Calling](features/AI_TOOL_CALLING_SETUP.md)
- Observability → [Langfuse Integration](features/LANGFUSE_INTEGRATION.md)
- Prompt Engineering → [Langfuse Integration](features/LANGFUSE_INTEGRATION.md#detailed-prompt-visibility)

### Database
- Schema → `prisma/schema.prisma`
- Migrations → [Main README](../README.md#installation)
- Session Storage → [Session System](features/SESSION_SYSTEM.md)

### Deployment
- Environment Variables → [Main README](../README.md#set-up-environment-variables)
- Production Setup → [Main README](../README.md#deployment)
- Vercel Deployment → [Main README](../README.md#deploy-to-vercel)

### Cost & Performance
- **Performance Optimization** → [Analyze Performance Optimization](features/ANALYZE_PERFORMANCE_OPTIMIZATION.md) ⭐ NEW
- Token Tracking → [Langfuse Integration](features/LANGFUSE_INTEGRATION.md#whats-being-tracked)
- Cost Monitoring → [Langfuse Integration](features/LANGFUSE_INTEGRATION.md#benefits)
- Performance Metrics → [Documentation Index](README.md#performance-metrics)
- Timing Logs → [Analyze Performance Optimization](features/ANALYZE_PERFORMANCE_OPTIMIZATION.md)

## 💡 Common Questions

### "How do I see what the AI is actually doing?"
→ [Langfuse Integration Guide](features/LANGFUSE_INTEGRATION.md)

### "Why is my app reloading randomly?"
→ [Reload Bug Fix Guide](troubleshooting/RELOAD_BUG_FIX.md)

### "How do I add a new AI tool?"
→ [AI Tool Calling System](features/AI_TOOL_CALLING_SETUP.md)

### "How do sessions work?"
→ [Session System Guide](features/SESSION_SYSTEM.md)

### "What's new in the latest version?"
→ [CHANGELOG](../CHANGELOG.md)

### "How much does running this cost?"
→ [Langfuse Integration - Cost Tracking](features/LANGFUSE_INTEGRATION.md#whats-being-tracked)

### "Why is the analyze API slow?"
→ [Analyze Performance Optimization](features/ANALYZE_PERFORMANCE_OPTIMIZATION.md)

## 🛠️ Development Resources

### Code Reference
- **AI Tools**: `lib/aiTools.ts`
- **Tool Handlers**: `lib/toolHandlers.ts`
- **Langfuse Client**: `lib/langfuse.ts`
- **Audio Capture**: `lib/audioCapture.ts`
- **Type Definitions**: `lib/types.ts`

### API Documentation
- All endpoints listed in [Documentation Index](README.md#api-endpoints)

### Testing
- Testing workflow in [Documentation Index](README.md#testing-with-langfuse)

## 📚 Learning Path

### Beginner
1. Read [Main README](../README.md)
2. Follow [Quick Start](../QUICKSTART.md)
3. Try voice commands
4. View first traces in Langfuse

### Intermediate
1. Understand [AI Tool Calling](features/AI_TOOL_CALLING_SETUP.md)
2. Explore [Session System](features/SESSION_SYSTEM.md)
3. Review [Game State Dashboard](features/GAME_STATE_DASHBOARD_GUIDE.md)

### Advanced
1. Deep dive into [Langfuse Integration](features/LANGFUSE_INTEGRATION.md)
2. Review source code in `lib/` and `app/api/`
3. Customize prompts and tools
4. Set up custom Langfuse dashboards

## 🔄 Recent Updates

**Version 4.53.0 (December 31, 2025)** 🛡️ LATEST
- AI Unit Tactical Summaries for every unit in the dossier
- AI Tactical Role Assignments (Hammer, Anvil, Utility, Specialist, etc.)
- Expanded Role System with reasoning-based assignments
- Enhanced Playstyle and Combat Focus assessment logic
- Simplified Unit Profile Cards focused on AI guidance

**Version 4.51.0 (December 30, 2025)**
- Army Spirit Hero Section with AI-generated icons and taglines
- Playstyle Blend Analysis and Combat Spectrum visualization
- Dynamic Fun Stats (3-4 per army)
- Self-Contained HTML Export with base64 embedded images

**Version 4.15.0 (November 26, 2025)** ⚔️

**Version 4.6.0 (November 15, 2025)**
- Secondary Objectives GameRule-based schema migration
- 19 missions from Chapter Approved 2025-26 v1.2 (Wahapedia)
- CRITICAL FIX: Scoring secondaries now updates total VP counter
- CRITICAL FIX: Reverting VP events now subtracts VP correctly
- Structured vpCalculation with threshold-based scoring
- Full revert support with scoring history cleanup

**Version 4.5.0 (November 15, 2025)**
- Comprehensive revert system with voice and manual controls
- Cascade detection and batch revert support
- Full audit trail with RevertAction model
- State restoration for phase, CP, VP, objectives, units

**Version 3.8.3 (October 30, 2025)**
- Simplified CP/VP controls with click-to-edit interface
- Optimistic updates for instant UI feedback (all interactions)
- Pattern-based cache invalidation system
- Fixed timeline refresh timing (no more "one behind")

See [CHANGELOG](../CHANGELOG.md) for full details.

---

## 📞 Need Help?

1. Check relevant documentation above
2. Search [Troubleshooting](troubleshooting/) guides
3. Review console errors and Langfuse traces
4. Open GitHub issue with details

---

**Navigate with confidence.** The Machine God illuminates the path. ⚙️

