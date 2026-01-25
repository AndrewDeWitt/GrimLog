# Supabase Authentication Setup Complete

## ✅ What Was Implemented

### 1. Core Authentication System
- **Supabase Integration**: Installed `@supabase/supabase-js` and `@supabase/ssr` packages
- **Client/Server Utilities**: Created browser and server-side Supabase clients
- **Middleware**: Set up Next.js middleware for automatic session refresh
- **Auth Context**: Created React Context for managing auth state across the app
- **Auth Hooks**: `useAuth()` and `useRequireAuth()` for easy access to auth state

### 2. Database Schema Updates
- **User Model**: Added `User` model to Prisma schema with:
  - `id` (Supabase auth.users.id)
  - `email`, `name`, `avatar`
  - Relations to `Army` and `GameSession`
- **Updated Relations**:
  - `Army` now links to `userId` (owner of the army)
  - `GameSession` links to `userId` (session owner)
  - `Player` can optionally link to `userId`
  - Added `sharedWith` field to `GameSession` for multi-user support

### 3. UI Components
- **AuthModal**: Beautiful Mechanicus-themed modal with:
  - Google sign-in button
  - Responsive design with grimdark aesthetics
- **Updated HamburgerMenu**: Now shows:
  - User avatar (or initials)
  - User name and email
  - Sign-out button

### 4. Protected API Routes
Updated all API routes to require authentication:
- ✅ `/api/armies` - Filters armies by userId
- ✅ `/api/sessions` - Filters sessions by userId (with sharing support)
- ✅ `/api/analyze` - Requires auth, logs userId in Langfuse
- ✅ `/api/users` - User creation and retrieval

### 5. Frontend Updates
- **Main Page**: Shows AuthModal when user is not authenticated
- **Session Loading**: Only loads sessions when authenticated
- **User-Scoped Data**: All queries filter by authenticated user

### 6. OAuth Callback Route
Created `/auth/callback` to handle OAuth redirects from Supabase and automatically create/update User records in the database.

### 7. Documentation
- ✅ Updated README with Supabase setup instructions
- ✅ Added environment variable documentation
- ✅ Added deployment guide with Supabase

## 🚀 Next Steps (Manual Configuration Required)

### 1. Set Up Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Create a new project (if you haven't already)
3. Wait for the database to be provisioned

### 2. Get Supabase Credentials
1. Go to **Project Settings** > **API**
2. Copy the following values to your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

3. Go to **Project Settings** > **Database**
4. Copy the **Connection Pooling** connection string
5. Add to `.env.local` as `DATABASE_URL`

### 2.5. Configure AI Provider
TacLog supports both OpenAI and Google Gemini as AI providers. Configure your preferred provider:

#### Option A: Use OpenAI (Default)
```bash
# .env.local
AI_PROVIDER=openai  # or omit (defaults to openai)
OPENAI_API_KEY=sk-...  # Your OpenAI API key
```

#### Option B: Use Google Gemini
```bash
# .env.local
AI_PROVIDER=google
GOOGLE_API_KEY=...  # Your Google AI API key from https://aistudio.google.com/
```

**Getting a Google AI API Key:**
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key for your project
5. Copy the key to your `.env.local`

**Model Selection:**
- **OpenAI**: Uses `gpt-5-mini` for analysis, `gpt-5-nano` for intent classification
- **Google**: Uses `gemini-2.5-flash` for both analysis and intent classification

You can switch between providers at any time by changing the `AI_PROVIDER` environment variable.

### 3. Configure Google OAuth

TacLog uses **Google OAuth only** for authentication, with **separate OAuth apps** for development and production.

