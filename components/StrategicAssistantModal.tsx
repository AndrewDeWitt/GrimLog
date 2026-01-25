'use client';

import { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface RelevantRule {
  id: string;
  name: string;
  source: string;
  type: 'stratagem' | 'ability';
  cpCost?: number;
  triggerSubphase: string;
  fullText: string;
  requiredKeywords: string[];
  isReactive: boolean;
  category?: string;
}

interface RelevantRulesResult {
  opportunities: RelevantRule[];
  threats: RelevantRule[];
  subphases: string[];
}

interface StrategicAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  currentPhase: string;
  currentTurn: 'attacker' | 'defender';
}

// ============================================
// Main Modal Component
// ============================================

export default function StrategicAssistantModal({
  isOpen,
  onClose,
  sessionId,
  currentPhase,
  currentTurn
}: StrategicAssistantModalProps) {
  const [rules, setRules] = useState<RelevantRulesResult | null>(null);
  const [activeSubphase, setActiveSubphase] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RelevantRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllAbilities, setShowAllAbilities] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Fetch rules when modal opens or phase changes
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchRules();
    }
  }, [isOpen, sessionId, currentPhase, currentTurn]);
  
  // Reset active subphase when rules change
  useEffect(() => {
    if (rules) {
      setActiveSubphase('All');
    }
  }, [rules]);
  
  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/strategic-assistant/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, currentPhase, currentTurn })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch rules');
      }
      
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      setError(error instanceof Error ? error.message : 'Failed to load strategic rules');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  const filterRules = (rulesList: RelevantRule[]) => {
    let filtered = rulesList;
    
    // Filter by subphase
    if (activeSubphase !== 'All') {
      filtered = filtered.filter(r => r.triggerSubphase === activeSubphase);
    }
    
    // Filter by "Stratagems Only" toggle (hide unit abilities)
    if (!showAllAbilities) {
      filtered = filtered.filter(r => r.type === 'stratagem' || r.source.includes('Detachment'));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.source.toLowerCase().includes(query) ||
        r.fullText.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };
  
  const turnLabel = currentTurn === 'attacker' ? 'Your Turn' : "Opponent's Turn";
  
  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategic-assistant-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-6xl mx-auto h-[85vh] flex flex-col rounded-t-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 
              id="strategic-assistant-title"
              className="text-gray-900 text-lg md:text-xl font-bold tracking-wider uppercase truncate flex items-center gap-2"
            >
              <span>⚔</span> Strategic Assistant
            </h2>
            <div className="text-gray-600 text-xs md:text-sm mt-1">
              {currentPhase} Phase - {turnLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl font-bold transition-colors ml-4 w-10 h-10 flex items-center justify-center rounded-lg"
            aria-label="Close strategic assistant"
          >
            ✕
          </button>
        </div>
        
        {/* Search & Controls */}
        <div className="px-4 md:px-6 py-3 bg-grimlog-slate-dark border-b border-grimlog-steel flex-shrink-0 space-y-2">
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search stratagems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-grimlog-orange text-sm rounded-lg"
          />
          
          {/* Toggle: Strategic Only / Show All */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAllAbilities(false)}
              className={`flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all rounded-lg ${
                !showAllAbilities
                  ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
              }`}
            >
              Stratagems Only
            </button>
            <button
              onClick={() => setShowAllAbilities(true)}
              className={`flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all rounded-lg ${
                showAllAbilities
                  ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
              }`}
            >
              Show All Abilities
            </button>
          </div>
        </div>
        
        {/* Subphase Tabs */}
        {rules && rules.subphases.length > 0 && (
          <div className="px-3 md:px-6 py-2 md:py-3 bg-grimlog-slate-dark border-b border-grimlog-steel flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-thin">
            <button
              onClick={() => setActiveSubphase('All')}
              className={`px-3 md:px-4 py-2 text-xs font-bold tracking-wider uppercase border transition-all whitespace-nowrap flex-shrink-0 rounded-lg ${
                activeSubphase === 'All'
                  ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-grimlog-orange'
              }`}
            >
              All Timing
            </button>
            {rules.subphases.map(subphase => (
              <button
                key={subphase}
                onClick={() => setActiveSubphase(subphase)}
                className={`px-3 md:px-4 py-2 text-xs font-bold tracking-wider uppercase border whitespace-nowrap transition-all flex-shrink-0 rounded-lg ${
                  activeSubphase === subphase
                    ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-grimlog-orange'
                }`}
              >
                {subphase}
              </button>
            ))}
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="flex-1 flex items-center justify-center p-6 bg-grimlog-slate-light">
            <div className="text-center">
              <div className="text-red-600 text-xl font-bold mb-2">⚠ Error</div>
              <div className="text-gray-600 mb-4">{error}</div>
              <button
                onClick={fetchRules}
                className="px-4 py-2 bg-grimlog-orange text-gray-900 font-bold tracking-wider uppercase hover:bg-grimlog-amber transition-colors rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && !error && (
          <div className="flex-1 flex items-center justify-center p-6 bg-grimlog-slate-light">
            <div className="text-center">
              <div className="text-grimlog-orange text-xl font-bold mb-2">Loading...</div>
              <div className="text-gray-600">Analyzing strategic options...</div>
            </div>
          </div>
        )}
        
        {/* Two-Column Layout */}
        {!loading && !error && rules && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-3 md:p-6 overflow-hidden bg-grimlog-slate-light">
            {/* My Opportunities */}
            <div className="flex flex-col overflow-hidden border-2 border-green-500 rounded-lg">
              <div className="px-3 md:px-4 py-2 md:py-3 bg-green-500 text-white font-bold tracking-wider uppercase text-center flex-shrink-0 text-sm md:text-base">
                ✓ {currentTurn === 'attacker' ? 'Your Opportunities' : 'Your Reactive Options'} ({filterRules(rules.opportunities).length})
              </div>
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 bg-white">
                {filterRules(rules.opportunities).length === 0 ? (
                  <div className="text-gray-500 text-center py-8 text-sm">
                    {searchQuery ? 'No matches found' : `No ${currentTurn === 'attacker' ? 'opportunities' : 'reactive options'} available`}
                    {!showAllAbilities && !searchQuery && <div className="mt-2 text-xs">Try &ldquo;Show All Abilities&rdquo; to see more</div>}
                  </div>
                ) : (
                  filterRules(rules.opportunities).map(rule => (
                    <RuleCard 
                      key={rule.id} 
                      rule={rule} 
                      onClick={() => setSelectedRule(rule)}
                    />
                  ))
                )}
              </div>
            </div>
            
            {/* Opponent's Threats */}
            <div className="flex flex-col overflow-hidden border-2 border-red-500 rounded-lg">
              <div className="px-3 md:px-4 py-2 md:py-3 bg-red-500 text-white font-bold tracking-wider uppercase text-center flex-shrink-0 text-sm md:text-base">
                ⚠ {currentTurn === 'attacker' ? "Opponent's Threats" : "Opponent's Options"} ({filterRules(rules.threats).length})
              </div>
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 bg-white">
                {filterRules(rules.threats).length === 0 ? (
                  <div className="text-gray-500 text-center py-8 text-sm">
                    {searchQuery ? 'No matches found' : 'No threats to watch for'}
                    {!showAllAbilities && !searchQuery && <div className="mt-2 text-xs">Try &ldquo;Show All Abilities&rdquo; to see more</div>}
                  </div>
                ) : (
                  filterRules(rules.threats).map(rule => (
                    <RuleCard 
                      key={rule.id} 
                      rule={rule}
                      onClick={() => setSelectedRule(rule)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Instructions */}
        <div className="px-3 md:px-6 py-2 md:py-3 bg-grimlog-slate-dark border-t border-grimlog-steel text-gray-600 text-xs flex-shrink-0">
          <span className="font-bold text-grimlog-orange">Tip:</span> Click cards for details. Use search or toggle &ldquo;Show All Abilities&rdquo; to see unit-specific rules.
        </div>
      </div>
      
      {/* Rule Detail Modal (nested) */}
      {selectedRule && (
        <RuleDetailModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
      )}
    </div>
  );
}

// ============================================
// Rule Card Component
// ============================================

function RuleCard({ rule, onClick }: { rule: RelevantRule; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-gray-50 border border-gray-300 hover:border-grimlog-orange transition-all focus:outline-none focus:ring-2 focus:ring-grimlog-orange rounded-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-grimlog-orange font-bold text-sm truncate">
            {rule.name}
          </div>
          <div className="text-gray-500 text-xs mt-1 flex items-center gap-2 flex-wrap">
            <span>{rule.source}</span>
            {rule.category && (
              <>
                <span>•</span>
                <span>{rule.category}</span>
              </>
            )}
            {rule.triggerSubphase !== 'Any' && (
              <>
                <span>•</span>
                <span className="text-amber-600">{rule.triggerSubphase}</span>
              </>
            )}
          </div>
        </div>
        {rule.cpCost !== undefined && (
          <div className="flex-shrink-0 px-2 py-1 bg-grimlog-orange text-gray-900 font-bold text-xs rounded">
            {rule.cpCost} CP
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================
// Rule Detail Modal (Nested)
// ============================================

function RuleDetailModal({ rule, onClose }: { rule: RelevantRule; onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-detail-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-2xl mx-auto max-h-[80vh] overflow-y-auto rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel sticky top-0 z-10">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between sticky top-[44px] z-10">
          <h3 
            id="rule-detail-title"
            className="text-gray-900 text-lg font-bold tracking-wider uppercase"
          >
            {rule.name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-xl font-bold transition-colors w-10 h-10 flex items-center justify-center rounded-lg"
            aria-label="Close rule details"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4 bg-grimlog-slate-light">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="text-gray-600">
              <span className="font-bold">Source:</span> <span className="text-grimlog-orange">{rule.source}</span>
            </div>
            {rule.category && (
              <div className="text-gray-600">
                <span className="font-bold">Category:</span> <span className="text-grimlog-orange">{rule.category}</span>
              </div>
            )}
            {rule.cpCost !== undefined && (
              <div className="px-3 py-1 bg-grimlog-orange text-gray-900 font-bold rounded">
                {rule.cpCost} CP
              </div>
            )}
          </div>
          
          {/* Timing */}
          {rule.triggerSubphase !== 'Any' && (
            <div className="text-sm">
              <span className="text-gray-600 font-bold">Timing:</span>{' '}
              <span className="text-amber-600">{rule.triggerSubphase}</span>
            </div>
          )}
          
          {/* Reactive Badge */}
          {rule.isReactive && (
            <div className="inline-block px-3 py-1 bg-red-500 text-white font-bold text-xs tracking-wider uppercase rounded">
              ⚡ Reactive (Can interrupt opponent)
            </div>
          )}
          
          {/* Full Text */}
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-300 pt-4">
            {rule.fullText}
          </div>
          
          {/* Keywords */}
          {rule.requiredKeywords.length > 0 && (
            <div className="text-xs text-gray-600 border-t border-gray-300 pt-4">
              <span className="font-bold">Required Keywords:</span>{' '}
              <span className="text-amber-600">{rule.requiredKeywords.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
