# Unit Icon Generation

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview
Grimlog provides an end-to-end workflow for creating stylized 256×256 unit icons without leaving the app. Users can search Wahapedia-style miniature photos through Google Custom Search, pass the reference image to Google's Gemini image model, and automatically resize/store the final PNG. Icons can be generated in bulk from the admin dashboard or edited inline directly from a datasheet or active unit card.

**v4.18.0 Update:** Icon generation now uses `gemini-3-pro-image-preview` with an anime-style prompt. Icons feature white backgrounds with orange borders for better visibility against the dark UI. Icon display size increased to 64px for better recognition.

**v4.25.0 Update:** Icons can now be stored as **global/shared icons** via **Supabase Storage** (admin-generated). This allows icons to persist in development without Vercel Blob tokens and makes icons consistent for all users.

**v4.37.0 Update:** 
- Prompt switched to **bold comic book style** with waist-up framing to capture weapon/armor profiles
- **Cache busting** ensures regenerated icons display immediately (no browser cache issues)
- **Delete functionality** allows removing unsatisfactory icons for regeneration

## Table of Contents
- [Feature Highlights](#feature-highlights)
- [Storage Architecture](#storage-architecture)
- [Admin Icon Dashboard](#admin-icon-dashboard)
- [Inline Icon Editing](#inline-icon-editing)
- [Technical Details](#technical-details)
- [Troubleshooting & Limitations](#troubleshooting--limitations)
- [Related Documentation](#related-documentation)

## Feature Highlights
- **Human-in-the-loop selection:** Preview search results in-app and pick the most accurate miniature photo before stylizing.
- **Gemini-powered stylization:** Calls `gemini-3-pro-image-preview` with a comic book style portrait prompt + optional overrides.
- **Optimized for icon clarity:** Bold comic book style with high contrast and strong ink outlines for instant recognition at small sizes.
- **Weapon/armor visibility:** Waist-up framing captures the full weapon and armor profile while maintaining a close-up feel.
- **Larger display:** Icons shown at 64px in DatasheetCards for easy recognition at a glance.
- **Per-user cloud storage:** Icons stored in Vercel Blob with database tracking – each user has their own icon library.
- **Automatic resizing:** Generated images are resized to 256×256 PNG.
- **Contextual editing:** Datasheet headers and live unit cards expose always-visible ✎ buttons for quick icon fixes.
- **Instant updates:** Re-generated icons immediately appear via cache busting (no browser refresh needed).
- **Delete & regenerate:** Unsatisfactory icons can be deleted and regenerated from the admin panel.

## Storage Architecture

### Global Storage (v4.25.0+)
For admin-generated global icons, icons are stored in **Supabase Storage** and referenced via a global mapping table:

```
Supabase Storage Bucket: unit-icons
Object Path:            icons/{faction}/{unitName}.png
Database Table:         GlobalUnitIcon (faction, unitName, bucket, path)
```

### Per-User Storage (v4.17.0+)
For authenticated users, icons can also be stored per-user in **Vercel Blob** cloud storage:

```
Vercel Blob Path: icons/{userId}/{faction}/{unitName}.png
Database Table:   UnitIcon (userId, unitName, faction, blobUrl, blobKey)
```

**Benefits:**
- Each user has their own icon library
- Icons persist across deployments
- No filesystem management required
- Automatic CDN distribution via Vercel

### Legacy Filesystem Storage
For unauthenticated users or development, icons fall back to the filesystem:

```
Filesystem Path: public/icons/{faction}/{unitName}.png
```

### Icon Resolution Priority
1. **Global database first:** Check `GlobalUnitIcon` table for global storage mapping (Supabase Storage)
2. **User database next:** Check `UnitIcon` table for user-specific blob URL
3. **Filesystem fallback:** Check `public/icons/{faction}/{unit}.png`
3. **No icon:** Return null, UI shows role-based fallback emoji

## Admin Icon Dashboard
1. Navigate to `/admin/icons`.
2. Filter datasheets by faction or "missing icon".
3. Click **Generate Icon** (or **Regenerate**).
4. **Step 1 – Select Reference Image**
   - Search query defaults to `Warhammer 40k <Unit> miniature`.
   - Results are shown in a single vertical column with larger previews.
   - Click a tile to stage it for generation.
5. **Step 2 – Style & Generate**
   - (Optional) Override the default comic book prompt.
   - Click **Generate Icon** to call Gemini.
6. Success state displays the final PNG; the datasheet list updates immediately.

### Deleting Icons
- Units with existing icons show a **Delete Icon** button below the regenerate button.
- Clicking delete shows a confirmation dialog.
- After deletion, the unit returns to "Missing" state and can be regenerated.

## Inline Icon Editing
### Datasheet Detail Page
- Datasheet headers now show the generated icon (or fallback faction icon).
- A circular ✎ button sits on the lower-right corner of the icon (always visible).
- Clicking the button opens the Icon Generator Modal with the unit/faction pre-filled.

### Unit Cards (Compact + Medium Views)
- Every unit portrait receives the same overlay ✎ indicator.
- The modal is launched in-place, allowing quick fixes mid-session.
- Successful generation triggers `onRefresh` so the updated PNG appears instantly.

## Technical Details

### API Endpoints
- **Search Endpoint:** `app/api/admin/icons/search/route.ts`
  - Wraps Google Custom Search (`googleapis`).
  - Requires `GOOGLE_SEARCH_API_KEY` (or `GOOGLE_API_KEY`) and `GOOGLE_SEARCH_CX`.
  
- **Generation Endpoint:** `app/api/admin/icons/generate/route.ts`
  - Uses `@google/genai` (`gemini-3-pro-image-preview`) and `sharp`.
  - Accepts `imageUrl`, `unitName`, `faction`, `stylePrompt`.
  - Default prompt creates anime-style portraits with white background and orange border.
  - Admin-only: Uploads to Supabase Storage (`unit-icons`) and saves to `GlobalUnitIcon`.
  - (Optional legacy) Per-user Vercel Blob icons may still exist via `UnitIcon` for future overrides.
  
### Default Generation Prompt
```
Create a comic book style portrait icon of this Warhammer 40K miniature.

FRAMING:
- Show from waist/hip up - capture the full weapon and armor profile
- Include the character's signature weapons and distinctive armor details
- Centered composition with the subject filling most of the frame
- NOT full body - crop at waist level, but show all weapons and shoulder details

STYLE:
- Bold comic book illustration with strong ink outlines
- High contrast cel-shading with defined shadows
- Crisp, clean linework - no soft edges
- Vibrant saturated colors matching the faction's scheme
- Heroic/dramatic comic book aesthetic

BACKGROUND:
- Solid white background only
- NO borders, NO frames, NO circles, NO outlines around the image edges

OUTPUT:
- This is a small UI icon - prioritize clarity and instant recognition
- Bold shapes and high contrast for readability at small sizes
```
  
- **Resolution Endpoint:** `app/api/icons/resolve/route.ts`
  - **GET:** Single icon lookup by `unitName` and `faction`.
  - **POST:** Batch lookup for multiple units.
  - Checks database first (user icons), then filesystem (legacy).
  - Unauthenticated requests still return filesystem icons when present (otherwise `null`).
  - **Cache busting:** URLs include `?v={timestamp}` from `updatedAt` to force browser refresh after regeneration.

- **Status Endpoint:** `app/api/admin/icons/status/route.ts`
  - Returns icon status for all datasheets.
  - Checks both database (user icons) and filesystem (legacy icons).
  - **Cache busting:** URLs include `?v={timestamp}` from `updatedAt`.

- **Delete Endpoint:** `app/api/admin/icons/delete/route.ts`
  - **DELETE:** Removes icon from Supabase Storage and `GlobalUnitIcon` table.
  - Accepts `unitName` and `faction` in request body.
  - Admin-only endpoint.

### Client Components
- **Client Modal:** `components/tools/IconGeneratorModal.tsx`
  - Shared between admin dashboard, datasheet page, and unit cards.
  - Single-column preview layout with larger thumbnails.

### Database Schema
```prisma
model GlobalUnitIcon {
  id          String   @id @default(uuid())
  unitName    String
  faction     String
  datasheetId String?
  bucket      String   @default("unit-icons")
  path        String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([faction, unitName])
}

model UnitIcon {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(...)
  datasheetId String?
  datasheet   Datasheet? @relation(...)
  unitName    String
  faction     String
  blobUrl     String     // Vercel Blob URL
  blobKey     String     // Blob pathname for deletion
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([userId, unitName, faction])
}
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Gemini/Nano Banana access |
| `GOOGLE_SEARCH_API_KEY` | No | Optional dedicated key for Custom Search |
| `GOOGLE_SEARCH_CX` | Yes | Programmable Search Engine ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Required for admin icon uploads to Supabase Storage |
| `BLOB_READ_WRITE_TOKEN` | No | Only required if using per-user Vercel Blob icons |

### Dependencies
`googleapis`, `@google/genai`, `sharp`, `fs-extra`, `@vercel/blob`

## Troubleshooting & Limitations
| Problem | Resolution |
| ------- | ---------- |
| Search request fails with `INVALID_ARGUMENT` | Confirm `.env` contains the real `GOOGLE_SEARCH_CX` (not `paste_your_id_here`) and restart the dev server. |
| Generation request returns `SERVICE_DISABLED` | Enable the "Generative Language API" for the Google Cloud project tied to `GOOGLE_API_KEY`. Wait a minute after enabling. |
| Icon generated but not showing in UI | Ensure you're logged in. User-specific icons require authentication. Check browser console for API errors. |
| Icon not persisting after generation | Verify `BLOB_READ_WRITE_TOKEN` is set in `.env`. Without it, icons return as base64 data URLs (temporary). |
| Style not matching expectations | Provide a custom `stylePrompt` (e.g., "comic shading", "metallic outline") before clicking **Generate Icon**. |
| Icons showing for wrong user | Icons are user-specific. Each user has their own library stored in the database. |

## Related Documentation
- [Admin Icons Generate Endpoint](../api/ADMIN_ICONS_GENERATE_ENDPOINT.md) - Icon generation API
- [Admin Icons Delete Endpoint](../api/ADMIN_ICONS_DELETE_ENDPOINT.md) - Icon deletion API
- [Icons Resolve Endpoint](../api/ICONS_RESOLVE_ENDPOINT.md) - Icon lookup API
- [Google Gemini Integration](GOOGLE_GEMINI_INTEGRATION.md)
- [Manual UI Controls](MANUAL_UI_CONTROLS.md) – describes common modal patterns reused here.
- [Datasheet Integration](DATASHEET_INTEGRATION.md) – displays where icon paths are consumed.
