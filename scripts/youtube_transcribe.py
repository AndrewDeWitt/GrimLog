"""
Content Scraper & Transcript Fetcher with Unit Context Extraction

✅ DIRECT DATABASE CONNECTION
==============================
This script uses direct PostgreSQL connection to Supabase, bypassing the
Next.js API. No ADMIN_API_KEY required - just ensure DATABASE_URL is set
in .env.local.

Requirements:
  - psycopg2-binary: pip install psycopg2-binary
  - DATABASE_URL in .env.local (Supabase connection string)
  - GOOGLE_API_KEY in .env.local (for AI extraction)
==============================

Interactive script to fetch content from various sources:
- YouTube videos (captions or Whisper transcription)
- Reddit posts and comments
- Gaming articles (Goonhammer, Art of War, etc.)
- Forum posts (DakkaDakka, Bolter and Chainsword, etc.)
- Generic webpages

Supports two workflows:

1. MANUAL MODE: Fetch individual URLs and extract context
2. PIPELINE MODE: Process faction-level sources from database

=== PIPELINE MODE (Faction-Level Sources) ===

Sources are added at the FACTION level (not per-unit), then the pipeline:
1. FETCH: Downloads content from YouTube/Reddit/articles
2. CURATE: AI identifies which units are discussed in the content
3. EXTRACT: AI extracts unit-specific competitive insights for each unit
4. AGGREGATE: Synthesizes all sources for a unit into final competitive context

Pipeline Commands:
  # Run all pipeline steps
  python3 scripts/youtube_transcribe.py --process-all

  # Run individual steps
  python3 scripts/youtube_transcribe.py --fetch-pending     # Step 1: Fetch content
  python3 scripts/youtube_transcribe.py --curate-pending    # Step 2: Identify units
  python3 scripts/youtube_transcribe.py --extract-pending   # Step 3: Extract context

  # Synthesize final context for a single unit
  python3 scripts/youtube_transcribe.py --aggregate --datasheet-name "Adrax Agatone"
  
  # Synthesize context for ALL units in a faction (batch mode)
  python3 scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"

=== MANUAL MODE ===

  # Interactive mode (prompts for URL)
  python3 scripts/youtube_transcribe.py

  # With URL (auto-detects source type)
  python3 scripts/youtube_transcribe.py --url "https://www.youtube.com/watch?v=..."
  python3 scripts/youtube_transcribe.py --url "https://www.reddit.com/r/WarhammerCompetitive/..."

  # Fetch + extract context for a specific unit
  python3 scripts/youtube_transcribe.py --url "..." --unit "Infernus Marines" --faction "Salamanders"

  # List available transcripts
  python3 scripts/youtube_transcribe.py --list

  # Extract context from existing transcript
  python3 scripts/youtube_transcribe.py --file "filename.txt" --unit "Infernus Marines"

Output:
  Content is saved to: data/youtube-transcripts/{source_id}_{safe_title}.txt
  Unit context JSON saved to: data/youtube-transcripts/{source_id}_{unit_name}_context.json

Requirements:
  - ffmpeg (for audio conversion): winget install ffmpeg (YouTube only)
  - beautifulsoup4: pip install beautifulsoup4 (for web scraping)
  - OPENAI_API_KEY in .env.local (for Whisper fallback)
  - GOOGLE_API_KEY in .env.local (for Gemini unit context extraction)
  - ADMIN_API_KEY in .env.local (for database integration)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Tuple
from urllib.parse import urlparse

import requests
from yt_dlp import YoutubeDL


def requests_with_retry(method: str, url: str, max_retries: int = 3, **kwargs) -> requests.Response:
    """Make HTTP request with exponential backoff retry on connection errors."""
    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.request(method, url, **kwargs)
            return response
        except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError) as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1, 2, 4 seconds
                print(f"   ⚠️ Connection error, retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                raise last_error

# Try to import BeautifulSoup for web scraping
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("⚠️ BeautifulSoup not installed. Web scraping will be limited.")
    print("   Install with: pip install beautifulsoup4")

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except Exception:
    pass

# Database connection (direct Supabase PostgreSQL access)
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("⚠️ psycopg2 not installed. Database access will be limited.")
    print("   Install with: pip install psycopg2-binary")

# Global database connection
_db_conn = None

def get_db_connection():
    """Get or create a database connection using DATABASE_URL from .env.local"""
    global _db_conn
    if _db_conn is not None and not _db_conn.closed:
        return _db_conn

    if not HAS_PSYCOPG2:
        raise RuntimeError("psycopg2 is required for database access")

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found in .env.local")

    # Remove pgbouncer params for direct connection compatibility
    # psycopg2 handles connection pooling differently
    clean_url = db_url.split("?")[0]

    _db_conn = psycopg2.connect(clean_url, cursor_factory=RealDictCursor)
    _db_conn.autocommit = True
    print("✅ Connected to Supabase PostgreSQL directly")
    return _db_conn

def close_db_connection():
    """Close the database connection"""
    global _db_conn
    if _db_conn is not None and not _db_conn.closed:
        _db_conn.close()
        _db_conn = None

# ============================================================
# DATABASE QUERY FUNCTIONS (replace API calls)
# ============================================================

def db_get_pending_sources(status: str = "pending") -> list:
    """Get competitive sources with the given status"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                cs.id, cs."sourceUrl", cs."sourceType", cs.content,
                cs."contentTitle", cs."authorName", cs."sourceId",
                cs.status, cs."errorMessage", cs."factionId", cs."detachmentId",
                f.name as "factionName"
            FROM "CompetitiveSource" cs
            LEFT JOIN "Faction" f ON cs."factionId" = f.id
            WHERE cs.status = %s
            ORDER BY cs."createdAt" ASC
        """, (status,))
        return cur.fetchall()

def db_get_faction_datasheets(faction_id: str) -> list:
    """Get all datasheets for a faction"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, faction, role, keywords
            FROM "Datasheet"
            WHERE "factionId" = %s AND "isEnabled" = true
            ORDER BY name ASC
        """, (faction_id,))
        return cur.fetchall()

def db_update_source_status(source_id: str, status: str, **kwargs):
    """Update a competitive source's status and optional fields"""
    conn = get_db_connection()

    # Build dynamic update query
    set_clauses = ['status = %s', '"updatedAt" = NOW()']
    values = [status]

    field_mapping = {
        'content': 'content',
        'contentTitle': '"contentTitle"',
        'authorName': '"authorName"',
        'sourceId': '"sourceId"',
        'errorMessage': '"errorMessage"',
        'duration': 'duration',
        'publishedAt': '"publishedAt"',
    }

    for key, col in field_mapping.items():
        if key in kwargs and kwargs[key] is not None:
            set_clauses.append(f'{col} = %s')
            values.append(kwargs[key])

    values.append(source_id)

    with conn.cursor() as cur:
        query = f'UPDATE "CompetitiveSource" SET {", ".join(set_clauses)} WHERE id = %s'
        cur.execute(query, values)

def db_create_datasheet_links(source_id: str, links: list):
    """Create DatasheetSource links for a competitive source"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        for link in links:
            cur.execute("""
                INSERT INTO "DatasheetSource" (
                    id, "datasheetId", "competitiveSourceId", "relevanceScore",
                    "mentionCount", "mentionSummary", status, "createdAt", "updatedAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s, %s, %s, %s, 'pending', NOW(), NOW()
                )
                ON CONFLICT ("datasheetId", "competitiveSourceId") DO UPDATE SET
                    "relevanceScore" = EXCLUDED."relevanceScore",
                    "mentionCount" = EXCLUDED."mentionCount",
                    "mentionSummary" = EXCLUDED."mentionSummary",
                    "updatedAt" = NOW()
            """, (
                link['datasheetId'],
                source_id,
                link.get('relevanceScore', 0.5),
                link.get('mentionCount', 1),
                link.get('mentionSummary', '')
            ))

def db_get_pending_datasheet_sources() -> list:
    """Get DatasheetSource records pending extraction"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                ds.id, ds."datasheetId", ds."competitiveSourceId" AS "sourceId", ds.status,
                d.name as "datasheetName", d.faction,
                cs."sourceUrl", cs."sourceType", cs.content, cs."contentTitle"
            FROM "DatasheetSource" ds
            JOIN "Datasheet" d ON ds."datasheetId" = d.id
            JOIN "CompetitiveSource" cs ON ds."competitiveSourceId" = cs.id
            WHERE ds.status = 'pending' AND cs.status IN ('curated', 'extracted')
            ORDER BY ds."createdAt" ASC
        """)
        return cur.fetchall()

def db_update_datasheet_source_extraction(ds_id: str, extracted_context: dict, confidence: int, status: str = "extracted"):
    """Update a DatasheetSource with extracted context"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE "DatasheetSource"
            SET "extractedContext" = %s,
                confidence = %s,
                status = %s,
                "extractedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = %s
        """, (json.dumps(extracted_context), confidence, status, ds_id))

def db_get_datasheet_by_name(name: str, faction: str = None) -> dict:
    """Find a datasheet by name, optionally filtered by faction"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        if faction:
            cur.execute("""
                SELECT id, name, faction, "factionId"
                FROM "Datasheet"
                WHERE LOWER(name) = LOWER(%s) AND LOWER(faction) = LOWER(%s)
                LIMIT 1
            """, (name, faction))
        else:
            cur.execute("""
                SELECT id, name, faction, "factionId"
                FROM "Datasheet"
                WHERE LOWER(name) = LOWER(%s)
                LIMIT 1
            """, (name,))
        return cur.fetchone()

def db_get_datasheet_sources_for_aggregation(datasheet_id: str) -> list:
    """Get all extracted sources for a datasheet for aggregation"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                ds."extractedContext", ds.confidence,
                cs."sourceType", cs."contentTitle" AS "sourceTitle",
                cs."authorName", cs."publishedAt", cs."gameVersion"
            FROM "DatasheetSource" ds
            JOIN "CompetitiveSource" cs ON ds."competitiveSourceId" = cs.id
            WHERE ds."datasheetId" = %s
              AND ds.status = 'extracted'
              AND ds."isOutdated" = false
            ORDER BY cs."publishedAt" DESC NULLS LAST
        """, (datasheet_id,))
        return cur.fetchall()

def db_upsert_datasheet_competitive_context(
    datasheet_id: str,
    faction_id: str = None,
    detachment_id: str = None,
    **context_data
):
    """Upsert aggregated competitive context for a datasheet"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        # Check if exists
        cur.execute("""
            SELECT id FROM "DatasheetCompetitiveContext"
            WHERE "datasheetId" = %s
              AND ("factionId" IS NOT DISTINCT FROM %s)
              AND ("detachmentId" IS NOT DISTINCT FROM %s)
        """, (datasheet_id, faction_id, detachment_id))
        existing = cur.fetchone()

        if existing:
            # Update
            set_clauses = ['"updatedAt" = NOW()', '"lastAggregated" = NOW()']
            values = []

            for key, value in context_data.items():
                if key in ['competitiveTier', 'tierReasoning', 'bestTargets', 'counters',
                           'synergies', 'playstyleNotes', 'deploymentTips', 'competitiveNotes',
                           'sourceCount', 'conflicts']:
                    col = f'"{key}"'
                    set_clauses.append(f'{col} = %s')
                    values.append(value)

            values.append(existing['id'])
            cur.execute(
                f'UPDATE "DatasheetCompetitiveContext" SET {", ".join(set_clauses)} WHERE id = %s',
                values
            )
        else:
            # Insert
            cur.execute("""
                INSERT INTO "DatasheetCompetitiveContext" (
                    id, "datasheetId", "factionId", "detachmentId",
                    "competitiveTier", "tierReasoning", "bestTargets", "counters",
                    "synergies", "playstyleNotes", "deploymentTips", "competitiveNotes",
                    "sourceCount", "conflicts", "lastAggregated", "createdAt", "updatedAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW()
                )
            """, (
                datasheet_id, faction_id, detachment_id,
                context_data.get('competitiveTier'),
                context_data.get('tierReasoning'),
                context_data.get('bestTargets'),
                context_data.get('counters'),
                context_data.get('synergies'),
                context_data.get('playstyleNotes'),
                context_data.get('deploymentTips'),
                context_data.get('competitiveNotes'),
                context_data.get('sourceCount', 0),
                context_data.get('conflicts'),
            ))

def db_get_all_factions() -> list:
    """Get all factions"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute('SELECT id, name FROM "Faction" ORDER BY name')
        return cur.fetchall()

def db_get_faction_by_name(name: str) -> dict:
    """Get faction by name"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute('SELECT id, name FROM "Faction" WHERE LOWER(name) = LOWER(%s)', (name,))
        return cur.fetchone()

def db_get_datasheets_with_sources(faction_id: str) -> list:
    """Get datasheets that have extracted sources for aggregation"""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT d.id, d.name, d.faction
            FROM "Datasheet" d
            JOIN "DatasheetSource" ds ON d.id = ds."datasheetId"
            JOIN "CompetitiveSource" cs ON ds."competitiveSourceId" = cs.id
            WHERE cs."factionId" = %s
              AND ds.status = 'extracted'
              AND ds."isOutdated" = false
            ORDER BY d.name
        """, (faction_id,))
        return cur.fetchall()

