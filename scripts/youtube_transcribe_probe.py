"""
YouTube transcript/captions/audio probe (Python)

Goal: Determine whether YouTube extraction is the main blocker by trying, in order:
  1) Captions/subtitles (VTT) via yt-dlp metadata URLs (no audio download)
  2) Audio download via yt-dlp + OpenAI Whisper transcription

Usage:
  py scripts/youtube_transcribe_probe.py --url "https://www.youtube.com/watch?v=UbAC-BQ63j0" --lang en

  # captions only
  py scripts/youtube_transcribe_probe.py --url "..." --mode captions

  # audio + whisper only (requires OPENAI_API_KEY)
  py scripts/youtube_transcribe_probe.py --url "..." --mode whisper

Notes:
  - Requires ffmpeg for audio extraction (install via: winget install ffmpeg)
  - Whisper supports webm/m4a/mp4/mp3/wav, etc.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from typing import Any, Optional

import requests
from yt_dlp import YoutubeDL

try:
    # Optional: load OPENAI_API_KEY from .env/.env.local
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(".env.local")
    load_dotenv(".env")
except Exception:
    pass


YOUTUBE_ID_RE = re.compile(
    r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$"
)


def extract_video_id(url_or_id: str) -> Optional[str]:
    m = YOUTUBE_ID_RE.search(url_or_id.strip())
    if not m:
        return None
    return m.group(1) or m.group(2)


def vtt_time_to_ms(ts: str) -> int:
    ts = ts.strip()
    parts = ts.split(":")
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        sec_ms = parts[2]
    elif len(parts) == 2:
        hours = 0
        minutes = int(parts[0])
        sec_ms = parts[1]
    else:
        hours = 0
        minutes = 0
        sec_ms = parts[0]

    if "." in sec_ms:
        sec, ms = sec_ms.split(".", 1)
    else:
        sec, ms = sec_ms, "0"
    seconds = int(sec)
    ms_i = int((ms + "000")[:3])
    return ((hours * 3600 + minutes * 60 + seconds) * 1000) + ms_i


@dataclass
class CaptionsResult:
    ok: bool
    transcript: Optional[str] = None
    vtt_url: Optional[str] = None
    error: Optional[str] = None
    is_auto: Optional[bool] = None


def parse_vtt_to_text(vtt: str) -> str:
    lines = vtt.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line or line.startswith("WEBVTT") or line.startswith("NOTE") or line.startswith("STYLE"):
            i += 1
            continue

        # Optional cue id line
        if i + 1 < len(lines) and "-->" in lines[i + 1] and "-->" not in line:
            i += 1
            line = lines[i].strip()

        if "-->" not in line:
            i += 1
            continue

        # timing
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


def _pick_caption_format(candidates: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    # Prefer vtt, otherwise anything
    vtt = next((c for c in candidates if (c.get("ext") or "").lower() == "vtt"), None)
    return vtt or (candidates[0] if candidates else None)


def try_fetch_captions(url: str, lang: str) -> CaptionsResult:
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        return CaptionsResult(ok=False, error=f"yt-dlp metadata fetch failed: {e}")

    subtitles = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    # Prefer manual subtitles in lang
    candidates = subtitles.get(lang)
    is_auto = False
    if not candidates:
        candidates = auto.get(lang)
        is_auto = True
    if not candidates:
        # fall back to any english-ish
        for key in ("en", "en-US", "en-GB"):
            if subtitles.get(key):
                candidates = subtitles[key]
                is_auto = False
                break
            if auto.get(key):
                candidates = auto[key]
                is_auto = True
                break

    if not candidates:
        return CaptionsResult(ok=False, error="No captions/subtitles available via yt-dlp (manual or auto).")

    chosen = _pick_caption_format(candidates)
    if not chosen or not chosen.get("url"):
        return CaptionsResult(ok=False, error="Caption track found, but no downloadable URL.")

    vtt_url = chosen["url"]
    # Force VTT if possible
    if "fmt=" not in vtt_url and chosen.get("ext") != "vtt":
        # Some caption URLs accept fmt=vtt
        sep = "&" if "?" in vtt_url else "?"
        vtt_url = f"{vtt_url}{sep}fmt=vtt"

    try:
        r = requests.get(
            vtt_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=30,
        )
        r.raise_for_status()
        vtt = r.text
        transcript = parse_vtt_to_text(vtt)
        if not transcript:
            return CaptionsResult(ok=False, error="Downloaded captions were empty.", vtt_url=vtt_url, is_auto=is_auto)
        return CaptionsResult(ok=True, transcript=transcript, vtt_url=vtt_url, is_auto=is_auto)
    except Exception as e:
        return CaptionsResult(ok=False, error=f"Caption download failed: {e}", vtt_url=vtt_url, is_auto=is_auto)


def download_audio(url: str, tmp_dir: str) -> str:
    """
    Download audio from YouTube and convert to m4a via ffmpeg.
    
    This is required because many YouTube videos only offer HLS streams,
    which produce files that Whisper rejects as "Invalid file format" even
    though the extension is .mp4. Using ffmpeg to extract/convert to m4a
    guarantees a valid audio container.
    """
    import shutil
    
    # Check for ffmpeg
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg is not installed or not in PATH.\n"
            "Install it via: winget install ffmpeg\n"
            "Then restart your terminal and try again."
        )
    
    outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")
    ydl_opts = {
        "quiet": False,
        "no_warnings": True,
        # Download best audio available
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        # Use ffmpeg to extract audio and convert to m4a (Whisper-compatible)
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "m4a",
            "preferredquality": "128",  # 128kbps is plenty for speech
        }],
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    # Helpful debug about what we actually downloaded
    fmt_id = info.get("format_id")
    fmt = info.get("format")
    ext = info.get("ext")
    acodec = info.get("acodec")
    vcodec = info.get("vcodec")
    print(f"🎛️ Downloaded format_id={fmt_id} ext={ext} acodec={acodec} vcodec={vcodec}")
    if fmt:
        print(f"🧾 format: {fmt}")

    vid = info.get("id")
    
    # After postprocessing, the file will be .m4a
    path = os.path.join(tmp_dir, f"{vid}.m4a")
    if not os.path.exists(path):
        # Try requested_downloads which has the final filepath after postprocessing
        for rd in info.get("requested_downloads") or []:
            fp = rd.get("filepath")
            if fp and os.path.exists(fp):
                return fp
        # Also check for any .m4a file in the temp dir
        for f in os.listdir(tmp_dir):
            if f.endswith(".m4a"):
                return os.path.join(tmp_dir, f)
        raise FileNotFoundError(f"Expected audio file not found at {path}")
    return path


def whisper_transcribe(audio_path: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    # Use raw HTTP call to avoid installing the OpenAI Python SDK.
    # POST https://api.openai.com/v1/audio/transcriptions
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": "whisper-1",
        # Let Whisper auto-detect language; you can uncomment to force English.
        # "language": "en",
        "response_format": "text",
    }

    # Best-effort content type from extension
    ext = os.path.splitext(audio_path)[1].lower()
    content_type = {
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".webm": "audio/webm",
        ".wav": "audio/wav",
    }.get(ext, "application/octet-stream")

    with open(audio_path, "rb") as f:
        files = {"file": (os.path.basename(audio_path), f, content_type)}
        r = requests.post(url, headers=headers, data=data, files=files, timeout=300)

    if r.status_code >= 400:
        # Print the exact API error body (this is what we need to debug)
        raise RuntimeError(f"OpenAI Whisper API {r.status_code}: {r.text.strip()[:2000]}")

    return r.text.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="YouTube URL or video id")
    parser.add_argument("--lang", default="en", help="Preferred caption language (default: en)")
    parser.add_argument(
        "--mode",
        choices=["auto", "captions", "whisper"],
        default="auto",
        help="auto = captions then whisper; captions = captions only; whisper = audio+whisper only",
    )
    parser.add_argument("--print", dest="do_print", action="store_true", help="Print transcript to stdout")
    parser.add_argument("--out", default="", help="Write transcript to this file path")
    args = parser.parse_args()

    url = args.url.strip()
    vid = extract_video_id(url)
    if not vid:
        print("❌ Could not parse a YouTube video id from the input.", file=sys.stderr)
        return 2

    # Normalize to watch URL for yt-dlp
    if "http" not in url:
        url = f"https://www.youtube.com/watch?v={vid}"

    print(f"🎬 Video ID: {vid}")
    print(f"🔗 URL: {url}")
    print(f"🧭 Mode: {args.mode}")

    transcript: Optional[str] = None

    if args.mode in ("auto", "captions"):
        print("📝 Trying captions/subtitles (no audio)...")
        cap = try_fetch_captions(url, args.lang)
        if cap.ok and cap.transcript:
            transcript = cap.transcript
            print(f"✅ Captions OK (auto={cap.is_auto}). chars={len(transcript)}")
            if cap.vtt_url:
                print(f"📎 Captions URL: {cap.vtt_url[:120]}...")
        else:
            print(f"⚠️ Captions failed: {cap.error}")

    if transcript is None and args.mode in ("auto", "whisper"):
        print("🎧 Trying audio download + Whisper...")
        with tempfile.TemporaryDirectory(prefix="yt_probe_") as tmp_dir:
            try:
                audio_path = download_audio(url, tmp_dir)
                size_mb = os.path.getsize(audio_path) / (1024 * 1024)
                print(f"⬇️ Audio downloaded: {audio_path} ({size_mb:.2f} MB)")
            except Exception as e:
                print(f"❌ Audio download failed: {e}", file=sys.stderr)
                return 3

            try:
                transcript = whisper_transcribe(audio_path)
                print(f"✅ Whisper OK. chars={len(transcript)}")
            except Exception as e:
                print(f"❌ Whisper transcription failed: {e}", file=sys.stderr)
                return 4

    if transcript is None:
        print("❌ No transcript could be obtained via the selected mode.", file=sys.stderr)
        return 5

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(transcript)
        print(f"💾 Wrote transcript to: {args.out}")

    if args.do_print:
        print("\n--- TRANSCRIPT START ---\n")
        print(transcript)
        print("\n--- TRANSCRIPT END ---\n")
    else:
        # Print a preview for convenience
        preview = transcript[:500].replace("\n", " ")
        print(f"👀 Preview: {preview}{'...' if len(transcript) > 500 else ''}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


