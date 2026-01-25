# Army Export Endpoint

**Last Updated:** 2025-12-14
**Status:** Complete

## Overview

The Army Export endpoint generates a beautifully styled HTML document containing a complete army roster summary. The export includes unit composition, wounds, weapons, abilities, stratagems, and character attachments.

## Table of Contents

- [Endpoint](#endpoint)
- [Query Parameters](#query-parameters)
- [Response](#response)
- [HTML Content](#html-content)
- [Styling](#styling)
- [Examples](#examples)
- [Error Codes](#error-codes)

## Endpoint

```
GET /api/armies/[id]/export
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Army UUID |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | (none) | Set to `download` to trigger file download |

## Response

### View in Browser (default)

```
Content-Type: text/html; charset=utf-8
```

Returns HTML that can be viewed directly in the browser.

### Download File (`?format=download`)

```
Content-Type: text/html; charset=utf-8
Content-Disposition: attachment; filename="{army-name}_roster.html"
```

Triggers a file download with sanitized filename.

## HTML Content

The generated HTML includes the following sections:

### 1. Army Header
- Army name (large title)
- Player name, faction, detachment
- Stats: Total Points, Points Limit, Units, Models, Total Wounds

### 2. Detachment Section
- Detachment name
- Detachment ability name and description (if available)

### 3. Character Attachments
- Visual display of which leaders are attached to which units
- Format: `Leader Name → Unit Name`

### 4. Characters Section
- All units with CHARACTER keyword
- Highlighted with gold border
- Full composition, weapons, abilities

### 5. Battle Units Section
- All non-character units
- Composition breakdown with wounds per model
- Weapons with profiles
- Abilities as tags
- Enhancements highlighted

### 6. Stratagems Section
- Grouped by type (Battle Tactic, Strategic Ploy, Epic Deed)
- Shows CP cost, timing, and effect
- Includes both faction and core stratagems

### 7. Available Enhancements
- Enhancements available for the selected detachment
- Shows points cost and description

### 8. Notable Abilities
- Summary of key unit and leader abilities
- Limited to top 12 most relevant

## Styling

### Theme
- **Primary:** Dark grimdark theme (`#0a0a0c` background)
- **Accent:** Gold (`#c9a227`) for headers and highlights
- **Typography:** Cinzel (headings), Crimson Pro (body)
- **Cards:** Dark cards with subtle borders

### Print Support
The HTML includes `@media print` styles that:
- Convert to light background for printing
- Maintain readability of all text
- Preserve card structure with light backgrounds
- Use page-break-inside: avoid for cards

## Examples

### View in Browser

```bash
curl "http://localhost:3000/api/armies/abc123/export"
```

### Download as File

```bash
curl -O "http://localhost:3000/api/armies/abc123/export?format=download"
```

### From UI

Click the `📄 EXPORT` button in the army detail page toolbar. The file downloads automatically.

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Army not found | The specified army ID does not exist |
| 500 | Failed to export army | Server error during HTML generation |

## Related Documentation

- [Army HTML Export Feature](../features/ARMY_HTML_EXPORT.md) - Feature overview
- [Armies Endpoint](./ARMIES_ENDPOINT.md) - Army CRUD operations
- [Army Attachment Presets](./ARMY_ATTACHMENT_PRESETS_ENDPOINT.md) - Character attachments

