/**
 * Image Rules Parser - Vision OCR (No System Dependencies)
 * 
 * Extracts Warhammer 40K stratagems from pre-converted images using GPT-4 Vision.
 * Use this if you can't install GraphicsMagick/Ghostscript or prefer to convert PDFs manually.
 * 
 * Usage:
 *   npx tsx scripts/parseImageRules.ts --input data/pdf-images/space-marines/ --output space-marines.md --faction "Space Marines" --detachment "Saga of the Beastslayer"
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import OpenAI from 'openai';
import cliProgress from 'cli-progress';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// Vision OCR with GPT-4
// ============================================

async function extractStrategemsFromImage(
  imagePath: string,
  pageNumber: number,
  context: { faction?: string; detachment?: string; }
): Promise<string> {
  console.log(`🤖 Processing: ${path.basename(imagePath)}`);
  
  // Read image and convert to base64
  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  // Detect image format
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const imageUrl = `data:${mimeType};base64,${base64Image}`;
  
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
              text: 'Extract all text from this rulebook page. Preserve exact wording and structure.'
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
      console.log(`  ⏭️  Skipped (no rules found)`);
      return '';
    }
    
    const count = countStratagems(extractedText);
    if (count > 0) {
      console.log(`  ✓ Extracted ${count} rule(s)`);
    } else {
      console.log(`  ✓ Text extracted`);
    }
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(imagePath)}:`, error);
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

async function processImagesToMarkdown(
  inputDir: string,
  outputPath: string,
  context: { faction?: string; detachment?: string; }
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🖼️  Image Rules Parser - Vision OCR');
  console.log('='.repeat(60));
  console.log(`Input:  ${inputDir}`);
  console.log(`Output: ${outputPath}`);
  if (context.faction) console.log(`Faction: ${context.faction}`);
  if (context.detachment) console.log(`Detachment: ${context.detachment}`);
  console.log('='.repeat(60));
  
  // Find all image files
  const allFiles = await fs.readdir(inputDir);
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];
  const imageFiles = allFiles
    .filter(file => imageExtensions.some(ext => file.endsWith(ext)))
    .sort() // Sort alphabetically for consistent ordering
    .map(file => path.join(inputDir, file));
  
  if (imageFiles.length === 0) {
    console.error('❌ No image files found in directory');
    console.log('\nSupported formats: PNG, JPG, JPEG');
    console.log(`\nPlace your images in: ${inputDir}`);
    return;
  }
  
  console.log(`\n📊 Found ${imageFiles.length} image(s)`);
  
  // Extract stratagems from each image
  const allStratagems: string[] = [];
  const progressBar = new cliProgress.SingleBar({
    format: 'Processing Images |{bar}| {percentage}% | {value}/{total} images',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
  
  progressBar.start(imageFiles.length, 0);
  
  for (let i = 0; i < imageFiles.length; i++) {
    const imagePath = imageFiles[i];
    const pageNumber = i + 1;
    
    const extracted = await extractStrategemsFromImage(imagePath, pageNumber, context);
    
    if (extracted) {
      allStratagems.push(extracted);
    }
    
    progressBar.update(i + 1);
    
    // Rate limiting - wait between API calls
    if (i < imageFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  progressBar.stop();
  
  // Combine and write to markdown file
  const header = `# ${context.detachment || context.faction || 'Game'} Rules

Extracted from: ${path.basename(inputDir)}
Date: ${new Date().toLocaleDateString()}
${context.faction ? `Faction: ${context.faction}` : ''}
${context.detachment ? `Detachment: ${context.detachment}` : ''}

Note: This is raw extracted text. Run through importStrategicRules.ts to parse and structure.

---

`;
  
  const markdownContent = header + allStratagems.join('\n\n---\n\n');
  
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, markdownContent, 'utf-8');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Image Extraction Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Statistics:`);
  console.log(`   - Images processed: ${imageFiles.length}`);
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
  
  const inputDir = getArg('--input');
  const outputMd = getArg('--output');
  const faction = getArg('--faction');
  const detachment = getArg('--detachment');
  
  // Validate arguments
  if (!inputDir) {
    console.error('❌ Missing required argument: --input');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/parseImageRules.ts --input <image-directory> --output <markdown-file> [--faction <name>] [--detachment <name>]');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/parseImageRules.ts --input data/pdf-images/core-rules/ --output core-stratagems.md');
    console.log('  npx tsx scripts/parseImageRules.ts --input data/pdf-images/space-marines/ --output space-marines-saga.md --faction "Space Marines" --detachment "Saga of the Beastslayer"');
    console.log('  npx tsx scripts/parseImageRules.ts --input data/pdf-images/tyranids/ --output tyranids-subterranean.md --faction "Tyranids" --detachment "Subterranean Assault"');
    process.exit(1);
  }
  
  // Resolve paths
  const imageDirPath = path.isAbsolute(inputDir) ? inputDir : path.join(process.cwd(), inputDir);
  
  if (!await fs.pathExists(imageDirPath)) {
    console.error(`❌ Directory not found: ${imageDirPath}`);
    console.log('\nCreate the directory and place your images there:');
    console.log(`  mkdir -p ${imageDirPath}`);
    process.exit(1);
  }
  
  // Default output path
  const defaultOutput = path.join(
    process.cwd(),
    'data',
    'rules-source',
    path.basename(imageDirPath) + '.md'
  );
  const outputPath = outputMd 
    ? (path.isAbsolute(outputMd) ? outputMd : path.join(process.cwd(), outputMd))
    : defaultOutput;
  
  // Process images
  await processImagesToMarkdown(imageDirPath, outputPath, {
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

