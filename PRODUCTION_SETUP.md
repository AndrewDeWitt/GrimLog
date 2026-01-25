# TacLog Production Setup Guide

## Production Supabase Project

- **Project Name**: TacLogProd
- **Project ID**: `qzpsnwhjztydbbgcufrk`
- **Project URL**: `https://qzpsnwhjztydbbgcufrk.supabase.co`
- **Region**: `us-west-2`
- **Status**: ACTIVE_HEALTHY

## Required Environment Variables

Get these from Supabase Dashboard → Project Settings → API:

```env
# Supabase Production
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
NEXT_PUBLIC_SUPABASE_URL=https://qzpsnwhjztydbbgcufrk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Get from Supabase Dashboard
SUPABASE_SERVICE_ROLE_KEY=[GET_FROM_DASHBOARD]

# Or use the modern publishable key:
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_cJEbr_LT3-eycllBGbFcGA_jPMR1B9N
```

**To get DATABASE_URL:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Under "Connection string", select "Transaction pooler" mode
3. Copy the connection string (replace `[YOUR-PASSWORD]` with your database password)

**To get SUPABASE_SERVICE_ROLE_KEY:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the "service_role" key (keep this secret!)

## OAuth Provider Configuration

Configure these in Supabase Dashboard → Authentication → Providers:

### Google OAuth
1. Enable Google provider
2. Get OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)
3. Add Client ID and Client Secret to Supabase
4. Set redirect URL: `https://qzpsnwhjztydbbgcufrk.supabase.co/auth/v1/callback`

### Microsoft/Azure OAuth
1. Enable Azure provider
2. Create app in [Azure Portal](https://portal.azure.com/)
3. Add Client ID and Client Secret to Supabase
4. Set redirect URL: `https://qzpsnwhjztydbbgcufrk.supabase.co/auth/v1/callback`

### Redirect URLs for Production
Add these redirect URLs in Supabase Dashboard → Authentication → URL Configuration:
- `http://localhost:3000/auth/callback` (for local testing)
- `https://your-app.vercel.app/auth/callback` (after Vercel deployment)

## Database Schema Setup

Once you have the DATABASE_URL, run:

```bash
cd C:\Dev\warhammer_app_prod
DATABASE_URL="your-production-connection-string" npx prisma db push
npx prisma generate
```

## Data Migration

After schema is pushed, migrate reference data from dev database:
- StratagemData (976 rows)
- Weapon (613 rows)
- Datasheet (219 rows)
- Ability (513 rows)
- Detachment (166 rows)
- Enhancement (658 rows)
- Faction (26 rows)

See `DATA_MIGRATION.md` for detailed migration steps.