# Langfuse for tracing LLM calls (optional)
try:
    from langfuse import Langfuse
    langfuse = Langfuse(
        secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        host=os.getenv("LANGFUSE_BASE_URL"),
    )
    HAS_LANGFUSE = bool(os.getenv("LANGFUSE_SECRET_KEY"))
    if HAS_LANGFUSE:
        print("✅ Langfuse tracing enabled")
except ImportError:
    HAS_LANGFUSE = False
    langfuse = None
except Exception as e:
    HAS_LANGFUSE = False
    langfuse = None
    print(f"⚠️ Langfuse init error (tracing disabled): {e}")

# Output directory (relative to repo root)
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = REPO_ROOT / "data" / "youtube-transcripts"
MANIFEST_FILE = OUTPUT_DIR / "_manifest.json"
CONTEXT_OUTPUT_DIR = OUTPUT_DIR  # Unit context files go in same directory

# Gemini model for unit context extraction (matches other LLM calls in the app)
GEMINI_MODEL = "gemini-3-flash-preview"

YOUTUBE_ID_RE = re.compile(
    r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$"
)

# Source type definitions
SOURCE_TYPES = ["youtube", "reddit", "article", "forum", "discord", "other"]

# Known article sites for better extraction
ARTICLE_SITES = [
    "goonhammer.com",
    "aow40k.com",
    "artofwar40k.com",
    "warhammercompetitive.com",
    "woehammer.com",
]

# Known forum sites
FORUM_SITES = [
    "dakkadakka.com",
    "bolterandchainsword.com",
    "tga.community",
    "reddit.com",  # Reddit also has forum-like threads
]


def extract_video_id(url_or_id: str) -> Optional[str]:
    m = YOUTUBE_ID_RE.search(url_or_id.strip())
    if not m:
        return None
    return m.group(1) or m.group(2)


def detect_source_type(url: str) -> str:
    """Detect the source type from a URL."""
    url_lower = url.lower()
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    
    # Remove www. prefix
    if domain.startswith("www."):
        domain = domain[4:]
    
    # YouTube detection
    if "youtube.com" in domain or "youtu.be" in domain:
        return "youtube"
    
    # Reddit detection
    if "reddit.com" in domain or "redd.it" in domain:
        return "reddit"
    
    # Discord detection (will require manual paste)
    if "discord.com" in domain or "discord.gg" in domain:
        return "discord"
    
    # Article sites
    for site in ARTICLE_SITES:
        if site in domain:
            return "article"
    
    # Forum sites (excluding reddit which is handled above)
    for site in FORUM_SITES:
        if site in domain and "reddit" not in site:
            return "forum"
    
    return "other"


def generate_source_id(url: str, source_type: str) -> str:
    """Generate a unique source ID for non-YouTube sources."""
    # Use URL hash for uniqueness
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    return f"{source_type}-{url_hash}"


def safe_filename(s: str, max_len: int = 60) -> str:
    """Convert string to safe filename."""
    s = re.sub(r'[<>:"/\\|?*]', '', s)
    s = re.sub(r'\s+', '_', s)
    s = s.strip('._')
    return s[:max_len] if len(s) > max_len else s


def repair_truncated_json(text: str) -> Optional[str]:
    """
    Attempt to repair truncated JSON from LLM responses.
    Common case: JSON array gets cut off mid-object.
    Returns repaired JSON string or None if repair fails.
    """
    # Find the last complete object in mentionedUnits array
    # Look for the last complete "}" followed by either "," or before truncation
    
    # Strategy: Find "mentionedUnits": [ and then find the last complete object
    if '"mentionedUnits"' not in text:
        return None
    
    # Try to find the last complete object (ends with })
    # Remove any trailing incomplete object
    last_complete_brace = -1
    brace_depth = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if char == '\\':
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == '{':
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth >= 1:  # We're closing an object inside the main object
                last_complete_brace = i
    
    if last_complete_brace == -1:
        return None
    
    # Truncate at last complete object
    repaired = text[:last_complete_brace + 1]
    
    # Check if we're inside the mentionedUnits array
    # Close the array and add empty unmatchedMentions
    if repaired.rstrip().endswith('}'):
        # We likely have a complete object, need to close the array and main object
        # Check if there's a trailing comma
        repaired = repaired.rstrip()
        if repaired.endswith(','):
            repaired = repaired[:-1]  # Remove trailing comma
        
        # Add closing brackets
        repaired += '], "unmatchedMentions": []}'
    
    return repaired


def get_video_info(url: str) -> dict[str, Any]:
    """Fetch video metadata without downloading."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


def parse_vtt_to_text(vtt: str) -> str:
    """Parse VTT subtitle format to plain text."""
    lines = vtt.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("WEBVTT") or line.startswith("NOTE") or line.startswith("STYLE"):
            i += 1
            continue
        if i + 1 < len(lines) and "-->" in lines[i + 1] and "-->" not in line:
            i += 1
            line = lines[i].strip()
        if "-->" not in line:
            i += 1
            continue
        i += 1
        text_lines: list[str] = []
        while i < len(lines) and lines[i].strip() != "":
            t = re.sub(r"<[^>]+>", "", lines[i]).strip()
            if t:
                text_lines.append(t)
            i += 1
        if text_lines:
            out.append(" ".join(text_lines))
        i += 1
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def try_fetch_captions(url: str, lang: str = "en") -> tuple[bool, Optional[str], Optional[str]]:
    """Try to fetch captions/subtitles. Returns (success, transcript, error)."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        return False, None, f"yt-dlp metadata fetch failed: {e}"

    subtitles = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    # Find caption track
    candidates = None
    for key in (lang, "en", "en-US", "en-GB"):
        if subtitles.get(key):
            candidates = subtitles[key]
            break
        if auto.get(key):
            candidates = auto[key]
            break

    if not candidates:
        return False, None, "No captions available"

    # Find VTT format
    vtt_track = next((c for c in candidates if c.get("ext") == "vtt"), candidates[0] if candidates else None)
    if not vtt_track or not vtt_track.get("url"):
        return False, None, "No downloadable caption URL"

    vtt_url = vtt_track["url"]
    
    try:
        r = requests.get(vtt_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        r.raise_for_status()
        transcript = parse_vtt_to_text(r.text)
        if not transcript:
            return False, None, "Captions were empty"
        return True, transcript, None
    except Exception as e:
        return False, None, f"Caption download failed: {e}"


def download_audio(url: str, tmp_dir: str) -> str:
    """Download audio and convert to m4a via ffmpeg."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg is not installed.\n"
            "Install it via: winget install ffmpeg\n"
            "Then restart your terminal."
        )
    
    outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")
    ydl_opts = {
        "quiet": False,
        "no_warnings": True,
        # Prefer non-HLS formats to avoid fragment download issues
        # ba = best audio, fallback to best if no audio-only available
        # Exclude HLS (m3u8) formats which can have fragment issues
        "format": "ba[protocol!=m3u8_native][protocol!=m3u8]/ba/b[protocol!=m3u8_native][protocol!=m3u8]/b",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "m4a",
            "preferredquality": "128",
        }],
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    vid = info.get("id")
    path = os.path.join(tmp_dir, f"{vid}.m4a")
    
    if not os.path.exists(path):
        for rd in info.get("requested_downloads") or []:
            fp = rd.get("filepath")
            if fp and os.path.exists(fp):
                return fp
        for f in os.listdir(tmp_dir):
            if f.endswith(".m4a"):
                return os.path.join(tmp_dir, f)
        raise FileNotFoundError(f"Audio file not found at {path}")
    
    return path


def get_audio_duration(audio_path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    import subprocess
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True, timeout=30
    )
    return float(result.stdout.strip())


def split_audio_into_chunks(audio_path: str, chunk_duration_sec: int = 600) -> list:
    """Split audio into chunks of specified duration (default 10 minutes)."""
    import subprocess

    duration = get_audio_duration(audio_path)
    num_chunks = int(duration / chunk_duration_sec) + 1

    if num_chunks == 1:
        return [audio_path]  # No split needed

    print(f"   ✂️ Splitting {duration/60:.1f}min audio into {num_chunks} chunks...")

    chunks = []
    base_path = audio_path.rsplit(".", 1)[0]
    ext = audio_path.rsplit(".", 1)[1] if "." in audio_path else "mp3"

    for i in range(num_chunks):
        start_time = i * chunk_duration_sec
        chunk_path = f"{base_path}_chunk{i:02d}.{ext}"

        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ss", str(start_time),
             "-t", str(chunk_duration_sec), "-c", "copy", chunk_path],
            capture_output=True, timeout=60
        )

        if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 1000:
            chunks.append(chunk_path)

    print(f"   ✅ Created {len(chunks)} chunks")
    return chunks


def compress_audio_chunk(audio_path: str, max_size_mb: float = 24.0) -> str:
    """Compress a single audio chunk if it exceeds size limit."""
    import subprocess

    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    if file_size_mb <= max_size_mb:
        return audio_path

    duration_sec = get_audio_duration(audio_path)
    target_kbps = int((max_size_mb * 8 * 1024 * 0.9) / duration_sec)
    target_kbps = max(32, min(target_kbps, 128))

    compressed_path = audio_path.rsplit(".", 1)[0] + "_comp.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-i", audio_path, "-b:a", f"{target_kbps}k", "-ac", "1", compressed_path],
        capture_output=True, timeout=120
    )

    return compressed_path


def whisper_transcribe_chunk(audio_path: str, api_key: str) -> str:
    """Transcribe a single audio chunk."""
    # Compress if needed
    audio_path = compress_audio_chunk(audio_path)

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {"model": "whisper-1", "response_format": "text"}

    with open(audio_path, "rb") as f:
        files = {"file": (os.path.basename(audio_path), f, "audio/mp4")}
        r = requests.post(url, headers=headers, data=data, files=files, timeout=300)

    if r.status_code >= 400:
        raise RuntimeError(f"Whisper API error {r.status_code}: {r.text[:500]}")

    return r.text.strip()


def whisper_transcribe(audio_path: str) -> str:
    """Transcribe audio using OpenAI Whisper API with chunking for long files."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in .env.local")

    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)

    # For files over 20MB or longer than 15 minutes, use chunking
    try:
        duration = get_audio_duration(audio_path)
        needs_chunking = file_size_mb > 20 or duration > 900  # 15 minutes
    except Exception:
        needs_chunking = file_size_mb > 20

    if needs_chunking:
        print(f"   📦 Large audio ({file_size_mb:.1f}MB), using chunked transcription...")
        chunks = split_audio_into_chunks(audio_path, chunk_duration_sec=600)  # 10 min chunks

        transcripts = []
        for i, chunk in enumerate(chunks):
            print(f"   🎤 Transcribing chunk {i+1}/{len(chunks)}...")
            try:
                transcript = whisper_transcribe_chunk(chunk, api_key)
                transcripts.append(transcript)
            except Exception as e:
                print(f"   ⚠️ Chunk {i+1} failed: {e}")
                transcripts.append(f"[Transcription failed for segment {i+1}]")

        return "\n\n".join(transcripts)
    else:
        # Small file, transcribe directly
        return whisper_transcribe_chunk(audio_path, api_key)


# ============================================
# WEB SCRAPING FUNCTIONS
# ============================================

