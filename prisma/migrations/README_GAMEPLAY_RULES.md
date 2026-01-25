# Gameplay Rules Migration Guide

## Migration: Add Gameplay Rules System

This migration adds the extensible rules framework for secondary objectives, primary missions, CP validation, and phase rules.

### New Models Added

1. **GameRule** - Generic container for all rule types
2. **SecondaryObjective** - Secondary objective definitions with VP calculations
3. **PrimaryMission** - Tournament mission definitions
4. **CPTransaction** - CP gain/spend tracking
5. **SecondaryProgress** - Per-session secondary objective progress

### GameSession Updates

- Added `primaryMissionId` - Link to selected primary mission
- Added `primaryVPScored` - JSON tracking of VP by round
- Added relations to `cpTransactions` and `secondaryProgress`

### Running the Migration

```bash
# Generate the migration
npx prisma migrate dev --name add_gameplay_rules

# Or if in production
npx prisma migrate deploy
```

### Post-Migration Steps

1. Run the seed script to populate rules:
   ```bash
   npx tsx scripts/seedGameplayRules.ts
   ```

2. Verify the migration:
   ```bash
   npx prisma studio
   ```
   Check that GameRule, SecondaryObjective, and PrimaryMission tables exist.

### Rollback (if needed)

If you need to rollback:
```bash
# List migrations
npx prisma migrate status

# Rollback specific migration
# Note: Prisma doesn't support automatic rollback, you'll need to manually revert
```

### Data Migration Notes

- Existing game sessions will continue to work
- New sessions can optionally select a primary mission
- Secondary progress will start tracking from new sessions
- CP transactions will be logged going forward

### Verification Queries

After migration, verify with these queries:

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('GameRule', 'SecondaryObjective', 'PrimaryMission', 'CPTransaction', 'SecondaryProgress');

-- Verify GameSession updates
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'GameSession' 
AND column_name IN ('primaryMissionId', 'primaryVPScored');
```

### Troubleshooting

**Error: Relation does not exist**
- Make sure you've run `npx prisma generate` after migration
- Restart your dev server

**Error: Migration conflicts**
- Run `npx prisma migrate resolve --applied <migration_name>`
- Or reset with `npx prisma migrate reset` (WARNING: Deletes all data)

### Next Steps

After migration completes:
1. Parse rules from PDFs: `npx tsx scripts/parseGameplayRules.ts --sync`
2. Seed database: `npx tsx scripts/seedGameplayRules.ts`
3. Test in dev environment
4. Deploy to production


