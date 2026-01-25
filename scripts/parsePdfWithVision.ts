/**
 * PDF Rules Parser - Pure TypeScript with PDF.js + GPT-5 Vision
 * 
 * Uses Mozilla's PDF.js to render PDFs (no system dependencies!)
 * Then uses GPT-5-mini Vision to extract stratagem text.
 * 
 * Features:
 * - Pure TypeScript/Node.js - no Ghostscript needed
 * - High-quality rendering with PDF.js
 * - GPT-5-mini Vision for accurate text extraction
 * - Generic extraction (preserves all text)
 * 
 * Usage:
 *   npx tsx scripts/parsePdfWithVision.ts --input data/pdf-source/space-wolves.pdf --faction "Space Marines" --detachment "Saga of the Beastslayer"
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import OpenAI from 'openai';
import cliProgress from 'cli-progress';
import { createCanvas } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MARKDOWN_OUTPUT_DIR = path.join(process.cwd(), 'data', 'rules-source');

// ============================================
// PDF to Image Conversion (Pure JS)
// ============================================

async function convertPdfPageToImage(
  pdfPath: string,
  pageNumber: number
): Promise<string> {
  // Load PDF document
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  
  // Get specific page
  const page = await pdfDoc.getPage(pageNumber);
  
  // Set up canvas with high resolution
  const scale = 2.0; // 2x for high quality
  const viewport = page.getViewport({ scale });
  
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  // Render page to canvas
  const renderContext = {
    canvasContext: context as any,
    viewport: viewport
  };
  
  await page.render(renderContext).promise;
  
  // Convert canvas to base64 PNG
  const base64Image = canvas.toDataURL('image/png').split(',')[1];
  
  return base64Image;
}

async function getTotalPages(pdfPath: string): Promise<number> {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  return pdfDoc.numPages;
}

// ============================================
// Vision OCR with GPT-5
// ============================================

async function extractTextFromImage(
  base64Image: string,
  pageNumber: number,
  context: { faction?: string; detachment?: string; }
): Promise<string> {
  const imageUrl = `data:image/png;base64,${base64Image}`;
  
  const systemPrompt = `You are an expert at extracting text from Warhammer 40,000 rulebook pages.

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

${context.faction ? `Context: This is from ${context.faction} content` : ''}
${context.detachment ? `Context: This is from the ${context.detachment} detachment` : ''}

Focus on accuracy and completeness. The extracted text will be parsed and structured later.`;

  try {
    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: systemPrompt,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Extract all text from this rulebook page. Preserve exact wording and structure.'
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high'
            }
          ]
        }
      ],
    });
    
    const extractedText = response.output_text || '';
    
    if (extractedText.includes('NO_RULES_FOUND')) {
      console.log(`  ⏭️  Page ${pageNumber}: No rules (skipped)`);
      return '';
    }
    
    console.log(`  ✓ Page ${pageNumber}: Text extracted (${extractedText.length} chars)`);
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Error processing page ${pageNumber}:`, error);
    return '';
  }
}

// ============================================
// Main Processing Function
// ============================================

async function processPdfToMarkdown(
  pdfPath: string,
  outputPath: string,
  context: { faction?: string; detachment?: string; }
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📚 PDF Parser - Pure TypeScript with GPT-5 Vision');
  console.log('='.repeat(60));
  console.log(`Input:  ${pdfPath}`);
  console.log(`Output: ${outputPath}`);
  if (context.faction) console.log(`Faction: ${context.faction}`);
  if (context.detachment) console.log(`Detachment: ${context.detachment}`);
  console.log('='.repeat(60));
  
  // Get total pages
  const totalPages = await getTotalPages(pdfPath);
  console.log(`\n📄 PDF has ${totalPages} page(s)`);
  
  // Process each page
  const allExtractedText: string[] = [];
  const progressBar = new cliProgress.SingleBar({
    format: 'Processing Pages |{bar}| {percentage}% | {value}/{total} pages',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
  
  progressBar.start(totalPages, 0);
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      // Convert page to image
      const base64Image = await convertPdfPageToImage(pdfPath, pageNum);
      
      // Extract text with Vision API
      const extracted = await extractTextFromImage(base64Image, pageNum, context);
      
      if (extracted) {
        allExtractedText.push(extracted);
      }
      
      progressBar.update(pageNum);
      
      // Rate limiting - wait between API calls
      if (pageNum < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error) {
      console.error(`\n❌ Error on page ${pageNum}:`, error);
      progressBar.update(pageNum);
    }
  }
  
  progressBar.stop();
  
  // Combine and write to markdown file
  const header = `# ${context.detachment || context.faction || 'Game'} Rules

Extracted from: ${path.basename(pdfPath)}
Date: ${new Date().toLocaleDateString()}
Total Pages: ${totalPages}
Pages with Content: ${allExtractedText.length}
${context.faction ? `Faction: ${context.faction}` : ''}
${context.detachment ? `Detachment: ${context.detachment}` : ''}

Note: This is raw extracted text. Run through importStrategicRules.ts to parse and structure.

---

`;
  
  const markdownContent = header + allExtractedText.join('\n\n---\n\n');
  
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, markdownContent, 'utf-8');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ PDF Extraction Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Statistics:`);
  console.log(`   - Total pages: ${totalPages}`);
  console.log(`   - Pages with content: ${allExtractedText.length}`);
  console.log(`   - Total characters: ${markdownContent.length.toLocaleString()}`);
  console.log(`   - Output file: ${outputPath}`);
  console.log('');
  console.log('Next steps:');
  console.log(`   1. Review extracted text: ${outputPath}`);
  console.log(`   2. Edit/clean up if needed`);
  console.log(`   3. Import with AI parser:`);
  console.log(`      npx tsx scripts/importStrategicRules.ts --file ${path.basename(outputPath)}${context.faction ? ` --faction "${context.faction}"` : ''}${context.detachment ? ` --detachment "${context.detachment}"` : ''}`);
  console.log('');
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : null;
  };
  
  const inputPdf = getArg('--input');
  const outputMd = getArg('--output');
  const faction = getArg('--faction');
  const detachment = getArg('--detachment');
  
  // Validate arguments
  if (!inputPdf) {
    console.error('❌ Missing required argument: --input');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/parsePdfWithVision.ts --input <pdf-file> [--output <markdown-file>] [--faction <name>] [--detachment <name>]');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/parsePdfWithVision.ts --input data/pdf-source/space-wolves.pdf --faction "Space Marines" --detachment "Saga of the Beastslayer"');
    console.log('  npx tsx scripts/parsePdfWithVision.ts --input data/pdf-source/tyranids.pdf --faction "Tyranids" --detachment "Subterranean Assault"');
    console.log('  npx tsx scripts/parsePdfWithVision.ts --input data/pdf-source/core-rules.pdf --output core-stratagems.md');
    process.exit(1);
  }
  
  // Resolve paths
  const pdfPath = path.isAbsolute(inputPdf) ? inputPdf : path.join(process.cwd(), inputPdf);
  
  if (!await fs.pathExists(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  // Auto-generate output filename if not specified
  const defaultOutput = path.join(
    MARKDOWN_OUTPUT_DIR,
    path.basename(inputPdf, '.pdf') + '.md'
  );
  const outputPath = outputMd 
    ? (path.isAbsolute(outputMd) ? outputMd : path.join(process.cwd(), outputMd))
    : defaultOutput;
  
  // Process PDF
  await processPdfToMarkdown(pdfPath, outputPath, {
    faction,
    detachment
  });
}

// ============================================
// Run
// ============================================

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

