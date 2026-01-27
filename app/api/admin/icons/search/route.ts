import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const customsearch = google.customsearch('v1');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    const missing = [];
    if (!apiKey) missing.push('API Key (GOOGLE_SEARCH_API_KEY or GOOGLE_API_KEY)');
    if (!cx) missing.push('CX (Search Engine ID) - GOOGLE_SEARCH_CX');
    
    return NextResponse.json(
      { 
        error: `Google Search API not configured. Missing: ${missing.join(', ')}`,
        setupInstructions: !cx ? {
          title: 'How to get Google Custom Search Engine ID (CX)',
          steps: [
            '1. Go to https://programmablesearchengine.google.com/',
            '2. Click "Add" to create a new search engine',
            '3. Enter a name and description',
            '4. Under "Sites to search", enter: * (to search the entire web)',
            '5. Click "Create"',
            '6. Go to "Control Panel" → "Setup" → "Basics"',
            '7. Copy the "Search engine ID" (starts with a string like "012345678901234567890:abcdefghijk")',
            '8. Add it to your .env.local as: GOOGLE_SEARCH_CX=your_search_engine_id',
            '9. Enable the "Custom Search API" in Google Cloud Console for your project',
            '10. Restart your development server'
          ]
        } : undefined
      },
      { status: 500 }
    );
  }

  try {
    console.log(`🔍 Searching Google Images for: "${query}" (CX: ${cx})`);
    
    const res = await customsearch.cse.list({
      cx,
      q: query,
      auth: apiKey,
      searchType: 'image',
      num: 10, // Return top 10 results
      // safe: 'active', // Removing 'safe' temporarily as it sometimes conflicts with settings
    });

    const items = res.data.items || [];

    const images = items.map((item) => ({
      link: item.link,
      thumbnail: item.image?.thumbnailLink || item.link,
      title: item.title,
      contextLink: item.image?.contextLink,
    }));

    return NextResponse.json({ images });
  } catch (error: any) {
    // Log error code/status only (not full response which may contain sensitive data)
    const errorCode = error.response?.status || error.code || 'UNKNOWN';
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    console.error(`Google Search API Error: code=${errorCode}, message=${errorMessage.substring(0, 100)}`);

    // Return generic error to client
    return NextResponse.json(
      { error: 'Failed to fetch images. Please try again later.' },
      { status: 500 }
    );
  }
}
