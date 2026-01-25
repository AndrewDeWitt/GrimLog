'use client';

import { useState, useRef, useEffect } from 'react';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DeploymentZone {
  name: string;
  color: 'green' | 'red' | 'neutral';
  shape: 'rectangle' | 'triangle' | 'L-shape' | 'circle';
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  trianglePoints?: Array<{ x: number; y: number }>;
  segments?: Array<{ x: number; y: number; width: number; height: number }>;
  radius?: number;
}

interface ObjectiveMarker {
  number: number;
  x: number;
  y: number;
}

interface DeploymentMap {
  id: string;
  name: string;
  zones: DeploymentZone[];
  objectives: ObjectiveMarker[];
  dividerLines?: Array<{ 
    x1: number; 
    y1: number; 
    x2: number; 
    y2: number;
    color?: string;
    dashed?: boolean;
  }>;
}

// ============================================
// DEPLOYMENT MAP DEFINITIONS (All 60x44)
// ============================================

const DEPLOYMENT_MAPS: Record<string, DeploymentMap> = {

  'hammer-and-anvil': {
    id: 'hammer-and-anvil',
    name: 'Hammer and Anvil',
    zones: [
      {
        name: 'Opponent Deployment',
        color: 'red',
        shape: 'rectangle',
        position: { x: 0, y: 0 },
        dimensions: { width: 20, height: 44 },
      },
      {
        name: 'Your Deployment',
        color: 'green',
        shape: 'rectangle',
        position: { x: 40, y: 0 },
        dimensions: { width: 20, height: 44 },
      },
    ],
    objectives: [
      { number: 1, x: 50, y: 22 },
      { number: 2, x: 30, y: 8 },
      { number: 3, x: 30, y: 22 },
      { number: 4, x: 30, y: 36 },
      { number: 5, x: 10, y: 22 },
    ],
    dividerLines: [],
  },

  'search-and-destroy': {
    id: 'search-and-destroy',
    name: 'Search and Destroy',
    zones: [
      // Top-left quarter (neutral)
      {
        name: 'No Mans Land',
        color: 'neutral',
        shape: 'rectangle',
        position: { x: 0, y: 0 },
        dimensions: { width: 30, height: 22 },
      },
      // Top-right quarter (attacker - red)
      {
        name: 'Attacker Deployment',
        color: 'red',
        shape: 'rectangle',
        position: { x: 30, y: 0 },
        dimensions: { width: 30, height: 22 },
      },
      // Bottom-left quarter (defender - green)
      {
        name: 'Defender Deployment',
        color: 'green',
        shape: 'rectangle',
        position: { x: 0, y: 22 },
        dimensions: { width: 30, height: 22 },
      },
      // Bottom-right quarter (neutral)
      {
        name: 'No Mans Land',
        color: 'neutral',
        shape: 'rectangle',
        position: { x: 30, y: 22 },
        dimensions: { width: 30, height: 22 },
      },
      // Center circle (neutral no man's land) - renders LAST so it's on top
      {
        name: 'No Mans Land',
        color: 'neutral',
        shape: 'circle',
        position: { x: 30, y: 22 },
        dimensions: { width: 0, height: 0 },
        radius: 9,
      },
    ],
    objectives: [
      { number: 1, x: 46, y: 33 },
      { number: 2, x: 46, y: 11 },
      { number: 3, x: 30, y: 22 },
      { number: 4, x: 14, y: 11 },
      { number: 5, x: 14, y: 33 },
    ],
    dividerLines: [
      // Line from right middle edge to center circle (attacker connection)
      { x1: 60, y1: 22, x2: 39, y2: 22, color: '#f97316', dashed: true },
    ],
  },
};

// ============================================
// COMPONENT
// ============================================

interface TacticalMapViewProps {
  deploymentType: string;
  objectives: Array<{
    objectiveNumber: number;
    controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
    controllingUnit?: string;
  }>;
  onObjectiveClick: (objectiveNumber: number, newState: 'attacker' | 'defender' | 'contested' | 'none') => void;
  battleRound: number;
  sessionId: string;
  isModal?: boolean;
}

