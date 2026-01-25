# React Hook Order Error (Rules of Hooks)

**Last Updated:** 2025-12-20
**Status:** Complete

## Overview

This guide explains how to diagnose and fix the React runtime error:

> “React has detected a change in the order of Hooks called by X…”

In Grimlog, this most often happens when a component **returns early** (or conditionally renders) **before** calling hooks like `useMemo`, `useEffect`, or custom hooks.

## Table of Contents

- [Symptoms](#symptoms)
- [Root Cause](#root-cause)
- [Fix Pattern](#fix-pattern)
- [Grimlog Notes](#grimlog-notes)
- [Related Documentation](#related-documentation)

## Symptoms

- Error in console referencing a component (e.g., `TacticalAdvisorModal`)
- A hook that is present in one render is **missing** in another render
- The error often includes a hook order diff, where a later render shows a new hook call like `useMemo`

## Root Cause

React hooks must be called in the **same order on every render**.

Common causes:
- Calling hooks inside `if (...) { ... }`
- Returning `null` (or another branch) **before** calling hooks
- Calling custom hooks only on certain renders

## Fix Pattern

**Always call hooks first**, then branch/return after.

Example pattern:

```tsx
export function SomeComponent({ isOpen }: { isOpen: boolean }) {
  // ✅ Hooks always run in a stable order
  const memoValue = useMemo(() => compute(), []);
  useEffect(() => { /* ... */ }, []);

  // ✅ Early return AFTER hooks
  if (!isOpen) return null;

  return <div>{memoValue}</div>;
}
```

## Grimlog Notes

- When adding UI enhancements that require hooks (e.g., `useMemo`, `useUnitIcons`), ensure they are **not placed after** an `if (!isOpen) return null` early return.
- If you need to avoid doing work while a modal is closed, gate the side-effect using flags (e.g., `autoFetch: isOpen`) rather than skipping the hook call.

## Related Documentation

- [Tactical Advisor](../features/TACTICAL_ADVISOR.md) - Uses hooks extensively in the modal UI
- [React Rules of Hooks](https://react.dev/link/rules-of-hooks) - Official guidance


