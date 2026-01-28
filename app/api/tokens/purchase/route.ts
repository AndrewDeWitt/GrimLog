/**
 * Token Purchase API Endpoint (Stub)
 *
 * POST /api/tokens/purchase - Stub for future payment integration
 *
 * Currently returns a "coming soon" message.
 * Will be integrated with Stripe or similar payment provider later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

// Token bundle options (for display purposes)
export const TOKEN_BUNDLES = [
  {
    id: 'bundle_10',
    tokens: 10,
    price: 1.99,
    priceDisplay: '$1.99',
    description: '10 Tokens',
    popular: false,
  },
  {
    id: 'bundle_25',
    tokens: 25,
    price: 3.99,
    priceDisplay: '$3.99',
    description: '25 Tokens',
    savings: '20% off',
    popular: true,
  },
  {
    id: 'bundle_50',
    tokens: 50,
    price: 6.99,
    priceDisplay: '$6.99',
    description: '50 Tokens',
    savings: '30% off',
    popular: false,
  },
  {
    id: 'bundle_100',
    tokens: 100,
    price: 11.99,
    priceDisplay: '$11.99',
    description: '100 Tokens',
    savings: '40% off',
    popular: false,
  },
];

// GET: Return available token bundles
export async function GET() {
  return NextResponse.json({
    success: true,
    bundles: TOKEN_BUNDLES,
    currency: 'USD',
    paymentEnabled: false, // Payment integration not yet implemented
    message: 'Token purchases coming soon! Contact support for early access.',
  });
}

// POST: Stub for purchase (returns coming soon message)
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    const body = await request.json();
    const { bundleId } = body;

    // Validate bundle exists
    const bundle = TOKEN_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) {
      return NextResponse.json(
        { error: 'Invalid bundle selected' },
        { status: 400 }
      );
    }

    // For now, return a "coming soon" message
    // In the future, this will:
    // 1. Create a Stripe checkout session
    // 2. Return the checkout URL
    // 3. Handle webhook for successful payment
    // 4. Grant tokens via grantTokens()

    return NextResponse.json({
      success: false,
      paymentEnabled: false,
      message: 'Token purchases are coming soon! Contact support for early access.',
      bundle: {
        id: bundle.id,
        tokens: bundle.tokens,
        price: bundle.price,
        priceDisplay: bundle.priceDisplay,
      },
      // userId removed - unnecessary exposure in API response
    }, { status: 503 }); // Service Unavailable

  } catch (error) {
    console.error('Token purchase error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process purchase request' },
      { status: 500 }
    );
  }
}
