/**
 * Dossier HTML Export
 * 
 * Generates a self-contained HTML file with the tactical dossier report.
 * Includes inline CSS, embedded Chart.js, and all analysis data.
 * Now includes role-based unit grouping and engagement scenarios.
 */

import {
  DossierAnalysis,
  TacticalRole,
  UnitEngagementProfile,
  DossierStrategicAnalysis,
  ViralInsights,
  ListSuggestion,
} from './dossierAnalysis';
import { ParsedArmyList } from './types';

// Role display configuration
const ROLE_CONFIG: Record<TacticalRole, { label: string; icon: string; color: string; description: string }> = {
  hammer: {
    label: 'HAMMERS',
    icon: '⚔️',
    color: '#b84a4a',
    description: 'Primary damage dealers',
  },
  anvil: {
    label: 'ANVILS',
    icon: '🛡️',
    color: '#60a5fa',
    description: 'Durable holders',
  },
  skirmisher: {
    label: 'SKIRMISHERS',
    icon: '⚡',
    color: '#fbbf24',
    description: 'Mobile harassment',
  },
  support: {
    label: 'SUPPORT',
    icon: '✨',
    color: '#a855f7',
    description: 'Force multipliers',
  },
  scoring: {
    label: 'SCORING',
    icon: '🎯',
    color: '#a8c5a0',
    description: 'Objective holders',
  },
  screening: {
    label: 'SCREENING',
    icon: '📍',
    color: '#4a4a4a',
    description: 'Cheap blockers',
  },
  utility: {
    label: 'UTILITY',
    icon: '🔧',
    color: '#22d3ee',
    description: 'Special tricks',
  },
  specialist: {
    label: 'SPECIALISTS',
    icon: '🎖️',
    color: '#f59e0b',
    description: 'Single-purpose units',
  },
};

