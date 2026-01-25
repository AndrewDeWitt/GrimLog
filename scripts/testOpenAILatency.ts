/**
 * OpenAI API Latency Test
 * 
 * Tests direct OpenAI API calls to diagnose performance issues
 * 
 * Usage: npx tsx scripts/testOpenAILatency.ts
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testAPILatency() {
  console.log('\n🔍 Testing OpenAI API Latency...\n');
  console.log('═══════════════════════════════════════════════\n');
  
  // Test 1: GPT-5-nano simple call
  console.log('TEST 1: GPT-5-nano (simple classification)');
  console.log('─────────────────────────────────────────────\n');
  console.time('└─ GPT-5-nano latency');
  
  try {
    const nanoResponse = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: 'Classify if this is game-related.',
      input: 'my terminators took 5 damage',
      text: {
        format: {
          type: 'json_schema',
          name: 'classification',
          schema: {
            type: 'object',
            properties: {
              isGameRelated: { type: 'boolean' },
              reasoning: { type: 'string' }
            },
            required: ['isGameRelated', 'reasoning'],
            additionalProperties: false
          },
          strict: true
        }
      }
    });
    
    console.timeEnd('└─ GPT-5-nano latency');
    console.log('✅ Success:', nanoResponse.output_text);
    console.log('');
    
  } catch (error) {
    console.timeEnd('└─ GPT-5-nano latency');
    console.error('❌ Failed:', error);
    console.log('');
  }
  
  // Test 2: GPT-5-mini simple call
  console.log('TEST 2: GPT-5-mini (simple call)');
  console.log('─────────────────────────────────────────────\n');
  console.time('└─ GPT-5-mini latency');
  
  try {
    const miniResponse = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: 'You are a helpful assistant.',
      input: 'Say hello'
    });
    
    console.timeEnd('└─ GPT-5-mini latency');
    console.log('✅ Success:', miniResponse.output_text?.substring(0, 100));
    console.log('');
    
  } catch (error) {
    console.timeEnd('└─ GPT-5-mini latency');
    console.error('❌ Failed:', error);
    console.log('');
  }
  
  // Test 3: GPT-5-mini with tools
  console.log('TEST 3: GPT-5-mini (with tools - like main analysis)');
  console.log('─────────────────────────────────────────────\n');
  console.time('└─ GPT-5-mini with tools latency');
  
  try {
    const toolsResponse = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: 'You are a game tracker. Call tools when appropriate.',
      input: 'change to shooting phase',
      tools: [
        {
          type: 'function',
          name: 'change_phase',
          description: 'Change game phase',
          parameters: {
            type: 'object',
            properties: {
              new_phase: {
                type: 'string',
                enum: ['Command', 'Movement', 'Shooting', 'Charge', 'Fight']
              }
            },
            required: ['new_phase'],
            additionalProperties: false
          }
        }
      ],
      parallel_tool_calls: true
    });
    
    console.timeEnd('└─ GPT-5-mini with tools latency');
    console.log('✅ Success - Tool calls:', toolsResponse.output.filter((o: any) => o.type === 'function_call').length);
    console.log('');
    
  } catch (error) {
    console.timeEnd('└─ GPT-5-mini with tools latency');
    console.error('❌ Failed:', error);
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════\n');
  console.log('💡 WHAT TO LOOK FOR:\n');
  console.log('  ✅ GOOD:  Each test < 2 seconds');
  console.log('  ⚠️  SLOW:  Tests taking 5-10+ seconds');
  console.log('  ❌ BAD:   Tests timing out or failing\n');
  console.log('If tests are SLOW:');
  console.log('  1. Check your OpenAI dashboard for rate limits');
  console.log('  2. Check your network connection');
  console.log('  3. Check your OpenAI API tier/quota');
  console.log('  4. Try a different network/VPN\n');
  console.log('═══════════════════════════════════════════════\n');
}

testAPILatency().catch(console.error);

