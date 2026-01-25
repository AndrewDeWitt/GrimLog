#!/usr/bin/env python3
"""
PDF Rules Parser - Python with PyMuPDF + GPT-5 Vision

Pure Python solution for extracting rules from Warhammer 40K PDFs.
Uses PyMuPDF (no external dependencies) + OpenAI Vision API.

Installation:
    pip install pymupdf openai pillow

Usage:
    python scripts/parsePdfWithVision.py --input data/pdf-source/space-wolves.pdf --faction "Space Marines" --detachment "Saga of the Beastslayer"
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Optional
import fitz  # PyMuPDF
from openai import OpenAI
from tqdm import tqdm

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def convert_pdf_page_to_image(pdf_path: str, page_num: int) -> str:
    """
    Convert a PDF page to base64-encoded PNG image.
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number (0-indexed)
    
    Returns:
        Base64-encoded PNG image string
    """
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num)
    
    # Render at 2x resolution (300 DPI) for better OCR
    mat = fitz.Matrix(2.0, 2.0)
    pix = page.get_pixmap(matrix=mat)
    
    # Convert to PNG bytes
    img_bytes = pix.tobytes("png")
    
    # Encode to base64
    base64_image = base64.b64encode(img_bytes).decode('utf-8')
    
    doc.close()
    return base64_image

def extract_text_from_image(
    base64_image: str,
    page_num: int,
    faction: Optional[str] = None,
    detachment: Optional[str] = None
) -> str:
    """
    Extract text from image using GPT-5-mini Vision API.
    """
    system_prompt = f"""You are an expert at extracting text from Warhammer 40,000 rulebook pages.

Your job is to extract ALL text content from this page accurately, preserving the exact wording and structure.

EXTRACTION RULES:
1. Extract ALL visible text from the page
2. Preserve exact wording - do not paraphrase, summarize, or interpret
3. Maintain the original structure and formatting where possible
4. If you see stratagems, abilities, or rules, extract them completely
5. Include rule names, costs (CP), descriptions, and any metadata
6. If the page contains no game rules (e.g., table of contents, index, artwork only), respond with "NO_RULES_FOUND"
7. Use clear section breaks between different rules or entries

OUTPUT FORMAT:
- Use markdown headings (##) for rule/stratagem names
- Keep CP costs in parentheses after the name
- Preserve all rule text exactly as written
- Use line breaks to separate different sections
- Include any section headers, rule categories, or metadata you see

{f"Context: This is from {faction} content" if faction else ""}
{f"Context: This is from the {detachment} detachment" if detachment else ""}

Focus on accuracy and completeness. The extracted text will be parsed and structured later."""

    try:
        response = client.responses.create(
            model="gpt-5-mini",
            instructions=system_prompt,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "Extract all text from this rulebook page. Preserve exact wording and structure."
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{base64_image}",
                            "detail": "high"
                        }
                    ]
                }
            ],
        )
        
        extracted_text = response.output_text or ""
        
        if "NO_RULES_FOUND" in extracted_text:
            print(f"  Page {page_num + 1}: No rules (skipped)")
            return ""
        
        print(f"  Page {page_num + 1}: Text extracted ({len(extracted_text)} chars)")
        return extracted_text
        
    except Exception as e:
        print(f"ERROR processing page {page_num + 1}: {e}")
        return ""

def process_pdf(
    pdf_path: str,
    output_path: str,
    faction: Optional[str] = None,
    detachment: Optional[str] = None
):
    """
    Process PDF and extract all text using Vision API.
    """
    print("\n" + "=" * 60)
    print("PDF Parser - Python with GPT-5 Vision")
    print("=" * 60)
    print(f"Input:  {pdf_path}")
    print(f"Output: {output_path}")
    if faction:
        print(f"Faction: {faction}")
    if detachment:
        print(f"Detachment: {detachment}")
    print("=" * 60)
    
    # Get total pages
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    doc.close()
    
    print(f"\nPDF has {total_pages} page(s)")
    
    # Process each page with progress bar
    all_extracted = []
    
    for page_num in tqdm(range(total_pages), desc="Processing pages", unit="page"):
        try:
            # Convert page to image
            base64_image = convert_pdf_page_to_image(pdf_path, page_num)
            
            # Extract text with Vision API
            extracted = extract_text_from_image(base64_image, page_num, faction, detachment)
            
            if extracted:
                all_extracted.append(extracted)
            
            # Rate limiting
            import time
            if page_num < total_pages - 1:
                time.sleep(1)  # 1 second delay between pages
                
        except Exception as e:
            print(f"\nError on page {page_num + 1}: {e}")
            continue
    
    # Create markdown output
    header = f"""# {detachment or faction or 'Game'} Rules

Extracted from: {Path(pdf_path).name}
Date: {Path(output_path).stat().st_mtime if Path(output_path).exists() else 'N/A'}
Total Pages: {total_pages}
Pages with Content: {len(all_extracted)}
{"Faction: " + faction if faction else ""}
{"Detachment: " + detachment if detachment else ""}

Note: This is raw extracted text. Run through importStrategicRules.ts to parse and structure.

---

"""
    
    markdown_content = header + "\n\n---\n\n".join(all_extracted)
    
    # Write to file
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(markdown_content, encoding='utf-8')
    
    # Summary
    print("\n" + "=" * 60)
    print("PDF Extraction Complete!")
    print("=" * 60)
    print(f"Statistics:")
    print(f"   - Total pages: {total_pages}")
    print(f"   - Pages with content: {len(all_extracted)}")
    print(f"   - Total characters: {len(markdown_content):,}")
    print(f"   - Output file: {output_path}")
    print("")
    print("Next steps:")
    print(f"   1. Review extracted text: {output_path}")
    print(f"   2. Edit/clean up if needed")
    print(f"   3. Import with AI parser:")
    faction_arg = f' --faction "{faction}"' if faction else ''
    detachment_arg = f' --detachment "{detachment}"' if detachment else ''
    print(f"      npx tsx scripts/importStrategicRules.ts --file {Path(output_path).name}{faction_arg}{detachment_arg}")
    print("")

def main():
    parser = argparse.ArgumentParser(
        description="Extract Warhammer 40K rules from PDF using GPT-5 Vision"
    )
    parser.add_argument('--input', required=True, help='Input PDF file path')
    parser.add_argument('--output', help='Output markdown file path (auto-generated if not specified)')
    parser.add_argument('--faction', help='Faction name (e.g., "Space Marines", "Tyranids")')
    parser.add_argument('--detachment', help='Detachment name')
    
    args = parser.parse_args()
    
    # Resolve paths
    pdf_path = Path(args.input)
    if not pdf_path.is_absolute():
        pdf_path = Path.cwd() / pdf_path
    
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found: {pdf_path}")
        sys.exit(1)
    
    # Auto-generate output filename
    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path
    else:
        output_dir = Path.cwd() / 'data' / 'rules-source'
        output_path = output_dir / (pdf_path.stem + '.md')
    
    # Process PDF
    process_pdf(
        str(pdf_path),
        str(output_path),
        args.faction,
        args.detachment
    )

if __name__ == '__main__':
    main()