// Synergy role colors for static visualization
const SYNERGY_ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  hammer: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#f87171' },
  anvil: { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#60a5fa' },
  skirmisher: { bg: 'rgba(234, 179, 8, 0.2)', border: '#eab308', text: '#fbbf24' },
  support: { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7', text: '#c084fc' },
  scoring: { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', text: '#4ade80' },
  screening: { bg: 'rgba(100, 116, 139, 0.2)', border: '#64748b', text: '#94a3b8' },
};

// Types for synergy export data
export interface SynergyExportData {
  connections: Array<{ from: string; to: string; bidirectional: boolean }>;
  activeUnits: string[];
  orphanUnits: Array<{ unitName: string; synergies: string[] }>;
  unitData: Map<string, { points: number; role?: string; tier?: string }>;
  stats: {
    totalConnections: number;
    unitsWithSynergies: number;
  };
}

/**
 * Fetch an image URL and convert to base64 data URL
 * Works in browser environment
 * Handles:
 * - Absolute URLs (http/https)
 * - Relative paths (e.g., /icons/...)
 * - Already base64 data URLs (returns as-is)
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  // If already a base64 data URL, return as-is
  if (url.startsWith('data:')) {
    return url;
  }
  
  // Convert relative paths to absolute URLs
  let absoluteUrl = url;
  if (url.startsWith('/')) {
    // In browser environment, use window.location.origin
    if (typeof window !== 'undefined') {
      absoluteUrl = `${window.location.origin}${url}`;
    } else {
      // In server environment, can't resolve relative paths
      console.warn('Cannot resolve relative URL in server environment:', url);
      return null;
    }
  }
  
  // Must be http or https at this point
  if (!absoluteUrl.startsWith('http')) {
    return null;
  }
  
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      console.warn('Failed to fetch image:', absoluteUrl, response.status);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn('Failed to read image as data URL:', absoluteUrl);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error fetching image:', absoluteUrl, error);
    return null;
  }
}

/**
 * Batch convert multiple image URLs to base64
 */
async function fetchImagesAsBase64(
  urls: Record<string, string | null>
): Promise<Record<string, string | null>> {
  const entries = Object.entries(urls);
  const results = await Promise.all(
    entries.map(async ([key, url]) => {
      const base64 = url ? await fetchImageAsBase64(url) : null;
      return [key, base64] as const;
    })
  );
  return Object.fromEntries(results);
}

/**
 * Generate a complete, self-contained HTML file for the dossier
 * All images are converted to base64 data URLs for offline viewing
 */
export async function generateDossierHTML(
  analysis: DossierAnalysis,
  armyList: ParsedArmyList,
  strategicAnalysis?: Partial<DossierStrategicAnalysis> | null,
  spiritIconUrl?: string | null,
  unitIcons?: Record<string, string | null>,
  synergyData?: SynergyExportData | null,
  listName?: string,
  listSuggestions?: ListSuggestion[]
): Promise<string> {
  const {
    faction,
    detachment,
    totalPoints,
    unitCount,
    modelCount,
    unitEngagementProfiles,
    collectionGaps,
    threatAssessment,
  } = analysis;

  const generatedDate = new Date().toLocaleDateString();
  const generatedTimestamp = new Date().toISOString();

  // Convert all images to base64 for embedding
  const spiritIconBase64 = spiritIconUrl ? await fetchImageAsBase64(spiritIconUrl) : null;
  const unitIconsBase64 = unitIcons ? await fetchImagesAsBase64(unitIcons) : {};

  // Generate unit profiles with embedded icons, AI tactical summaries, and AI role assignments
  const unitProfilesHTML = generateUnitProfilesHTML(
    unitEngagementProfiles, 
    faction, 
    unitIconsBase64, 
    strategicAnalysis?.unitTacticalSummaries,
    strategicAnalysis?.unitRoleAssignments
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tactical Dossier - ${listName || 'Army Analysis'}</title>
  <style>
    ${getInlineStyles()}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <h1 class="title">⚔ TACTICAL DOSSIER</h1>
        <p class="subtitle">Army Analysis Report • Generated ${generatedDate}</p>
      </div>
    </header>

    ${strategicAnalysis?.viralInsights ? generateViralInsightsHTML(strategicAnalysis.viralInsights, faction, detachment, totalPoints, unitCount, modelCount, spiritIconBase64) : ''}

    <!-- Strengths & Weaknesses -->
    ${(strategicAnalysis?.strategicStrengths?.length || strategicAnalysis?.strategicWeaknesses?.length || 
      threatAssessment.primaryStrengths.length || threatAssessment.primaryWeaknesses.length) ? `
      <section class="strengths-weaknesses-grid">
        <div class="sw-card strengths">
          <h3 class="sw-title green">✓ Strengths</h3>
          <ul>
            ${(strategicAnalysis?.strategicStrengths || []).slice(0, 4).map(s => `
              <li class="green">
                <strong>${s.title}</strong>
                ${s.relevantUnits?.length > 0 ? `<span class="units">(${s.relevantUnits.slice(0, 2).join(', ')})</span>` : ''}
              </li>
            `).join('')}
            ${threatAssessment.primaryStrengths.slice(0, strategicAnalysis?.strategicStrengths ? 0 : 4).map(s => `<li class="green">• ${s}</li>`).join('')}
          </ul>
        </div>
        <div class="sw-card weaknesses">
          <h3 class="sw-title red">⚠ Weaknesses</h3>
          <ul>
            ${(strategicAnalysis?.strategicWeaknesses || []).slice(0, 4).map(w => `
              <li class="${w.severity === 'critical' ? 'red' : w.severity === 'major' ? 'orange' : 'amber'}">
                <strong>${w.title}</strong>
                <span class="severity">(${w.severity})</span>
              </li>
            `).join('')}
            ${threatAssessment.primaryWeaknesses.slice(0, strategicAnalysis?.strategicWeaknesses ? 0 : 4).map(w => `<li class="red">• ${w}</li>`).join('')}
          </ul>
        </div>
      </section>
    ` : ''}

    <!-- Strategic Assessment -->
    ${strategicAnalysis ? `
      <section class="card full-width strategic-assessment">
        <div class="assessment-content">
          <span class="assessment-icon">🎖</span>
          <div class="assessment-text">
            <div class="assessment-header">
              <h2 class="card-title">Strategic Assessment</h2>
              ${strategicAnalysis.armyArchetype ? `
                <div class="archetype-tags">
                  <span class="archetype-tag primary">${strategicAnalysis.armyArchetype.primary.replace(/_/g, ' ')}</span>
                  <span class="archetype-tag secondary">${strategicAnalysis.armyArchetype.secondary.replace(/_/g, ' ')}</span>
                </div>
              ` : ''}
            </div>
            <p class="executive-summary">${strategicAnalysis.executiveSummary}</p>
          </div>
        </div>
      </section>
    ` : ''}

    <!-- Synergy Network -->
    ${synergyData && synergyData.connections.length > 0 ? generateSynergyNetworkHTML(synergyData) : ''}

    <!-- Unit Profiles by Role -->
    <section class="card full-width">
      <h2 class="card-title">📊 Unit Profiles by Role</h2>
      <p class="note">Click on a unit to see detailed weapon breakdowns and performance across toughness brackets.</p>
      ${unitProfilesHTML}
    </section>

    <!-- Collection Gaps -->
    ${collectionGaps.length > 0 ? `
      <section class="card full-width">
        <h2 class="card-title">📋 Collection Gaps & Recommendations</h2>
        <div class="gaps-grid">
          ${collectionGaps.map(gap => `
            <div class="gap-card priority-${gap.priority}">
              <div class="gap-header">
                <span class="priority-badge ${gap.priority}">${gap.priority.toUpperCase()}</span>
                <span class="gap-category">${gap.category}</span>
              </div>
              <p class="gap-issue">${gap.issue}</p>
              <p class="gap-suggestion">${gap.suggestion}</p>
              ${gap.potentialUnits && gap.potentialUnits.length > 0 ? `
                <p class="gap-units">Consider: ${gap.potentialUnits.join(', ')}</p>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    <!-- List Modification Suggestions -->
    ${listSuggestions && listSuggestions.length > 0 ? generateListSuggestionsHTML(listSuggestions, unitIconsBase64, faction) : ''}

    <!-- Footer -->
    <footer class="footer">
      <p>Generated by Grimlog Tactical Dossier Engine • ${generatedTimestamp}</p>
      <p>This analysis is based on mathematical averages and general tactical principles.</p>
      <p class="legal-disclaimer">
        This tool is an unofficial analysis assistant. Warhammer 40,000, Space Marines, 
        Space Wolves, and associated marks are trademarks of Games Workshop Limited. 
        This report is for commentary purposes only and is not endorsed by Games Workshop.
      </p>
    </footer>
  </div>

</body>
</html>`;
}

/**
 * Generate static synergy network HTML section
 * Matches the SynergyNetwork React component layout
 */
function generateSynergyNetworkHTML(synergyData: SynergyExportData): string {
  const { connections, activeUnits, orphanUnits, unitData, stats } = synergyData;
  
  if (connections.length === 0) {
    return '';
  }
  
  // Generate unit grid with synergy connections
  const unitGridHTML = activeUnits.map(unitName => {
    const data = unitData.get(unitName);
    const role = data?.role || 'scoring';
    const roleColors = SYNERGY_ROLE_COLORS[role] || SYNERGY_ROLE_COLORS.scoring;
    const unitConnections = connections.filter(c => c.from === unitName || c.to === unitName);
    const connectionCount = unitConnections.length;
    
    return `
      <div class="synergy-unit-card" style="background: ${roleColors.bg}; border-color: ${roleColors.border}">
        <div class="synergy-connection-badge">${connectionCount}</div>
        ${data?.tier ? `
          <div class="synergy-tier-badge tier-${data.tier.toLowerCase()}">${data.tier}</div>
        ` : ''}
        <p class="synergy-unit-name" style="color: ${roleColors.text}">${unitName}</p>
        <div class="synergy-unit-meta">
          <span class="synergy-unit-pts">${data?.points || 0}pts</span>
          ${data?.role ? `<span class="synergy-unit-role" style="color: ${roleColors.text}">${data.role.toUpperCase()}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Generate synergy connections list
  const connectionsListHTML = connections.slice(0, 10).map(conn => {
    return `
      <span class="synergy-connection">
        ${conn.from} ${conn.bidirectional ? '↔' : '→'} ${conn.to}
      </span>
    `;
  }).join('');
  
  // Generate role legend
  const legendHTML = Object.entries(SYNERGY_ROLE_COLORS).map(([role, colors]) => `
    <div class="synergy-legend-item">
      <div class="synergy-legend-color" style="background: ${colors.bg}; border-color: ${colors.border}"></div>
      <span style="color: ${colors.text}">${role}</span>
    </div>
  `).join('');
  
  // Generate orphan units section
  const orphanHTML = orphanUnits.length > 0 ? `
    <div class="synergy-orphans">
      <p class="synergy-orphans-title">💡 Synergy Opportunities (units not in list):</p>
      <div class="synergy-orphans-list">
        ${orphanUnits.slice(0, 4).map(unit => `
          <span class="synergy-orphan-item">
            <span class="synergy-orphan-unit">${unit.unitName}</span> works with 
            <span class="synergy-orphan-targets">${unit.synergies.slice(0, 2).join(', ')}</span>
          </span>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  return `
    <section class="card full-width synergy-network">
      <div class="synergy-header">
        <h2 class="card-title">🔗 Unit Synergies</h2>
        <div class="synergy-stats">
          <span><span class="synergy-stat-value">${stats.totalConnections}</span> active synergies</span>
          <span><span class="synergy-stat-value amber">${stats.unitsWithSynergies}</span> connected units</span>
        </div>
      </div>
      
      <div class="synergy-grid">
        ${unitGridHTML}
      </div>
      
      <div class="synergy-connections-list">
        ${connectionsListHTML}
      </div>
      
      <div class="synergy-legend">
        <span class="synergy-legend-label">Roles:</span>
        ${legendHTML}
      </div>
      
      ${orphanHTML}
    </section>
  `;
}

/**
 * Generate list modification suggestions HTML section
 */
function generateListSuggestionsHTML(
  suggestions: ListSuggestion[],
  unitIconsBase64: Record<string, string | null>,
  faction: string | null
): string {
  const suggestionsHTML = suggestions.map((suggestion, index) => {
    const priorityClass = suggestion.priority === 'high' ? 'priority-high' :
                          suggestion.priority === 'medium' ? 'priority-medium' : 'priority-low';

    // Generate remove units HTML with icons
    const removeUnitsHTML = (suggestion.removeUnits || []).map(unit => {
      const iconKey = `${faction || 'Unknown'}:${unit.name}`;
      const iconBase64 = unitIconsBase64[iconKey];
      const iconHTML = iconBase64
        ? `<img src="${iconBase64}" alt="${unit.name}" class="suggestion-unit-icon" />`
        : `<span class="suggestion-unit-icon-placeholder">−</span>`;

      return `
        <div class="suggestion-unit remove">
          ${iconHTML}
          <div class="suggestion-unit-info">
            <span class="suggestion-unit-name">${unit.name}</span>
            <span class="suggestion-unit-pts">${unit.points}pts</span>
          </div>
        </div>
      `;
    }).join('');

    // Generate add units HTML with icons
    const addUnitsHTML = (suggestion.addUnits || []).map(unit => {
      const iconKey = `${faction || 'Unknown'}:${unit.name}`;
      const iconBase64 = unitIconsBase64[iconKey];
      const iconHTML = iconBase64
        ? `<img src="${iconBase64}" alt="${unit.name}" class="suggestion-unit-icon" />`
        : `<span class="suggestion-unit-icon-placeholder">+</span>`;

      return `
        <div class="suggestion-unit add">
          ${iconHTML}
          <div class="suggestion-unit-info">
            <span class="suggestion-unit-name">${unit.name}</span>
            <span class="suggestion-unit-pts">${unit.points}pts</span>
          </div>
        </div>
      `;
    }).join('');

    // Generate enhancement additions HTML
    const enhancementsHTML = (suggestion.addEnhancements || []).map(enh => {
      return `
        <div class="suggestion-unit enhancement">
          <span class="suggestion-unit-icon-placeholder">★</span>
          <div class="suggestion-unit-info">
            <span class="suggestion-unit-name">${enh.name}</span>
            <span class="suggestion-unit-pts">${enh.points}pts</span>
            <span class="suggestion-unit-target">→ ${enh.targetCharacter}</span>
          </div>
        </div>
      `;
    }).join('');

    const pointsDeltaClass = suggestion.pointsDelta > 0 ? 'delta-positive' :
                             suggestion.pointsDelta < 0 ? 'delta-negative' : 'delta-neutral';
    const pointsDeltaStr = suggestion.pointsDelta > 0 ? `+${suggestion.pointsDelta}` : `${suggestion.pointsDelta}`;

    return `
      <div class="suggestion-card ${priorityClass}">
        <div class="suggestion-header">
          <div class="suggestion-header-left">
            <span class="suggestion-option">Option ${index + 1}</span>
            <span class="suggestion-priority">${suggestion.priority.toUpperCase()}</span>
            <span class="suggestion-title">${suggestion.title}</span>
          </div>
          <span class="suggestion-delta ${pointsDeltaClass}">${pointsDeltaStr} pts</span>
        </div>

        <div class="suggestion-content">
          <div class="suggestion-units-flow">
            ${removeUnitsHTML ? `
              <div class="suggestion-units-group remove-group">
                ${removeUnitsHTML}
              </div>
            ` : ''}
            ${removeUnitsHTML && (addUnitsHTML || enhancementsHTML) ? `<span class="suggestion-arrow">→</span>` : ''}
            ${addUnitsHTML ? `
              <div class="suggestion-units-group add-group">
                ${addUnitsHTML}
              </div>
            ` : ''}
            ${enhancementsHTML ? `
              <div class="suggestion-units-group enhancement-group">
                ${enhancementsHTML}
              </div>
            ` : ''}
          </div>

          <div class="suggestion-details">
            <div class="suggestion-addresses">
              <span class="detail-label">Addresses:</span>
              <span class="detail-value green">${suggestion.addressesGap}</span>
            </div>

            <div class="suggestion-tradeoffs">
              <span class="detail-label">Trade-offs:</span>
              <span class="detail-value muted">${suggestion.tradeoffs}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <section class="card full-width list-suggestions">
      <h2 class="card-title">🔄 List Modification Suggestions</h2>
      <p class="suggestions-intro">Two independent options to strengthen your army. <span class="amber">Pick one that fits your collection.</span></p>
      <div class="suggestions-grid">
        ${suggestionsHTML}
      </div>
    </section>
  `;
}

/**
 * Generate viral insights HTML section
 */
function generateViralInsightsHTML(
  viralInsights: ViralInsights,
  faction: string | null,
  detachment: string | null,
  totalPoints: number,
  unitCount: number,
  modelCount: number,
  spiritIconUrl?: string | null
): string {
  const funStatsHTML = viralInsights.funStats.slice(0, 2).map(stat => `
    <div class="fun-stat-card">
      <span class="fun-stat-emoji">${stat.emoji}</span>
      <span class="fun-stat-value">${stat.value}</span>
      <span class="fun-stat-name">${stat.name}</span>
      <span class="fun-stat-desc">${stat.description}</span>
    </div>
  `).join('');

  return `
    <!-- Army Spirit Section -->
    <section class="army-spirit">
      <div class="spirit-content">
        <div class="spirit-icon-container">
          ${spiritIconUrl
            ? `<img src="${spiritIconUrl}" alt="${viralInsights.tagline}" class="spirit-icon" />`
            : `<div class="spirit-icon-placeholder">⚔️</div>`
          }
        </div>

        <div class="spirit-identity">
          <h2 class="spirit-tagline">${viralInsights.tagline}</h2>
          <p class="spirit-faction">${faction || 'Unknown'} • ${detachment || 'Unknown Detachment'}</p>
          <p class="spirit-description">"${viralInsights.spiritDescription}"</p>
          <div class="spirit-stats">
            <span class="spirit-stat">${totalPoints} PTS</span>
            <span class="spirit-stat">${unitCount} UNITS</span>
            <span class="spirit-stat">${modelCount} MODELS</span>
          </div>
        </div>
      </div>

      <div class="fun-stats-section">
        <h3 class="section-title">Army Quirks</h3>
        <div class="fun-stats-grid">
          ${funStatsHTML}
        </div>
      </div>
    </section>
  `;
}

/**
 * Generate unit profiles HTML grouped by role
 */
function generateUnitProfilesHTML(
  profiles: UnitEngagementProfile[],
  faction: string | null,
  unitIconsBase64: Record<string, string | null>,
  unitTacticalSummaries?: Record<string, string>,
  unitRoleAssignments?: Record<string, { role: TacticalRole; reasoning: string }>
): string {
  // Group by role - use AI-assigned roles when available
  const byRole: Record<TacticalRole, UnitEngagementProfile[]> = {
    hammer: [],
    anvil: [],
    skirmisher: [],
    support: [],
    scoring: [],
    screening: [],
    utility: [],
    specialist: [],
  };
  
  for (const profile of profiles) {
    // Use AI-assigned role if available, otherwise fall back to local
    const role = unitRoleAssignments?.[profile.unitName]?.role || profile.tacticalRole.role;
    if (byRole[role]) {
      byRole[role].push(profile);
    }
  }
  
  const roles = Object.entries(byRole).filter(([_, units]) => units.length > 0);
  
  return roles.map(([role, units]) => {
    const config = ROLE_CONFIG[role as TacticalRole];
    return `
      <div class="role-section">
        <div class="role-header">
          <span class="role-icon-large">${config.icon}</span>
          <h3 class="role-title" style="color: ${config.color}">${config.label}</h3>
          <span class="role-description">— ${config.description}</span>
        </div>
        <div class="units-grid">
          ${units.map(unit => {
            const iconKey = `${faction || 'Unknown'}:${unit.unitName}`;
            const iconBase64 = unitIconsBase64[iconKey] || null;
            const tacticalSummary = unitTacticalSummaries?.[unit.unitName];
            const aiRole = unitRoleAssignments?.[unit.unitName];
            return generateUnitCardHTML(unit, iconBase64, tacticalSummary, aiRole);
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Get a placeholder emoji for a unit based on its role
 */
function getUnitPlaceholderEmoji(role: TacticalRole): string {
  return ROLE_CONFIG[role]?.icon || '⚔️';
}

/**
 * Generate individual unit card HTML with icon - simplified with AI tactical summary
 */
function generateUnitCardHTML(
  unit: UnitEngagementProfile, 
  iconBase64: string | null, 
  tacticalSummary?: string,
  aiRole?: { role: TacticalRole; reasoning: string }
): string {
  // Use AI-assigned role if available
  const effectiveRole = aiRole?.role || unit.tacticalRole.role;
  const roleConfig = ROLE_CONFIG[effectiveRole];
  
  // Generate icon HTML - either embedded image or placeholder emoji
  const iconHTML = iconBase64 
    ? `<img src="${iconBase64}" alt="${unit.unitName}" class="unit-icon" />`
    : `<div class="unit-icon-placeholder">${getUnitPlaceholderEmoji(effectiveRole)}</div>`;
  
  // Use AI tactical summary if available, otherwise fall back to AI reasoning or local reasoning
  const summaryText = tacticalSummary || aiRole?.reasoning || unit.tacticalRole.reasoning;
  
  return `
    <div class="unit-card">
      <div class="unit-header">
        ${iconHTML}
        <div class="unit-info">
          <div class="unit-name-row">
            <span class="unit-name">${unit.unitName}</span>
            <span class="unit-pts">(${unit.pointsCost}pts)</span>
          </div>
          <div class="unit-role-row">
            <span class="unit-role-badge" style="color: ${roleConfig.color}">${roleConfig.label}</span>
          </div>
        </div>
      </div>
      
      <div class="unit-tactical-summary">
        <p>"${summaryText}"</p>
      </div>
    </div>
  `;
}

/**
 * Get inline CSS styles for the HTML export
 */
function getInlineStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', Consolas, Monaco, monospace;
      /* Grimdark, high-contrast base */
      background: #0a0a0a;
      color: #e5e7eb;
      line-height: 1.5;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      background: #1a1a1a;
      border-bottom: 3px solid #ff6b00;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .title {
      color: #ff6b00;
      font-size: 28px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .subtitle {
      color: #a8c5a0;
      font-size: 14px;
      margin-top: 8px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 768px) {
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    .summary-card {
      background: #1a1a1a;
      border: 1px solid #4a4a4a;
      padding: 16px;
    }
    
    .summary-card .label {
      display: block;
      color: #9ca3af;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary-card .value {
      display: block;
      font-size: 18px;
      font-weight: bold;
      margin-top: 4px;
    }
    
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 768px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .card {
      background: #1a1a1a;
      border: 1px solid #4a4a4a;
      padding: 24px;
    }
    
    .card.full-width {
      margin-bottom: 24px;
    }
    
    .card-title {
      color: #ff6b00;
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-bottom: 1px solid #4a4a4a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    
    .note {
      color: #9ca3af;
      font-size: 12px;
      margin-bottom: 16px;
    }
    
    .rating-card {
      border: 2px solid #ff6b00;
      text-align: center;
    }
    
    .rating-card .label {
      display: block;
      color: #9ca3af;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .rating-label {
      display: block;
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 3px;
    }
    
    .rating-score {
      display: block;
      color: #d4a04c;
      font-size: 24px;
      margin-top: 8px;
    }
    
    .threat-level {
      margin-bottom: 16px;
    }
    
    .threat-low { color: #a8c5a0; }
    .threat-medium { color: #d4a04c; }
    .threat-high { color: #ff6b00; }
    .threat-extreme { color: #b84a4a; }
    
    .strengths, .weaknesses {
      margin-top: 16px;
    }
    
    .section-label {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    ul {
      list-style: none;
    }
    
    li {
      font-size: 14px;
      padding-left: 8px;
    }
    
    /* Role rows */
    .role-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      margin-bottom: 8px;
    }
    
    .role-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .role-icon {
      font-size: 18px;
    }
    
    .role-label {
      font-weight: bold;
      font-size: 14px;
    }
    
    .role-stats {
      text-align: right;
    }
    
    .unit-count {
      color: #d4a04c;
      font-size: 14px;
    }
    
    .pts-count {
      color: #9ca3af;
      font-size: 12px;
      margin-left: 8px;
    }
    
    .label {
      color: #9ca3af;
      font-size: 12px;
      text-transform: uppercase;
    }
    
    .objective-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    .objective-stat .label {
      display: block;
      margin-bottom: 4px;
    }
    
    .big-number {
      color: #d4a04c;
      font-size: 28px;
      font-weight: bold;
    }
    
    .mobility-distribution {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #4a4a4a;
    }
    
    .mobility-tags {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    
    .tag {
      font-size: 12px;
      padding: 4px 8px;
    }
    
    .capabilities-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    .capability {
      font-size: 14px;
      color: #9ca3af;
    }
    
    .capability.active {
      color: #a8c5a0;
    }
    
    /* Scenarios */
    .scenarios-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    @media (max-width: 900px) {
      .scenarios-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    @media (max-width: 600px) {
      .scenarios-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .scenario-card {
      background: rgba(0,0,0,0.3);
      border: 1px solid #4a4a4a;
      padding: 16px;
      border-radius: 4px;
    }
    
    .scenario-title {
      color: #a8c5a0;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .scenario-target {
      color: #9ca3af;
      font-size: 12px;
      margin-bottom: 12px;
    }
    
    .scenario-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .stat {
      text-align: center;
    }
    
    .stat-value {
      display: block;
      font-size: 20px;
      font-weight: bold;
      color: #e5e7eb;
    }
    
    .stat-label {
      display: block;
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
    }
    
    .scenario-notes {
      color: #d4a04c;
      font-size: 12px;
      font-style: italic;
    }
    
    /* Unit profiles */
    .role-section {
      margin-bottom: 24px;
    }
    
    .role-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .role-icon-large {
      font-size: 24px;
    }
    
    .role-title {
      font-size: 18px;
      font-weight: bold;
    }
    
    .role-description {
      color: #9ca3af;
      font-size: 14px;
    }
    
    .units-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    @media (max-width: 768px) {
      .units-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .unit-card {
      background: rgba(0,0,0,0.3);
      border: 1px solid #4a4a4a;
      padding: 16px;
      border-radius: 4px;
    }
    
    .unit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .unit-name {
      color: #a8c5a0;
      font-weight: bold;
      font-size: 14px;
    }
    
    .unit-pts {
      color: #9ca3af;
      font-size: 12px;
    }
    
    .unit-role {
      color: #d4a04c;
      font-size: 12px;
      margin-bottom: 12px;
    }
    
    .best-target {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    
    .target-label {
      color: #9ca3af;
    }
    
    .target-type {
      color: #a8c5a0;
    }
    
    .target-damage {
      color: #ff6b00;
      font-weight: bold;
    }
    
    .toughness-chart {
      margin-bottom: 12px;
    }
    
    .chart-label {
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 60px;
    }
    
    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
    }
    
    .bar {
      width: 100%;
      border-radius: 2px 2px 0 0;
      min-height: 3px;
    }
    
    .bar-label {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 4px;
    }
    
    .unit-stats {
      display: flex;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(74, 74, 74, 0.5);
      color: #9ca3af;
      font-size: 12px;
    }
    
    /* Gaps */
    .gaps-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    @media (max-width: 768px) {
      .gaps-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .gap-card {
      border: 1px solid #4a4a4a;
      padding: 16px;
    }
    
    .gap-card.priority-high {
      border-color: #b84a4a;
      background: rgba(184, 74, 74, 0.1);
    }
    
    .gap-card.priority-medium {
      border-color: #d4a04c;
      background: rgba(212, 160, 76, 0.1);
    }
    
    .gap-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .priority-badge {
      font-size: 10px;
      font-weight: bold;
      padding: 2px 8px;
    }
    
    .priority-badge.high { background: #b84a4a; color: white; }
    .priority-badge.medium { background: #d4a04c; color: #0a0a0a; }
    .priority-badge.low { background: #4a4a4a; color: white; }
    
    .gap-category {
      color: #a8c5a0;
      font-size: 14px;
      font-weight: bold;
    }
    
    .gap-issue {
      color: #d4a04c;
      font-size: 14px;
      margin-bottom: 4px;
    }
    
    .gap-suggestion {
      color: #4a4a4a;
      font-size: 14px;
    }
    
    .gap-units {
      color: #a8c5a0;
      font-size: 12px;
      margin-top: 8px;
    }
    
    .stratagems-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    @media (max-width: 768px) {
      .stratagems-list {
        grid-template-columns: 1fr;
      }
    }
    
    .stratagems-list li {
      color: #a8c5a0;
      font-size: 14px;
    }
    
    .footer {
      background: #1a1a1a;
      border-top: 2px solid #4a4a4a;
      padding: 16px;
      text-align: center;
      margin-top: 24px;
    }
    
    .footer p {
      color: #9ca3af;
      font-size: 12px;
    }
    
    .footer .legal-disclaimer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #4a4a4a;
      font-size: 10px;
      color: #6b7280;
      line-height: 1.5;
    }
    
    /* Strengths & Weaknesses Grid */
    .strengths-weaknesses-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 768px) {
      .strengths-weaknesses-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .sw-card {
      padding: 20px;
      border-radius: 8px;
      /* Keep on-brand but readable on dark page background */
      background: rgba(0, 0, 0, 0.35);
    }
    
    .sw-card.strengths {
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    
    .sw-card.weaknesses {
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .sw-title {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 16px 0;
    }
    
    .sw-card ul {
      list-style: none;
    }
    
    .sw-card li {
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .sw-card .units, .sw-card .severity {
      color: #9ca3af;
      font-size: 12px;
      margin-left: 8px;
    }
    
    /* Strategic Assessment */
    .strategic-assessment {
      background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
    }
    
    .assessment-content {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    
    .assessment-icon {
      font-size: 32px;
      flex-shrink: 0;
    }
    
    .assessment-text {
      flex: 1;
    }
    
    .assessment-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .assessment-header .card-title {
      border: none;
      padding: 0;
      margin: 0;
    }
    
    .archetype-tags {
      display: flex;
      gap: 8px;
    }
    
    .archetype-tag {
      padding: 4px 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .archetype-tag.primary {
      background: #ff6b00;
      color: #0a0a0a;
    }
    
    .archetype-tag.secondary {
      background: #d4a04c;
      color: #0a0a0a;
    }
    
    .executive-summary {
      color: #a8c5a0;
      font-size: 16px;
      line-height: 1.6;
      margin: 0;
    }
    
    /* Color utilities */
    .green { color: #a8c5a0; }
    .amber { color: #d4a04c; }
    .orange { color: #ff6b00; }
    .red { color: #b84a4a; }
    .blue { color: #60a5fa; }
    
    /* Army Spirit Section */
    .army-spirit {
      background: linear-gradient(135deg, #0a0a0a, #1a1a1a, #0a0a0a);
      border-bottom: 4px solid #ff6b00;
      padding: 32px;
    }
    
    .spirit-content {
      display: flex;
      align-items: center;
      gap: 32px;
      margin-bottom: 32px;
    }
    
    @media (max-width: 768px) {
      .spirit-content {
        flex-direction: column;
        text-align: center;
      }
    }
    
    .spirit-icon-container {
      flex-shrink: 0;
    }
    
    .spirit-icon {
      width: 160px;
      height: 160px;
      object-fit: contain;
      border-radius: 8px;
      border: 2px solid #ff6b00;
      box-shadow: 0 4px 24px rgba(255, 107, 0, 0.2);
    }
    
    .spirit-icon-placeholder {
      width: 160px;
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 64px;
      background: #1a1a1a;
      border: 2px solid #4a4a4a;
      border-radius: 8px;
    }
    
    .spirit-identity {
      flex: 1;
    }
    
    .spirit-tagline {
      font-size: 48px;
      font-weight: 900;
      background: linear-gradient(135deg, #ff6b00, #fbbf24, #ff6b00);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 8px 0;
    }
    
    .spirit-faction {
      color: #a8c5a0;
      font-size: 20px;
      font-weight: bold;
      margin: 0 0 12px 0;
    }
    
    .spirit-description {
      color: #9ca3af;
      font-size: 18px;
      font-style: italic;
      margin: 0 0 16px 0;
      max-width: 600px;
    }
    
    .spirit-stats {
      display: flex;
      gap: 16px;
    }
    
    @media (max-width: 768px) {
      .spirit-stats {
        justify-content: center;
      }
    }
    
    .spirit-stat {
      padding: 6px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-family: monospace;
    }
    
    .spirit-stat:first-child {
      background: rgba(255, 107, 0, 0.1);
      border: 1px solid rgba(255, 107, 0, 0.3);
      color: #ff6b00;
    }
    
    .spirit-stat:not(:first-child) {
      background: rgba(74, 74, 74, 0.1);
      border: 1px solid rgba(74, 74, 74, 0.3);
      color: #e5e7eb;
    }
    
    .playstyle-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 768px) {
      .playstyle-section {
        grid-template-columns: 1fr;
      }
    }
    
    .section-title {
      color: #ff6b00;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 16px 0;
    }
    
    .playstyle-blend {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #4a4a4a;
      border-radius: 8px;
      padding: 20px;
    }
    
    .playstyle-primary, .playstyle-secondary {
      margin-bottom: 16px;
    }
    
    .playstyle-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .playstyle-icon {
      font-size: 24px;
    }
    
    .playstyle-secondary .playstyle-icon {
      font-size: 18px;
    }
    
    .playstyle-label {
      color: white;
      font-weight: bold;
      flex: 1;
    }
    
    .playstyle-secondary .playstyle-label {
      color: #cbd5e1;
    }
    
    .playstyle-percent {
      color: #ff6b00;
      font-size: 20px;
      font-weight: bold;
    }
    
    .playstyle-secondary .playstyle-percent {
      color: #d4a04c;
      font-size: 16px;
    }
    
    .playstyle-bar-container {
      height: 12px;
      background: #1a1a1a;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .playstyle-bar-container.small {
      height: 8px;
    }
    
    .playstyle-bar {
      height: 100%;
      border-radius: 6px;
    }
    
    .playstyle-desc {
      color: #9ca3af;
      font-size: 12px;
      margin: 0;
    }
    
    .playstyle-desc.secondary {
      color: rgba(74, 74, 74, 0.7);
    }
    
    .combat-spectrum {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #4a4a4a;
      border-radius: 8px;
      padding: 20px;
    }
    
    .spectrum-labels {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .melee-label {
      color: #ef4444;
      font-weight: bold;
      font-size: 14px;
    }
    
    .shooting-label {
      color: #3b82f6;
      font-weight: bold;
      font-size: 14px;
    }
    
    .spectrum-bar {
      position: relative;
      height: 16px;
      background: linear-gradient(to right, rgba(239, 68, 68, 0.2), #1a1a1a, rgba(59, 130, 246, 0.2));
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .spectrum-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 16px;
      background: white;
      border-radius: 8px;
      transform: translateX(-50%);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .spectrum-desc {
      color: #9ca3af;
      font-size: 12px;
      text-align: center;
      margin: 0;
    }
    
    .fun-stats-section {
      margin-top: 24px;
    }
    
    .fun-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    @media (max-width: 900px) {
      .fun-stats-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .fun-stat-card {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #4a4a4a;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      transition: border-color 0.2s;
    }
    
    .fun-stat-card:hover {
      border-color: rgba(255, 107, 0, 0.5);
    }
    
    .fun-stat-emoji {
      display: block;
      font-size: 32px;
      margin-bottom: 4px;
    }
    
    .fun-stat-icon {
      display: block;
      width: 48px;
      height: 48px;
      margin: 0 auto 4px auto;
      object-fit: contain;
      border-radius: 4px;
    }
    
    .fun-stat-value {
      display: block;
      color: #ff6b00;
      font-size: 18px;
      font-weight: bold;
    }
    
    .fun-stat-name {
      display: block;
      color: white;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .fun-stat-desc {
      display: block;
      color: #cbd5e1;
      font-size: 11px;
      line-height: 1.3;
    }
    
    /* Unit Icon Styles */
    .unit-icon {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid rgba(74, 74, 74, 0.5);
      background: #0a0a0a;
      flex-shrink: 0;
    }
    
    .unit-icon-placeholder {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      background: #0a0a0a;
      border: 1px solid rgba(74, 74, 74, 0.5);
      border-radius: 4px;
      flex-shrink: 0;
    }
    
    .unit-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .unit-info {
      flex: 1;
      min-width: 0;
    }
    
    .unit-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .unit-name {
      color: #a8c5a0;
      font-weight: bold;
      font-size: 14px;
    }
    
    .unit-pts {
      color: #4a4a4a;
      font-size: 12px;
    }
    
    .unit-role-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
    }
    
    .unit-role-badge {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
    }
    
    .unit-damage-preview {
      color: #d4a04c;
    }
    
    .unit-role-reasoning {
      color: #d4a04c;
      font-size: 12px;
      margin-bottom: 12px;
      font-style: italic;
    }
    
    .unit-tactical-summary {
      margin-top: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-left: 2px solid #ff6b00;
      border-radius: 0 4px 4px 0;
    }
    
    .unit-tactical-summary p {
      color: #d4a04c;
      font-size: 13px;
      font-style: italic;
      line-height: 1.5;
      margin: 0;
    }
    
    /* Synergy Network Styles */
    .synergy-network {
      background: #1a1a1a;
    }
    
    .synergy-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .synergy-header .card-title {
      border: none;
      padding: 0;
      margin: 0;
    }
    
    .synergy-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #9ca3af;
    }
    
    .synergy-stat-value {
      color: #a8c5a0;
      font-weight: bold;
    }
    
    .synergy-stat-value.amber {
      color: #d4a04c;
    }
    
    .synergy-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    
    @media (max-width: 900px) {
      .synergy-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    
    @media (max-width: 600px) {
      .synergy-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    .synergy-unit-card {
      position: relative;
      padding: 12px;
      border-radius: 8px;
      border: 2px solid;
    }
    
    .synergy-connection-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ff6b00;
      color: #0a0a0a;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .synergy-tier-badge {
      position: absolute;
      top: -8px;
      left: -8px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    
    .synergy-tier-badge.tier-s { background: #f59e0b; color: #0a0a0a; }
    .synergy-tier-badge.tier-a { background: #22c55e; color: #0a0a0a; }
    .synergy-tier-badge.tier-b { background: #3b82f6; color: white; }
    .synergy-tier-badge.tier-c { background: #64748b; color: white; }
    
    .synergy-unit-name {
      font-weight: bold;
      font-size: 13px;
      margin: 0 0 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .synergy-unit-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    
    .synergy-unit-pts {
      color: #d4a04c;
      font-family: monospace;
    }
    
    .synergy-unit-role {
      font-weight: bold;
      font-size: 10px;
    }
    
    .synergy-connections-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .synergy-connection {
      padding: 4px 8px;
      background: rgba(168, 197, 160, 0.1);
      border-radius: 4px;
      color: #a8c5a0;
      font-size: 12px;
    }
    
    .synergy-legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(74, 74, 74, 0.3);
      font-size: 12px;
    }
    
    .synergy-legend-label {
      color: #4a4a4a;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .synergy-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .synergy-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 4px;
      border: 1px solid;
    }
    
    .synergy-orphans {
      margin-top: 16px;
      padding: 12px;
      background: rgba(212, 160, 76, 0.1);
      border: 1px solid rgba(212, 160, 76, 0.3);
      border-radius: 8px;
    }
    
    .synergy-orphans-title {
      color: #d4a04c;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 0 8px 0;
    }
    
    .synergy-orphans-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .synergy-orphan-item {
      font-size: 12px;
      color: #9ca3af;
    }
    
    .synergy-orphan-unit {
      color: #a8c5a0;
    }
    
    .synergy-orphan-targets {
      color: #d4a04c;
    }
    
    /* List Modification Suggestions */
    .list-suggestions {
      background: #1a1a1a;
    }
    
    .suggestions-intro {
      color: #9ca3af;
      font-size: 14px;
      margin-bottom: 20px;
    }
    
    .suggestions-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .suggestion-card {
      border-radius: 8px;
      overflow: hidden;
    }
    
    .suggestion-card.priority-high {
      border: 2px solid #b84a4a;
    }
    
    .suggestion-card.priority-medium {
      border: 2px solid #d4a04c;
    }
    
    .suggestion-card.priority-low {
      border: 2px solid #4a4a4a;
    }
    
    .suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
    }
    
    .priority-high .suggestion-header {
      background: rgba(184, 74, 74, 0.2);
    }
    
    .priority-medium .suggestion-header {
      background: rgba(212, 160, 76, 0.2);
    }
    
    .priority-low .suggestion-header {
      background: rgba(74, 74, 74, 0.3);
    }
    
    .suggestion-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .suggestion-option {
      color: #a8c5a0;
      font-weight: bold;
      font-size: 14px;
    }
    
    .suggestion-priority {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    
    .priority-high .suggestion-priority {
      background: #b84a4a;
      color: white;
    }
    
    .priority-medium .suggestion-priority {
      background: #d4a04c;
      color: #0a0a0a;
    }
    
    .priority-low .suggestion-priority {
      background: #4a4a4a;
      color: white;
    }
    
    .suggestion-type {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .suggestion-type.type-swap { color: #60a5fa; }
    .suggestion-type.type-add { color: #22c55e; }
    .suggestion-type.type-realloc { color: #a855f7; }
    
    .suggestion-delta {
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
    }
    
    .suggestion-delta.delta-positive { color: #b84a4a; }
    .suggestion-delta.delta-negative { color: #22c55e; }
    .suggestion-delta.delta-neutral { color: #9ca3af; }
    
    .suggestion-content {
      padding: 16px;
      background: rgba(0, 0, 0, 0.3);
    }
    
    .suggestion-units-flow {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    
    .suggestion-units-group {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .suggestion-unit {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
    }
    
    .suggestion-unit.remove {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .suggestion-unit.add {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    
    .suggestion-unit-icon {
      width: 36px;
      height: 36px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid rgba(74, 74, 74, 0.5);
    }
    
    .suggestion-unit-icon-placeholder {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.3);
    }
    
    .suggestion-unit.remove .suggestion-unit-icon-placeholder { color: #ef4444; }
    .suggestion-unit.add .suggestion-unit-icon-placeholder { color: #22c55e; }
    
    .suggestion-unit-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .suggestion-unit-name {
      font-weight: bold;
      font-size: 13px;
    }
    
    .suggestion-unit.remove .suggestion-unit-name { color: #fca5a5; }
    .suggestion-unit.add .suggestion-unit-name { color: #86efac; }
    
    .suggestion-unit-pts {
      font-size: 11px;
      font-family: monospace;
    }
    
    .suggestion-unit.remove .suggestion-unit-pts { color: rgba(252, 165, 165, 0.7); }
    .suggestion-unit.add .suggestion-unit-pts { color: rgba(134, 239, 172, 0.7); }
    
    .suggestion-unit-capability {
      font-size: 10px;
      color: #a8c5a0;
      font-style: italic;
    }
    
    .suggestion-arrow {
      font-size: 24px;
      color: #4a4a4a;
    }
    
    .suggestion-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .suggestion-addresses,
    .suggestion-synergies,
    .suggestion-tradeoffs {
      display: flex;
      gap: 8px;
      font-size: 13px;
      flex-wrap: wrap;
    }
    
    .detail-label {
      color: #d4a04c;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
      flex-shrink: 0;
    }
    
    .detail-value {
      flex: 1;
    }
    
    .detail-value.green { color: #a8c5a0; }
    .detail-value.purple { color: #c084fc; }
    .detail-value.muted { color: #9ca3af; font-style: italic; }
  `;
}
