# Grimlog - AI Battle Tracker

**Version 4.54.0** - Narrative Tactical Summaries & Leader Rules

An AI-powered tactical logger for tabletop wargames, featuring voice-activated phase tracking, comprehensive undo/correction system, per-model wound tracking with smart damage distribution, damage calculator (MathHammer), character attachment management, official datasheet integration, rules validation, and multi-provider AI support (OpenAI + Google Gemini).

> **⚠ Forbidden AI Technology** - Men of Iron Protocol Active

## 🆕 What's New in v4.54.0

- **📝 Narrative Unit Summaries** - Replaced raw damage numbers with plain English tactical advice, including weaknesses and counterpoints for balanced assessments.
- **🛡️ Leader Attachment Accuracy** - Character attachment recommendations are now powered by verified database rules, preventing AI hallucinations.
- **🔍 Full Datasheet Context** - AI now receives complete, non-truncated unit abilities for improved strategic depth.
- **🛠️ Server-Side Data Enrichment** - New enrichment layer ensures analysis is based on official rules even when parsed data is imperfect.
- See [Tactical Dossier Guide](docs/features/TACTICAL_DOSSIER.md)

## 🆕 What's New in v4.53.0

## 🆕 What's New in v4.13.0

- **📊 Damage Calculator (MathHammer)** - Statistical combat simulation tool
  - Quick modal and full-page interfaces for theory-crafting
  - Game-aware unit and weapon selection from current battle
  - Complete modifier support: rerolls, cover, special abilities
  - Real-time calculations with detailed probability breakdown
  - Voice integration: "How much damage would X do to Y?"
  - Supports all 10th Edition mechanics (Lethal Hits, Sustained Hits, Devastating Wounds, etc.)
  - See [Damage Calculator Guide](docs/features/DAMAGE_CALCULATOR.md)

## 🆕 What's New in v4.10.0

- **⚔️ Stratagem & Detachment System** - Smart stratagem filtering by detachment
  - Required detachment selection during army import
  - Live detachment switching with instant stratagem updates (no page reload)
  - Scraped 213+ stratagems for Space Marines and all divergent chapters
  - Smart filtering: only shows detachment-specific + Core stratagems
  - Space Wolves now has 33 stratagems across 4 detachments
  - See [Stratagem & Detachment System Guide](docs/features/STRATAGEM_DETACHMENT_SYSTEM.md)

## 🆕 What's New in v4.5.0

- **🔄 Game State Correction & Revert System** - Comprehensive undo for all mistakes
  - Voice commands: "undo the last stratagem", "actually that was 4 VP not 3"
  - Manual controls: Click "⎌ UNDO" button on any timeline event
  - Cascade warnings: Know when reverting affects subsequent events
  - Complete state restoration: CP, VP, phases, objectives, unit damage - everything
  - Full audit trail: All reverts logged with who, what, when, why
  - Grouped consecutive reverts: Clean timeline even with multiple corrections
  - See [Revert System Guide](docs/features/REVERT_SYSTEM.md)

## 🆕 What's New in v4.4.0

- **🤖 Multi-Provider AI Support** - Choose between OpenAI or Google Gemini
  - Switch providers via `AI_PROVIDER` environment variable
  - OpenAI: GPT-5-mini (analysis) + GPT-5-nano (intent)
  - Google: Gemini 2.5 Flash (both analysis and intent)
  - All 25 tools work with both providers
  - Cost optimization with Gemini's free tier
  - See [Google Gemini Integration Guide](docs/features/GOOGLE_GEMINI_INTEGRATION.md)

## 🆕 What's New in v4.0.0

- **⚔️ Rules-Based Gameplay Enhancement** - Official Warhammer 40K rules integration (NEW!)
  - Automatic secondary VP calculation (Assassination, Bring It Down, etc.)
  - CP validation with max 2 CP/turn enforcement
  - 7 primary missions from Chapter Approved
  - Proactive phase reminders (CP gain, battle-shock, scoring opportunities)
  - Damaged state detection for multi-wound units
  - See [Rules System Guide](docs/guides/RULES_SYSTEM_GUIDE.md)

- **🎯 Attacker vs Defender Terminology** - Complete refactor for clarity
  - Consistent "Attacker/Defender" terminology throughout entire UI
  - Session setup: Choose Attacker/Defender armies at game creation
  - Color-coded: Green for Attacker, Red for Defender
  - Voice commands: "Attacker's Terminators" instead of "my units"
  - See [Usage Guide](docs/guides/ATTACKER_DEFENDER_USAGE_GUIDE.md) and [Migration Guide](docs/MIGRATION_V3_TO_V4.md)
  
