# Competitive Context Paste Feature

**Last Updated:** 2025-12-27
**Status:** Complete

## Overview
The Competitive Context Paste feature provides a reliable way for administrators to import competitive insights from any text source, most notably YouTube transcripts. This replaces the previous automated Node.js-based YouTube fetching, which was unreliable due to frequent YouTube API changes. By using a local Python script powered by `yt-dlp` and pasting the result, the system achieves 100% reliability for content ingestion.

## Table of Contents
- [Workflow](#workflow)
- [Architecture](#architecture)
- [Local Transcript Fetching](#local-transcript-fetching)
- [AI Parsing and Noise Tolerance](#ai-parsing-and-noise-tolerance)
- [Key Components](#key-components)

## Workflow
1. **Fetch Transcript Locally**: Use the provided Python script to get a clean transcript from a YouTube video.
2. **Create Source**: In the Admin UI (`/admin/competitive-context`), paste the transcript and provide metadata (Title, Type, URL).
3. **Parse Context**: Trigger the AI parsing to extract structured insights for all units and factions mentioned in the text.
4. **Review**: View the extracted cards for unit-specific and faction-wide competitive context.

## Architecture
The system uses a two-stage process to ensure stability and quality:
- **Ingestion Stage**: Manual creation of a `CompetitiveSource` record via the `/api/competitive/create-from-text` endpoint.
- **Extraction Stage**: Gemini 3 Flash (`gemini-3-flash-preview`) processes the full text to extract structured JSON data according to a predefined schema.

## Local Transcript Fetching
A reliable Python script is provided in `scripts/youtube_transcribe.py`.

### Usage
```bash
# Get plain text transcript
python scripts/youtube_transcribe.py --url "https://youtube.com/watch?v=VIDEO_ID"

# Get JSON format for easy copy-paste of metadata
python scripts/youtube_transcribe.py --url "https://youtube.com/watch?v=VIDEO_ID" --json
```

## AI Parsing and Noise Tolerance
The system is optimized for "noisy" transcripts common in auto-generated YouTube captions.
- **Noise Tolerance**: The AI is instructed to look past repetitions and phonetic misspellings (e.g., "Adra Eggatone" recognized as "Adrax Agatone").
- **Model**: Uses `gemini-3-flash-preview` for high speed and large context window (up to 500,000 characters).
- **Structured Output**: Uses JSON schema enforcement to ensure data consistency.

## Key Components
- **Admin Page**: `app/admin/competitive-context/page.tsx`
- **Creation API**: `app/api/competitive/create-from-text/route.ts`
- **Parsing Logic**: `lib/competitiveContextParser.ts`
- **Unit Parser API**: `app/api/competitive/parse-for-unit/route.ts`

## Related Documentation
- [Competitive Create From Text API](../api/COMPETITIVE_CREATE_FROM_TEXT.md)
- [Dossier Async API](../api/DOSSIER_ASYNC_ENDPOINTS.md)

