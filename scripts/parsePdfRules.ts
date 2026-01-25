/**
 * PDF Rules Parser - LLM Vision OCR
 * 
 * Converts Warhammer 40K PDF rulebooks into structured markdown using GPT-4 Vision.
 * 
 * Features:
 * - Converts PDF pages to images
 * - Uses GPT-4 Vision to extract stratagem text with perfect formatting
 * - Handles complex layouts, tables, and multi-column text
 * - Outputs markdown files ready for import
 * 
 * Usage:
 *   npx tsx scripts/parsePdfRules.ts --input core-rules.pdf --output core-stratagems.md
 *   npx tsx scripts/parsePdfRules.ts --input space-wolves.pdf --output space-wolves-saga-beastslayer.md --faction "Space Marines" --detachment "Saga of the Beastslayer"
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import OpenAI from 'openai';
import { fromPath } from 'pdf2pic';
import cliProgress from 'cli-progress';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PDF_SOURCE_DIR = path.join(process.cwd(), 'data', 'pdf-source');
const MARKDOWN_OUTPUT_DIR = path.join(process.cwd(), 'data', 'rules-source');

// ============================================
// PDF to Image Conversion
// ============================================

interface PdfToImageOptions {
  density: number;
  format: 'png' | 'jpg';
  width: number;
  height: number;
}

async function convertPdfPagesToImages(
  pdfPath: string,
  outputDir: string
): Promise<string[]> {
  console.log(`\n📄 Converting PDF to images: ${path.basename(pdfPath)}`);
  
  // Ensure output directory exists
  await fs.ensureDir(outputDir);
  
  const options: PdfToImageOptions = {
    density: 300,        // High DPI for better OCR
    format: 'png',
    width: 2000,         // High resolution
    height: 2800,
  };
  
  const converter = fromPath(pdfPath, options);
  
  // Get total page count (we'll convert all pages)
  const imagePaths: string[] = [];
  
  try {
    // Convert pages (pdf2pic uses 1-based indexing)
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      try {
        const result = await converter(pageNum, { responseType: 'image' });
        
        if (result.page && result.path) {
          imagePaths.push(result.path);
          console.log(`  ✓ Page ${pageNum} converted`);
          pageNum++;
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        // Reached end of PDF
        hasMorePages = false;
      }
    }
    
    console.log(`✅ Converted ${imagePaths.length} pages`);
    return imagePaths;
    
  } catch (error) {
    console.error('❌ Error converting PDF:', error);
    throw error;
  }
}

// ============================================
// Vision OCR with GPT-4
// ============================================

async function extractStrategemsFromImage(
  imagePath: string,
  pageNumber: number,
  context: { faction?: string; detachment?: string; }
): Promise<string> {
  console.log(`\n🤖 Extracting stratagems from page ${pageNumber}...`);
  
  // Read image and convert to base64
  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
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

${context.faction ? `Context: This is from ${context.faction} content` : ''}
${context.detachment ? `Context: This is from the ${context.detachment} detachment` : ''}

Focus on accuracy and completeness. The extracted text will be parsed and structured later.`;

  try {
    const response = await openai.responses.create({
      model: 'gpt-5-mini', // GPT-5-mini with vision
      instructions: systemPrompt,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Extract all stratagems from this rulebook page in the specified markdown format.'
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high' // High detail for better text recognition
            }
          ]
        }
      ],
    });
    
    const extractedText = response.output_text || '';
    
    if (extractedText.includes('NO_RULES_FOUND')) {
      console.log(`  ⏭️  Page ${pageNumber}: No rules found (skipped)`);
      return '';
    }
    
    const ruleCount = countStratagems(extractedText);
    if (ruleCount > 0) {
      console.log(`  ✓ Page ${pageNumber}: Extracted ${ruleCount} rule(s)`);
    } else {
      console.log(`  ✓ Page ${pageNumber}: Text extracted`);
    }
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Error processing page ${pageNumber}:`, error);
    return '';
  }
}

function countStratagems(markdown: string): number {
  const matches = markdown.match(/^## .+\(\d+\s*CP\)/gm);
  return matches ? matches.length : 0;
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
  console.log('📚 PDF Rules Parser - Vision OCR');
  console.log('='.repeat(60));
  console.log(`Input:  ${pdfPath}`);
  console.log(`Output: ${outputPath}`);
  if (context.faction) console.log(`Faction: ${context.faction}`);
  if (context.detachment) console.log(`Detachment: ${context.detachment}`);
  console.log('='.repeat(60));
  
  // Step 1: Convert PDF to images
  const tempDir = path.join(process.cwd(), 'temp', 'pdf-images', Date.now().toString());
  const imagePaths = await convertPdfPagesToImages(pdfPath, tempDir);
  
  if (imagePaths.length === 0) {
    console.error('❌ No pages converted from PDF');
    return;
  }
  
  // Step 2: Extract stratagems from each page using Vision API
  const allStratagems: string[] = [];
  const progressBar = new cliProgress.SingleBar({
    format: 'Processing Pages |{bar}| {percentage}% | {value}/{total} pages',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
  
  progressBar.start(imagePaths.length, 0);
  
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const pageNumber = i + 1;
    
    const extracted = await extractStrategemsFromImage(imagePath, pageNumber, context);
    
    if (extracted) {
      allStratagems.push(extracted);
    }
    
    progressBar.update(i + 1);
    
    // Rate limiting - wait between API calls
    if (i < imagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  progressBar.stop();
  
  // Step 3: Combine and write to markdown file
  const header = `# ${context.detachment || context.faction || 'Game'} Rules

Extracted from: ${path.basename(pdfPath)}
Date: ${new Date().toLocaleDateString()}
${context.faction ? `Faction: ${context.faction}` : ''}
${context.detachment ? `Detachment: ${context.detachment}` : ''}

Note: This is raw extracted text. Run through importStrategicRules.ts to parse and structure.

---

`;
  
  const markdownContent = header + allStratagems.join('\n\n---\n\n');
  
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, markdownContent, 'utf-8');
  
  // Step 4: Clean up temp images
  try {
    await fs.remove(tempDir);
    console.log('\n🧹 Cleaned up temporary files');
  } catch (error) {
    console.warn('⚠️  Could not clean up temp directory:', tempDir);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ PDF Extraction Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Statistics:`);
  console.log(`   - Pages processed: ${imagePaths.length}`);
  console.log(`   - Pages with content: ${allStratagems.length}`);
  console.log(`   - Rules detected: ~${countStratagems(markdownContent)}`);
  console.log(`   - Output file: ${outputPath}`);
  console.log('');
  console.log('Next steps:');
  console.log(`   1. Review extracted text: ${outputPath}`);
  console.log(`   2. Edit/clean up if needed`);
  console.log(`   3. Import with AI parser: npx tsx scripts/importStrategicRules.ts --file ${path.basename(outputPath)}${context.faction ? ` --faction "${context.faction}"` : ''}${context.detachment ? ` --detachment "${context.detachment}"` : ''}`);
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
    console.log('  npx tsx scripts/parsePdfRules.ts --input <pdf-file> --output <markdown-file> [--faction <name>] [--detachment <name>]');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/parsePdfRules.ts --input data/pdf-source/core-rules.pdf --output core-stratagems.md');
    console.log('  npx tsx scripts/parsePdfRules.ts --input data/pdf-source/space-wolves.pdf --output space-wolves-saga.md --faction "Space Marines" --detachment "Saga of the Beastslayer"');
    process.exit(1);
  }
  
  // Resolve paths
  const pdfPath = path.isAbsolute(inputPdf) ? inputPdf : path.join(process.cwd(), inputPdf);
  
  if (!await fs.pathExists(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  // Default output path
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

