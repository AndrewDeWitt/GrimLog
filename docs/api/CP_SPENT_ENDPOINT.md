# CP Spent Endpoint

**Last Updated:** 2025-10-31  
**Status:** Complete

## Overview

The CP Spent endpoint provides real-time command point spending statistics for a game session, tracking both current round spending and cumulative game spending for both players.

## Endpoint

```
GET /api/sessions/[id]/cp-spent
```

## Parameters

### Path Parameters

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `id`      | string | Yes      | The game session ID (UUID)            |

## Response Format

### Success Response (200 OK)

```json
{
  "player": {
    "round": 3,
    "total": 8
  },
  "opponent": {
    "round": 2,
    "total": 5
  }
}
```

### Response Fields

| Field              | Type   | Description                                               |
|--------------------|--------|-----------------------------------------------------------|
| `player.round`     | number | CP spent by player since current round started            |
| `player.total`     | number | Total CP spent by player across entire game               |
| `opponent.round`   | number | CP spent by opponent since current round started          |
| `opponent.total`   | number | Total CP spent by opponent across entire game             |

### Error Responses

**404 Not Found** - Session does not exist
```json
{
  "error": "Session not found"
}
```

**500 Internal Server Error** - Server error during calculation
```json
{
  "error": "Failed to calculate CP spent"
}
```

## Data Sources

The endpoint queries two database tables to calculate CP spending:

### 1. StratagemLog Table
- Tracks all stratagem usage with CP costs
- Filtered by `gameSessionId`, `usedBy` (player/opponent), and `timestamp`
- Provides: `cpCost`, `usedBy`, `timestamp`

### 2. TimelineEvent Table
- Tracks manual CP adjustments
- Filtered by `eventType: 'custom'` with metadata containing CP changes
- Parses JSON metadata to find negative CP changes (spending)
- Provides: `metadata.change`, `metadata.player`, `timestamp`

### Round Boundary Detection

The endpoint identifies when the current round started by:
1. Querying `TimelineEvent` for phase changes to "Command" phase
2. Finding the most recent event matching `Round ${battleRound} started`
3. Using that timestamp to separate "this round" from "total game" spending

## Example Usage

### JavaScript/TypeScript

```typescript
async function fetchCPSpent(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/cp-spent`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch CP spent data');
  }
  
  const data = await response.json();
  console.log(`Player spent ${data.player.round} CP this round`);
  console.log(`Opponent spent ${data.opponent.total} CP total`);
  
  return data;
}
```

### React Hook

```typescript
const [cpSpent, setCPSpent] = useState({ 
  player: { round: 0, total: 0 }, 
  opponent: { round: 0, total: 0 } 
});

useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/cp-spent`);
      if (response.ok) {
        const data = await response.json();
        setCPSpent(data);
      }
    } catch (error) {
      console.error('Failed to fetch CP spent:', error);
    }
  };
  
  fetchData();
}, [sessionId, battleRound, playerCP, opponentCP]); // Refresh on changes
```

## Refresh Triggers

The endpoint should be called when:
- Component mounts (initial load)
- Battle round changes (resets "this round" counter)
- CP values change (stratagem use or manual adjustment)
- Phase changes to Command (new round starts)

## Performance

- **Response Time:** Typically < 50ms
- **Caching:** No caching implemented (always returns fresh data)
- **Database Queries:** 2-3 queries per request
  - 1 query to fetch session and battle round
  - 1 query for all stratagems
  - 1 query for all CP-related timeline events

## Implementation Details

See `lib/cpTracking.ts` for the core calculation logic:

```typescript
export async function calculateCPSpent(
  sessionId: string,
  battleRound: number
): Promise<{
  player: { round: number; total: number };
  opponent: { round: number; total: number };
}>
```

### Algorithm

1. Find round start timestamp from phase change events
2. Query all `StratagemLog` entries for session
3. Query all `TimelineEvent` entries with CP metadata
4. Iterate through logs and sum CP costs by player
5. Separate spending before/after round start timestamp
6. Return structured data for both players

### Edge Cases

- **No round start event found:** Uses `Date(0)` (everything counts as "this round")
- **Malformed JSON in metadata:** Silently skips that event
- **Negative CP from gains:** Only counts negative changes (spending)
- **First round:** Round start is session creation time

## Related Documentation

- [Manual UI Controls](../features/MANUAL_UI_CONTROLS.md) - CP adjustment controls
- [AI Tool Calling](../features/AI_TOOL_CALLING.md) - Stratagem logging tools
- [Game State Display](../features/OPTIMISTIC_UI_CONTROLS.md) - CP/VP display

## See Also

- `lib/cpTracking.ts` - Helper functions
- `app/api/sessions/[id]/cp-spent/route.ts` - Endpoint implementation
- `components/GameStateDisplay.tsx` - UI consumer

