# Armies Endpoint

**Last Updated:** 2025-12-14  
**Status:** Complete

## Overview

The Armies API powers army creation, listing, and the Army Register (`/armies/[id]`). It supports:

- Creating armies (manual import/parse flow writes units)
- Listing armies for selection and session setup
- Fetching full army details including units, stratagems, detachment, and attachments
- Managing character attachments and detachment selection

## Table of Contents

- [List Armies](#list-armies)
- [Create Army](#create-army)
- [Get Army Detail](#get-army-detail)
- [Update Army](#update-army)
- [Delete Army](#delete-army)
- [Units Sub-Resource](#units-sub-resource)
- [Related Documentation](#related-documentation)

## List Armies

**Route:** `GET /api/armies`

### Query Params

- `detailed=true` (optional): returns detailed objects used by session setup.

### Notes

- The non-detailed list is optimized for the armies library UI and may include enriched counts/stratagem name lists.
- **Subfaction Stratagem Resolution (v4.32.1):** For subfactions like Space Wolves, stratagems are resolved from both the army's faction AND its parent faction (e.g., Space Marines). This allows subfaction armies to access parent faction detachments like "Stormlance Task Force".

## Create Army

**Route:** `POST /api/armies`

### Notes

- Used by the army builder/import flows.
- Creates an `Army` plus associated `Unit` records.

## Get Army Detail

**Route:** `GET /api/armies/[id]`

### Notes

- Returns the full army payload for the Army Register.
- Includes:
  - `units` (with `fullDatasheet` where linked)
  - `stratagems` (merged manual + reference; filtered to detachment + core)
  - `characterAttachments` (army baseline mapping)
  - `detachment`

## Update Army

**Route:** `PATCH /api/armies/[id]`

### Common fields

- `name` (string)
- `pointsLimit` (number)
- `detachment` (string | null)
- `characterAttachments` (stringified JSON mapping)
- `visibility` (string)

## Delete Army

**Route:** `DELETE /api/armies/[id]`

## Units Sub-Resource

### List Units

**Route:** `GET /api/armies/[id]/units`

### Add Unit

**Route:** `POST /api/armies/[id]/units`

### Notes

- Adding units via this endpoint stores unit configuration including keywords, composition, weapons/abilities, and `needsReview`.

## Related Documentation

- [Army Management UI](../features/ARMY_MANAGEMENT_UI.md)
- [Army Register: Tactics & Battle Ready](../features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md)
- [Character Attachments Guide](../guides/CHARACTER_ATTACHMENTS_GUIDE.md)
- [Army Attachment Presets Endpoint](ARMY_ATTACHMENT_PRESETS_ENDPOINT.md)