def get_webpage(url: str, use_old_reddit: bool = True) -> Tuple[bool, Optional[str], Optional[str]]:
    """Fetch a webpage and return its HTML content."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    # Convert Reddit URLs to old.reddit.com for easier scraping
    if use_old_reddit and "reddit.com" in url and "old.reddit.com" not in url:
        if "www.reddit.com" in url:
            url = url.replace("www.reddit.com", "old.reddit.com")
        else:
            url = url.replace("reddit.com", "old.reddit.com")
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return True, response.text, None
    except requests.Timeout:
        return False, None, "Request timed out"
    except requests.HTTPError as e:
        return False, None, f"HTTP error: {e.response.status_code}"
    except Exception as e:
        return False, None, f"Request failed: {e}"


def scrape_reddit(url: str) -> Tuple[bool, Optional[dict], Optional[str]]:
    """
    Scrape a Reddit post and its comments using the .json endpoint.
    This is more reliable than HTML scraping and avoids 403 errors.
    """
    print(f"   📥 Fetching Reddit JSON content...")
    
    # Remove trailing slash and add .json
    json_url = url.rstrip('/') + ".json"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    try:
        response = requests.get(json_url, headers=headers, timeout=30)
        
        # If .json fails with 403, try old.reddit.com as fallback
        if response.status_code == 403:
            print("   ⚠️ JSON endpoint blocked, trying old.reddit.com fallback...")
            return scrape_reddit_html(url)
            
        response.raise_for_status()
        data = response.json()
        
        # Reddit JSON for a post is a list: [post_data, comments_data]
        if not isinstance(data, list) or len(data) < 2:
            return False, None, "Invalid Reddit JSON structure"
            
        post_info = data[0]["data"]["children"][0]["data"]
        comments_info = data[1]["data"]["children"]
        
        title = post_info.get("title", "Unknown Title")
        author = post_info.get("author", "Unknown")
        subreddit = post_info.get("subreddit", "Unknown")
        post_body = post_info.get("selftext", "")
        
        # Extract comments
        comments = []
        for child in comments_info[:30]:  # Top 30 comments
            if child["kind"] == "t1":  # t1 is a comment
                text = child["data"].get("body", "")
                if text and len(text) > 20:
                    comments.append(text)
        
        # Build full text content
        full_text = f"Title: {title}\n"
        full_text += f"Subreddit: r/{subreddit}\n"
        full_text += f"Author: u/{author}\n"
        full_text += "\n--- POST CONTENT ---\n"
        full_text += post_body or "(No text content - may be a link post)"
        
        if comments:
            full_text += "\n\n--- TOP COMMENTS ---\n"
            for i, comment in enumerate(comments[:20], 1):
                full_text += f"\n[Comment {i}]\n{comment}\n"
        
        return True, {
            "title": title,
            "author": f"r/{subreddit} - u/{author}",
            "text": full_text,
            "subreddit": subreddit,
            "comment_count": len(comments),
        }, None
        
    except Exception as e:
        return False, None, f"Reddit JSON fetch failed: {e}"


def scrape_reddit_html(url: str) -> Tuple[bool, Optional[dict], Optional[str]]:
    """Fallback HTML scraper for Reddit if JSON fails."""
    if not HAS_BS4:
        return False, None, "BeautifulSoup not installed"
        
    success, html, error = get_webpage(url, use_old_reddit=True)
    if not success:
        return False, None, error
    
    soup = BeautifulSoup(html, "html.parser")
    # ... (rest of existing HTML scraping logic)
    # I'll just keep the existing logic here for the fallback
    
    # Extract post title
    title_elem = soup.find("a", class_="title")
    title = title_elem.get_text(strip=True) if title_elem else "Unknown Title"
    
    # Extract subreddit
    subreddit_elem = soup.find("span", class_="subreddit") or soup.find("a", class_="subreddit")
    subreddit = subreddit_elem.get_text(strip=True) if subreddit_elem else "Unknown"
    
    # Extract post author
    author_elem = soup.find("a", class_="author")
    author = author_elem.get_text(strip=True) if author_elem else "Unknown"
    
    # Extract post body
    post_body = ""
    usertext = soup.find("div", class_="usertext-body")
    if usertext:
        post_body = usertext.get_text(separator="\n", strip=True)
    
    # Extract comments
    comments = []
    comment_areas = soup.find_all("div", class_="entry")
    for comment_div in comment_areas[1:30]:
        comment_text = comment_div.find("div", class_="usertext-body")
        if comment_text:
            text = comment_text.get_text(separator=" ", strip=True)
            if len(text) > 50:
                comments.append(text)
                
    full_text = f"Title: {title}\nSubreddit: r/{subreddit}\nAuthor: u/{author}\n\n--- POST CONTENT ---\n{post_body}"
    if comments:
        full_text += "\n\n--- TOP COMMENTS ---\n" + "\n".join(f"\n[Comment]\n{c}" for c in comments[:20])
        
    return True, {
        "title": title,
        "author": f"r/{subreddit} - u/{author}",
        "text": full_text,
        "subreddit": subreddit,
        "comment_count": len(comments),
    }, None


def scrape_article(url: str) -> Tuple[bool, Optional[dict], Optional[str]]:
    """
    Scrape an article webpage, extracting main content.
    Uses heuristics to find the main article body.
    """
    if not HAS_BS4:
        return False, None, "BeautifulSoup not installed. Run: pip install beautifulsoup4"
    
    print(f"   📥 Fetching article...")
    success, html, error = get_webpage(url, use_old_reddit=False)
    if not success:
        return False, None, error
    
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()
    
    # Try to find the title
    title = None
    title_elem = soup.find("h1")
    if title_elem:
        title = title_elem.get_text(strip=True)
    if not title:
        title_elem = soup.find("title")
        title = title_elem.get_text(strip=True) if title_elem else "Unknown Title"
    
    # Try to find author
    author = None
    author_patterns = [
        {"class_": "author"},
        {"class_": "byline"},
        {"rel": "author"},
        {"itemprop": "author"},
    ]
    for pattern in author_patterns:
        author_elem = soup.find(**pattern)
        if author_elem:
            author = author_elem.get_text(strip=True)
            break
    
    # Try to find the main article content
    article_content = None
    
    # Try common article container patterns
    content_selectors = [
        {"name": "article"},
        {"class_": "post-content"},
        {"class_": "article-content"},
        {"class_": "entry-content"},
        {"class_": "content"},
        {"id": "content"},
        {"class_": "post-body"},
        {"role": "main"},
    ]
    
    for selector in content_selectors:
        content_elem = soup.find(**selector)
        if content_elem:
            article_content = content_elem
            break
    
    # Fall back to body if no article container found
    if not article_content:
        article_content = soup.find("body")
    
    # Extract text from content
    if article_content:
        # Get all paragraphs
        paragraphs = article_content.find_all("p")
        text_parts = []
        for p in paragraphs:
            text = p.get_text(separator=" ", strip=True)
            if len(text) > 30:  # Filter out short snippets
                text_parts.append(text)
        
        full_text = "\n\n".join(text_parts)
    else:
        full_text = soup.get_text(separator="\n", strip=True)
    
    # Clean up excessive whitespace
    full_text = re.sub(r'\n{3,}', '\n\n', full_text)
    full_text = re.sub(r' {2,}', ' ', full_text)
    
    # Extract domain for author attribution
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    
    return True, {
        "title": title,
        "author": author or domain,
        "text": full_text,
        "domain": domain,
    }, None


def scrape_forum(url: str) -> Tuple[bool, Optional[dict], Optional[str]]:
    """
    Scrape a forum thread, extracting posts.
    Generic approach that works for most forum software.
    """
    if not HAS_BS4:
        return False, None, "BeautifulSoup not installed. Run: pip install beautifulsoup4"
    
    print(f"   📥 Fetching forum thread...")
    success, html, error = get_webpage(url, use_old_reddit=False)
    if not success:
        return False, None, error
    
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove script and style elements
    for element in soup(["script", "style"]):
        element.decompose()
    
    # Try to find the title
    title = None
    title_elem = soup.find("h1") or soup.find("h2", class_="title")
    if title_elem:
        title = title_elem.get_text(strip=True)
    if not title:
        title_elem = soup.find("title")
        title = title_elem.get_text(strip=True) if title_elem else "Unknown Thread"
    
    # Try to find posts (common patterns)
    posts = []
    post_selectors = [
        {"class_": "post"},
        {"class_": "message"},
        {"class_": "comment"},
        {"class_": "forumpost"},
        {"class_": "post-content"},
    ]
    
    for selector in post_selectors:
        found_posts = soup.find_all(**selector)
        if found_posts:
            for post in found_posts[:30]:  # Limit to 30 posts
                text = post.get_text(separator=" ", strip=True)
                if len(text) > 50:
                    posts.append(text)
            break
    
    # Fall back to main content
    if not posts:
        main_content = soup.find("main") or soup.find("body")
        if main_content:
            full_text = main_content.get_text(separator="\n", strip=True)
            posts = [full_text]
    
    # Build full text
    full_text = f"Thread: {title}\n\n"
    for i, post in enumerate(posts, 1):
        full_text += f"--- Post {i} ---\n{post}\n\n"
    
    # Clean up
    full_text = re.sub(r'\n{3,}', '\n\n', full_text)
    
    # Extract domain
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    
    return True, {
        "title": title,
        "author": domain,
        "text": full_text,
        "post_count": len(posts),
    }, None


def scrape_generic(url: str) -> Tuple[bool, Optional[dict], Optional[str]]:
    """
    Generic webpage scraper - extracts all readable text.
    Used as fallback for unknown source types.
    """
    if not HAS_BS4:
        return False, None, "BeautifulSoup not installed. Run: pip install beautifulsoup4"
    
    print(f"   📥 Fetching webpage...")
    success, html, error = get_webpage(url, use_old_reddit=False)
    if not success:
        return False, None, error
    
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove non-content elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        element.decompose()
    
    # Get title
    title_elem = soup.find("title")
    title = title_elem.get_text(strip=True) if title_elem else "Unknown Page"
    
    # Get all text
    text = soup.get_text(separator="\n", strip=True)
    
    # Clean up
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    
    # Extract domain
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    
    return True, {
        "title": title,
        "author": domain,
        "text": text,
    }, None


def fetch_content(url: str, source_type: Optional[str] = None) -> Tuple[bool, Optional[dict], Optional[str]]:
    """
    Unified content fetcher - routes to the appropriate scraper based on source type.
    
    Returns (success, content_dict, error_message)
    content_dict has: title, author, text, source_type, source_id
    """
    # Detect source type if not provided
    if not source_type:
        source_type = detect_source_type(url)
    
    print(f"   🔍 Detected source type: {source_type}")
    
    if source_type == "youtube":
        # For YouTube, use the existing caption/whisper flow
        video_id = extract_video_id(url)
        if not video_id:
            return False, None, "Could not extract YouTube video ID"
        return True, {
            "source_type": "youtube",
            "source_id": video_id,
            "requires_youtube_flow": True,  # Signal to use YouTube flow
        }, None
    
    elif source_type == "discord":
        return False, None, "Discord requires manual content paste - content cannot be scraped automatically"
    
    elif source_type == "reddit":
        success, content, error = scrape_reddit(url)
        if success:
            content["source_type"] = "reddit"
            content["source_id"] = generate_source_id(url, "reddit")
        return success, content, error
    
    elif source_type == "article":
        success, content, error = scrape_article(url)
        if success:
            content["source_type"] = "article"
            content["source_id"] = generate_source_id(url, "article")
        return success, content, error
    
    elif source_type == "forum":
        success, content, error = scrape_forum(url)
        if success:
            content["source_type"] = "forum"
            content["source_id"] = generate_source_id(url, "forum")
        return success, content, error
    
    else:  # "other"
        success, content, error = scrape_generic(url)
        if success:
            content["source_type"] = "other"
            content["source_id"] = generate_source_id(url, "other")
        return success, content, error


def load_manifest() -> dict[str, Any]:
    """Load the transcript manifest."""
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    return {"transcripts": []}


def save_manifest(manifest: dict[str, Any]) -> None:
    """Save the transcript manifest."""
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


# ============================================
# UNIT CONTEXT EXTRACTION (Gemini AI)
# ============================================

# JSON Schema for unit-specific competitive context extraction
UNIT_CONTEXT_SCHEMA = {
    "type": "object",
    "properties": {
        "found": {
            "type": "boolean",
            "description": "Whether the unit was mentioned in the transcript"
        },
        "tierRank": {
            "type": "string",
            "enum": ["S", "A", "B", "C", "D", "F"],
            "description": "Tier ranking if mentioned or implied"
        },
        "tierReasoning": {
            "type": "string",
            "description": "Why this tier was assigned based on the transcript"
        },
        "bestTargets": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What this unit is best against"
        },
        "counters": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What counters or threatens this unit"
        },
        "synergies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "unit": {"type": "string", "description": "Name of the synergistic unit, character, ability, or detachment rule"},
                    "why": {"type": "string", "description": "Explanation of why this synergy works and how to leverage it"}
                },
                "required": ["unit", "why"]
            },
            "description": "Units, characters, or abilities that synergize well with explanations"
        },
        "playstyleNotes": {
            "type": "string",
            "description": "How to play this unit effectively"
        },
        "deploymentTips": {
            "type": "string",
            "description": "Deployment and positioning advice"
        },
        "detachmentNotes": {
            "type": "string",
            "description": "Notes about how this unit works in specific detachments"
        },
        "equipmentRecommendations": {
            "type": "string",
            "description": "Recommended loadouts or equipment choices"
        },
        "pointsEfficiency": {
            "type": "string",
            "description": "Notes on points cost and value"
        },
        "additionalNotes": {
            "type": "string",
            "description": "Any other relevant competitive insights"
        },
        "confidence": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Confidence in the extracted data (0-100)"
        }
    },
    "required": ["found", "confidence"]
}


def build_unit_context_system_prompt() -> str:
    """Build system prompt for unit context extraction."""
    return """You are an expert Warhammer 40,000 competitive analyst. Extract competitive insights about a SPECIFIC unit from the provided content (video transcript, Reddit post, article, or forum discussion).

HANDLING VARIOUS CONTENT TYPES:
1. The text may be a messy auto-transcript with heavy repetition (words or sentences repeated multiple times). Look past the repetition to find the actual content.
2. The unit name may be phonetically misspelled (e.g., "Infernus" as "Infernace", "Vulkan He'stan" as "Vulcan Histan"). Use your knowledge of Warhammer 40k to identify the intended unit.
3. Only extract information that is clearly about the target unit.
4. The content may cover multiple units - focus ONLY on the requested unit.
5. For Reddit/forum content, consider both the original post AND the comments/replies.
6. For articles, focus on the author's main points and conclusions.

IMPORTANT:
1. If the unit is discussed in any meaningful way, set "found" to true.
2. If the unit is absolutely not mentioned or only mentioned in passing without useful info, set "found" to false.
3. Be specific with tactical advice - include actual numbers, ranges, and game mechanics when mentioned.
4. Include detachment-specific interactions if discussed.

