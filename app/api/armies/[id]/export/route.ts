import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to safely parse JSON
function safeParseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Calculate total wounds from composition
function calculateTotalWounds(composition: any[]): number {
  return composition.reduce((total, entry) => {
    return total + (entry.count || 1) * (entry.woundsPerModel || 1);
  }, 0);
}

// Generate HTML export
function generateArmyHTML(
  army: any,
  detachment: any | null,
  stratagems: any[],
  coreStratagems: any[],
  enhancements: any[]
): string {
  const playerName = army.player?.name || 'Unknown Commander';
  const factionName = army.player?.faction || 'Unknown Faction';
  const armyName = army.name || 'Unnamed Force';
  const detachmentName = army.detachment || 'No Detachment';
  const characterAttachments = safeParseJSON<Record<string, string>>(army.characterAttachments, {});

  // Calculate army totals
  let totalPoints = 0;
  let totalModels = 0;
  let totalWounds = 0;
  let totalOC = 0;

  const processedUnits = army.units.map((unit: any) => {
    const composition = safeParseJSON<any[]>(unit.composition, []);
    const weapons = safeParseJSON<any[]>(unit.weapons, []);
    const abilities = safeParseJSON<any[]>(unit.abilities, []);
    const unitEnhancements = safeParseJSON<string[]>(unit.enhancements, []);
    const keywords = safeParseJSON<string[]>(unit.keywords, []);

    const unitWounds = calculateTotalWounds(composition);
    const unitModels = composition.reduce((sum: number, c: any) => sum + (c.count || 1), 0) || unit.modelCount || 1;

    totalPoints += unit.pointsCost || 0;
    totalModels += unitModels;
    totalWounds += unitWounds;

    // Try to get OC from datasheet
    if (unit.fullDatasheet) {
      totalOC += (unit.fullDatasheet.objectiveControl || 0) * unitModels;
    }

    return {
      ...unit,
      composition,
      weapons,
      abilities,
      unitEnhancements,
      keywords,
      totalWounds: unitWounds,
      totalModels: unitModels,
    };
  });

  // Sort units: Characters first, then by role, then by name
  const sortedUnits = processedUnits.sort((a: any, b: any) => {
    const aIsChar = a.keywords.includes('CHARACTER') ? 0 : 1;
    const bIsChar = b.keywords.includes('CHARACTER') ? 0 : 1;
    if (aIsChar !== bIsChar) return aIsChar - bIsChar;
    return a.name.localeCompare(b.name);
  });

  // Separate characters and other units
  const characters = sortedUnits.filter((u: any) => u.keywords.includes('CHARACTER'));
  const otherUnits = sortedUnits.filter((u: any) => !u.keywords.includes('CHARACTER'));

  // Group stratagems by type
  const stratagemsByType: Record<string, any[]> = {};
  [...stratagems, ...coreStratagems].forEach((s) => {
    const type = s.type || 'Other';
    if (!stratagemsByType[type]) stratagemsByType[type] = [];
    stratagemsByType[type].push(s);
  });

  // Notable abilities (filter for important ones)
  const notableAbilities: { unit: string; name: string; description: string; type: string }[] = [];
  processedUnits.forEach((unit: any) => {
    unit.abilities.forEach((ability: any) => {
      if (ability.type === 'leader' || ability.type === 'unit' || ability.type === 'core') {
        notableAbilities.push({
          unit: unit.name,
          name: ability.name,
          description: ability.description || '',
          type: ability.type,
        });
      }
    });
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${armyName} - Army Roster</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:wght@400;500;600&display=swap');
    
    :root {
      --bg-dark: #0a0a0c;
      --bg-card: #141418;
      --bg-card-alt: #1a1a1f;
      --border-color: #2a2a35;
      --border-accent: #4a3f2f;
      --text-primary: #e8e6e3;
      --text-secondary: #9a9890;
      --text-muted: #6a6860;
      --accent-gold: #c9a227;
      --accent-gold-dark: #8b7019;
      --accent-red: #8b2020;
      --accent-blue: #1e4a7a;
      --success: #2d5a27;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Crimson Pro', Georgia, serif;
      background: var(--bg-dark);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      background-image: 
        radial-gradient(ellipse at top, rgba(201, 162, 39, 0.03) 0%, transparent 50%),
        radial-gradient(ellipse at bottom, rgba(139, 32, 32, 0.03) 0%, transparent 50%);
    }
    
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    /* Header */
    .army-header {
      text-align: center;
      padding: 3rem 2rem;
      border-bottom: 2px solid var(--border-accent);
      margin-bottom: 2rem;
      background: linear-gradient(180deg, rgba(201, 162, 39, 0.05) 0%, transparent 100%);
    }
    
    .army-name {
      font-family: 'Cinzel', serif;
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--accent-gold);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 0.5rem;
      text-shadow: 0 2px 10px rgba(201, 162, 39, 0.3);
    }
    
    .army-subtitle {
      font-size: 1.1rem;
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    
    .army-stats {
      display: flex;
      justify-content: center;
      gap: 3rem;
      flex-wrap: wrap;
    }
    
    .stat-box {
      text-align: center;
    }
    
    .stat-value {
      font-family: 'Cinzel', serif;
      font-size: 2rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
    }
    
    /* Sections */
    .section {
      margin-bottom: 2.5rem;
    }
    
    .section-title {
      font-family: 'Cinzel', serif;
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--accent-gold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-accent);
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 1.2em;
      background: var(--accent-gold);
    }
    
    /* Detachment */
    .detachment-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
    }
    
    .detachment-name {
      font-family: 'Cinzel', serif;
      font-size: 1.2rem;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }
    
    .detachment-ability {
      color: var(--text-secondary);
      font-style: italic;
    }
    
    /* Stratagems */
    .stratagems-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    
    .stratagem-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--accent-blue);
      border-radius: 6px;
      padding: 1rem;
    }
    
    .stratagem-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }
    
    .stratagem-name {
      font-family: 'Cinzel', serif;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .stratagem-cp {
      background: var(--accent-blue);
      color: white;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-size: 0.85rem;
    }
    
    .stratagem-timing {
      font-size: 0.8rem;
      color: var(--accent-gold);
      margin-bottom: 0.5rem;
    }
    
    .stratagem-effect {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    
    .stratagem-type {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }
    
    /* Character Attachments */
    .attachments-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.75rem;
    }
    
    .attachment-item {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .attachment-arrow {
      color: var(--accent-gold);
      font-size: 1.2rem;
    }
    
    .attachment-leader {
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .attachment-unit {
      color: var(--text-secondary);
    }
    
    /* Units */
    .unit-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    
    .unit-card.character {
      border-left: 3px solid var(--accent-gold);
    }
    
    .unit-header {
      background: var(--bg-card-alt);
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .unit-name {
      font-family: 'Cinzel', serif;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .unit-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
    }
    
    .unit-meta-item {
      color: var(--text-secondary);
    }
    
    .unit-meta-value {
      color: var(--text-primary);
      font-weight: 500;
    }
    
    .unit-body {
      padding: 1rem 1.25rem;
    }
    
    .unit-composition {
      margin-bottom: 1rem;
    }
    
    .composition-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    
    .composition-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    
    .composition-entry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--border-color);
    }
    
    .composition-entry:last-child {
      border-bottom: none;
    }
    
    .composition-role {
      color: var(--text-secondary);
    }
    
    .composition-wounds {
      color: var(--accent-red);
      font-weight: 500;
    }
    
    .unit-weapons {
      margin-bottom: 1rem;
    }
    
    .weapons-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    
    .weapons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.5rem;
    }
    
    .weapon-item {
      background: var(--bg-dark);
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    
    .weapon-name {
      color: var(--text-primary);
      font-weight: 500;
    }
    
    .weapon-profile {
      color: var(--text-muted);
      font-size: 0.8rem;
    }
    
    .unit-abilities {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .ability-tag {
      background: rgba(201, 162, 39, 0.1);
      border: 1px solid var(--border-accent);
      color: var(--accent-gold);
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    
    .unit-enhancements {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }
    
    .enhancement-tag {
      background: rgba(45, 90, 39, 0.2);
      border: 1px solid var(--success);
      color: #6db86d;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    
    /* Notable Abilities Section */
    .abilities-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 0.75rem;
    }
    
    .notable-ability {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
    }
    
    .notable-ability-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    
    .notable-ability-name {
      font-weight: 600;
      color: var(--accent-gold);
    }
    
    .notable-ability-unit {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .notable-ability-desc {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    
    /* Enhancements Section */
    .enhancements-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    
    .enhancement-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--success);
      border-radius: 6px;
      padding: 1rem;
    }
    
    .enhancement-name {
      font-family: 'Cinzel', serif;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }
    
    .enhancement-cost {
      font-size: 0.85rem;
      color: var(--accent-gold);
      margin-bottom: 0.5rem;
    }
    
    .enhancement-desc {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 2rem;
      border-top: 1px solid var(--border-color);
      margin-top: 2rem;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    
    /* Print Styles */
    @media print {
      body {
        background: white;
        color: #1a1a1a;
      }
      
      .container {
        max-width: 100%;
        padding: 1rem;
      }
      
      .army-header {
        background: none;
        border-bottom: 2px solid #c9a227;
      }
      
      .army-name {
        color: #8b7019;
        text-shadow: none;
      }
      
      .unit-card,
      .stratagem-card,
      .detachment-card,
      .attachment-item,
      .notable-ability,
      .enhancement-card {
        background: #f5f5f5;
        border-color: #ddd;
        break-inside: avoid;
      }
      
      .unit-header {
        background: #eee;
      }
      
      .weapon-item {
        background: #e8e8e8;
      }
      
      .stat-value,
      .unit-name,
      .stratagem-name,
      .detachment-name {
        color: #1a1a1a;
      }
      
      .section-title {
        color: #8b7019;
        border-color: #c9a227;
      }
      
      .ability-tag {
        background: rgba(201, 162, 39, 0.15);
        color: #8b7019;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Army Header -->
    <header class="army-header">
      <h1 class="army-name">${escapeHtml(armyName)}</h1>
      <p class="army-subtitle">
        <strong>${escapeHtml(playerName)}</strong> &bull; 
        ${escapeHtml(factionName)} &bull; 
        ${escapeHtml(detachmentName)}
      </p>
      <div class="army-stats">
        <div class="stat-box">
          <div class="stat-value">${totalPoints}</div>
          <div class="stat-label">Points</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${army.pointsLimit || 2000}</div>
          <div class="stat-label">Limit</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${army.units.length}</div>
          <div class="stat-label">Units</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${totalModels}</div>
          <div class="stat-label">Models</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${totalWounds}</div>
          <div class="stat-label">Total Wounds</div>
        </div>
      </div>
    </header>

    ${detachment ? `
    <!-- Detachment -->
    <section class="section">
      <h2 class="section-title">Detachment</h2>
      <div class="detachment-card">
        <div class="detachment-name">${escapeHtml(detachment.name)}</div>
        ${detachment.abilityName ? `
        <div style="margin-top: 0.75rem;">
          <strong style="color: var(--accent-gold);">${escapeHtml(detachment.abilityName)}</strong>
          ${detachment.abilityDescription ? `
          <p class="detachment-ability" style="margin-top: 0.5rem;">${escapeHtml(detachment.abilityDescription)}</p>
          ` : ''}
        </div>
        ` : ''}
      </div>
    </section>
    ` : ''}

    ${Object.keys(characterAttachments).length > 0 ? `
    <!-- Character Attachments -->
    <section class="section">
      <h2 class="section-title">Character Attachments</h2>
      <div class="attachments-list">
        ${Object.entries(characterAttachments).map(([leader, unit]) => `
        <div class="attachment-item">
          <span class="attachment-leader">${escapeHtml(leader)}</span>
          <span class="attachment-arrow">→</span>
          <span class="attachment-unit">${escapeHtml(unit as string)}</span>
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    ${characters.length > 0 ? `
    <!-- Characters -->
    <section class="section">
      <h2 class="section-title">Characters</h2>
      ${characters.map((unit: any) => renderUnitCard(unit, true)).join('')}
    </section>
    ` : ''}

    ${otherUnits.length > 0 ? `
    <!-- Battle Units -->
    <section class="section">
      <h2 class="section-title">Battle Units</h2>
      ${otherUnits.map((unit: any) => renderUnitCard(unit, false)).join('')}
    </section>
    ` : ''}

    ${Object.keys(stratagemsByType).length > 0 ? `
    <!-- Stratagems -->
    <section class="section">
      <h2 class="section-title">Stratagems</h2>
      ${Object.entries(stratagemsByType).map(([type, strats]) => `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">${escapeHtml(type)}</h3>
        <div class="stratagems-grid">
          ${(strats as any[]).map((s: any) => `
          <div class="stratagem-card">
            <div class="stratagem-header">
              <span class="stratagem-name">${escapeHtml(s.name)}</span>
              <span class="stratagem-cp">${s.cpCost} CP</span>
            </div>
            <div class="stratagem-timing">${escapeHtml(s.when || s.phase || 'Any Phase')}</div>
            <div class="stratagem-effect">${escapeHtml(s.effect || s.description || '')}</div>
          </div>
          `).join('')}
        </div>
      </div>
      `).join('')}
    </section>
    ` : ''}

    ${enhancements.length > 0 ? `
    <!-- Available Enhancements -->
    <section class="section">
      <h2 class="section-title">Available Enhancements</h2>
      <div class="enhancements-grid">
        ${enhancements.map((e: any) => `
        <div class="enhancement-card">
          <div class="enhancement-name">${escapeHtml(e.name)}</div>
          <div class="enhancement-cost">${e.pointsCost} pts</div>
          <div class="enhancement-desc">${escapeHtml(e.description || '')}</div>
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    ${notableAbilities.length > 0 ? `
    <!-- Notable Abilities -->
    <section class="section">
      <h2 class="section-title">Notable Abilities</h2>
      <div class="abilities-list">
        ${notableAbilities.slice(0, 12).map((a) => `
        <div class="notable-ability">
          <div class="notable-ability-header">
            <span class="notable-ability-name">${escapeHtml(a.name)}</span>
            <span class="notable-ability-unit">${escapeHtml(a.unit)}</span>
          </div>
          ${a.description ? `<div class="notable-ability-desc">${escapeHtml(a.description)}</div>` : ''}
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    <footer class="footer">
      <p>Generated by Grimlog &bull; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin-top: 0.5rem;">Warhammer 40,000 © Games Workshop Ltd.</p>
    </footer>
  </div>
</body>
</html>`;

  return html;
}

// Render a unit card
function renderUnitCard(unit: any, isCharacter: boolean): string {
  const composition = unit.composition || [];
  const weapons = unit.weapons || [];
  const abilities = unit.abilities || [];
  const enhancements = unit.unitEnhancements || [];

  return `
  <div class="unit-card${isCharacter ? ' character' : ''}">
    <div class="unit-header">
      <span class="unit-name">${escapeHtml(unit.name)}</span>
      <div class="unit-meta">
        <span class="unit-meta-item">
          <span class="unit-meta-value">${unit.pointsCost}</span> pts
        </span>
        <span class="unit-meta-item">
          <span class="unit-meta-value">${unit.totalModels}</span> models
        </span>
        <span class="unit-meta-item">
          <span class="unit-meta-value">${unit.totalWounds}</span> wounds
        </span>
      </div>
    </div>
    <div class="unit-body">
      ${composition.length > 0 ? `
      <div class="unit-composition">
        <div class="composition-title">Composition</div>
        <div class="composition-list">
          ${composition.map((c: any) => `
          <div class="composition-entry">
            <span class="composition-role">${c.count}× ${escapeHtml(c.role || 'Model')}${c.weapons?.length ? ` (${c.weapons.slice(0, 2).map((w: string) => escapeHtml(w)).join(', ')}${c.weapons.length > 2 ? '...' : ''})` : ''}</span>
            <span class="composition-wounds">${c.woundsPerModel || 1}W each</span>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      ${weapons.length > 0 ? `
      <div class="unit-weapons">
        <div class="weapons-title">Weapons</div>
        <div class="weapons-grid">
          ${weapons.slice(0, 8).map((w: any) => `
          <div class="weapon-item">
            <div class="weapon-name">${escapeHtml(w.name)}</div>
            <div class="weapon-profile">${w.range || 'Melee'} ${w.type ? `• ${w.type}` : ''}</div>
          </div>
          `).join('')}
          ${weapons.length > 8 ? `<div class="weapon-item" style="color: var(--text-muted);">+${weapons.length - 8} more...</div>` : ''}
        </div>
      </div>
      ` : ''}
      
      ${abilities.length > 0 ? `
      <div class="unit-abilities">
        ${abilities.map((a: any) => `
        <span class="ability-tag">${escapeHtml(a.name)}</span>
        `).join('')}
      </div>
      ` : ''}
      
      ${enhancements.length > 0 ? `
      <div class="unit-enhancements">
        ${enhancements.map((e: string) => `
        <span class="enhancement-tag">✦ ${escapeHtml(e)}</span>
        `).join('')}
      </div>
      ` : ''}
    </div>
  </div>
  `;
}

// HTML escape helper
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    // Get optional auth - we'll check permissions based on army visibility
    const user = await getOptionalAuth();

    // Fetch army with all related data
    const army = await prisma.army.findUnique({
      where: { id },
      include: {
        player: true,
        units: {
          include: {
            fullDatasheet: {
              select: {
                id: true,
                name: true,
                role: true,
                keywords: true,
                wounds: true,
                objectiveControl: true,
              },
            },
          },
        },
        faction: true,
      },
    });

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    // Check access permissions:
    // 1. Owner can always access
    // 2. Public armies can be accessed by anyone
    // 3. Private/link-shared armies require owner
    const isOwner = user?.id === army.userId;
    const isPublic = army.visibility === 'public';
    
    if (!isOwner && !isPublic) {
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Not authorized to export this army' }, { status: 403 });
    }

    // Fetch detachment info if available
    let detachment = null;
    if (army.detachment) {
      detachment = await prisma.detachment.findFirst({
        where: {
          name: { equals: army.detachment, mode: 'insensitive' },
        },
      });
    }

    // Fetch stratagems for this faction/detachment
    let stratagems: any[] = [];
    const factionName = army.player?.faction || army.faction?.name;
    
    if (factionName) {
      stratagems = await prisma.stratagemData.findMany({
        where: {
          OR: [
            { faction: { equals: factionName, mode: 'insensitive' } },
            { factionId: army.factionId || undefined },
          ],
          ...(army.detachment ? {
            OR: [
              { detachment: { equals: army.detachment, mode: 'insensitive' } },
              { detachment: null },
              { detachment: 'Core' },
            ],
          } : {}),
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    }

    // Fetch core stratagems
    const coreStratagems = await prisma.coreStratagem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Fetch enhancements for this detachment
    let enhancements: any[] = [];
    if (army.detachment && factionName) {
      enhancements = await prisma.enhancement.findMany({
        where: {
          OR: [
            { detachment: { equals: army.detachment, mode: 'insensitive' } },
            { detachmentId: detachment?.id || undefined },
          ],
        },
        orderBy: { pointsCost: 'asc' },
      });
    }

    // Generate HTML
    const html = generateArmyHTML(army, detachment, stratagems, coreStratagems.map(s => ({
      ...s,
      type: s.category,
      when: s.when,
      effect: s.effect,
    })), enhancements);

    // Return based on format
    if (format === 'download') {
      // Return as downloadable file
      const filename = `${army.name.replace(/[^a-z0-9]/gi, '_')}_roster.html`;
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Return as viewable HTML
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error exporting army:', error);
    return NextResponse.json({ error: 'Failed to export army' }, { status: 500 });
  }
}

