/**
 * One-time Langfuse Model Pricing Setup Script
 *
 * This script configures Gemini model pricing in Langfuse so that token counts
 * are automatically converted to cost calculations.
 *
 * Run once per Langfuse project (or when Gemini pricing changes).
 *
 * Usage: npx tsx scripts/setup-langfuse-models.ts
 */

import 'dotenv/config';

const LANGFUSE_HOST = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

interface ModelConfig {
  modelName: string;
  matchPattern: string;
  inputPrice: number;  // Price per token (not per 1M)
  outputPrice: number; // Price per token (not per 1M)
  unit: 'TOKENS';
}

// Gemini pricing as of 2025
// Prices are per token (original is per 1M tokens)
const MODELS: ModelConfig[] = [
  {
    modelName: 'gemini-3-flash-preview',
    matchPattern: '(?i)^(gemini-3-flash-preview)$',
    inputPrice: 0.0000005,  // $0.50 per 1M tokens = $0.0000005 per token
    outputPrice: 0.000003,  // $3.00 per 1M tokens = $0.000003 per token
    unit: 'TOKENS'
  },
  {
    modelName: 'gemini-3-pro-preview',
    matchPattern: '(?i)^(gemini-3-pro-preview)$',
    inputPrice: 0.000002,   // $2.00 per 1M tokens = $0.000002 per token
    outputPrice: 0.000012,  // $12.00 per 1M tokens = $0.000012 per token
    unit: 'TOKENS'
  },
  // Add older model names that might still be in use
  {
    modelName: 'gemini-2.5-flash-preview-05-20',
    matchPattern: '(?i)^(gemini-2\\.5-flash.*)$',
    inputPrice: 0.0000005,  // Same as flash pricing
    outputPrice: 0.000003,
    unit: 'TOKENS'
  }
];

async function setupModels() {
  console.log('Setting up Langfuse model pricing...');
  console.log(`Langfuse host: ${LANGFUSE_HOST}`);
  console.log('');

  // Check required env vars
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.error('Error: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be set');
    process.exit(1);
  }

  const authHeader = `Basic ${Buffer.from(
    `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`
  ).toString('base64')}`;

  for (const model of MODELS) {
    try {
      const response = await fetch(`${LANGFUSE_HOST}/api/public/models`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelName: model.modelName,
          matchPattern: model.matchPattern,
          inputPrice: model.inputPrice,
          outputPrice: model.outputPrice,
          unit: model.unit
        })
      });

      if (response.ok) {
        console.log(`${model.modelName}: Created successfully`);
      } else if (response.status === 409) {
        // Model already exists - try to update it
        console.log(`${model.modelName}: Already exists, attempting update...`);

        // First, get existing models to find the ID
        const listResponse = await fetch(`${LANGFUSE_HOST}/api/public/models`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          }
        });

        if (listResponse.ok) {
          const models = await listResponse.json();
          const existingModel = models.data?.find((m: any) => m.modelName === model.modelName);

          if (existingModel) {
            // Update the existing model
            const updateResponse = await fetch(`${LANGFUSE_HOST}/api/public/models/${existingModel.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                inputPrice: model.inputPrice,
                outputPrice: model.outputPrice
              })
            });

            if (updateResponse.ok) {
              console.log(`${model.modelName}: Updated successfully`);
            } else {
              console.log(`${model.modelName}: Update failed (${updateResponse.status})`);
            }
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`${model.modelName}: Failed (${response.status}) - ${errorText}`);
      }
    } catch (error) {
      console.error(`${model.modelName}: Error -`, error);
    }
  }

  console.log('');
  console.log('Model pricing setup complete!');
  console.log('');
  console.log('Pricing configured:');
  console.log('- gemini-3-flash-preview: $0.50/1M input, $3.00/1M output');
  console.log('- gemini-3-pro-preview: $2.00/1M input, $12.00/1M output');
  console.log('- gemini-2.5-flash*: $0.50/1M input, $3.00/1M output');
  console.log('');
  console.log('Langfuse will now automatically calculate costs from token counts.');
}

setupModels().catch(console.error);