- **📊 Unit Management View** - Redesigned unit tracking (v3.13.0)
  - Smart filtering by status, role, and search
  - Per-model health tracking with modal controls
  - Phase-contextual quick actions
  
- **🎯 Secondary Objectives System** - Complete Chapter Approved 2025-26 integration (v3.8.0)
- **🎯 Per-Model Wound Tracking** - Track individual models within units with role awareness (v3.3.0)

## Version

**Current Version:** 4.54.0 (December 31, 2025)

**Latest Updates:**
- **Narrative Tactical Summaries & Leader Rules:** Plain English unit guides with weaknesses; accurate leader attachment validation via database enrichment
- **AI Unit Tactical Summaries & Roles:** 1-2 sentence tactical guides and dynamic role assignments for all units
- **Dossier UI Revamp:** Simplified unit cards focused on AI guidance; improved playstyle and combat focus assessments
- **Army Quirks:** 4 mechanical attributes highlighting what makes each army composition unique
- See [CHANGELOG.md](CHANGELOG.md) for full version history

**⚠️ BREAKING CHANGE in v4.0.0:**
- Complete terminology consolidation from "player/opponent" to "attacker/defender"
- Database migration required for existing sessions
- See [Migration Guide](docs/MIGRATION_V3_TO_V4.md) for details

## Features

### 🔐 User Authentication (NEW!)
- **Social login** - Sign in with Google, Microsoft, or Discord
- **Email/password** - Traditional authentication option
- **Secure sessions** - Powered by Supabase Auth
- **Per-user data** - Your armies and games are private
- **50k free users** - Generous free tier for growing communities
- **Shareable sessions** - Share specific games with opponents

### 🎤 Voice-Activated AI Analysis
- Continuous listening with Voice Activity Detection (VAD)
- Automatic transcription using OpenAI Whisper with segment timestamps
- **Multi-provider AI** (v4.4.0) - Choose OpenAI GPT-5 or Google Gemini
- **25 AI tools** for tracking phases, stratagems, combat, objectives, units, corrections, and more
- **Revert system** (NEW v4.5.0!) - Voice commands to undo mistakes and make corrections
- **LLM gatekeeper system** - Filters non-game conversation to save costs
- **Intent orchestrator** - 6-tier context optimization (minimal to full)
- Conversation history for context (last 20 transcriptions)
- Handles background noise and natural speech patterns
- **Smart unit name matching** - Recognizes nicknames and abbreviations
- **Accurate timestamps** - Events timestamped to when you actually spoke them
- **Structured outputs** - JSON schemas for reliable tool calling

### ⚔️ Unit Health Tracking with Per-Model Granularity
- **Per-model tracking** - See each individual model's health state (NEW!)
- **Role awareness** - Sergeants, heavy weapons, special weapons tracked separately (NEW!)
- **Smart distribution** - AI automatically protects special models when allocating wounds (NEW!)
- **Visual model grid** - Color-coded boxes showing each model (green/amber/red) (NEW!)
- **Character attachments** - Pre-configure which characters attach to units (NEW!)
- **Voice-controlled** - "My Terminators lost 2 models" or "Sergeant took 3 wounds"
- **Visual health bars** - Color-coded progress bars for overall unit health
- **Half-strength warnings** - Automatic battleshock reminders
- **Manual controls** - Tap +/- buttons to adjust models and wounds
- **Battlefield organization** - Units grouped by role (Characters, Battleline, etc.)
- **Army health overview** - See total army strength at a glance

### 🎮 Army-Required Session Management (UPDATED!)
- **Army selection required** - Both player and opponent armies must be selected
- **Automatic unit initialization** - All units loaded from army lists at battle start
- **Session history** - Browse all past games with full army details
- **Continue or replay** - Resume sessions or view past battles

### 🎲 Turn Order System (NEW v3.11.0!)
- **Attacker/Defender tracking** - Proper Warhammer 40K turn order implementation
- **First player selection** - Set who won the roll-off during game setup
- **Smart round progression** - Automatically advances rounds when defender's turn ends
- **Round/Turn dropdown** - Jump to any round (1-5) and turn (attacker/defender)
- **Role-based color coding** - Green for attacker, red for defender
- **Turn position badges** - Visual "1st" and "2nd" turn indicators
- **Voice AI awareness** - Contextually understands "end of my turn"
- **Error correction** - Navigate backward if needed
- **Optimistic UI** - Instant updates, background API calls

