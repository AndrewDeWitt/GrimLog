# Modal Bottom Sheet Standardization

**Last Updated:** 2025-12-20
**Status:** Complete
**Version:** 4.39.0

## Overview

All modals in Grimlog have been standardized to use a consistent "bottom sheet" pattern, matching the `UnitHealthSheet.tsx` component. This provides a unified, mobile-first experience with slide-up animations, rounded top corners, and a light slate theme that maintains the grimdark aesthetic while improving readability.

## Table of Contents

- [Design Pattern](#design-pattern)
- [Visual Characteristics](#visual-characteristics)
- [Modals Updated](#modals-updated)
- [Implementation Details](#implementation-details)
- [Code Example](#code-example)
- [Related Documentation](#related-documentation)

## Design Pattern

The bottom sheet pattern follows these key principles:

1. **Slide-up from bottom** - Modals animate upward from the bottom of the screen
2. **Rounded top corners** - Consistent `rounded-t-xl` or `rounded-t-2xl` styling
3. **Light slate theme** - `bg-grimlog-slate-light` backgrounds for improved readability
4. **Semi-transparent backdrop** - `bg-grimlog-black/45 backdrop-blur-[2px]` for subtle depth
5. **Neutral text colors** - `text-grimlog-black` for headers and content
6. **Consistent z-index** - `z-[60]` ensures proper layering above other UI elements

## Visual Characteristics

### Container
- Fixed positioning: `fixed inset-0`
- Flexbox layout: `flex flex-col justify-end`
- Z-index: `z-[60]`

### Backdrop
- Position: `absolute inset-0`
- Background: `bg-grimlog-black/45`
- Blur effect: `backdrop-blur-[2px]`
- Click-to-dismiss functionality

### Sheet
- Position: `relative`
- Background: `bg-grimlog-slate-light`
- Border: `border-t-2 border-grimlog-steel`
- Corners: `rounded-t-xl` or `rounded-t-2xl`
- Shadow: `shadow-lg` or `shadow-2xl`
- Animation: `animate-slide-up`

### Header
- Background: `bg-grimlog-slate-light` or `bg-grimlog-slate-dark`
- Border: `border-b border-grimlog-steel`
- Title: `text-grimlog-black font-bold uppercase tracking-wider`
- Close button: `text-grimlog-black hover:text-grimlog-orange`

### Content
- Background: `bg-grimlog-slate-light`
- Text: `text-grimlog-black` or `text-gray-700`
- Scrollable when needed: `overflow-y-auto`

### Footer
- Background: `bg-grimlog-slate-light` or `bg-grimlog-slate-dark`
- Border: `border-t border-grimlog-steel`
- Buttons with proper light-theme contrast

## Modals Updated

| Component | Description |
|-----------|-------------|
| `ConfirmDialog.tsx` | Confirmation dialogs with variant support |
| `SettingsModal.tsx` | Application settings |
| `StratagemReferenceModal.tsx` | Stratagem quick reference (neutral colors) |
| `TacticalAdvisorModal.tsx` | AI tactical advice |
| `MissionSelectionModal.tsx` | Mission selection |
| `AddUnitModal.tsx` | Add units to battle |
| `SecondarySelectionModal.tsx` | Secondary objective selection |
| `SecondaryDetailModal.tsx` | Secondary objective details |
| `TacticsModal.tsx` | Tactics overview |
| `BattleReadyModal.tsx` | Battle ready configuration |
| `ShareModal.tsx` | Share functionality |
| `AuthModal.tsx` | Authentication |
| `StratagemLoggerModal.tsx` | Manual stratagem logging |
| `ModelDetailsModal.tsx` | Model detail view |
| `StrategicAssistantModal.tsx` | Strategic assistant |
| `DamageResultsModal.tsx` | Damage calculation results |
| `RevertConfirmDialog.tsx` | Revert confirmation |
| `DatasheetEditorModal.tsx` | Datasheet editing |
| `tools/DamageCalculatorModal.tsx` | MathHammer calculator |
| `tools/IconGeneratorModal.tsx` | Icon generation |

## Implementation Details

### Backdrop Click-to-Dismiss

All modals support clicking the backdrop to close:

```tsx
<div 
  className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]"
  onClick={onClose}
/>
```

### Event Propagation

The sheet content stops event propagation to prevent accidental closes:

```tsx
<div 
  className="relative bg-grimlog-slate-light ..."
  onClick={(e) => e.stopPropagation()}
>
```

### Drag Handle (Optional)

Larger modals include a visual drag handle indicator:

```tsx
<div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
  <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
</div>
```

### Responsive Max Heights

Modals respect viewport height with `max-h-[85vh]` or `max-h-[90vh]` to ensure scrollability.

## Code Example

```tsx
if (!isOpen) return null;

return (
  <div className="fixed inset-0 z-[60] flex flex-col justify-end">
    {/* Backdrop */}
    <div 
      className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    />
    
    {/* Bottom Sheet */}
    <div 
      className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-grimlog-slate-light border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
        <h2 className="text-grimlog-black text-lg font-bold tracking-wider uppercase">
          Modal Title
        </h2>
        <button
          onClick={onClose}
          className="text-grimlog-black hover:text-grimlog-orange text-2xl font-bold transition-colors"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-grimlog-slate-light">
        {/* Modal content here */}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-grimlog-slate-light border-t border-grimlog-steel flex justify-end gap-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 font-bold rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-grimlog-orange text-gray-900 hover:bg-grimlog-amber font-bold rounded-lg"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
);
```

## Related Documentation

- [UI Color System](UI_COLOR_SYSTEM.md) - Grimlog color palette and theme system
- [Unit Health Sheet](UNIT_HEALTH_SHEET.md) - Reference implementation for bottom sheet pattern
- [Light Slate Theme (v4.33.0)](../CHANGELOG.md) - Original light theme implementation

