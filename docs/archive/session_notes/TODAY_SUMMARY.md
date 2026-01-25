# Today's Session Summary

**Date:** December 1, 2025  
**Version:** 4.20.0 → 4.21.0 Flat Faction Architecture & Detachment Normalization

## 🎯 Objective

Restructure the faction system from a parent/child hierarchy to a flat architecture where each faction (including divergent chapters) has its own complete datasheet roster, and normalize detachments into proper database records.

## ✅ Completed Features

### 1. Flat Faction Architecture
- **Changed:** Removed parent/child hierarchy from Faction model
- **Functionality:**
  - Each faction is now a top-level entity
  - Divergent chapters (Space Wolves, Blood Angels, etc.) have their own datasheets
  - Datasheets duplicated from source (Space Wolves) to all chapters
  - Chapter-specific keywords added to duplicated datasheets

### 2. Unit Restriction System
- **Added:** `isEnabled` Boolean field on Datasheet model
- **Purpose:** Controls army builder visibility without deleting data
- **Restrictions Applied:**
  - Black Templars: 4 Librarian units disabled (PSYKER restriction)
  - Deathwatch: Scout Squad disabled (per official rules)

### 3. Detachment Normalization
- **Created:** 60 Detachment records extracted from stratagem data
- **Linked:** 301 stratagems via `detachmentId` foreign key
- **Core Faction:** New faction for universal stratagems (8 stratagems)

### 4. Admin UI Updates
- **Updated:** `/admin/factions` now displays flat list
- **Added:** Disabled datasheet counts per faction
- **Removed:** Parent/child faction grouping

## 📝 Documentation Created/Updated

### Updated Documentation
1. **`docs/features/FACTION_SYSTEM.md`** - Complete rewrite for flat architecture
2. **`CHANGELOG.md`** - Added v4.21.0 entry
3. **`docs/README.md`** - Version bump, updated features section
4. **`package.json`** - Version bump to 4.21.0

## 🔧 Technical Changes

### New Scripts
- `scripts/migrateFactionHierarchy.ts` - Flatten factions, duplicate datasheets
- `scripts/normalizeDetachments.ts` - Extract and normalize detachments

### Schema Changes
- **Datasheet model:** Added `isEnabled Boolean @default(true)` with index

### Modified Files
- `app/api/admin/factions/route.ts` - Flat list API, disabled counts
- `app/admin/factions/page.tsx` - Flat list UI

## 📊 Data Statistics

| Faction | Datasheets | Disabled | Detachments | Stratagems |
|---------|-----------|----------|-------------|------------|
| Astra Militarum | 64 | 0 | 0 | 0 |
| Black Templars | 102 | 4 | 4 | 24 |
| Blood Angels | 96 | 0 | 4 | 24 |
| Core | - | - | 1 | 8 |
| Dark Angels | 96 | 0 | 5 | 30 |
| Deathwatch | 96 | 1 | 1 | 6 |
| Space Marines | 96 | 0 | 33 | 156 |
| Space Wolves | 96 | 0 | 11 | 40 |
| Tyranids | 49 | 0 | 1 | 13 |

**Totals:**
- 695 datasheets (5 disabled)
- 60 detachments
- 301 linked stratagems

---

**Session Status:** ✅ Complete  
**Version Bump:** 4.20.0 → 4.21.0
