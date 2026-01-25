import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/apiAuth';
import { getAllSecondaries } from '@/lib/secondaryRules';

/**
 * GET /api/secondaries
 * 
 * Fetch all available secondary objectives
 * Reads from JSON file with full Fixed/Tactical VP structures
 */
export async function GET() {
  try {
    // Require authentication
    await requireAuth();

    // Get all secondaries from JSON file (via secondaryRules)
    const secondariesData = getAllSecondaries();

    // Transform to API response format
    const secondaries = secondariesData.map(sec => ({
      // Core identification
      name: sec.name,
      description: sec.description,
      fullRules: sec.fullRules,
      
      // Mission type info
      missionType: sec.missionType, // "tactical", "fixed", or "both"
      category: sec.missionType === 'tactical' ? 'Tactical' : sec.missionType === 'fixed' ? 'Fixed' : 'Both',
      type: sec.scoringType, // "unit_destruction", "objective_control", etc.
      
      // Scoring configuration
      scoringType: sec.scoringType,
      scoringTiming: sec.scoringTiming,
      completesOnScore: sec.completesOnScore,
      
      // VP limits
      maxVP: sec.maxVP,
      vpPerTurnCap: sec.vpPerTurnCap,
      maxVPTotal: sec.maxVP || 20,
      maxVPPerTurn: sec.vpPerTurnCap,
      
      // Fixed vs Tactical scoring
      fixedScoring: sec.fixedScoring,
      tacticalScoring: sec.tacticalScoring,
      
      // VP Calculation (derived from fixedScoring/tacticalScoring)
      vpCalculation: sec.fixedScoring ? {
        type: sec.fixedScoring.perUnit ? 'per_unit' : 'threshold',
        thresholds: sec.fixedScoring.options || [],
        vpPerUnit: sec.fixedScoring.options?.[0]?.vp || null,
        fixedVP: null
      } : (sec.tacticalScoring ? {
        type: sec.tacticalScoring.perUnit ? 'per_unit' : 'threshold',
        thresholds: sec.tacticalScoring.options || [],
        vpPerUnit: sec.tacticalScoring.options?.[0]?.vp || null,
        fixedVP: null
      } : null),
      
      // Round restrictions
      roundRestrictions: sec.roundRestrictions,
      
      // Target selection (Marked for Death, Tempting Target)
      requiresTargetSelection: sec.requiresTargetSelection,
      targetSelectionRules: sec.targetSelectionRules,
      
      // Action requirements (Cleanse, Establish Locus, etc.)
      requiresAction: sec.requiresAction,
      actionDetails: sec.actionDetails,
      
      // Scoring trigger (derived from scoringType)
      scoringTrigger: sec.scoringType === 'unit_destruction' 
        ? 'Unit destroyed' 
        : sec.scoringType === 'objective_control'
        ? 'Control objectives'
        : sec.requiresAction 
        ? 'Complete action'
        : 'Position check',
      
      // Tournament restrictions
      tournamentRestricted: sec.tournamentRestricted,
      tournamentRestriction: sec.tournamentRestriction,
    }));

    return NextResponse.json({
      success: true,
      count: secondaries.length,
      secondaries
    });

  } catch (error: any) {
    console.error('Error fetching secondaries:', error);

    // Handle auth errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch secondaries' },
      { status: 500 }
    );
  }
}