### 📋 Event Timeline
- Automatic logging of phase changes
- Track important game events:
  - Stratagem usage
  - Deep strikes
  - Objective captures
  - Unit health changes
  - Combat results
  - Custom events
  - **Revert actions** (NEW v4.5.0!) - Audit trail for corrections
- **Undo capability** (NEW v4.5.0!) - Click "⎌ UNDO" on any event
- **Cascade detection** - Warns about subsequent events before reverting
- **Grouped reverts** - Consecutive corrections auto-grouped for clean display
- Full persistence with PostgreSQL database

### 🤖 AI Army Management (IMPROVED!)
- **AI-powered imports** - Upload images, PDFs, or text files
- **Official datasheets** (NEW!) - Complete 10th edition unit profiles from Wahapedia
- **Automatic matching** - AI matches units to templates with confidence scores
- **Template validation** - Foreign key validation before database insert
- **Review system** - Flag uncertain matches for manual verification
- **Langfuse tracing** - Debug parsing issues with full observability

### ⚔️ Rules Engine (NEW!)
- **Official datasheet data** - Stats, weapons, abilities for 96+ Space Wolves units
- **Combat validation** - Validates ranges, calculates wound rolls (S vs T)
- **Weapon profiles** - Complete profiles with abilities (RAPID FIRE, ANTI-X, etc.)
- **Ability lookups** - Full text of all unit and faction abilities
- **Stratagem database** - CP costs, timing, restrictions
- **AI rules expert** - Ask "What's Logan Grimnar's toughness?" and get accurate answers

### 🔍 LLM Observability (Langfuse)
- **Complete AI tracing** - Every prompt, response, and tool call logged
- **Full context visibility** - See exact prompts including conversation history
- **Gatekeeper transparency** (NEW!) - View classification decisions with full prompts
- **Cost tracking** - Monitor token usage and API costs per request
- **Performance monitoring** - Response times and success rates
- **Tool call inspection** - View arguments and results for all AI decisions
- **Session tagging** - Filter traces by game session, round, or phase

