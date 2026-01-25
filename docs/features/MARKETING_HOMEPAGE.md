# Marketing Homepage

**Last Updated:** 2026-01-08
**Status:** Complete

## Overview

The marketing homepage (`/`) is a public-facing landing page designed to convert visitors into users. It features a grimdark aesthetic with prominent "2 Free Analyses" messaging, an interactive sample dossier preview, and clear sign-up CTAs. Logged-in users are automatically redirected to the dossier gallery (`/dossier/gallery`) to skip marketing content.

## Table of Contents

- [Features](#features)
- [User Flows](#user-flows)
- [Design Elements](#design-elements)
- [Technical Implementation](#technical-implementation)
- [Related Documentation](#related-documentation)

## Features

- **Public Marketing Page** - Accessible to all visitors without authentication
- **"2 Free Analyses" Banner** - Terminal green styling with grimdark aesthetic
- **Interactive Sample Preview** - Collapsible sample dossier to showcase product value
- **Sign-Up CTAs** - Multiple conversion points throughout the page
- **Auto-Redirect for Logged-In Users** - Seamless experience for authenticated users
- **Mobile-First Design** - Optimized for phone users (primary audience)

## User Flows

### New Visitor (Unauthenticated)

1. Lands on `/` (marketing homepage)
2. Sees "2 Free Analyses" banner with terminal green styling
3. Scrolls to view sample dossier preview
4. Clicks "Sign Up Free" button (in banner or below sample)
5. Auth modal opens with sign-up/sign-in options
6. After authentication, redirected to `/dossier/gallery`

### Returning User (Authenticated)

1. Visits `/` (marketing homepage)
2. Automatically redirected to `/dossier/gallery`
3. Sees public dossier gallery with "+ Generate Dossier" CTA

### Direct Access to Dossier Tool

- `/dossier` - Functional dossier generation page (requires authentication)
- Unauthenticated users redirected to `/` (marketing page)

## Design Elements

### "2 Free Analyses" Banner

- **Location**: Top of marketing homepage, below header
- **Styling**: Terminal green (`green-400`/`green-500`) with grimdark aesthetic
- **Elements**:
  - Corner bracket accents (targeting reticle style)
  - CRT scanline overlay effect
  - Subtle glow effect behind banner
  - Checkmark icon (hidden on mobile)
  - Text: "2 Free Analyses" with "++ TACTICAL SUBSIDY ++ NO SURCHARGE ++"
- **CTA**: "Sign Up Free" button integrated into banner (emerald-700 styling)
- **Mobile**: Responsive text sizing, centered layout, icon hidden

### Sample Dossier Preview

- **Component**: `DossierSamplePreview`
- **Features**: 
  - Collapsible sections (Strategic Assessment, Strengths & Weaknesses, etc.)
  - Real AI output showcase
  - "Sign Up Free" CTA at bottom (emerald-700 green button)
- **Purpose**: "Try Before You Buy" - shows value before requiring sign-up

### Color Scheme

- **Terminal Green**: `green-400`/`green-500` for banner text and accents
- **Emerald CTA**: `emerald-700`/`emerald-600` for sign-up buttons (grimdark, not lime)
- **Background**: Black with subtle radial gradients
- **Text**: Light gray/steel for readability

## Technical Implementation

### Route Structure

```
/                    → Marketing homepage (public, redirects logged-in users)
/dossier             → Functional dossier tool (requires auth)
/dossier/gallery     → Public dossier gallery (requires auth, landing for logged-in users)
/dossier/history     → User's dossier history (requires auth)
```

### Components

- **`app/page.tsx`** - Marketing homepage
  - Conditional rendering based on auth state
  - Redirects logged-in users to `/dossier/gallery`
  - Integrates `DossierHero` and `DossierSamplePreview`
  - Auth modal integration

- **`components/dossier/DossierHero.tsx`** - Hero banner component
  - "2 Free Analyses" banner with terminal green styling
  - Integrated "Sign Up Free" CTA button
  - Mobile-responsive layout

- **`components/dossier/DossierSamplePreview.tsx`** - Sample dossier preview
  - Accepts `ctaLabel` and `ctaVariant` props
  - Opens auth modal on CTA click
  - Collapsible sections for interactive exploration

### Authentication Flow

```typescript
// app/page.tsx
useEffect(() => {
  if (!authLoading && user) {
    router.push('/dossier/gallery'); // Redirect logged-in users
  }
}, [authLoading, user, router]);
```

### CTA Button Styling

```typescript
// Emerald-700 for grimdark aesthetic (not bright lime)
className="bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/50"
```

## Related Documentation

- [Tactical Dossier](TACTICAL_DOSSIER.md) - Main dossier feature documentation
- [Dossier Credits System](DOSSIER_CREDITS_SYSTEM.md) - Free generation system
- [API Security](API_SECURITY.md) - Authentication requirements