export default function TacticalMapView({
  deploymentType,
  objectives,
  onObjectiveClick,
  battleRound,
  sessionId,
  isModal = false
}: TacticalMapViewProps) {
  const [selectedObjective, setSelectedObjective] = useState<number | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [localObjectives, setLocalObjectives] = useState(objectives);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const deployment = DEPLOYMENT_MAPS[deploymentType] || DEPLOYMENT_MAPS['hammer-and-anvil'];

  // Sync local state with props when they change (from parent refresh)
  useEffect(() => {
    setLocalObjectives(objectives);
  }, [objectives]);

  // Fetch objective timeline events when timeline is opened or objectives change
  useEffect(() => {
    if (showTimeline && sessionId) {
      fetchObjectiveTimeline();
    }
  }, [showTimeline, sessionId, objectives]);

  const fetchObjectiveTimeline = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only objective events
        const objectiveEvents = (data.timelineEvents || [])
          .filter((event: any) => event.eventType === 'objective')
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTimelineEvents(objectiveEvents);
      }
    } catch (error) {
      console.error('Failed to fetch timeline events:', error);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedObjective !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.objective-popup') && !target.closest('.objective-marker')) {
          setSelectedObjective(null);
          setPopupPosition(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedObjective]);
  
  const getObjectiveColor = (controlledBy: string) => {
    switch (controlledBy) {
      case 'attacker':
        return '#b84a4a'; // grimlog-red - Attacker
      case 'defender':
        return '#a8c5a0'; // grimlog-green - Defender
      case 'contested':
        return '#d4a04c'; // grimlog-amber - Contested
      case 'none':
      default:
        return '#4b5563'; // gray-600 - Unclaimed
    }
  };

  const getObjectiveState = (objectiveNumber: number) => {
    const obj = localObjectives.find(o => o.objectiveNumber === objectiveNumber);
    return obj ? obj.controlledBy : 'none';
  };

  const getZoneColor = (color: 'green' | 'red' | 'neutral') => {
    switch (color) {
      case 'green':
        return '#6b9e78'; // grimlog-dark-green - Defender zone fill
      case 'red':
        return '#784a4a'; // grimlog-dark-red - Attacker zone fill
      case 'neutral':
      default:
        return '#6b7280'; // gray-500 - Neutral zone fill
    }
  };

  const handleObjectiveMarkerClick = (objNumber: number, event: React.MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const containerRect = svgRef.current.parentElement?.getBoundingClientRect();
    
    if (!containerRect) return;

    // Use client coordinates directly (already in screen space)
    const clickX = event.clientX - containerRect.left;
    const clickY = event.clientY - containerRect.top;

    setSelectedObjective(objNumber);
    setPopupPosition({ x: clickX, y: clickY });
  };

  const handleStateSelection = (objNumber: number, newState: 'attacker' | 'defender' | 'contested' | 'none') => {
    // 1. Optimistic UI update - change state immediately
    setLocalObjectives(prev => prev.map(obj => 
      obj.objectiveNumber === objNumber 
        ? { ...obj, controlledBy: newState }
        : obj
    ));
    
    // 2. Close popup
    setSelectedObjective(null);
    setPopupPosition(null);
    
    // 3. Call parent callback (which triggers API)
    // Parent will call onRefresh() after API succeeds, which will sync localObjectives via useEffect
    onObjectiveClick(objNumber, newState);
  };

  const renderZone = (zone: DeploymentZone, index: number) => {
    const color = getZoneColor(zone.color);
    const strokeColor = zone.color === 'green' ? '#a8c5a0' : zone.color === 'red' ? '#b84a4a' : '#9ca3af';

    switch (zone.shape) {
      case 'rectangle':
        return (
          <rect
            key={index}
            x={zone.position.x}
            y={zone.position.y}
            width={zone.dimensions.width}
            height={zone.dimensions.height}
            fill={color}
            fillOpacity="0.4"
            stroke={strokeColor}
            strokeWidth="0.6"
            strokeDasharray={zone.color !== 'neutral' ? '2,1' : undefined}
          />
        );

      case 'triangle':
        if (!zone.trianglePoints) return null;
        const points = zone.trianglePoints.map(p => `${p.x},${p.y}`).join(' ');
        return (
          <polygon
            key={index}
            points={points}
            fill={color}
            fillOpacity="0.3"
            stroke={strokeColor}
            strokeWidth="0.6"
            strokeDasharray={zone.color !== 'neutral' ? '2,1' : undefined}
          />
        );

      case 'circle':
        if (!zone.radius) return null;
        // Make circles fully opaque so they cover zones underneath
        return (
          <circle
            key={index}
            cx={zone.position.x}
            cy={zone.position.y}
            r={zone.radius}
            fill={color}
            fillOpacity="1"
            stroke={strokeColor}
            strokeWidth="0.6"
            strokeDasharray={zone.color !== 'neutral' ? '2,1' : undefined}
          />
        );

      case 'L-shape':
        if (!zone.segments) return null;
        return (
          <g key={index}>
            {zone.segments.map((seg, segIdx) => (
              <rect
                key={segIdx}
                x={seg.x}
                y={seg.y}
                width={seg.width}
                height={seg.height}
                fill={color}
                fillOpacity="0.3"
                stroke={strokeColor}
                strokeWidth="0.6"
                strokeDasharray={zone.color !== 'neutral' ? '2,1' : undefined}
              />
            ))}
          </g>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`w-full h-full flex flex-col relative ${isModal ? 'bg-transparent' : 'bg-grimlog-black'}`}>
      {/* Map Header - Hidden in Modal Mode */}
      {!isModal && (
        <div className="p-3 bg-grimlog-gray border-b-2 border-grimlog-steel flex items-center justify-between gap-3">
          <h3 className="text-base md:text-lg font-bold text-grimlog-orange tracking-wider uppercase">
            {deployment.name}
          </h3>
          
          {/* Round Indicators */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((round) => (
              <div
                key={round}
                className={`
                  w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm
                  transition-all duration-200
                  ${round <= battleRound
                    ? round === battleRound
                      ? 'bg-grimlog-orange text-black shadow-lg ring-2 ring-grimlog-amber'
                      : 'bg-grimlog-steel text-grimlog-light-steel'
                    : 'bg-grimlog-black border-2 border-grimlog-steel text-grimlog-steel opacity-40'
                  }
                `}
                title={`Round ${round}${round === battleRound ? ' (Current)' : round < battleRound ? ' (Complete)' : ' (Future)'}`}
              >
                {round}
              </div>
            ))}
          </div>

          {/* Timeline Toggle Button */}
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`
              px-2 py-1 text-xs font-bold rounded transition-all
              ${showTimeline 
                ? 'bg-grimlog-orange text-black' 
                : 'bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-orange border-2 border-grimlog-steel'
              }
            `}
            title="Toggle objective timeline"
          >
            📜 {showTimeline ? 'HIDE' : 'TIMELINE'}
          </button>
        </div>
      )}

      {/* SVG Map */}
      <div className={`flex-1 flex items-center justify-center overflow-hidden relative ${isModal ? 'p-2' : 'p-4 md:p-8'}`}>
        {/* Timeline Toggle Button in Modal Mode (Floating) */}
        {isModal && (
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`
              absolute top-4 right-4 z-[60] px-3 py-1.5 text-xs font-bold rounded shadow-xl transition-all
              ${showTimeline 
                ? 'bg-grimlog-orange text-black' 
                : 'bg-grimlog-steel/80 backdrop-blur-sm hover:bg-grimlog-light-steel text-grimlog-orange border-2 border-grimlog-orange/50'
              }
            `}
          >
            📜 {showTimeline ? 'HIDE TIMELINE' : 'VIEW TIMELINE'}
          </button>
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 60 44"
          preserveAspectRatio="xMidYMid meet"
          className="w-full shadow-2xl"
          style={{ 
            maxWidth: isModal ? '100%' : '800px',
            maxHeight: isModal ? 'calc(90vh - 180px)' : 'none',
            background: '#374151'
          }}
        >
          {/* Outer Map Border */}
          <rect
            x="0"
            y="0"
            width="60"
            height="44"
            fill="none"
            stroke="#6b7280"
            strokeWidth="0.3"
          />

          {/* Deployment Zones */}
          {deployment.zones.map((zone, idx) => renderZone(zone, idx))}

          {/* Center Crosshairs (always visible) */}
              <line
            x1="30"
                y1="0"
            x2="30"
            y2="44"
            stroke="#4b5563"
            strokeWidth="0.4"
            strokeDasharray="1,1"
            opacity="0.5"
              />
              <line
            x1="0"
            y1="22"
            x2="60"
            y2="22"
            stroke="#4b5563"
            strokeWidth="0.4"
            strokeDasharray="1,1"
            opacity="0.5"
          />

          {/* Deployment-Specific Divider Lines */}
          {deployment.dividerLines?.map((line, idx) => (
            <line
              key={idx}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color || '#1f2937'}
              strokeWidth="0.6"
              strokeDasharray={line.dashed ? '2,1' : undefined}
            />
          ))}

          {/* Objective Markers */}
          {deployment.objectives.map((obj) => {
            const state = getObjectiveState(obj.number);
            const color = getObjectiveColor(state);
            const isSelected = selectedObjective === obj.number;
            
            return (
              <g
                key={obj.number}
                onClick={(e) => handleObjectiveMarkerClick(obj.number, e)}
                className="cursor-pointer objective-marker"
              >
                {/* Subtle Glow */}
                <circle
                  cx={obj.x}
                  cy={obj.y}
                  r="3.5"
                  fill={color}
                  fillOpacity="0.2"
                >
                  <animate
                    attributeName="opacity"
                    values="0.2;0.3;0.2"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
                
                {/* Main Circle */}
                <circle
                  cx={obj.x}
                  cy={obj.y}
                  r="3.2"
                  fill={color}
                  stroke="#1f2937"
                  strokeWidth="0.5"
                />
                
                {/* Outer Ring */}
                <circle
                  cx={obj.x}
                  cy={obj.y}
                  r="2.6"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="0.3"
                  opacity="0.4"
                />
                
                {/* Objective Number */}
                <text
                  x={obj.x + 0.19}
                  y={obj.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#d1d5db"
                  fontSize="2.6"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {obj.number}
                </text>
                
                {/* Hit Area with Highlight */}
                <circle
                  cx={obj.x}
                  cy={obj.y}
                  r="5.5"
                  fill="transparent"
                  className={`hover:stroke-grimlog-orange hover:stroke-[0.6px] transition-all ${
                    isSelected ? 'stroke-grimlog-orange stroke-[1.2px]' : ''
                  }`}
                />
              </g>
            );
          })}
        </svg>

        {/* Objective State Popup */}
        {selectedObjective !== null && popupPosition && (() => {
          // Calculate smart positioning based on available space
          const popupWidth = 280; // Increased width for better mobile experience
          const containerWidth = svgRef.current?.parentElement?.getBoundingClientRect().width || 800;
          const spaceOnRight = containerWidth - popupPosition.x;
          const spaceOnLeft = popupPosition.x;
          
          // If less than 150px space on right, try to position differently
          let transformX = '-50%'; // Default: center on objective
          if (spaceOnRight < 150 && spaceOnLeft > 150) {
            // Flip to left-aligned when too close to right edge
            transformX = '-100%';
          } else if (spaceOnLeft < 150 && spaceOnRight > 150) {
            // Align to right when too close to left edge
            transformX = '0%';
          }
          
          return (
            <div
              className="objective-popup absolute bg-grimlog-gray border-2 border-grimlog-orange shadow-2xl z-50 p-4 rounded-lg"
              style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
                transform: `translate(${transformX}, -100%) translateY(-40px)`,
                minWidth: '260px',
                maxWidth: '320px',
              }}
            >
              <div className="text-sm font-bold text-grimlog-orange mb-3 text-center">
                Objective {selectedObjective}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleStateSelection(selectedObjective, 'attacker')}
                  className="min-h-[48px] px-1 py-1 bg-grimlog-red hover:bg-grimlog-dark-red active:bg-grimlog-dark-red border-2 border-grimlog-red hover:border-grimlog-dark-red text-white text-sm font-bold rounded transition-all whitespace-nowrap shadow-md active:scale-[0.98]"
                >
                  Attacker
                </button>
                <button
                  onClick={() => handleStateSelection(selectedObjective, 'defender')}
                  className="min-h-[48px] px-1 py-1 bg-grimlog-green hover:bg-grimlog-dark-green active:bg-grimlog-dark-green border-2 border-grimlog-green hover:border-grimlog-dark-green text-grimlog-black text-sm font-bold rounded transition-all whitespace-nowrap shadow-md active:scale-[0.98]"
                >
                  Defender
                </button>
                <button
                  onClick={() => handleStateSelection(selectedObjective, 'contested')}
                  className="min-h-[48px] px-1 py-1 bg-grimlog-amber bg-opacity-50 hover:bg-opacity-70 active:bg-opacity-70 border-2 border-grimlog-amber text-grimlog-black text-sm font-bold rounded transition-all whitespace-nowrap shadow-md active:scale-[0.98]"
                >
                  Contested
                </button>
                <button
                  onClick={() => handleStateSelection(selectedObjective, 'none')}
                  className="min-h-[48px] px-1 py-1 bg-grimlog-gray hover:bg-grimlog-steel active:bg-grimlog-steel border-2 border-grimlog-steel hover:border-grimlog-light-steel text-white text-sm font-bold rounded transition-all whitespace-nowrap shadow-md active:scale-[0.98]"
                >
                  Unclaimed
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Objective Timeline Panel */}
      {showTimeline && (
        <div className="absolute inset-y-0 right-0 w-full md:w-80 bg-grimlog-gray border-l-4 border-grimlog-orange shadow-2xl z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out">
          {/* Timeline Header */}
          <div className="p-3 bg-grimlog-black border-b-2 border-grimlog-steel flex items-center justify-between">
            <h4 className="text-sm font-bold text-grimlog-orange tracking-wider uppercase">
              📜 Objective Timeline
            </h4>
            <button
              onClick={() => setShowTimeline(false)}
              className="text-grimlog-steel hover:text-grimlog-orange transition-colors text-lg"
              aria-label="Close timeline"
            >
              ✕
            </button>
          </div>

          {/* Timeline Events */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {timelineEvents.length === 0 ? (
              <div className="text-center text-grimlog-steel text-sm py-8">
                No objective changes yet
              </div>
            ) : (
              timelineEvents.map((event) => {
                const metadata = event.metadata ? JSON.parse(event.metadata) : {};
                const objNum = metadata.objectiveNumber || '?';
                const controlled = metadata.controlledBy || 'none';
                const previous = metadata.previouslyControlledBy || 'none';
                const round = metadata.battleRound || '?';
                const phase = event.phase || 'Unknown';
                
                const colorMap: Record<string, string> = {
                  attacker: 'text-grimlog-red',
                  defender: 'text-grimlog-green',
                  player: 'text-grimlog-green', // Legacy support
                  opponent: 'text-grimlog-red', // Legacy support
                  contested: 'text-grimlog-amber',
                  none: 'text-grimlog-steel'
                };
                
                const labelMap: Record<string, string> = {
                  attacker: 'Attacker',
                  defender: 'Defender',
                  player: 'Defender', // Legacy support
                  opponent: 'Attacker', // Legacy support
                  contested: 'Contested',
                  none: 'Unclaimed'
                };

                return (
                  <div
                    key={event.id}
                    className="bg-grimlog-black border-2 border-grimlog-steel p-2 rounded text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-grimlog-orange">
                        Objective {objNum}
                      </span>
                      <span className="text-grimlog-steel font-mono text-[10px]">
                        R{round} • {phase}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={colorMap[previous]}>
                        {labelMap[previous]}
                      </span>
                      <span className="text-grimlog-steel">→</span>
                      <span className={`${colorMap[controlled]} font-bold`}>
                        {labelMap[controlled]}
                      </span>
                    </div>
                    <div className="text-grimlog-steel text-[10px] mt-1">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Legend - Hidden in Modal Mode (moved to modal footer) */}
      {!isModal && (
        <div className="p-3 bg-grimlog-gray border-t-2 border-grimlog-steel">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-grimlog-red border-2 border-grimlog-black"></div>
              <span className="text-grimlog-light-steel font-mono">Attacker Control</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-grimlog-green border-2 border-grimlog-black"></div>
              <span className="text-grimlog-light-steel font-mono">Defender Control</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-grimlog-amber border-2 border-grimlog-black"></div>
              <span className="text-grimlog-light-steel font-mono">Contested</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-grimlog-steel border-2 border-grimlog-black"></div>
              <span className="text-grimlog-light-steel font-mono">Unclaimed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DEPLOYMENT_TYPES = Object.keys(DEPLOYMENT_MAPS).map(key => ({
  value: key,
  label: DEPLOYMENT_MAPS[key].name
}));
