# Global Navigation System

**Last Updated:** 2025-11-22  
**Status:** Complete  
**Version:** 4.12.0

## Overview

The Global Navigation System provides a unified, grimdark interface for navigating the Grimlog application. It replaces the disparate navigation elements with a cohesive structure that persists across the application lifecycle, handling battle context, system routes, and the tactical aesthetic of the 41st Millennium.

## Key Components

### 1. Grimdark Menu (`HamburgerMenu.tsx`)

A complete redesign of the standard drawer menu into a tactical "Dataslate" panel.

*   **Trigger:** Custom rotating Cog icon (`grimlog-orange`/`grimlog-steel`) that acts as a mechanical switch.
*   **Aesthetic:** 
    *   Floating panel design with `dataslate-frame` borders.
    *   Scanline background effects and subtle pulses.
    *   "Power-up" animation on open (`dataslate-power-up`).
    *   Terminal-style typography (`Courier New`/Monospace).
*   **Context Awareness:**
    *   Displays User Profile with vermilion clearance level.
    *   Dynamically shows "Battle Controls" (Pause, End, Stratagems) only when a session is active.
    *   Provides distinct navigation for "Armies" and "Sessions" (formerly Past Games).

### 2. Navigation Wrapper (`NavigationWrapper.tsx`)

A smart client-side wrapper that manages the global header state based on the current route.

*   **Route Intelligence:**
    *   `app/*` (Global): Shows standard `GlobalHeader`.
    *   `app/page.tsx` (Battle): Hides global header to maximize tactical view.
*   **State Handling:**
    *   Manages the "Return to Battle" button visibility.
    *   Ensures smooth transitions between the Battle interface and management screens (`/armies`, `/sessions`).

### 3. Global Header (`GlobalHeader.tsx`)

The persistent top bar for non-battle pages.

*   **Structure:**
    *   **Left:** "TACLOG" branding with `text-grimlog-orange` glow.
    *   **Right:** Cogitator Menu trigger.
*   **Behavior:**
    *   Fixed position on mobile, sticky/static options for desktop.
    *   Integrates seamlessly with the new Grimdark CSS theme.

## User Experience Changes

### Navigation Flow

| Old Flow | New Flow |
| :--- | :--- |
| "Back" buttons everywhere | "Return" context action + Global Menu |
| Hidden drawer menu | Prominent tactical "Cog" trigger |
| Inconsistent headers | Unified "System Log" / "Cogitator" headers |
| Disconnected pages | Seamless "OS-like" app feel |

### Visual Language

*   **Colors:** Strict adherence to `grimlog-orange` (Active), `grimlog-green` (System), and `grimlog-steel` (Structural).
*   **Depth:** Usage of `.btn-depth` and `.dataslate-frame` to give weight to UI elements.
*   **Feedback:** Hover-lift effects and scanline animations provide immediate tactile feedback.

## Technical Implementation

### CSS Architecture

New utility classes added to `globals.css` to support the system:

```css
/* Grimdark Frame */
.dataslate-frame {
  background-color: var(--grimlog-black);
  border: 2px solid var(--grimlog-steel);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

/* Button Depth */
.btn-depth {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

### Component Structure

```
components/
├── HamburgerMenu.tsx       # The Dataslate Menu
├── NavigationWrapper.tsx   # Route manager
├── GlobalHeader.tsx        # Persistent top bar
└── MechanicusFrame.tsx     # Decorative screen borders
```

## Related Documentation

*   [UI Prominence Enhancement](../UI_PROMINENCE_ENHANCEMENT_V3.8.2.md) - Foundation of the visual style
*   [UI Color System](UI_COLOR_SYSTEM.md) - Color palette reference
