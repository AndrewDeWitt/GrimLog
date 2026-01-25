# Army Register: Tactics & Attachments

**Last Updated:** 2025-12-13  
**Status:** Complete

## Overview

Grimlog's Army Register (`/armies/[id]`) is designed to support two distinct mental models:

- **List Building**: Maintain an army roster with units, points, and configuration.
- **Battle Ready**: Quickly pivot detachment/stratagem reference and character attachments **right before a game** without hunting through separate tabs.

This feature consolidates **Detachment + Stratagems** into a single **Tactics** quick-glance modal, presents the **units roster** as the primary view with a **wounds breakdown**, and provides a unified **Attachments modal** for managing character attachments and presets.

## Table of Contents

- [Key UX Changes](#key-ux-changes)
- [Toolbar Actions](#toolbar-actions)
- [Tactics Modal](#tactics-modal)
- [Attachments Modal](#attachments-modal)
- [Roster (All Units + Wounds)](#roster-all-units--wounds)
- [Session Integration](#session-integration)
- [API & Data Model](#api--data-model)
- [Related Documentation](#related-documentation)

## Key UX Changes

### What changed (v4.27.0)

- **Units-first view**: The main content is always the units roster (no tab switching).
- **Toolbar actions**: TACTICS and ATTACHMENTS are buttons in the toolbar that open modals.
- **Unified Attachments modal**: Combines attachment editing and preset management in one place.
- **No sticky footer**: Save/reset controls live inside the Attachments modal.

### Previous changes (v4.26.0)

- **Detachment + Stratagems unified** as "Tactics" modal.
- **Roster shows all units**, including characters.
- **Wounds breakdown** shown per unit and as roster totals (units/models/wounds).
- **Attachment presets** for matchup-driven character assignments.

### Why it changed

- Detachments and stratagems are usually referenced together during list review and play.
- Attachments are often matchup-dependent and should be configurable as a **pre-game checklist step**.
- The previous tabbed interface and sticky footer added unnecessary complexity.
- A single, focused units view is cleaner for reviewing army composition.

## Toolbar Actions

The toolbar provides quick access to actions:

```
[← RETURN] [+ ADD UNIT] [⭐ ATTACHMENTS]
```

- **RETURN**: Navigate back to the armies list
- **ADD UNIT**: Open the unit picker modal (if faction is set)
- **ATTACHMENTS**: Open the unified attachments modal

The **TACTICS** button remains in the header section for quick detachment/stratagem reference.

## Tactics Modal

### Entry point

- **Header button**: `TACTICS` (in the army header section)

### Contents

- **Detachment selector** (same available values as the army detail detachment set)
- **Stratagems quick-glance**
  - **Core stratagems** section
  - **Detachment stratagems** section
  - Search across name/phase/text/keywords

### Notes

- Stratagems are sourced from the army's resolved stratagem list (manual + reference).
- Reference stratagems include `detachment` metadata so they can be grouped into Core vs Detachment.

## Attachments Modal

### Entry point

- **Toolbar button**: `⭐ ATTACHMENTS`

### Two tabs

1. **Edit Attachments** - Configure which characters attach to which units
   - Character list with searchable dropdowns
   - Clear individual or all attachments
   - Dirty state indicator shows unsaved changes

2. **Presets** - Manage saved attachment loadouts
   - Save current attachments as a named preset (e.g., "VS_ELITE", "AGGRESSIVE")
   - Load a preset to apply it to current attachments
   - Delete presets you no longer need
   - Set a default preset

### Save workflow

- **RESET**: Revert to last saved state
- **SAVE**: Persist current attachments to the army
- **CLOSE**: Exit without saving (changes are preserved in memory until page refresh)

## Roster (All Units + Wounds)

### What's shown

- Full roster list including **Characters** and **Non-Characters**
- Characters sorted first, then alphabetically
- Per unit:
  - Unit icon
  - Name and datasheet
  - Model count
  - Points cost
  - Total wounds (derived)
  - Attachment context (if applicable)
  - Review flag (if needs attention)

### Wounds calculation

Wounds are computed using the best available data, in order:

1. Unit composition JSON (mixed-wound support)
2. Datasheet wounds (when full datasheet data is present)
3. Fallback: `1W × modelCount` (legacy-safe)

### Session Setup (`/sessions/new`)

- Optionally select a preset (or use army-saved attachments)
- Tweak character-to-unit assignments before clicking **START BATTLE**

## Session Integration

When a new session is created:

- If `attackerAttachments` is provided, Grimlog applies those attachments at session start.
- Otherwise it falls back to the army’s saved `characterAttachments`.

Attachments are stored on unit instances via:

- `UnitInstance.attachedToUnit` (for character units)

## API & Data Model

### Database

- `AttachmentPreset` model stores named, per-army attachment loadouts.

### Endpoints

- Presets CRUD:
  - `GET /api/armies/[id]/attachment-presets`
  - `POST /api/armies/[id]/attachment-presets`
  - `PATCH /api/armies/[id]/attachment-presets/[presetId]`
  - `DELETE /api/armies/[id]/attachment-presets/[presetId]`

- Session creation:
  - `POST /api/sessions` supports optional `attackerAttachments`

## Related Documentation

- [Character Attachments Guide](../guides/CHARACTER_ATTACHMENTS_GUIDE.md) - How attachments work and how to configure them
- [Session Setup Guide](../guides/SESSION_SETUP_GUIDE.md) - Starting a battle session with battle-ready options
- [Sessions Endpoint](../api/SESSIONS_ENDPOINT.md) - Session creation API details
- [Army Attachment Presets Endpoint](../api/ARMY_ATTACHMENT_PRESETS_ENDPOINT.md) - Preset CRUD API