TIER RANKINGS (assign based on how the content discusses the unit):
- S = Meta-defining, auto-include, extremely enthusiastic recommendation
- A = Very strong, competitive staple, highly recommended  
- B = Solid, viable choice, good in the right list
- C = Situational, has niche uses, requires specific builds
- D = Below average, rarely recommended
- F = Avoid, advised against taking

Extract quotes and specific advice from the content. If the unit isn't meaningfully discussed, return { "found": false, "confidence": 100 }."""


def build_unit_context_user_prompt(transcript: str, unit_name: str, faction: Optional[str] = None) -> str:
    """Build user prompt for unit context extraction."""
    faction_str = f" ({faction})" if faction else ""
    return f"""Extract competitive insights about "{unit_name}"{faction_str} from this content:

---
{transcript}
---

Look for any information about:
- Tier rankings or power level assessments
- Best targets / what the unit is good against
- Counters / what threatens the unit
- Synergies with other units, characters, or detachment rules (IMPORTANT: for each synergy, explain WHY it works)
- How to play and position the unit
- Deployment tips and strategies
- Equipment/loadout recommendations
- Points efficiency commentary
- Detachment-specific interactions

SYNERGY FORMAT: When listing synergies, provide structured objects with "unit" (name of synergistic unit/ability) and "why" (explanation of the synergy). Example:
- {{"unit": "Wolf Guard Battle Leader", "why": "Wolf-touched enhancement grants +1 to wound, stacking with Anti-keywords for near-guaranteed wounds"}}
- {{"unit": "Saga of the Beast Slayer", "why": "Detachment ability adds Lethal Hits when targeting Monsters/Vehicles, complementing their Anti- keywords"}}

Extract ONLY information specifically about "{unit_name}". Include actual numbers and game mechanics when mentioned."""