#### Production Google OAuth (TacLog-Prod):
1. In [Google Cloud Console](https://console.cloud.google.com/), create OAuth 2.0 Client ID
2. Set **Authorized redirect URIs**: `https://qzpsnwhjztydbbgcufrk.supabase.co/auth/v1/callback`
3. In TacLogProd Supabase Dashboard → **Authentication** → **Providers** → **Google**
4. Add the Client ID and Client Secret

#### Development Google OAuth (TacLog-Dev):
1. Create a separate OAuth 2.0 Client ID for development
2. Set **Authorized JavaScript origins**: `http://localhost:3000`
3. Set **Authorized redirect URIs**: `https://lelfaceyultzvztdndzs.supabase.co/auth/v1/callback`
4. In TacLog Supabase Dashboard → **Authentication** → **Providers** → **Google**
5. Add the Client ID and Client Secret

### 4. Configure Redirect URLs

#### TacLogProd (Production):
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: Your Vercel production URL (e.g., `https://taclog.vercel.app`)
3. Add **Redirect URLs**: `https://your-vercel-app.vercel.app/auth/callback`

#### TacLog (Development):
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3000`
3. Add **Redirect URLs**: `http://localhost:3000/auth/callback`

### 5. Sync Database Schema
```bash
# Push the updated schema to Supabase
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 6. Test Authentication
```bash
# Start the development server
npm run dev

# Open http://localhost:3000
# You should see the auth modal
# Try signing in with Google or email/password
```

## 🔒 Security Features

### Data Isolation
- **Army Lists**: Users can only see their own armies
- **Game Sessions**: Users can only see their own sessions (or shared ones)
- **API Protection**: All routes verify user authentication
- **Row Level Security**: Can be enabled in Supabase for additional protection

### Authentication Flow
1. User visits app → Sees AuthModal
2. User signs in with OAuth or email/password
3. Supabase handles authentication
4. User redirected to `/auth/callback`
5. User record created/updated in database
6. Session established with cookies
7. User has access to app with their data

### Session Management
- Sessions are stored in HTTP-only cookies
- Automatic refresh on page load via middleware
- Secure by default (no localStorage tokens)

## 📊 Optional: Row Level Security (RLS)

For maximum security, you can enable RLS in Supabase:

### Enable RLS on Tables
```sql
-- Run in Supabase SQL Editor

-- Enable RLS on Army table
ALTER TABLE "Army" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own armies"
  ON "Army" FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can create their own armies"
  ON "Army" FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update their own armies"
  ON "Army" FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete their own armies"
  ON "Army" FOR DELETE
  USING (auth.uid() = "userId");

-- Enable RLS on GameSession table
ALTER TABLE "GameSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON "GameSession" FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can create their own sessions"
  ON "GameSession" FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update their own sessions"
  ON "GameSession" FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete their own sessions"
  ON "GameSession" FOR DELETE
  USING (auth.uid() = "userId");
```

## 🎯 Benefits of Supabase Auth

### Cost-Effective
- **50,000 monthly active users** on free tier
- Way better than Auth0's 7,500 free users
- Scales affordably ($25/month for 100k users)

### Simple
- One service for database + authentication
- No need to sync users between systems
- Built-in social providers
- Automatic session management

### Powerful
- Row Level Security integration
- Real-time subscriptions (for future features)
- Storage integration (for user avatars)
- Edge Functions (for custom logic)

## 🐛 Troubleshooting

### "Unauthorized" errors
- Check that `.env.local` has all required variables
- Verify Supabase keys are correct
- Ensure `NEXT_PUBLIC_` prefix is correct for client-side variables

### OAuth redirect doesn't work
- Verify redirect URLs are configured in Supabase
- Check that OAuth credentials are correct
- Ensure your domain matches the configured URLs

### User not created in database
- Check `/auth/callback` route is working
- Look for errors in browser console
- Verify Prisma schema is synced (`npx prisma db push`)

### Session doesn't persist
- Check that middleware is running (should see it in logs)
- Verify cookies are being set (check browser DevTools)
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is correct

## 📝 Testing Checklist

- [ ] Environment variables are set in `.env.local` (dev) and Vercel (prod)
- [ ] Google OAuth is configured in both Supabase projects
- [ ] Redirect URLs are configured for both environments
- [ ] Database schema is synced in both projects
- [ ] Can sign in with Google (dev - localhost redirects correctly)
- [ ] Can sign in with Google (prod - Vercel URL redirects correctly)
- [ ] User record is created in database
- [ ] Session persists on page refresh
- [ ] Auth modal closes after successful login
- [ ] User info appears in hamburger menu
- [ ] Sign out works correctly
- [ ] API routes require authentication
- [ ] Users can only see their own armies
- [ ] Users can only see their own game sessions

## 🎉 You're Done!

Your TacLog app now has enterprise-grade authentication powered by Supabase. Users can:
- Sign up and sign in with social providers
- Have their own private army lists
- Track their own game sessions
- Sign out securely

The app is ready for multi-user deployment and can scale to thousands of users on the free tier!

