# Vercel Deployment Guide

## Environment Overview

TacLog uses **separate Supabase projects** for development and production:

| Environment | Supabase Project | Project ID | Region |
|-------------|------------------|------------|--------|
| **Local Dev** | TacLog | `lelfaceyultzvztdndzs` | us-east-2 |
| **Production** | TacLogProd | `qzpsnwhjztydbbgcufrk` | us-west-2 |

### Authentication
- **Provider**: Google OAuth only
- **Separation**: Separate Google OAuth apps for dev and prod (better isolation)

## Prerequisites

- ✅ Fresh repository created (`warhammer_app_prod`)
- ✅ Production Supabase project ready (`qzpsnwhjztydbbgcufrk`)
- ✅ Development Supabase project ready (`lelfaceyultzvztdndzs`)
- ✅ Database schema pushed to both environments
- ✅ Separate Google OAuth apps for dev and prod
- ⏳ Reference data migrated (run migration script first)

## Step 1: Push Repository to GitHub

1. **Create a new GitHub repository** (e.g., `taclog` or `taclog-app`)
2. **Push your code:**

```bash
cd C:\Dev\warhammer_app_prod
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` or `yarn install`

## Step 3: Configure Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

### Required Variables

```env
# AI Provider
AI_PROVIDER=openai

# OpenAI (if using OpenAI)
OPENAI_API_KEY=sk-...

# Google (if using Gemini)
GOOGLE_API_KEY=...

# Supabase Production
DATABASE_URL=postgresql://postgres.qzpsnwhjztydbbgcufrk:[YOUR-DB-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
NEXT_PUBLIC_SUPABASE_URL=https://qzpsnwhjztydbbgcufrk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Get from Supabase Dashboard → Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Get from Supabase Dashboard → Project Settings → API
```

### Optional Variables

```env
# Langfuse Observability
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# Vercel Blob Storage (for unit icons)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Google Custom Search (for icon generation)
GOOGLE_SEARCH_CX=...
GOOGLE_SEARCH_API_KEY=...
```

**Important:** 
- Set all variables for **Production**, **Preview**, and **Development** environments
- The `SUPABASE_SERVICE_ROLE_KEY` must be kept secret - get it from Supabase Dashboard

## Step 4: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for build to complete
3. Note your production URL (e.g., `https://your-app.vercel.app`)

## Step 5: Configure Supabase Auth (Production)

**In TacLogProd Supabase Dashboard** (`qzpsnwhjztydbbgcufrk`):

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel production URL (e.g., `https://taclog.vercel.app`)
3. Add **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

**In Google Cloud Console** (Production OAuth App):
1. Ensure **Authorized redirect URIs** includes:
   - `https://qzpsnwhjztydbbgcufrk.supabase.co/auth/v1/callback`

## Step 6: Verify Deployment

1. Visit your Vercel URL
2. Test authentication (sign in with Google)
3. Test voice commands
4. Test session creation

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all environment variables are set
- Ensure `DATABASE_URL` uses the pooler connection string

### Authentication Doesn't Work
- Verify redirect URLs are configured in Supabase
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Ensure OAuth providers are enabled in Supabase

### Database Connection Errors
- Verify `DATABASE_URL` uses transaction pooler (port 6543)
- Check database password is correct
- Ensure production database is active

## Next Steps

After successful deployment:
1. ✅ Enable Row Level Security (see `ENABLE_RLS.md`)
2. ✅ Add rate limiting (optional but recommended)
3. ✅ Test all major flows
4. ✅ Monitor Langfuse for AI usage

---

## Local Development Setup

### 1. Configure Environment Variables

Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

The template is pre-configured for the **TacLog (dev)** Supabase project.

### 2. Create Development Google OAuth App

In [Google Cloud Console](https://console.cloud.google.com):

1. Create a new OAuth 2.0 Client ID named "TacLog-Dev"
2. Set **Authorized JavaScript origins**: `http://localhost:3000`
3. Set **Authorized redirect URIs**: `https://lelfaceyultzvztdndzs.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret

### 3. Configure TacLog (Dev) Supabase Auth

In **TacLog Supabase Dashboard** (`lelfaceyultzvztdndzs`):

1. Go to **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/auth/callback`

2. Go to **Authentication** → **Providers** → **Google**:
   - Enable Google provider
   - Enter the Client ID and Client Secret from TacLog-Dev OAuth app

### 4. Push Schema to Dev Database

```bash
npx prisma db push
```

### 5. Run Development Server

```bash
yarn dev
```

---

## Environment Reference

### TacLog (Development)
- **Supabase URL**: `https://lelfaceyultzvztdndzs.supabase.co`
- **Region**: us-east-2
- **Google OAuth**: TacLog-Dev app
- **Site URL**: `http://localhost:3000`

### TacLogProd (Production)
- **Supabase URL**: `https://qzpsnwhjztydbbgcufrk.supabase.co`
- **Region**: us-west-2
- **Google OAuth**: TacLog-Prod app
- **Site URL**: Your Vercel production URL