def extract_unit_context(
    transcript: str,
    unit_name: str,
    faction: Optional[str] = None,
    video_info: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """
    Extract competitive context for a specific unit from a transcript using Gemini AI.
    
    Returns a dict with the extracted context or error information.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "GOOGLE_API_KEY is not set in .env.local"
        }
    
    print(f"\n🎯 Extracting context for \"{unit_name}\"...")
    
    # Build prompts
    system_prompt = build_unit_context_system_prompt()
    user_prompt = build_unit_context_user_prompt(transcript, unit_name, faction)
    
    # Create Langfuse trace
    trace = None
    generation = None
    if HAS_LANGFUSE and langfuse:
        source_id = video_info.get("source_id") or video_info.get("video_id") if video_info else None
        trace = langfuse.trace(
            name="unit-context-extraction",
            metadata={
                "unitName": unit_name,
                "faction": faction,
                "sourceId": source_id,
                "contentTitle": video_info.get("title") if video_info else None,
                "transcriptLength": len(transcript),
            },
            tags=["extraction", f"unit-{unit_name.lower().replace(' ', '-')}"]
        )
    
    # Call Gemini API
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
            "responseSchema": UNIT_CONTEXT_SCHEMA
        }
    }
    
    # Create Langfuse generation span
    if trace:
        generation = trace.generation(
            name="gemini-context-extraction",
            model=GEMINI_MODEL,
            input={
                "unit_name": unit_name,
                "faction": faction,
                "transcript_length": len(transcript),
            },
            metadata={
                "temperature": 0.3,
                "structuredOutput": True,
            }
        )
    
    try:
        print(f"🤖 Calling Gemini ({GEMINI_MODEL})...")
        response = requests_with_retry("POST", url, headers=headers, json=payload, timeout=600)  # 10 min timeout with retries
        
        if response.status_code != 200:
            error_text = response.text[:500] if response.text else "No error details"
            if generation:
                generation.end(output={"error": error_text}, level="ERROR")
            return {
                "success": False,
                "error": f"Gemini API error {response.status_code}: {error_text}"
            }
        
        result = response.json()
        
        # Extract the text from the response
        candidates = result.get("candidates", [])
        if not candidates:
            if generation:
                generation.end(output={"error": "No candidates"}, level="ERROR")
            return {
                "success": False,
                "error": "No response candidates from Gemini"
            }
        
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            if generation:
                generation.end(output={"error": "No parts"}, level="ERROR")
            return {
                "success": False,
                "error": "No content parts in Gemini response"
            }
        
        response_text = parts[0].get("text", "")
        if not response_text:
            if generation:
                generation.end(output={"error": "Empty text"}, level="ERROR")
            return {
                "success": False,
                "error": "Empty response text from Gemini"
            }
        
        # Parse the JSON response
        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as e:
            if generation:
                generation.end(output={"error": f"JSON parse: {e}"}, level="ERROR")
            return {
                "success": False,
                "error": f"Failed to parse Gemini response as JSON: {e}"
            }
        
        if not parsed.get("found", False):
            print(f"⚠️ Unit \"{unit_name}\" was not found in the transcript")
            if generation:
                generation.end(output={"found": False, "unit": unit_name})
            return {
                "success": True,
                "found": False,
                "message": f"\"{unit_name}\" was not found in the transcript"
            }
        
        print(f"✅ Successfully extracted context for \"{unit_name}\"")
        
        # Build the full output structure (uses generalized field names)
        output = {
            "success": True,
            "found": True,
            "unitName": unit_name,
            "faction": faction or "Unknown",
            "source": {
                "sourceId": video_info.get("source_id") or video_info.get("video_id") if video_info else None,
                "sourceType": video_info.get("source_type", "youtube") if video_info else "youtube",
                "contentTitle": video_info.get("title") if video_info else None,
                "authorName": video_info.get("author") or video_info.get("channel") if video_info else None,
                "url": video_info.get("url") if video_info else None,
                "fetchedAt": datetime.now().isoformat()
            },
            "context": {
                "tierRank": parsed.get("tierRank"),
                "tierReasoning": parsed.get("tierReasoning"),
                "bestTargets": parsed.get("bestTargets", []),
                "counters": parsed.get("counters", []),
                "synergies": parsed.get("synergies", []),
                "playstyleNotes": parsed.get("playstyleNotes"),
                "deploymentTips": parsed.get("deploymentTips"),
                "detachmentNotes": parsed.get("detachmentNotes"),
                "equipmentRecommendations": parsed.get("equipmentRecommendations"),
                "pointsEfficiency": parsed.get("pointsEfficiency"),
                "additionalNotes": parsed.get("additionalNotes"),
                "confidence": parsed.get("confidence", 50)
            }
        }
        
        # Log success to Langfuse
        if generation:
            generation.end(output={
                "found": True,
                "tierRank": parsed.get("tierRank"),
                "confidence": parsed.get("confidence", 50),
                "hasTargets": bool(parsed.get("bestTargets")),
                "hasSynergies": bool(parsed.get("synergies")),
            })
        
        return output
        
    except requests.Timeout:
        if generation:
            generation.end(output={"error": "Timeout"}, level="ERROR")
        return {
            "success": False,
            "error": "Gemini API request timed out"
        }
    except Exception as e:
        if generation:
            generation.end(output={"error": str(e)}, level="ERROR")
        return {
            "success": False,
            "error": f"Unexpected error calling Gemini: {e}"
        }


def save_unit_context(
    context: dict[str, Any],
    video_id: str,
    unit_name: str
) -> Path:
    """Save unit context to a JSON file."""
    safe_unit = safe_filename(unit_name, max_len=40)
    filename = f"{video_id}_{safe_unit}_context.json"
    output_path = CONTEXT_OUTPUT_DIR / filename
    
    output_path.write_text(
        json.dumps(context, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    
    return output_path


def process_pending_sources(api_url: str, no_whisper: bool = False) -> int:
    """
    Process all pending DatasheetSource entries from the database.
    
    This fetches pending sources from the API, downloads transcripts,
    extracts unit context, and updates the database.
    
    Authentication: Uses ADMIN_API_KEY from .env.local
    """
    print("\n🔄 FETCH-PENDING MODE")
    print("=" * 50)
    print(f"API URL: {api_url}")
    
    # Get admin API key for authentication
    admin_api_key = os.getenv("ADMIN_API_KEY")
    if not admin_api_key:
        print("⚠️ ADMIN_API_KEY not found in .env.local")
        print("   Add ADMIN_API_KEY=your-secret-key to .env.local")
        print("   (Use any secure random string, e.g., from: openssl rand -hex 32)")
        return 1
    
    api_headers = {
        "X-Admin-API-Key": admin_api_key,
        "Content-Type": "application/json",
    }
    
    # Fetch pending sources from the API
    pending_url = f"{api_url}/api/admin/datasheet-sources/pending"
    print(f"\n📡 Fetching pending sources from API...")
    
    try:
        response = requests.get(pending_url, headers=api_headers, timeout=30)
        if response.status_code == 401:
            print("❌ Authentication failed. Check your ADMIN_API_KEY in .env.local")
            print("   Make sure the same key is set in both .env.local files (if separate)")
            return 1
        if response.status_code != 200:
            print(f"❌ Failed to fetch pending sources: HTTP {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return 1
        
        data = response.json()
        sources = data.get("sources", [])
        
        if not sources:
            print("✅ No pending sources to process.")
            return 0
        
        print(f"📋 Found {len(sources)} pending source(s)")
        
    except requests.Timeout:
        print("❌ API request timed out")
        return 1
    except requests.ConnectionError:
        print(f"❌ Could not connect to {api_url}")
        print("   Make sure the dev server is running (npm run dev)")
        return 1
    except Exception as e:
        print(f"❌ Error fetching pending sources: {e}")
        return 1
    
    # Process each source
    results = []
    for i, source in enumerate(sources, 1):
        db_source_id = source.get("id")
        datasheet_name = source.get("datasheetName", "Unknown")
        faction = source.get("faction", "")
        source_url = source.get("sourceUrl", "")
        db_source_type = source.get("sourceType", "youtube")  # Get source type from DB if available
        
        print(f"\n{'=' * 50}")
        print(f"📋 [{i}/{len(sources)}] Processing: {datasheet_name}")
        print(f"   Faction: {faction}")
        print(f"   URL: {source_url}")
        
        # Detect source type if not provided
        detected_source_type = detect_source_type(source_url)
        content_source_type = db_source_type if db_source_type != "youtube" else detected_source_type
        print(f"   🔍 Source type: {content_source_type}")
        
        transcript = None
        title = "Unknown"
        author = "Unknown"
        content_source_id = ""
        fetch_method = "unknown"
        
        if content_source_type == "youtube":
            # Handle YouTube with existing flow
            video_id = extract_video_id(source_url)
            if not video_id:
                print(f"   ❌ Could not parse video ID from URL")
                results.append({
                    "id": db_source_id,
                    "status": "error",
                    "errorMessage": "Could not parse video ID from URL"
                })
                continue
            
            content_source_id = video_id
            
            # Get video info
            try:
                info = get_video_info(source_url)
                title = info.get("title", "Unknown")
                author = info.get("channel", info.get("uploader", "Unknown"))
                print(f"   📺 Title: {title}")
                print(f"   👤 Channel: {author}")
            except Exception as e:
                print(f"   ⚠️ Could not fetch video info: {e}")
                title = video_id
                author = "Unknown"
            
            # Fetch transcript
            print(f"   📝 Trying captions...")
            success, transcript, error = try_fetch_captions(source_url)
            if success and transcript:
                print(f"   ✅ Captions found! ({len(transcript):,} chars)")
                fetch_method = "captions"
            else:
                print(f"   ⚠️ Captions: {error}")
                
                # Try Whisper fallback
                if not no_whisper:
                    print(f"   🎧 Trying Whisper transcription...")
                    with tempfile.TemporaryDirectory(prefix="yt_pending_") as tmp_dir:
                        try:
                            audio_path = download_audio(source_url, tmp_dir)
                            transcript = whisper_transcribe(audio_path)
                            print(f"   ✅ Whisper transcription complete! ({len(transcript):,} chars)")
                            fetch_method = "whisper"
                        except Exception as e:
                            print(f"   ❌ Whisper failed: {e}")
        
        elif content_source_type == "discord":
            print(f"   ⚠️ Discord content cannot be scraped automatically - skipping")
            results.append({
                "id": db_source_id,
                "status": "error",
                "errorMessage": "Discord content requires manual paste"
            })
            continue
        
        else:
            # Handle web scraping for Reddit, articles, forums, other
            print(f"   📥 Scraping {content_source_type} content...")
            success, content, error = fetch_content(source_url, content_source_type)
            
            if not success:
                print(f"   ❌ Failed to fetch content: {error}")
                results.append({
                    "id": db_source_id,
                    "status": "error",
                    "errorMessage": f"Web scraping failed: {error}"
                })
                continue
            
            transcript = content.get("text", "")
            title = content.get("title", "Unknown")
            author = content.get("author", "Unknown")
            content_source_id = content.get("source_id", generate_source_id(source_url, content_source_type))
            fetch_method = f"scrape_{content_source_type}"
            
            print(f"   📄 Title: {title}")
            print(f"   👤 Author/Source: {author}")
            print(f"   ✅ Content extracted! ({len(transcript):,} chars)")
        
        if not transcript:
            print(f"   ❌ Could not get content")
            results.append({
                "id": db_source_id,
                "status": "error",
                "errorMessage": "Could not fetch content (scraping failed)"
            })
            continue
        
        # Extract unit context
        source_info = {
            "source_id": content_source_id,
            "source_type": content_source_type,
            "title": title,
            "author": author,
            "url": source_url,
        }
        
        context_result = extract_unit_context(
            transcript=transcript,
            unit_name=datasheet_name,
            faction=faction,
            video_info=source_info
        )
        
        if not context_result.get("success"):
            print(f"   ❌ Context extraction failed: {context_result.get('error')}")
            # Still save the transcript even if context extraction failed
            results.append({
                "id": db_source_id,
                "status": "fetched",
                "transcript": transcript,
                "sourceTitle": title,
                "channelName": author,  # Keep channelName for backward compatibility
                "errorMessage": f"Context extraction failed: {context_result.get('error')}"
            })
            continue
        
        if not context_result.get("found"):
            print(f"   ⚠️ Unit not mentioned in content")
            results.append({
                "id": db_source_id,
                "status": "extracted",
                "transcript": transcript,
                "sourceTitle": title,
                "channelName": author,
                "extractedContext": {
                    "found": False,
                    "message": f"{datasheet_name} was not mentioned in this content"
                },
                "confidence": 0
            })
            continue
        
        # Success!
        ctx = context_result.get("context", {})
        print(f"   ✅ Context extracted successfully!")
        print(f"   📊 Confidence: {ctx.get('confidence', 'N/A')}%")
        if ctx.get("tierRank"):
            print(f"   🏆 Tier: {ctx['tierRank']}")
        
        results.append({
            "id": db_source_id,
            "status": "extracted",
            "transcript": transcript,
            "sourceTitle": title,
            "channelName": author,
            "extractedContext": context_result,
            "confidence": ctx.get("confidence", 50)
        })
        
        # Also save locally
        save_unit_context(context_result, content_source_id, datasheet_name)
    
    # Update the database via bulk update API
    if results:
        print(f"\n{'=' * 50}")
        print(f"📤 Updating database with {len(results)} result(s)...")
        
        bulk_url = f"{api_url}/api/admin/datasheet-sources/bulk-update"
        try:
            response = requests.post(
                bulk_url,
                json={"updates": results},
                headers=api_headers,
                timeout=60
            )
            
            if response.status_code == 200:
                update_data = response.json()
                summary = update_data.get("summary", {})
                print(f"✅ Database updated!")
                print(f"   Succeeded: {summary.get('succeeded', 0)}")
                print(f"   Failed: {summary.get('failed', 0)}")
            else:
                print(f"⚠️ Bulk update returned {response.status_code}")
                print(f"   Results were processed but may not be saved to database")
                print(f"   Response: {response.text[:500]}")
        except Exception as e:
            print(f"⚠️ Could not update database: {e}")
            print("   Results were processed but not saved to database")
    
    # Summary
    print(f"\n{'=' * 50}")
    print("📊 PROCESSING SUMMARY")
    print("=" * 50)
    
    extracted = sum(1 for r in results if r.get("status") == "extracted")
    fetched = sum(1 for r in results if r.get("status") == "fetched")
    errors = sum(1 for r in results if r.get("status") == "error")
    
    print(f"   ✅ Extracted: {extracted}")
    print(f"   📄 Fetched (context failed): {fetched}")
    print(f"   ❌ Errors: {errors}")
    print(f"   📋 Total: {len(results)}")
    
    print("\n✅ Done!")
    return 0


# ============================================
# AGGREGATE CONTEXT FROM MULTIPLE SOURCES
# ============================================

# Schema for aggregated competitive context
AGGREGATED_CONTEXT_SCHEMA = {
    "type": "object",
    "properties": {
        "competitiveTier": {
            "type": "string",
            "enum": ["S", "A", "B", "C", "D", "F"],
            "description": "Synthesized tier ranking from all sources"
        },
        "tierReasoning": {
            "type": "string",
            "description": "Explanation of the tier ranking considering all perspectives"
        },
        "bestTargets": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What this unit is best against (aggregated from sources)"
        },
        "counters": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What counters or threatens this unit"
        },
        "synergies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "unit": {"type": "string", "description": "Name of the synergistic unit, character, ability, or detachment rule"},
                    "why": {"type": "string", "description": "Explanation of why this synergy works and how to leverage it"}
                },
                "required": ["unit", "why"]
            },
            "description": "Units, characters, or abilities that synergize well with explanations"
        },
        "playstyleNotes": {
            "type": "string",
            "description": "How to play this unit effectively (synthesized advice)"
        },
        "deploymentTips": {
            "type": "string",
            "description": "Deployment and positioning advice"
        },
        "competitiveNotes": {
            "type": "string",
            "description": "General competitive insights and meta position"
        },
        "conflicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "description": "Which field has disagreement"},
                    "disagreement": {"type": "string", "description": "What the disagreement is"},
                    "resolution": {"type": "string", "description": "How the conflict was resolved"}
                },
                "required": ["field", "disagreement", "resolution"]
            },
            "description": "Any detected conflicts between sources and how they were resolved"
        }
    },
    "required": ["competitiveTier", "tierReasoning"]
}


def build_aggregate_system_prompt() -> str:
    """Build system prompt for aggregating multiple sources."""
    return """You are an expert Warhammer 40,000 competitive analyst. You will be given competitive insights about a unit from MULTIPLE sources (YouTube videos, Reddit posts, articles, forum discussions).

Your task is to SYNTHESIZE these perspectives into a single, coherent competitive assessment.

GUIDELINES:
1. Consider all sources but weight more recent analysis higher
2. If sources agree, state the consensus confidently
3. If sources DISAGREE, you must:
   - Note the disagreement in the "conflicts" array
   - Provide a reasoned resolution (e.g., "Rated B as middle ground - meta-dependent")
   - Explain your reasoning for the resolution
4. Be specific with tactical advice - include numbers, ranges, and mechanics
5. Attribute notable insights to their source type when relevant (e.g., "Reddit users note that...")

TIER RANKINGS (synthesize based on overall sentiment):
- S = Universally agreed as meta-defining, auto-include
- A = Strong consensus as very competitive
- B = Generally considered solid and viable
- C = Mixed opinions, situational unit
- D = Generally considered below average
- F = Consensus to avoid

OUTPUT: Provide a synthesized competitive context that represents the best understanding from ALL provided sources."""


def build_aggregate_user_prompt(unit_name: str, faction: str, sources_data: list) -> str:
    """Build user prompt with all source contexts."""
    prompt = f"""Synthesize competitive context for "{unit_name}" ({faction}) from the following {len(sources_data)} sources:

"""
    for i, source in enumerate(sources_data, 1):
        source_type = source.get("sourceType", "unknown")
        source_title = source.get("sourceTitle", "Unknown")
        extracted = source.get("extractedContext", {})
        
        # Parse extracted context if it's a string
        if isinstance(extracted, str):
            try:
                extracted = json.loads(extracted)
            except:
                extracted = {"raw": extracted}
        
        prompt += f"""
--- SOURCE {i}: {source_type.upper()} ---
Title: {source_title}
"""
        
        # Add the extracted context details
        if extracted.get("context"):
            ctx = extracted["context"]
            if ctx.get("tierRank"):
                prompt += f"Tier: {ctx['tierRank']}\n"
            if ctx.get("tierReasoning"):
                prompt += f"Reasoning: {ctx['tierReasoning']}\n"
            if ctx.get("bestTargets"):
                prompt += f"Best Targets: {', '.join(ctx['bestTargets'])}\n"
            if ctx.get("counters"):
                prompt += f"Counters: {', '.join(ctx['counters'])}\n"
            if ctx.get("synergies"):
                # Handle both old string format and new structured format
                synergies = ctx['synergies']
                if synergies and isinstance(synergies[0], dict):
                    synergy_strs = [f"{s['unit']}: {s['why']}" for s in synergies if isinstance(s, dict)]
                    prompt += f"Synergies:\n" + "\n".join(f"  - {s}" for s in synergy_strs) + "\n"
                else:
                    prompt += f"Synergies: {', '.join(synergies)}\n"
            if ctx.get("playstyleNotes"):
                prompt += f"Playstyle: {ctx['playstyleNotes']}\n"
            if ctx.get("deploymentTips"):
                prompt += f"Deployment: {ctx['deploymentTips']}\n"
            if ctx.get("additionalNotes"):
                prompt += f"Notes: {ctx['additionalNotes']}\n"
        elif extracted.get("raw"):
            prompt += f"Raw context: {extracted['raw'][:1000]}\n"
        
        prompt += "\n"
    
    prompt += """
---

Now synthesize all these perspectives into a single comprehensive competitive assessment. Note any conflicts between sources and explain your resolution.

IMPORTANT - Synergy format: For synergies, provide structured objects with "unit" (name) and "why" (explanation). Example:
{"unit": "Wolf Guard Battle Leader", "why": "Wolf-touched enhancement grants +1 to wound, complementing Anti-keywords"}"""

    return prompt


def aggregate_all_for_faction(
    api_url: str = None,
    faction_id: Optional[str] = None,
    faction_name: Optional[str] = None,
    detachment_id: Optional[str] = None
) -> int:
    """
    Aggregate competitive context for ALL datasheets with extracted context for a faction.
    Uses direct database connection (api_url parameter is kept for backward compatibility but ignored).

    This finds all datasheets that have at least one extracted DatasheetSource
    for the specified faction, then runs aggregation for each one.
    """
    print("\n🔄 AGGREGATE ALL UNITS FOR FACTION")
    print("=" * 50)
    print("Using direct database connection")

    # Resolve faction ID from name if needed
    resolved_faction_id = faction_id
    resolved_faction_name = faction_name

    if faction_name and not faction_id:
        # Look up faction by name
        try:
            faction_record = db_get_faction_by_name(faction_name)
            if faction_record:
                resolved_faction_id = faction_record["id"]
                resolved_faction_name = faction_record["name"]
            else:
                print(f"❌ Faction not found: {faction_name}")
                return 1
        except Exception as e:
            print(f"❌ Error fetching faction: {e}")
            return 1

    print(f"Faction: {resolved_faction_name or resolved_faction_id}")
    if detachment_id:
        print(f"Detachment: {detachment_id}")

    # Get all datasheets with extracted context for this faction
    try:
        datasheets = db_get_datasheets_with_sources(resolved_faction_id)

        if not datasheets:
            print("❌ No datasheets with extracted context found for this faction")
            return 1

        print(f"\n📋 Found {len(datasheets)} datasheets with extracted context:")
        for ds in datasheets:
            print(f"   • {ds['name']}")

        print(f"\n{'=' * 50}")
        print("Starting aggregation...\n")

        success_count = 0
        error_count = 0

        for i, ds in enumerate(sorted(datasheets, key=lambda x: x["name"]), 1):
            print(f"\n[{i}/{len(datasheets)}] Aggregating: {ds['name']}")
            print("-" * 40)

            result = aggregate_datasheet_context(
                datasheet_id=ds["id"],
                faction_id=resolved_faction_id,
                detachment_id=detachment_id
            )

            if result == 0:
                success_count += 1
            else:
                error_count += 1
                print(f"   ⚠️ Failed to aggregate {ds['name']}")

        print(f"\n{'=' * 50}")
        print(f"✅ AGGREGATION COMPLETE")
        print(f"   Success: {success_count}/{len(datasheets)}")
        if error_count > 0:
            print(f"   Errors: {error_count}")

        return 0 if error_count == 0 else 1

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


def aggregate_datasheet_context(
    api_url: str = None,
    datasheet_id: Optional[str] = None,
    datasheet_name: Optional[str] = None,
    faction_id: Optional[str] = None,
    detachment_id: Optional[str] = None
) -> int:
    """
    Aggregate all sources for a datasheet and synthesize competitive context.
    Uses direct database connection (api_url parameter is kept for backward compatibility but ignored).

    This fetches all non-outdated, processed sources for a datasheet,
    combines their extracted contexts, and sends to Gemini to synthesize
    a unified competitive assessment.

    The resulting context is stored per (datasheet, faction, detachment) scope:
    - faction_id=None, detachment_id=None: Generic context for all armies
    - faction_id set, detachment_id=None: Faction-specific context
    - faction_id set, detachment_id set: Detachment-specific context
    """
    print("\n🔄 AGGREGATE MODE")
    print("=" * 50)
    print("Using direct database connection")

    # Display scope
    if detachment_id:
        print(f"Scope: Detachment-specific (factionId={faction_id}, detachmentId={detachment_id})")
    elif faction_id:
        print(f"Scope: Faction-specific (factionId={faction_id})")
    else:
        print("Scope: Generic (all factions)")

    # Get Gemini API key
    gemini_key = os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        print("⚠️ GOOGLE_API_KEY not found in .env.local")
        return 1

    # Resolve datasheet ID if name was provided
    if datasheet_name and not datasheet_id:
        print(f"🔍 Searching for datasheet: {datasheet_name}")
        try:
            datasheet_record = db_get_datasheet_by_name(datasheet_name)
            if datasheet_record:
                datasheet_id = datasheet_record["id"]
                print(f"   Found: {datasheet_record['name']} ({datasheet_record['faction']})")
            else:
                print(f"❌ No datasheet found matching '{datasheet_name}'")
                return 1
        except Exception as e:
            print(f"❌ Error searching for datasheet: {e}")
            return 1

    if not datasheet_id:
        print("❌ Must provide --datasheet-id or --datasheet-name")
        return 1

    # Fetch sources for this datasheet directly from database
    print(f"\n📡 Fetching sources for datasheet {datasheet_id}...")

    try:
        sources = db_get_datasheet_sources_for_aggregation(datasheet_id)

        # Get datasheet info
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id, name, faction FROM "Datasheet" WHERE id = %s', (datasheet_id,))
            datasheet = cur.fetchone()

        if not datasheet:
            print("❌ Datasheet not found")
            return 1

        print(f"📋 Datasheet: {datasheet['name']} ({datasheet['faction']})")
        print(f"   Valid sources: {len(sources)}")

    except Exception as e:
        print(f"❌ Error fetching sources: {e}")
        return 1

    # Sources are already filtered (extracted and not outdated)
    valid_sources = sources
    
    if not valid_sources:
        print("\n⚠️ No valid sources to aggregate")
        print("   Sources must be 'extracted' and not 'outdated'")
        return 0
    
    print(f"\n📚 Aggregating {len(valid_sources)} valid source(s)...")
    for s in valid_sources:
        type_icon = {"youtube": "📺", "reddit": "🔴", "article": "📄", "forum": "💬"}.get(s.get("sourceType", ""), "🌐")
        print(f"   {type_icon} {s.get('sourceTitle', s.get('sourceUrl', 'Unknown'))}")
    
    # Build the aggregation prompt
    system_prompt = build_aggregate_system_prompt()
    user_prompt = build_aggregate_user_prompt(
        datasheet.get("name", "Unknown"),
        datasheet.get("faction", "Unknown"),
        valid_sources
    )
    
    # Call Gemini API
    print(f"\n🤖 Calling Gemini ({GEMINI_MODEL}) to synthesize...")
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={gemini_key}"
    
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
            "responseSchema": AGGREGATED_CONTEXT_SCHEMA
        }
    }
    
    try:
        response = requests_with_retry(
            "POST", gemini_url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=600  # 10 min timeout with retries
        )
        
        if response.status_code != 200:
            print(f"❌ Gemini API error: {response.status_code}")
            print(f"   {response.text[:500]}")
            return 1
        
        result = response.json()
        candidates = result.get("candidates", [])
        if not candidates:
            print("❌ No response from Gemini")
            return 1
        
        response_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not response_text:
            print("❌ Empty response from Gemini")
            return 1
        
        aggregated = json.loads(response_text)
        print("✅ Context synthesized successfully!")
        
    except Exception as e:
        print(f"❌ Error calling Gemini: {e}")
        return 1
    
    # Display the results
    print(f"\n{'=' * 50}")
    print(f"📊 SYNTHESIZED COMPETITIVE CONTEXT")
    print("=" * 50)
    
    if aggregated.get("competitiveTier"):
        print(f"\n🏆 Tier: {aggregated['competitiveTier']}")
    if aggregated.get("tierReasoning"):
        print(f"   {aggregated['tierReasoning']}")
    
    if aggregated.get("bestTargets"):
        print(f"\n🎯 Best Targets: {', '.join(aggregated['bestTargets'])}")
    if aggregated.get("counters"):
        print(f"⚠️ Counters: {', '.join(aggregated['counters'])}")
    if aggregated.get("synergies"):
        synergies = aggregated['synergies']
        if synergies and isinstance(synergies[0], dict):
            print(f"🤝 Synergies:")
            for s in synergies:
                if isinstance(s, dict):
                    print(f"   • {s.get('unit', 'Unknown')}: {s.get('why', 'No explanation')}")
        else:
            print(f"🤝 Synergies: {', '.join(synergies)}")

    if aggregated.get("playstyleNotes"):
        print(f"\n📖 Playstyle: {aggregated['playstyleNotes']}")
    if aggregated.get("deploymentTips"):
        print(f"📍 Deployment: {aggregated['deploymentTips']}")
    
    # Show conflicts if any
    conflicts = aggregated.get("conflicts", [])
    if conflicts:
        print(f"\n⚡ DETECTED CONFLICTS ({len(conflicts)}):")
        for c in conflicts:
            print(f"   • {c.get('field', 'Unknown')}: {c.get('disagreement', '')}")
            print(f"     → Resolution: {c.get('resolution', '')}")
    
    # Update the datasheet competitive context directly in database
    scope_desc = "generic"
    if detachment_id:
        scope_desc = "detachment-specific"
    elif faction_id:
        scope_desc = "faction-specific"

    print(f"\n📤 Updating datasheet competitive context ({scope_desc})...")

    try:
        db_upsert_datasheet_competitive_context(
            datasheet_id=datasheet_id,
            faction_id=faction_id,
            detachment_id=detachment_id,
            competitiveTier=aggregated.get("competitiveTier"),
            tierReasoning=aggregated.get("tierReasoning"),
            bestTargets=json.dumps(aggregated.get("bestTargets", [])),
            counters=json.dumps(aggregated.get("counters", [])),
            synergies=json.dumps(aggregated.get("synergies", [])),
            playstyleNotes=aggregated.get("playstyleNotes"),
            deploymentTips=aggregated.get("deploymentTips"),
            competitiveNotes=aggregated.get("competitiveNotes"),
            sourceCount=len(valid_sources),
            conflicts=json.dumps(conflicts) if conflicts else None,
        )
        print("✅ Datasheet context updated successfully!")
    except Exception as e:
        print(f"⚠️ Could not update database: {e}")
        # Save locally as fallback
        fallback_path = OUTPUT_DIR / f"{datasheet_id}_aggregated_context.json"
        fallback_path.write_text(json.dumps(aggregated, indent=2), encoding="utf-8")
        print(f"   Saved locally to: {fallback_path}")
    
    print("\n✅ Done!")
    return 0


# ============================================
# NEW PIPELINE: Faction-Level Source Processing
# ============================================

def fetch_pending_sources(api_url: str = None, no_whisper: bool = False) -> int:
    """
    Fetch content for CompetitiveSources with status 'pending'.
    Uses direct database connection (api_url parameter is kept for backward compatibility but ignored).

    This is the FIRST step in the new pipeline:
    1. FETCH: Download content (this function)
    2. CURATE: AI identifies which units are mentioned
    3. EXTRACT: AI extracts unit-specific context
    4. AGGREGATE: Synthesize all sources for a unit
    """
    print("\n🔄 FETCH PENDING SOURCES (Step 1: Fetch)")
    print("=" * 50)
    print("Using direct database connection")

    try:
        sources = db_get_pending_sources("pending")

        if not sources:
            print("✅ No pending sources to fetch.")
            return 0

        print(f"📋 Found {len(sources)} source(s) to fetch")

    except Exception as e:
        print(f"❌ Error fetching sources from database: {e}")
        return 1

    # Process each source
    success_count = 0
    for i, source in enumerate(sources, 1):
        source_id = source.get("id")
        source_url = source.get("sourceUrl", "")
        source_type = source.get("sourceType", "youtube")
        faction_name = source.get("factionName", "Unknown")

        print(f"\n{'=' * 50}")
        print(f"📋 [{i}/{len(sources)}] Fetching source")
        print(f"   Faction: {faction_name}")
        print(f"   Type: {source_type}")
        print(f"   URL: {source_url}")

        content = None
        title = None
        author = None
        platform_id = None
        duration = None

        try:
            if source_type == "youtube":
                video_id = extract_video_id(source_url)
                if not video_id:
                    raise Exception("Could not parse video ID")

                platform_id = video_id

                # Get video info
                info = get_video_info(source_url)
                title = info.get("title", "Unknown")
                author = info.get("channel", info.get("uploader", "Unknown"))
                duration = info.get("duration", 0)

                print(f"   📺 Title: {title}")
                print(f"   👤 Channel: {author}")

                # Try captions
                success, content, error = try_fetch_captions(source_url)
                if not success and not no_whisper:
                    print(f"   📝 Captions failed, trying Whisper...")
                    with tempfile.TemporaryDirectory(prefix="yt_fetch_") as tmp_dir:
                        audio_path = download_audio(source_url, tmp_dir)
                        content = whisper_transcribe(audio_path)

            elif source_type == "discord":
                print("   ⚠️ Discord requires manual paste - skipping")
                continue

            else:
                # Web scraping
                success, result, error = fetch_content(source_url, source_type)
                if not success:
                    raise Exception(error or "Scraping failed")

                content = result.get("text", "")
                title = result.get("title", "Unknown")
                author = result.get("author", "Unknown")
                platform_id = result.get("source_id")

            if not content:
                raise Exception("No content retrieved")

            print(f"   ✅ Content fetched ({len(content):,} chars)")

            # Update source in database directly
            db_update_source_status(
                source_id, "fetched",
                content=content,
                contentTitle=title,
                authorName=author,
                sourceId=platform_id,
                duration=duration,
            )
            print(f"   ✅ Source updated (status: fetched)")
            success_count += 1

        except Exception as e:
            print(f"   ❌ Error: {e}")
            # Update with error status
            db_update_source_status(source_id, "error", errorMessage=str(e))

    print(f"\n✅ Fetch complete: {success_count}/{len(sources)} succeeded")
    return 0


def curate_pending_sources(api_url: str = None) -> int:
    """
    Run AI curation on CompetitiveSources with status 'fetched'.
    Uses direct database connection (api_url parameter is kept for backward compatibility but ignored).

    This is the SECOND step: identify which units are mentioned in each source.
    Creates DatasheetSource links for each mentioned unit.
    """
    print("\n🔄 CURATE PENDING SOURCES (Step 2: Curate)")
    print("=" * 50)
    print("Using direct database connection")

    google_api_key = os.getenv("GOOGLE_API_KEY")

    if not google_api_key:
        print("⚠️ GOOGLE_API_KEY not found")
        return 1

    # Fetch sources ready for curation (status=fetched)
    try:
        sources = db_get_pending_sources("fetched")

        if not sources:
            print("✅ No sources to curate.")
            return 0

        print(f"📋 Found {len(sources)} source(s) to curate")

        # Pre-fetch datasheets for each faction
        faction_datasheets = {}
        for source in sources:
            faction_id = source.get("factionId")
            if faction_id and faction_id not in faction_datasheets:
                faction_datasheets[faction_id] = db_get_faction_datasheets(faction_id)

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    success_count = 0
    for i, source in enumerate(sources, 1):
        source_id = source.get("id")
        faction_id = source.get("factionId")
        faction_name = source.get("factionName", "Unknown")
        content = source.get("content", "")
        title = source.get("contentTitle", "Unknown")
        
        print(f"\n{'=' * 50}")
        print(f"📋 [{i}/{len(sources)}] Curating: {title}")
        print(f"   Faction: {faction_name}")
        print(f"   Content: {len(content):,} chars")
        
        # Get datasheets for this faction
        datasheets = faction_datasheets.get(faction_id, [])
        if not datasheets:
            print(f"   ⚠️ No datasheets found for faction {faction_name}")
            continue
        
        print(f"   📊 Checking against {len(datasheets)} datasheets")
        
        # Build the datasheet list for the prompt - include keywords for matching
        datasheet_list = "\n".join([
            f"- {d['name']} (ID: {d['id']}) [Keywords: {d.get('keywords', '')}]"
            for d in datasheets
        ])
        
        print(f"   📄 Content length: {len(content):,} chars (full content)")
        
        # Call Gemini to identify mentioned units
        system_prompt = """You are an expert Warhammer 40,000 analyst. Given content from a competitive analysis source and a list of unit datasheets, identify which units are discussed.

CRITICAL MATCHING RULES:
1. Match units even if pronounced/spelled differently (e.g., "Wulfen" might sound like "Wolfin", "He'stan" like "Histan")
2. Match units by their keywords if the name isn't explicitly said (e.g., "Dreadnoughts" matches any unit with DREADNOUGHT keyword)
3. Be thorough - this is likely a tier list or comprehensive review, so MOST units should be mentioned
4. A brief mention like "unit X is good/bad" counts as a mention
5. Specific weapon/loadout discussions count for that unit

For each unit mentioned, provide:
- The exact datasheet ID from the list
- The datasheet name (exactly as shown)
- How many times approximately the unit is mentioned or discussed
- A relevance score (0.0-1.0) for how much insight is given about the unit
- A VERY BRIEF summary (max 60 chars) of what is said - be concise!

Include units with ANY meaningful competitive commentary, even if brief.

OUTPUT FORMAT (JSON):
{
  "mentionedUnits": [
    {
      "datasheetId": "uuid-here",
      "datasheetName": "Unit Name",
      "mentionCount": 5,
      "relevanceScore": 0.8,
      "mentionSummary": "Strong character killer, good mobility"
    }
  ],
  "unmatchedMentions": ["any unit names mentioned but not in the list"]
}

IMPORTANT: Keep summaries SHORT (under 60 characters) to avoid truncation!"""

        user_prompt = f"""CONTENT SOURCE: "{title}"

This appears to be a comprehensive tier list or unit review for {faction_name}. Carefully analyze the ENTIRE content and match units.

AVAILABLE DATASHEETS FOR {faction_name}:
{datasheet_list}

CONTENT TO ANALYZE (FULL TRANSCRIPT):
{content}

TASK: Identify ALL units from the list above that are discussed. For a tier list video, expect to match MOST units from the list. Be thorough!"""

        # Create Langfuse trace for this curation
        trace = None
        generation = None
        if HAS_LANGFUSE and langfuse:
            trace = langfuse.trace(
                name="competitive-source-curation",
                metadata={
                    "sourceId": source_id,
                    "factionName": faction_name,
                    "contentTitle": title,
                    "contentLength": len(content),
                    "datasheetCount": len(datasheets),
                },
                tags=["curation", f"faction-{faction_name.lower().replace(' ', '-')}"]
            )
        
        try:
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={google_api_key}"
            gemini_payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 65536,
                    "responseMimeType": "application/json",
                }
            }
            
            # Create Langfuse generation span
            if trace:
                generation = trace.generation(
                    name="gemini-unit-identification",
                    model=GEMINI_MODEL,
                    input={
                        "system_prompt": system_prompt[:500] + "...",  # Truncate for logging
                        "user_prompt_length": len(user_prompt),
                        "datasheet_names": [d["name"] for d in datasheets],
                    },
                    metadata={
                        "temperature": 0.2,
                        "maxOutputTokens": 65536,
                    }
                )
            
            print(f"   🤖 Calling Gemini for curation...")
            response = requests_with_retry("POST", gemini_url, json=gemini_payload, timeout=600)  # 10 min timeout with retries
            if response.status_code != 200:
                error_detail = response.text[:500] if response.text else "No details"
                if generation:
                    generation.end(output={"error": error_detail}, level="ERROR")
                raise Exception(f"Gemini API error {response.status_code}: {error_detail}")
            
            result = response.json()
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Parse JSON with repair for truncated responses
            try:
                curation_result = json.loads(text)
            except json.JSONDecodeError as e:
                # Try to repair truncated JSON
                print(f"   ⚠️ JSON truncated, attempting repair...")
                repaired_text = repair_truncated_json(text)
                if repaired_text:
                    try:
                        curation_result = json.loads(repaired_text)
                        print(f"   ✅ JSON repair successful")
                    except json.JSONDecodeError:
                        raise e  # Re-raise original error if repair fails
                else:
                    raise e
            
            mentioned_units = curation_result.get("mentionedUnits", [])
            unmatched = curation_result.get("unmatchedMentions", [])
            
            # Log to Langfuse
            if generation:
                generation.end(
                    output={
                        "unitsFound": len(mentioned_units),
                        "unmatchedCount": len(unmatched),
                        "unitNames": [u["datasheetName"] for u in mentioned_units],
                        "unmatched": unmatched[:10],
                    }
                )
            
            print(f"   🎯 Found {len(mentioned_units)} units mentioned")
            if unmatched:
                print(f"   ⚠️ Unmatched mentions (not in datasheet list): {', '.join(unmatched[:5])}")
            
            if mentioned_units:
                # Create datasheet links directly in database
                links = [
                    {
                        "datasheetId": u["datasheetId"],
                        "relevanceScore": u.get("relevanceScore", 0.5),
                        "mentionCount": u.get("mentionCount", 1),
                        "mentionSummary": u.get("mentionSummary", ""),
                    }
                    for u in mentioned_units
                ]
                try:
                    db_create_datasheet_links(source_id, links)
                    print(f"   ✅ Created {len(mentioned_units)} datasheet links")
                except Exception as link_err:
                    print(f"   ⚠️ Failed to create links: {link_err}")

            # Update source status directly in database
            db_update_source_status(source_id, "curated")
            
            print(f"   ✅ Source curated")
            success_count += 1
            
            # Print summary
            for u in mentioned_units[:5]:
                print(f"      • {u['datasheetName']} (relevance: {u.get('relevanceScore', '?')})")
            if len(mentioned_units) > 5:
                print(f"      ... and {len(mentioned_units) - 5} more")
        
        except json.JSONDecodeError as e:
            print(f"   ❌ Failed to parse Gemini response: {e}")
            # Log raw response for debugging
            if 'text' in dir():
                print(f"      Raw response (first 500 chars): {text[:500]}")
            if trace:
                trace.update(level="ERROR", metadata={"error": f"JSON parse: {e}", "rawResponse": text[:1000] if 'text' in dir() else None})
        except Exception as e:
            print(f"   ❌ Error: {e}")
            if trace:
                trace.update(level="ERROR", metadata={"error": str(e)})
    
    # Flush Langfuse traces
    if HAS_LANGFUSE and langfuse:
        try:
            langfuse.flush()
        except Exception:
            pass
    
    print(f"\n✅ Curation complete: {success_count}/{len(sources)} succeeded")
    return 0


def extract_pending_links(api_url: str = None) -> int:
    """
    Extract unit-specific context for DatasheetSources with status 'pending'.
    Uses direct database connection (api_url parameter is kept for backward compatibility but ignored).

    This is the THIRD step: for each unit link, extract detailed competitive insights
    from the source content specifically about that unit.
    """
    print("\n🔄 EXTRACT PENDING LINKS (Step 3: Extract)")
    print("=" * 50)
    print("Using direct database connection")

    google_api_key = os.getenv("GOOGLE_API_KEY")

    if not google_api_key:
        print("⚠️ GOOGLE_API_KEY not found")
        return 1

    # Fetch pending datasheet sources directly from database
    try:
        pending_links = db_get_pending_datasheet_sources()

        if not pending_links:
            print("✅ No links to extract.")
            return 0

        print(f"📋 Found {len(pending_links)} pending link(s) to extract")

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    total_extracted = 0
    processed_sources = set()

    for i, link in enumerate(pending_links, 1):
        link_id = link.get("id")
        source_id = link.get("sourceId")
        unit_name = link.get("datasheetName", "Unknown")
        faction = link.get("faction", "Unknown")
        content = link.get("content", "")
        title = link.get("contentTitle", "Unknown")

        print(f"\n{'=' * 50}")
        print(f"📋 [{i}/{len(pending_links)}] Extracting: {unit_name}")
        print(f"   Source: {title}")
        print(f"   Faction: {faction}")

        try:
            # Use existing extract_unit_context function
            result = extract_unit_context(
                transcript=content,
                unit_name=unit_name,
                faction=faction,
                video_info={"title": title}
            )

            if result.get("success") and result.get("found"):
                context = result.get("context", {})
                confidence = context.get("confidence", 50)

                # Update the datasheet source link directly in database
                db_update_datasheet_source_extraction(
                    link_id,
                    extracted_context=result,
                    confidence=confidence,
                    status="extracted"
                )

                print(f"   ✅ Extracted (confidence: {confidence}%)")
                total_extracted += 1
            else:
                print(f"   ⚠️ Unit not found in content")
                # Mark as extracted but with low confidence
                db_update_datasheet_source_extraction(
                    link_id,
                    extracted_context={"found": False},
                    confidence=0,
                    status="extracted"
                )

        except Exception as e:
            print(f"   ❌ Error: {e}")

        # Track processed sources
        if source_id:
            processed_sources.add(source_id)

    # Update source statuses for all processed sources
    for source_id in processed_sources:
        try:
            db_update_source_status(source_id, "extracted")
        except Exception as e:
            print(f"⚠️ Could not update source {source_id}: {e}")

    print(f"\n✅ Extraction complete: {total_extracted}/{len(pending_links)} unit contexts extracted")
    return 0


def process_all_pipeline(api_url: str, no_whisper: bool = False) -> int:
    """
    Run the complete pipeline: fetch → curate → extract.
    
    This is a convenience function that runs all three steps in sequence.
    """
    print("\n🚀 RUNNING FULL PIPELINE")
    print("=" * 50)
    
    # Step 1: Fetch
    result = fetch_pending_sources(api_url, no_whisper)
    if result != 0:
        print("\n⚠️ Fetch step had issues, continuing...")
    
    # Step 2: Curate
    result = curate_pending_sources(api_url)
    if result != 0:
        print("\n⚠️ Curate step had issues, continuing...")
    
    # Step 3: Extract
    result = extract_pending_links(api_url)
    if result != 0:
        print("\n⚠️ Extract step had issues")
    
    print("\n✅ Pipeline complete!")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch content from YouTube, Reddit, articles, forums and extract unit context",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List available transcripts/content
  python3 scripts/youtube_transcribe.py --list

  # Extract context from an existing file
  python3 scripts/youtube_transcribe.py --file "Yh9NFoHprH0_Salamanders.txt" --unit "Infernus Marines"

  # Fetch from YouTube (auto-detected)
  python3 scripts/youtube_transcribe.py --url "https://youtube.com/watch?v=..."

  # Fetch from Reddit (auto-detected)
  python3 scripts/youtube_transcribe.py --url "https://reddit.com/r/WarhammerCompetitive/..."

  # Fetch from article site (auto-detected)
  python3 scripts/youtube_transcribe.py --url "https://www.goonhammer.com/..."

  # Force a specific source type
  python3 scripts/youtube_transcribe.py --url "..." --source-type article

  # Fetch + extract context for a specific unit
  python3 scripts/youtube_transcribe.py --url "..." --unit "Infernus Marines" --faction "Salamanders"

  # Aggregate sources for a unit (synthesize competitive context from all sources)
  python3 scripts/youtube_transcribe.py --aggregate --datasheet-name "Adrax Agatone"
        """
    )
    parser.add_argument("--url", help="URL to fetch content from (YouTube, Reddit, article, forum, etc.)")
    parser.add_argument("--file", help="Path to existing transcript/content file")
    parser.add_argument("--list", action="store_true", help="List available transcripts in manifest")
    parser.add_argument("--source-type", choices=SOURCE_TYPES, 
                       help="Force a specific source type (auto-detected if not specified)")
    parser.add_argument("--no-whisper", action="store_true", help="Don't use Whisper fallback for YouTube")
    parser.add_argument("--print", dest="do_print", action="store_true", help="Print content to stdout")
    parser.add_argument("--json", dest="json_output", action="store_true", help="Output JSON with metadata (for admin UI)")
    
    # Unit context extraction arguments
    parser.add_argument("--unit", help="Unit/datasheet name to extract context for (e.g., 'Infernus Marines')")
    parser.add_argument("--faction", help="Faction name for better context (e.g., 'Salamanders')")
    
    # Database integration mode (direct connection - api-url is deprecated)
    parser.add_argument("--api-url", default=None,
                       help="[DEPRECATED] No longer needed - uses direct database connection")
    
    # New faction-level pipeline
    parser.add_argument("--fetch-pending", action="store_true", 
                       help="[Pipeline Step 1] Fetch content for pending CompetitiveSources")
    parser.add_argument("--curate-pending", action="store_true",
                       help="[Pipeline Step 2] Run AI curation to identify mentioned units")
    parser.add_argument("--extract-pending", action="store_true",
                       help="[Pipeline Step 3] Extract unit-specific context for each link")
    parser.add_argument("--process-all", action="store_true",
                       help="Run all pipeline steps (fetch → curate → extract)")
    
    # Aggregate mode - synthesize context from all sources
    parser.add_argument("--aggregate", action="store_true",
                       help="Aggregate all sources for a datasheet and synthesize competitive context")
    parser.add_argument("--aggregate-all", action="store_true",
                       help="Aggregate all datasheets with extracted context for a faction")
    parser.add_argument("--datasheet-id", 
                       help="Datasheet ID to aggregate (use with --aggregate)")
    parser.add_argument("--datasheet-name",
                       help="Datasheet name to aggregate (use with --aggregate, searches by name)")
    parser.add_argument("--faction-id",
                       help="Faction ID for faction-specific context (use with --aggregate or --aggregate-all)")
    parser.add_argument("--faction-name",
                       help="Faction name to aggregate all units for (use with --aggregate-all)")
    parser.add_argument("--detachment-id",
                       help="Detachment ID for detachment-specific context (use with --aggregate, requires --faction-id)")
    
    args = parser.parse_args()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # List mode - show available transcripts
    if args.list:
        manifest = load_manifest()
        transcripts = manifest.get("transcripts", [])
        if not transcripts:
            print("📋 No content in manifest yet.")
            return 0
        
        print("\n📋 AVAILABLE CONTENT")
        print("=" * 70)
        for i, t in enumerate(transcripts, 1):
            source_type = t.get('source_type', 'youtube')
            type_icon = {"youtube": "📺", "reddit": "🔴", "article": "📄", "forum": "💬", "other": "🌐"}.get(source_type, "📄")
            print(f"\n{i}. {t.get('title', 'Unknown')}")
            print(f"   {type_icon} Type: {source_type} | Author: {t.get('author', t.get('channel', 'Unknown'))}")
            print(f"   📄 File: {t.get('filename', 'N/A')}")
            print(f"   🔗 ID: {t.get('source_id', t.get('video_id', 'N/A'))}")
            print(f"   📊 {t.get('chars', 0):,} chars | Method: {t.get('fetch_method', t.get('source', 'unknown'))}")
        print(f"\n{'=' * 70}")
        print(f"Total: {len(transcripts)} entries")
        print("\nTo extract unit context from content:")
        print('  python3 scripts/youtube_transcribe.py --file "<filename>" --unit "Unit Name"')
        return 0

    # ===== NEW PIPELINE MODES =====
    
    # Process all pipeline steps
    if getattr(args, 'process_all', False):
        return process_all_pipeline(args.api_url, args.no_whisper)
    
    # Step 1: Fetch content for pending CompetitiveSources
    if getattr(args, 'fetch_pending', False):
        return fetch_pending_sources(args.api_url, args.no_whisper)
    
    # Step 2: Curate - identify mentioned units
    if getattr(args, 'curate_pending', False):
        return curate_pending_sources(args.api_url)
    
    # Step 3: Extract - unit-specific context
    if getattr(args, 'extract_pending', False):
        return extract_pending_links(args.api_url)
    
    # Aggregate ALL units for a faction
    if getattr(args, 'aggregate_all', False):
        if not args.faction_id and not args.faction_name:
            print("❌ --aggregate-all requires --faction-id or --faction-name")
            return 1
        return aggregate_all_for_faction(
            args.api_url,
            faction_id=args.faction_id,
            faction_name=args.faction_name,
            detachment_id=args.detachment_id
        )
    
    # Aggregate mode - synthesize context from multiple sources (single unit)
    if getattr(args, 'aggregate', False):
        # Validate detachment requires faction
        if args.detachment_id and not args.faction_id:
            print("❌ --detachment-id requires --faction-id to be set")
            return 1
        
        return aggregate_datasheet_context(
            args.api_url, 
            datasheet_id=args.datasheet_id,
            datasheet_name=args.datasheet_name,
            faction_id=args.faction_id,
            detachment_id=args.detachment_id
        )

    # File mode - read from existing transcript
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            # Try relative to OUTPUT_DIR
            file_path = OUTPUT_DIR / args.file
        if not file_path.exists():
            print(f"❌ File not found: {args.file}")
            return 1
        
        print(f"\n📄 Reading transcript from: {file_path.name}")
        transcript = file_path.read_text(encoding="utf-8")
        print(f"✅ Loaded transcript ({len(transcript):,} chars)")
        
        # Try to find video info from manifest
        manifest = load_manifest()
        video_info = None
        for t in manifest.get("transcripts", []):
            if t.get("filename") == file_path.name or file_path.name.startswith(t.get("video_id", "")):
                video_info = {
                    "video_id": t.get("video_id"),
                    "title": t.get("title"),
                    "channel": t.get("channel"),
                    "url": t.get("url"),
                }
                print(f"📺 Video: {video_info.get('title', 'Unknown')}")
                print(f"👤 Channel: {video_info.get('channel', 'Unknown')}")
                break
        
        if not video_info:
            # Extract video_id from filename if possible
            video_id_match = re.match(r'^([A-Za-z0-9_-]{11})_', file_path.name)
            video_info = {
                "video_id": video_id_match.group(1) if video_id_match else None,
                "title": file_path.stem,
                "channel": "Unknown",
                "url": None,
            }
        
        if not args.unit:
            print("\n⚠️ No --unit specified. Use --unit 'Unit Name' to extract context.")
            print("\nExample:")
            print(f'  python3 scripts/youtube_transcribe.py --file "{file_path.name}" --unit "Infernus Marines" --faction "Salamanders"')
            return 0
        
        # Extract unit context
        context_result = extract_unit_context(
            transcript=transcript,
            unit_name=args.unit,
            faction=args.faction,
            video_info=video_info
        )
        
        if not context_result.get("success"):
            print(f"\n❌ Failed to extract context: {context_result.get('error')}")
            return 1
        
        if not context_result.get("found"):
            print(f"\n⚠️ Unit \"{args.unit}\" was not found in the transcript.")
            return 0
        
        # Save the context
        video_id = video_info.get("video_id") or "unknown"
        context_path = save_unit_context(context_result, video_id, args.unit)
        print(f"\n💾 Unit context saved to: {context_path.relative_to(REPO_ROOT)}")
        
        # Print summary
        ctx = context_result.get("context", {})
        print("\n" + "=" * 50)
        print(f"📋 UNIT CONTEXT: {args.unit}")
        print("=" * 50)
        
        if ctx.get("tierRank"):
            print(f"\n🏆 Tier: {ctx['tierRank']}")
            if ctx.get("tierReasoning"):
                print(f"   Reasoning: {ctx['tierReasoning']}")
        
        if ctx.get("bestTargets"):
            print(f"\n🎯 Best Against:")
            for target in ctx["bestTargets"]:
                print(f"   • {target}")
        
        if ctx.get("synergies"):
            print(f"\n🤝 Synergies:")
            for synergy in ctx["synergies"]:
                if isinstance(synergy, dict):
                    print(f"   • {synergy.get('unit', 'Unknown')}: {synergy.get('why', 'No explanation')}")
                else:
                    print(f"   • {synergy}")

        if ctx.get("playstyleNotes"):
            print(f"\n📖 Playstyle: {ctx['playstyleNotes']}")

        print(f"\n📊 Confidence: {ctx.get('confidence', 'N/A')}%")
        
        if args.json_output:
            print("\n" + "=" * 50)
            print("FULL JSON OUTPUT:")
            print("=" * 50)
            print(json.dumps(context_result, indent=2, ensure_ascii=False))
        
        print("\n✅ Done!")
        return 0

    # Interactive mode if no URL provided
    url = args.url
    if not url:
        print("\n🌐 Content Scraper & Transcript Fetcher")
        print("=" * 40)
        print("Supported sources: YouTube, Reddit, Articles, Forums")
        url = input("\nEnter URL: ").strip()
        if not url:
            print("❌ No URL provided.")
            return 1

    # Determine source type
    source_type = args.source_type or detect_source_type(url)
    print(f"\n🔍 Source type: {source_type}")
    print(f"🔗 URL: {url}")
    
    transcript: Optional[str] = None
    title: str = "Unknown"
    author: str = "Unknown"
    source_id: str = ""
    fetch_method: str = "unknown"
    
    if source_type == "youtube":
        # Handle YouTube with existing flow
        video_id = extract_video_id(url)
        if not video_id:
            print(f"❌ Could not parse video ID from: {url}")
            return 1
        
        source_id = video_id
        
        # Normalize URL
        if "http" not in url:
            url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Get video info
        try:
            info = get_video_info(url)
            title = info.get("title", "Unknown")
            author = info.get("channel", info.get("uploader", "Unknown"))
            duration = info.get("duration", 0)
            print(f"📺 Title: {title}")
            print(f"👤 Channel: {author}")
            print(f"⏱️ Duration: {duration // 60}m {duration % 60}s")
        except Exception as e:
            print(f"⚠️ Could not fetch video info: {e}")
            title = video_id
            author = "Unknown"
        
        # Try captions first
        print("\n📝 Trying captions...")
        success, transcript, error = try_fetch_captions(url)
        if success and transcript:
            print(f"✅ Captions found! ({len(transcript)} chars)")
            fetch_method = "captions"
        else:
            print(f"⚠️ Captions: {error}")
        
        # Whisper fallback
        if not transcript and not args.no_whisper:
            print("\n🎧 Trying audio download + Whisper...")
            with tempfile.TemporaryDirectory(prefix="yt_transcript_") as tmp_dir:
                try:
                    audio_path = download_audio(url, tmp_dir)
                    size_mb = os.path.getsize(audio_path) / (1024 * 1024)
                    print(f"⬇️ Audio downloaded ({size_mb:.1f} MB)")
                    
                    print("🤖 Transcribing with Whisper...")
                    transcript = whisper_transcribe(audio_path)
                    print(f"✅ Whisper transcription complete! ({len(transcript)} chars)")
                    fetch_method = "whisper"
                except Exception as e:
                    print(f"❌ Whisper failed: {e}")
    
    elif source_type == "discord":
        print("\n⚠️ Discord content cannot be scraped automatically.")
        print("Please copy the content manually and use --file or paste mode in the app.")
        return 1
    
    else:
        # Handle web scraping for Reddit, articles, forums, other
        print(f"\n📥 Scraping {source_type} content...")
        success, content, error = fetch_content(url, source_type)
        
        if not success:
            print(f"❌ Failed to fetch content: {error}")
            return 1
        
        transcript = content.get("text", "")
        title = content.get("title", "Unknown")
        author = content.get("author", "Unknown")
        source_id = content.get("source_id", generate_source_id(url, source_type))
        fetch_method = f"scrape_{source_type}"
        
        print(f"📄 Title: {title}")
        print(f"👤 Author/Source: {author}")
        print(f"✅ Content extracted! ({len(transcript):,} chars)")
    
    if not transcript:
        print("\n❌ Could not get content. Use 'Paste Text' mode in the app instead.")
        return 1

    # Save content
    safe_title = safe_filename(title)
    filename = f"{source_id}_{safe_title}.txt"
    output_path = OUTPUT_DIR / filename

    output_path.write_text(transcript, encoding="utf-8")
    print(f"\n💾 Saved to: {output_path.relative_to(REPO_ROOT)}")

    # Update manifest
    manifest = load_manifest()
    entry = {
        "source_id": source_id,
        "source_type": source_type,
        "title": title,
        "author": author,
        "url": url,
        "filename": filename,
        "fetch_method": fetch_method,
        "chars": len(transcript),
        "fetched_at": datetime.now().isoformat(),
    }
    
    # Update or append (match by source_id)
    existing_idx = next((i for i, t in enumerate(manifest["transcripts"]) if t.get("source_id") == source_id or t.get("video_id") == source_id), None)
    if existing_idx is not None:
        manifest["transcripts"][existing_idx] = entry
    else:
        manifest["transcripts"].append(entry)
    
    save_manifest(manifest)
    print(f"📋 Updated manifest ({len(manifest['transcripts'])} entries tracked)")

    # JSON output mode - structured output for easy copy-paste to admin UI
    if args.json_output and not args.unit:
        output_json = {
            "title": title,
            "author": author,
            "url": url,
            "source_id": source_id,
            "source_type": source_type,
            "fetch_method": fetch_method,
            "chars": len(transcript),
            "transcript": transcript,
        }
        print("\n" + "=" * 40)
        print("JSON OUTPUT (copy for admin UI):")
        print("=" * 40)
        print(json.dumps(output_json, indent=2, ensure_ascii=False))
        print("\n✅ Done!")
        return 0

    # Unit context extraction mode
    if args.unit:
        source_info = {
            "source_id": source_id,
            "source_type": source_type,
            "title": title,
            "author": author,
            "url": url,
        }
        
        context_result = extract_unit_context(
            transcript=transcript,
            unit_name=args.unit,
            faction=args.faction,
            video_info=source_info  # Use source_info, compatible with video_info structure
        )
        
        if not context_result.get("success"):
            print(f"\n❌ Failed to extract context: {context_result.get('error')}")
            return 1
        
        if not context_result.get("found"):
            print(f"\n⚠️ Unit \"{args.unit}\" was not found in the transcript.")
            print("The transcript may not discuss this unit, or the unit name may need adjustment.")
            return 0
        
        # Save the context to a file
        context_path = save_unit_context(context_result, source_id, args.unit)
        print(f"\n💾 Unit context saved to: {context_path.relative_to(REPO_ROOT)}")
        
        # Print the context summary
        ctx = context_result.get("context", {})
        print("\n" + "=" * 50)
        print(f"📋 UNIT CONTEXT: {args.unit}")
        print("=" * 50)
        
        if ctx.get("tierRank"):
            print(f"\n🏆 Tier: {ctx['tierRank']}")
            if ctx.get("tierReasoning"):
                print(f"   Reasoning: {ctx['tierReasoning']}")
        
        if ctx.get("bestTargets"):
            print(f"\n🎯 Best Against:")
            for target in ctx["bestTargets"]:
                print(f"   • {target}")
        
        if ctx.get("counters"):
            print(f"\n⚠️ Countered By:")
            for counter in ctx["counters"]:
                print(f"   • {counter}")
        
        if ctx.get("synergies"):
            print(f"\n🤝 Synergies:")
            for synergy in ctx["synergies"]:
                if isinstance(synergy, dict):
                    print(f"   • {synergy.get('unit', 'Unknown')}: {synergy.get('why', 'No explanation')}")
                else:
                    print(f"   • {synergy}")

        if ctx.get("playstyleNotes"):
            print(f"\n📖 Playstyle: {ctx['playstyleNotes']}")

        if ctx.get("detachmentNotes"):
            print(f"\n🛡️ Detachment Notes: {ctx['detachmentNotes']}")
        
        if ctx.get("equipmentRecommendations"):
            print(f"\n⚔️ Equipment: {ctx['equipmentRecommendations']}")
        
        print(f"\n📊 Confidence: {ctx.get('confidence', 'N/A')}%")
        
        # Also output full JSON if --json flag is set
        if args.json_output:
            print("\n" + "=" * 50)
            print("FULL JSON OUTPUT:")
            print("=" * 50)
            print(json.dumps(context_result, indent=2, ensure_ascii=False))
        
        print("\n✅ Done!")
        return 0

    # Print preview or full
    if args.do_print:
        print("\n" + "=" * 40)
        print("TRANSCRIPT:")
        print("=" * 40)
        print(transcript)
    else:
        preview = transcript[:300].replace("\n", " ")
        print(f"\n👀 Preview: {preview}...")

    print("\n✅ Done!")
    
    # Final Langfuse flush
    if HAS_LANGFUSE and langfuse:
        try:
            langfuse.flush()
        except Exception:
            pass
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