### 🎨 Mechanicus-Themed UI
- Grimdark aesthetic with brass and red accents
- Animated decorative elements
- Responsive design for desktop and tablet
- Machine God inspired interface

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** Prisma + PostgreSQL (Supabase)
- **Authentication:** Supabase Auth (Google, Microsoft, Discord, Email)
- **AI:** OpenAI (Whisper + GPT-5 with function calling + 14 tools)
- **Observability:** Langfuse (LLM tracing and monitoring)
- **Audio:** Web Audio API with custom VAD
- **Unit Templates:** 23 pre-seeded templates (Space Marines + Tyranids)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Supabase account ([sign up here](https://supabase.com)) - for database and authentication
- Langfuse account (optional, [sign up here](https://langfuse.com)) - for LLM observability

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create `.env.local` and add your API keys:
   ```env
   # AI Provider Selection (Optional - defaults to 'openai')
   AI_PROVIDER=openai  # or 'google' for Gemini
   
   # OpenAI (Required if AI_PROVIDER=openai)
   OPENAI_API_KEY=your_actual_api_key_here
   
   # Google Gemini (Required if AI_PROVIDER=google)
   GOOGLE_API_KEY=your_google_ai_key_here  # Get from https://aistudio.google.com/
   
   # Database (Required - Supabase PostgreSQL)
   # Select "Transaction pooler" in Supabase → Connection String → Method dropdown
   # This is the recommended method for Next.js serverless API routes
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   
   # Supabase Auth (Required)
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   
   # Langfuse Observability (Optional but Recommended)
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
   
   # Google Custom Search (Required for Icon Generation)
   GOOGLE_SEARCH_CX=your_search_engine_id_here  # See setup instructions below
   GOOGLE_SEARCH_API_KEY=your_api_key_here  # Optional: dedicated key, or uses GOOGLE_API_KEY
   ```
   
   > **Note:** Get Supabase keys from Project Settings > API in your Supabase dashboard
   > 
   > Get Langfuse keys from [https://langfuse.com](https://langfuse.com) to enable full LLM tracing
   > 
   > **Google Custom Search Setup (for Icon Generation):**
   > 1. Go to [https://programmablesearchengine.google.com/](https://programmablesearchengine.google.com/)
   > 2. Click **"Add"** to create a new search engine
   > 3. Enter a name (e.g., "Warhammer Icon Search") and description
   > 4. Under **"Sites to search"**, enter: `*` (asterisk to search the entire web)
   > 5. Click **"Create"**
   > 6. Go to **"Control Panel"** → **"Setup"** → **"Basics"**
   > 7. Copy the **"Search engine ID"** (looks like `012345678901234567890:abcdefghijk`)
   > 8. Add it to your `.env.local` as `GOOGLE_SEARCH_CX=your_search_engine_id`
   > 9. Enable the **"Custom Search API"** in [Google Cloud Console](https://console.cloud.google.com/apis/library/customsearch.googleapis.com) for your project
   > 10. Restart your development server

3. **Set up Supabase:**
   
   a. Create a new project at [https://supabase.com](https://supabase.com)
   
   b. Get your connection string from Project Settings > Database
   
   c. Enable Auth providers in Authentication > Providers:
      - Enable Google (add OAuth credentials)
      - Enable Microsoft/Azure (add OAuth credentials)
      - Enable Discord (optional)
      - Set redirect URLs: `http://localhost:3000/auth/callback`, `https://yourdomain.com/auth/callback`

4. **Initialize the database:**
   ```bash
   npx prisma db push
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   
   Navigate to [http://localhost:3000](http://localhost:3000)
   
7. **Sign in:**
   
   You'll be prompted to sign in with Google, Microsoft, or email/password

## Usage

### Signing In

1. Navigate to **http://localhost:3000**
2. You'll see an authentication modal
3. Choose your sign-in method:
   - **Google** - Quick OAuth sign-in
   - **Microsoft** - Azure AD sign-in
   - **Discord** - For gaming communities
   - **Email/Password** - Traditional sign-in
4. After signing in, you'll have access to the app

### Starting a Game Session

1. Once signed in, navigate to **http://localhost:3000**
2. Click **"⚔ NEW BATTLE"** to create a session
   - Select your army and opponent's army
   - Auto-creates a session in the database
3. Click **"▶ START"** to activate voice recognition
   - Microphone permission required
4. Speak naturally to announce phases or events
5. AI analyzes with conversation history for context
6. All data saved to your account automatically

### Managing Sessions

**View All Sessions:**
- Click **"◈ SESSIONS"** in top right
- See active and past games
- Continue active sessions
- View replays of completed games

**Continue Existing Game:**
- Refresh page → Auto-resumes last session
- Or go to Sessions → Click "CONTINUE"

**End Game:**
- Click **"◼ END"** button (appears when session active)
- Confirm to mark game as complete
- Session moves to "Past Games"

### Example Voice Commands

- **Phase Changes:**
  - "Starting my command phase"
  - "Moving to movement phase"
  - "I'm in the shooting phase now"
  
- **Game Events:**
  - "Using Stratagem of the Protector"
  - "Deep striking my terminators here"
  - "Capturing objective 3"
  - "Using my Warlord's ability"

### Managing Armies

1. Navigate to **Army Codex** (create a link from main page or go to `/armies`)
2. Click **"+ NEW ARMY"**
3. Fill in player details, faction, and army name
4. Add units and stratagems for better AI recognition

### Controls

- **▶ START / ■ STOP:** Activate/deactivate audio listening
- **► ROUND:** Advance to next battle round (resets to Command Phase)
- **▼ LOG / ▲ LOG:** Show/hide event timeline
- **✕ CLEAR:** Clear timeline display (DB data preserved)
- **◼ END:** End current game session
- **◈ SESSIONS:** Open session manager
- **◆ ARMIES:** Open army management

## Project Structure

```
warhammer_app/
├── app/
│   ├── page.tsx                 # Main game interface
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Grimlog theme styles
│   ├── sessions/                # Session management
│   │   ├── page.tsx            # Session list
│   │   └── [id]/page.tsx       # Session replay
│   ├── armies/                  # Army management
│   └── api/
│       ├── analyze/             # Whisper + GPT-5-nano
│       ├── sessions/            # Session CRUD + events
│       └── armies/              # Army CRUD
├── components/
│   ├── PhaseDisplay.tsx         # Current phase indicator
│   ├── Timeline.tsx             # Event history log
│   ├── AudioIndicator.tsx       # Microphone status
│   └── MechanicusFrame.tsx      # Decorative UI frame
├── lib/
│   ├── aiTools.ts               # 11 AI tool definitions
│   ├── toolHandlers.ts          # Tool execution logic
│   ├── langfuse.ts              # Langfuse observability client
│   ├── audioCapture.ts          # VAD and audio recording
│   ├── prisma.ts                # Database client
│   └── types.ts                 # TypeScript definitions
├── prisma/
│   └── schema.prisma            # Database schema
└── README.md
```

## How It Works

### Voice Activity Detection
The app uses the Web Audio API to continuously monitor audio levels. When it detects speech above a threshold, it starts recording. After 2 seconds of silence, it automatically sends the audio to the backend for analysis.

### AI Analysis Pipeline (with Langfuse Tracing)
1. **📊 Create Trace:** Langfuse trace captures entire request with game state
2. **🎤 Transcription:** Whisper converts audio to text (logged in Langfuse)
3. **📚 History Retrieval:** Fetch last 5 transcriptions for context
4. **🤖 GPT-5 Analysis:** AI analyzes with full context + 11 available tools
   - System prompt includes: game rules, army context, conversation history
   - AI decides which tools to call (if any)
   - All prompts and responses logged in Langfuse
5. **🔧 Tool Execution:** Execute selected tools (change phase, log stratagem, etc.)
   - Each tool call logged as individual event
   - Results captured (success/failure, data changes)
6. **💾 Database Persistence:** Save transcripts, events, and game state
7. **🔄 State Refresh:** Update UI with latest game data
8. **📈 Trace Complete:** Full request logged with tags, costs, and metadata

### Conversation History System
Every transcription is saved to the database with a sequence number. When analyzing new speech, the system retrieves the last 5 transcriptions to provide context to the AI. This dramatically improves accuracy for partial phrases and multi-part statements.

**Example:**
- User says: "Okay I'm" → Saved (sequence 1)
- User says: "done with command" → Saved (sequence 2)
- User says: "moving to shooting" → Saved (sequence 3)
- AI sees all 3 → Correctly detects: "Phase change to Shooting"

### Data Persistence
- **LocalStorage:** Fast UI updates, session resumption
- **PostgreSQL Database:** Permanent storage for all game data
- **Hybrid Strategy:** LocalStorage for speed, database for permanence
- **Session Recovery:** Auto-resume on refresh using localStorage session ID

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Import the project in Vercel

3. Add environment variables in Vercel dashboard:
   - `AI_PROVIDER` - (Optional) 'openai' (default) or 'google'
   - `OPENAI_API_KEY` - Your OpenAI API key (required if using OpenAI)
   - `GOOGLE_API_KEY` - Your Google AI API key (required if using Gemini)
   - `DATABASE_URL` - Your Supabase PostgreSQL connection string
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `LANGFUSE_SECRET_KEY` - (Optional) Your Langfuse secret key
   - `LANGFUSE_PUBLIC_KEY` - (Optional) Your Langfuse public key
   - `LANGFUSE_BASE_URL` - (Optional) Your Langfuse instance URL

4. Update Supabase Auth redirect URLs:
   - Go to Authentication > URL Configuration
   - Add your Vercel domain: `https://your-app.vercel.app/auth/callback`

5. Deploy!

**Note:** Your Supabase database is already PostgreSQL and production-ready!

## Future Enhancements

### Planned Features
- [ ] Pre-game unit goal setting
- [ ] Post-game analysis and unit performance tracking
- [ ] Multiple player support in single game
- [ ] Dice roll logging and probability analysis
- [ ] Export game reports
- [ ] Mobile app version
- [ ] Shared game sessions (multiplayer)
- [ ] Custom faction-specific prompts
- [ ] Tournament mode with match history

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Documentation Index](docs/README.md)** - Complete documentation overview
- **[AI Tool Calling System](docs/features/AI_TOOL_CALLING_SETUP.md)** - How AI tools work
- **[Langfuse Integration](docs/features/LANGFUSE_INTEGRATION.md)** - LLM observability setup
- **[Session System](docs/features/SESSION_SYSTEM.md)** - Game session management
- **[Troubleshooting](docs/troubleshooting/)** - Common issues and fixes

## Troubleshooting

### Microphone Not Working
- Ensure you've granted microphone permissions in your browser
- Check if another app is using the microphone
- Try using HTTPS (required for secure contexts)

### AI Not Detecting Phases
- Speak clearly and mention the phase name explicitly
- Check your OpenAI API key is valid
- Look at the transcription to see if Whisper heard you correctly
- **Check Langfuse traces** to see exactly what prompt was sent to AI

### Database Errors
- Run `npx prisma migrate reset` to reset the database
- Ensure `DATABASE_URL` is set correctly in `.env.local`

### Page Reloads or Errors
- See [Reload Bug Fix Guide](docs/troubleshooting/RELOAD_BUG_FIX.md)
- Check browser console for error messages
- Verify all environment variables are set

## Contributing

This is an MVP built for rapid iteration. Contributions welcome!

## License

MIT License - Feel free to modify and use for your games!

## Credits

Built with the blessing of the Omnissiah ⚙️

*"From the moment I understood the weakness of my flesh, it disgusted me..."*

