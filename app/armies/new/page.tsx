'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MechanicusFrame from '@/components/MechanicusFrame';
import { ParsedArmyList, ParsedUnit } from '@/lib/types';
import Toast from '@/components/Toast';
import FactionIcon from '@/components/FactionIcon';
import AddUnitModal from '@/components/AddUnitModal';

interface Faction {
  id: string;
  name: string;
  datasheetCount: number;
  stratagemCount: number;
  parentFaction: { id: string; name: string } | null;
}

type Step = 'setup' | 'build' | 'review';
type Mode = 'import' | 'manual';

export default function CreateArmyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('import');
  const [step, setStep] = useState<Step>('setup');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loadingFactions, setLoadingFactions] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedArmyList | null>(null);
  const [manualUnits, setManualUnits] = useState<any[]>([]);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [availableDetachments, setAvailableDetachments] = useState<string[]>([]);
  const [loadingDetachments, setLoadingDetachments] = useState(false);
  const [selectedDetachment, setSelectedDetachment] = useState<string>('');
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [reviewedUnits, setReviewedUnits] = useState<Set<number>>(new Set());
  // Editing state for weapon/ability re-matching
  const [editingItem, setEditingItem] = useState<{
    unitIndex: number;
    itemType: 'weapon' | 'ability';
    itemIndex: number;
  } | null>(null);
  const [datasheetOptions, setDatasheetOptions] = useState<{
    [datasheetId: string]: {
      weapons: Array<{ id: string; name: string; range: string; type: string; attacks: string; strength: string; armorPenetration: string; damage: string; abilities: string[] }>;
      abilities: Array<{ id: string; name: string; type: string; description: string }>;
    };
  }>({});
  const [loadingDatasheetOptions, setLoadingDatasheetOptions] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    playerName: '',
    faction: '',
    armyName: '',
    pointsLimit: 2000,
  });

  // Helper functions for review statistics
  const getReviewStats = () => {
    const units = mode === 'import' ? (parsedData?.units || []) : manualUnits;
    
    let unitsNeedingReview = 0;
    let unmatchedWeapons = 0;
    let lowConfidenceWeapons = 0;
    let wargearItems = 0;
    let unmatchedAbilities = 0;
    
    units.forEach((unit, index) => {
      // Count weapon issues
      unit.weapons?.forEach((weapon: any) => {
        if (!weapon.weaponId || weapon.matchConfidence === 0) {
          unmatchedWeapons++;
        } else if (weapon.matchConfidence < 0.8) {
          lowConfidenceWeapons++;
        }
      });
      
      // Count wargear and ability issues - only count unmatched or low confidence
      unit.abilities?.forEach((ability: any) => {
        const isUnmatched = !ability.abilityId;
        const isLowConfidence = (ability.matchConfidence ?? 0) < 0.8;
        
        if (ability.type === 'wargear' && (isUnmatched || isLowConfidence)) {
          wargearItems++;
        } else if (isUnmatched || isLowConfidence) {
          unmatchedAbilities++;
        }
      });
      
      // Only count unit as needing review if it has detectable issues
      const unitIssueCount = unit.weapons?.filter((w: any) => !w.weaponId || w.matchConfidence < 0.8).length || 0;
      const abilityIssueCount = unit.abilities?.filter((a: any) => {
        const isUnmatched = !a.abilityId;
        const isLowConfidence = (a.matchConfidence ?? 0) < 0.8;
        return isUnmatched || isLowConfidence;
      }).length || 0;
      
      if ((unitIssueCount > 0 || abilityIssueCount > 0) && !reviewedUnits.has(index)) {
        unitsNeedingReview++;
      }
    });
    
    return {
      unitsNeedingReview,
      unmatchedWeapons,
      lowConfidenceWeapons,
      wargearItems,
      unmatchedAbilities,
      totalIssues: unmatchedWeapons + lowConfidenceWeapons + unmatchedAbilities
    };
  };
  
  // Get specific issues for a unit
  const getUnitIssues = (unit: any) => {
    const issues: { type: 'weapon' | 'ability' | 'wargear'; name: string; confidence: number }[] = [];
    
    unit.weapons?.forEach((weapon: any) => {
      if (!weapon.weaponId || weapon.matchConfidence < 0.8) {
        issues.push({
          type: 'weapon',
          name: weapon.name,
          confidence: weapon.matchConfidence || 0
        });
      }
    });
    
    unit.abilities?.forEach((ability: any) => {
      // Only flag abilities/wargear as issues if they're unmatched or low confidence
      const isUnmatched = !ability.abilityId;
      const isLowConfidence = (ability.matchConfidence ?? 0) < 0.8;
      
      if (isUnmatched || isLowConfidence) {
        issues.push({
          type: ability.type === 'wargear' ? 'wargear' : 'ability',
          name: ability.name,
          confidence: ability.matchConfidence || 0
        });
      }
    });
    
    return issues;
  };
  
  // Mark unit as manually reviewed
  const handleMarkReviewed = (index: number) => {
    setReviewedUnits(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };
  
  // Remove weapon from unit
  const handleRemoveWeapon = (unitIndex: number, weaponIndex: number) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        weapons: updatedUnits[unitIndex].weapons.filter((_, i) => i !== weaponIndex)
      };
      setParsedData({ ...parsedData, units: updatedUnits });
    }
  };
  
  // Remove ability from unit
  const handleRemoveAbility = (unitIndex: number, abilityIndex: number) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        abilities: updatedUnits[unitIndex].abilities.filter((_, i) => i !== abilityIndex)
      };
      setParsedData({ ...parsedData, units: updatedUnits });
    }
  };
  
  // Fetch datasheet options (weapons/abilities) for editing dropdowns
  const fetchDatasheetOptions = async (datasheetId: string) => {
    if (datasheetOptions[datasheetId] || !datasheetId) return;
    
    setLoadingDatasheetOptions(datasheetId);
    try {
      const response = await fetch(`/api/datasheets/detail/${datasheetId}`);
      if (response.ok) {
        const data = await response.json();
        setDatasheetOptions(prev => ({
          ...prev,
          [datasheetId]: {
            weapons: data.weapons || [],
            abilities: data.abilities || []
          }
        }));
      }
    } catch (err) {
      console.error('Failed to fetch datasheet options:', err);
    } finally {
      setLoadingDatasheetOptions(null);
    }
  };
  
  // Start editing a weapon or ability
  const handleStartEdit = (unitIndex: number, itemType: 'weapon' | 'ability', itemIndex: number) => {
    const unit = parsedData?.units[unitIndex];
    if (!unit?.parsedDatasheet?.datasheetId) return;
    
    // Fetch datasheet options if not already loaded
    fetchDatasheetOptions(unit.parsedDatasheet.datasheetId);
    
    setEditingItem({ unitIndex, itemType, itemIndex });
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItem(null);
  };
  
  // Update weapon with new match from datasheet
  const handleSelectWeapon = (unitIndex: number, weaponIndex: number, selectedWeapon: any) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      const currentWeapon = updatedUnits[unitIndex].weapons[weaponIndex];
      
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        weapons: updatedUnits[unitIndex].weapons.map((w, i) => 
          i === weaponIndex ? {
            ...w,
            weaponId: selectedWeapon.id,
            name: selectedWeapon.name,
            range: selectedWeapon.range,
            type: selectedWeapon.type,
            attacks: selectedWeapon.attacks,
            strength: selectedWeapon.strength,
            armorPenetration: selectedWeapon.armorPenetration,
            damage: selectedWeapon.damage,
            abilities: selectedWeapon.abilities || [],
            matchConfidence: 1.0, // Manual match = perfect confidence
            needsReview: false
          } : w
        )
      };
      setParsedData({ ...parsedData, units: updatedUnits });
      setEditingItem(null);
      setToast({ message: `Updated weapon to "${selectedWeapon.name}"`, type: 'success' });
    }
  };
  
  // Update ability with new match from datasheet
  const handleSelectAbility = (unitIndex: number, abilityIndex: number, selectedAbility: any) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        abilities: updatedUnits[unitIndex].abilities.map((a, i) => 
          i === abilityIndex ? {
            ...a,
            abilityId: selectedAbility.id,
            name: selectedAbility.name,
            type: selectedAbility.type,
            description: selectedAbility.description,
            matchConfidence: 1.0, // Manual match = perfect confidence
            needsReview: false
          } : a
        )
      };
      setParsedData({ ...parsedData, units: updatedUnits });
      setEditingItem(null);
      setToast({ message: `Updated ability to "${selectedAbility.name}"`, type: 'success' });
    }
  };
  
  // Convert weapon to wargear (move from weapons to abilities)
  const handleConvertToWargear = (unitIndex: number, weaponIndex: number) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      const weapon = updatedUnits[unitIndex].weapons[weaponIndex];
      
      // Create wargear ability entry
      const wargearAbility = {
        abilityId: null,
        name: weapon.name,
        type: 'wargear',
        description: `${weapon.name} wargear`,
        phase: undefined,
        matchConfidence: 0.5,
        needsReview: true
      };
      
      // Remove from weapons, add to abilities
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        weapons: updatedUnits[unitIndex].weapons.filter((_, i) => i !== weaponIndex),
        abilities: [...(updatedUnits[unitIndex].abilities || []), wargearAbility]
      };
      
      setParsedData({ ...parsedData, units: updatedUnits });
      setEditingItem(null);
      setToast({ message: `Converted "${weapon.name}" to wargear`, type: 'success' });
    }
  };
  
  // Add a weapon from datasheet that wasn't detected
  const handleAddWeaponFromDatasheet = (unitIndex: number, selectedWeapon: any) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      
      const newWeapon = {
        weaponId: selectedWeapon.id,
        name: selectedWeapon.name,
        range: selectedWeapon.range,
        type: selectedWeapon.type,
        attacks: selectedWeapon.attacks,
        ballisticSkill: selectedWeapon.ballisticSkill,
        weaponSkill: selectedWeapon.weaponSkill,
        strength: selectedWeapon.strength,
        armorPenetration: selectedWeapon.armorPenetration,
        damage: selectedWeapon.damage,
        abilities: selectedWeapon.abilities || [],
        matchConfidence: 1.0,
        needsReview: false
      };
      
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        weapons: [...(updatedUnits[unitIndex].weapons || []), newWeapon]
      };
      
      setParsedData({ ...parsedData, units: updatedUnits });
      setToast({ message: `Added weapon "${selectedWeapon.name}"`, type: 'success' });
    }
  };
  
  // Add an ability from datasheet that wasn't detected
  const handleAddAbilityFromDatasheet = (unitIndex: number, selectedAbility: any) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = [...parsedData.units];
      
      const newAbility = {
        abilityId: selectedAbility.id,
        name: selectedAbility.name,
        type: selectedAbility.type,
        description: selectedAbility.description,
        phase: selectedAbility.phase,
        matchConfidence: 1.0,
        needsReview: false
      };
      
      updatedUnits[unitIndex] = {
        ...updatedUnits[unitIndex],
        abilities: [...(updatedUnits[unitIndex].abilities || []), newAbility]
      };
      
      setParsedData({ ...parsedData, units: updatedUnits });
      setToast({ message: `Added ability "${selectedAbility.name}"`, type: 'success' });
    }
  };

  // Fetch factions on mount
  useEffect(() => {
    fetchFactions();
  }, []);

  // Fetch detachments when faction changes
  useEffect(() => {
    if (selectedFaction?.id) {
      fetchDetachments();
    }
  }, [selectedFaction]);

  const fetchFactions = async () => {
    try {
      const response = await fetch('/api/factions');
      if (response.ok) {
        const data = await response.json();
        setFactions(data);
      } else {
        setError('Failed to load factions');
      }
    } catch (err) {
      console.error('Failed to fetch factions:', err);
      setError('Failed to load factions');
    } finally {
      setLoadingFactions(false);
    }
  };

  const fetchDetachments = async () => {
    if (!selectedFaction) return;
    setLoadingDetachments(true);
    try {
      const response = await fetch(`/api/factions/${selectedFaction.id}/detachments`);
      if (response.ok) {
        const detachments = await response.json();
        setAvailableDetachments(detachments);
      }
    } catch (err) {
      console.error('Failed to fetch detachments:', err);
    } finally {
      setLoadingDetachments(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload an image (JPG, PNG), PDF, or TXT file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile || !selectedFaction) return;

    setUploading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('factionId', selectedFaction.id);
      formDataToSend.append('factionName', selectedFaction.name);

      const response = await fetch('/api/armies/parse', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse army list');
      }

      const parsed: ParsedArmyList = await response.json();
      setParsedData(parsed);
      
      // Only update faction from AI detection if user hasn't already selected one
      // User-selected faction (e.g., "Space Wolves") matches database exactly,
      // while AI may return compound names (e.g., "Space Marines (Space Wolves)")
      if (parsed.detectedFaction && !formData.faction) {
        setFormData(prev => ({ ...prev, faction: parsed.detectedFaction || '' }));
      }
      if (parsed.detectedPointsLimit) {
        setFormData(prev => ({ ...prev, pointsLimit: parsed.detectedPointsLimit || 2000 }));
      }
      
      // Pre-select detected detachment
      if (parsed.detectedDetachment && availableDetachments.includes(parsed.detectedDetachment)) {
        setSelectedDetachment(parsed.detectedDetachment);
      }

      setStep('review');
      setToast({ message: `Parsed ${parsed.units.length} units successfully!`, type: 'success' });
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse army list');
      setToast({ message: 'Failed to parse army list', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveUnit = (index: number) => {
    if (mode === 'import' && parsedData) {
      const updatedUnits = parsedData.units.filter((_, i) => i !== index);
      setParsedData({ ...parsedData, units: updatedUnits });
    } else {
      setManualUnits(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddManualUnit = (unit: any) => {
    setManualUnits(prev => [...prev, unit]);
    setToast({ message: `Added ${unit.name}`, type: 'success' });
  };

  const handleSaveArmy = async () => {
    const units = mode === 'import' ? parsedData?.units : manualUnits;
    if (!units || units.length === 0) {
      setError('Please add at least one unit');
      return;
    }

    if (!formData.playerName || !formData.faction || !formData.armyName) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (!selectedDetachment) {
      setError('Please select a detachment for your army');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/armies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: formData.playerName,
          faction: formData.faction,
          armyName: formData.armyName,
          pointsLimit: formData.pointsLimit,
          detachment: selectedDetachment,
          units: units,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to save army');
      }

      const result = await response.json();
      
      let message = `Army created successfully!`;
      if (result.stats) {
        message += ` ${result.stats.totalUnits} units added`;
        if (result.stats.unitsNeedingReview > 0) {
          message += ` (${result.stats.unitsNeedingReview} need review)`;
        }
      }
      
      setToast({ message, type: 'success' });
      setTimeout(() => {
        router.push(`/armies/${result.id}`);
      }, 1500);
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save army';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const currentUnits = mode === 'import' ? (parsedData?.units || []) : manualUnits;
  const totalPoints = currentUnits.reduce((sum, unit) => sum + (unit.pointsCost || 0), 0);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  
  const selectFaction = (faction: Faction) => {
    setSelectedFaction(faction);
    setFormData({ ...formData, faction: faction.name });
    setIsDropdownOpen(false);
  };

  const canProceedToReview = () => {
    if (mode === 'import') {
      return selectedFile && selectedFaction;
    }
    return selectedFaction && manualUnits.length > 0;
  };

  const handleStartManualBuild = () => {
    if (!selectedFaction) return;
    setStep('build');
  };

  return (
    <>
      <MechanicusFrame />
      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
      
      <AddUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => setIsAddUnitModalOpen(false)}
        factionId={selectedFaction?.id || ''}
        factionName={selectedFaction?.name || ''}
        includeParentFaction={!!selectedFaction?.parentFaction}
        onAddUnit={handleAddManualUnit}
      />
      
      <main className="min-h-screen pt-4 pb-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <header className="text-center py-6 border-b-2 border-grimlog-steel mb-8">
            <h1 className="text-4xl font-bold text-grimlog-orange glow-orange tracking-widest">
              CREATE ARMY
            </h1>
            <p className="text-grimlog-light-steel text-sm font-mono mt-2">
              .:| IMPORT OR BUILD YOUR FORCES |:.
            </p>
          </header>

          {/* Mode Toggle - Only show in setup step */}
          {step === 'setup' && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex border-2 border-grimlog-steel">
                <button
                  onClick={() => setMode('import')}
                  className={`px-6 py-3 font-bold tracking-wider transition-colors ${
                    mode === 'import'
                      ? 'bg-grimlog-orange text-grimlog-black'
                      : 'bg-grimlog-black text-grimlog-light-steel hover:text-white'
                  }`}
                >
                  IMPORT LIST
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`px-6 py-3 font-bold tracking-wider transition-colors ${
                    mode === 'manual'
                      ? 'bg-grimlog-orange text-grimlog-black'
                      : 'bg-grimlog-black text-grimlog-light-steel hover:text-white'
                  }`}
                >
                  BUILD MANUALLY
                </button>
              </div>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex justify-center mb-8 gap-4">
            <div className={`flex items-center gap-2 ${step === 'setup' ? 'text-grimlog-orange' : 'text-grimlog-steel'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'setup' ? 'border-grimlog-orange bg-grimlog-orange text-grimlog-black' : 'border-grimlog-steel'}`}>
                1
              </div>
              <span className="font-bold">SETUP</span>
            </div>
            <div className="w-16 border-t-2 border-grimlog-steel self-center"></div>
            {mode === 'manual' && (
              <>
                <div className={`flex items-center gap-2 ${step === 'build' ? 'text-grimlog-orange' : 'text-grimlog-steel'}`}>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'build' ? 'border-grimlog-orange bg-grimlog-orange text-grimlog-black' : 'border-grimlog-steel'}`}>
                    2
                  </div>
                  <span className="font-bold">BUILD</span>
                </div>
                <div className="w-16 border-t-2 border-grimlog-steel self-center"></div>
              </>
            )}
            <div className={`flex items-center gap-2 ${step === 'review' ? 'text-grimlog-orange' : 'text-grimlog-steel'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'review' ? 'border-grimlog-orange bg-grimlog-orange text-grimlog-black' : 'border-grimlog-steel'}`}>
                {mode === 'manual' ? '3' : '2'}
              </div>
              <span className="font-bold">REVIEW</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-grimlog-red border-2 border-grimlog-red text-white">
              {error}
            </div>
          )}

          {/* Step 1: Setup (Faction + Mode-specific) */}
          {step === 'setup' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Faction Selection */}
              <div className="border-2 border-grimlog-steel p-8 bg-grimlog-black relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-orange"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-orange"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-grimlog-orange"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-grimlog-orange"></div>

                <h2 className="text-2xl font-bold text-grimlog-orange mb-4 tracking-wider flex items-center gap-2">
                  <span className="text-grimlog-red">1.</span> SELECT FACTION *
                </h2>
                <p className="text-grimlog-light-steel mb-6">
                  Choose your faction to {mode === 'import' ? 'optimize parsing and datasheet matching' : 'browse available units'}.
                </p>

                {loadingFactions ? (
                  <div className="text-center text-grimlog-orange py-8">
                    <div className="text-4xl mb-2 animate-spin">⚙</div>
                    <div>Loading factions...</div>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={toggleDropdown}
                      className={`w-full px-4 py-4 bg-grimlog-darkGray border-2 flex items-center justify-between transition-colors
                        ${isDropdownOpen ? 'border-grimlog-orange' : 'border-grimlog-steel hover:border-grimlog-orange'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {selectedFaction ? (
                          <>
                            <div className="text-grimlog-orange">
                              <FactionIcon factionName={selectedFaction.name} className="w-6 h-6" />
                            </div>
                            <span className="text-lg text-white font-bold tracking-wide">{selectedFaction.name}</span>
                          </>
                        ) : (
                          <span className="text-grimlog-light-steel text-lg">Select faction...</span>
                        )}
                      </div>
                      <span className={`text-grimlog-orange transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-grimlog-black border-2 border-grimlog-orange max-h-96 overflow-y-auto shadow-xl">
                        {factions.map(faction => (
                          <button
                            key={faction.id}
                            onClick={() => selectFaction(faction)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-grimlog-darkGray transition-colors border-b border-grimlog-darkGray last:border-0 text-left"
                          >
                            <div className="text-grimlog-light-steel">
                              <FactionIcon factionName={faction.name} className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-white font-bold">{faction.name}</div>
                              <div className="text-xs text-grimlog-light-steel">{faction.datasheetCount} datasheets</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedFaction && (
                      <div className="mt-4 p-4 bg-grimlog-darkGray border-l-4 border-grimlog-orange">
                        <div className="flex items-center gap-2 text-grimlog-orange font-bold mb-3 uppercase tracking-widest text-sm">
                          <span className="text-lg">ℹ</span> INTELLIGENCE REPORT
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-white">
                            <span className="text-grimlog-light-steel">Datasheets:</span>
                            <span className="font-mono text-grimlog-green">{selectedFaction.datasheetCount}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white">
                            <span className="text-grimlog-light-steel">Stratagems:</span>
                            <span className="font-mono text-grimlog-amber">{selectedFaction.stratagemCount}</span>
                          </div>
                          {selectedFaction.parentFaction && (
                            <div className="col-span-2 flex items-center gap-2 text-grimlog-light-steel mt-2 pt-2 border-t border-grimlog-steel">
                              <span>✓ Includes access to </span>
                              <span className="text-white font-bold">{selectedFaction.parentFaction.name}</span>
                              <span> units</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mode-specific content */}
              {mode === 'import' ? (
                /* File Upload for Import Mode */
                <div className={`border-2 border-grimlog-steel p-8 bg-grimlog-black relative transition-opacity duration-300 ${!selectedFaction ? 'opacity-50' : ''}`}>
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-steel"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-steel"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-grimlog-steel"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-grimlog-steel"></div>

                  <h2 className="text-2xl font-bold text-grimlog-orange mb-4 tracking-wider flex items-center gap-2">
                    <span className="text-grimlog-red">2.</span> UPLOAD YOUR ARMY LIST
                  </h2>
                  <p className="text-grimlog-light-steel mb-6">
                    Upload a photo, PDF, or text file of your army list. The AI will parse it automatically.
                  </p>

                  <div className={`border-2 border-dashed p-12 text-center transition-colors ${selectedFaction ? 'border-grimlog-orange bg-grimlog-darkGray bg-opacity-30 hover:bg-opacity-50' : 'border-grimlog-steel'}`}>
                    {!selectedFile ? (
                      <label className={`cursor-pointer ${!selectedFaction ? 'pointer-events-none' : ''}`}>
                        <input
                          type="file"
                          accept="image/*,.pdf,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={!selectedFaction}
                        />
                        <div className="text-grimlog-orange">
                          <div className="text-6xl mb-4 opacity-80">📄</div>
                          <div className="text-xl font-bold mb-2 uppercase tracking-wide">
                            {selectedFaction ? 'Click to select file' : 'Select faction first'}
                          </div>
                          <div className="text-sm text-grimlog-light-steel">
                            Supports: JPG, PNG, PDF, TXT (Max 10MB)
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div className="text-grimlog-orange">
                        <div className="text-6xl mb-4 text-grimlog-green">✓</div>
                        <div className="text-xl font-bold mb-2 text-white">{selectedFile.name}</div>
                        <div className="text-sm text-grimlog-light-steel mb-4 font-mono">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-grimlog-red hover:text-white underline text-sm font-bold tracking-wide"
                        >
                          REMOVE FILE
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Link
                      href="/armies"
                      className="flex-1 px-6 py-3 bg-grimlog-darkGray hover:bg-grimlog-steel text-white font-bold tracking-wider border-2 border-grimlog-steel text-center transition-all"
                    >
                      CANCEL
                    </Link>
                    <button
                      onClick={handleUploadAndParse}
                      disabled={!selectedFile || !selectedFaction || uploading}
                      className="flex-1 px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-black font-bold tracking-wider border-2 border-grimlog-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'ANALYZING...' : 'PARSE LIST'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Manual Mode - Proceed Button */
                <div className="border-2 border-grimlog-steel p-8 bg-grimlog-black relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-steel"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-steel"></div>

                  <h2 className="text-2xl font-bold text-grimlog-orange mb-4 tracking-wider flex items-center gap-2">
                    <span className="text-grimlog-red">2.</span> BUILD YOUR ARMY
                  </h2>
                  <p className="text-grimlog-light-steel mb-6">
                    Browse datasheets and add units one by one. Full control over your army composition.
                  </p>

                  <div className="flex gap-4">
                    <Link
                      href="/armies"
                      className="flex-1 px-6 py-3 bg-grimlog-darkGray hover:bg-grimlog-steel text-white font-bold tracking-wider border-2 border-grimlog-steel text-center transition-all"
                    >
                      CANCEL
                    </Link>
                    <button
                      onClick={handleStartManualBuild}
                      disabled={!selectedFaction}
                      className="flex-1 px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-black font-bold tracking-wider border-2 border-grimlog-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      START BUILDING
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Build (Manual Mode Only) */}
          {step === 'build' && mode === 'manual' && (
            <div className="space-y-6">
              {/* Army Info Bar */}
              <div className="flex justify-between items-center p-4 bg-grimlog-darkGray border-2 border-grimlog-steel">
                <div className="flex items-center gap-4">
                  <FactionIcon factionName={selectedFaction?.name || ''} className="w-8 h-8 text-grimlog-orange" />
                  <div>
                    <div className="text-white font-bold">{selectedFaction?.name}</div>
                    <div className="text-sm text-grimlog-light-steel">{manualUnits.length} units</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-grimlog-green font-mono">{totalPoints}</div>
                  <div className="text-xs text-grimlog-light-steel">POINTS</div>
                </div>
              </div>

              {/* Units List */}
              <div className="border-2 border-grimlog-steel bg-grimlog-black p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">
                    YOUR UNITS
                  </h2>
                  <button
                    onClick={() => setIsAddUnitModalOpen(true)}
                    className="px-4 py-2 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold tracking-wider transition-colors"
                  >
                    + ADD UNIT
                  </button>
                </div>

                {manualUnits.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-grimlog-steel">
                    <div className="text-6xl mb-4 opacity-50">⚔️</div>
                    <div className="text-xl text-grimlog-light-steel mb-2">No units yet</div>
                    <div className="text-sm text-grimlog-steel mb-4">
                      Click &quot;ADD UNIT&quot; to browse datasheets and build your army
                    </div>
                    <button
                      onClick={() => setIsAddUnitModalOpen(true)}
                      className="px-6 py-2 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold transition-colors"
                    >
                      + ADD YOUR FIRST UNIT
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {manualUnits.map((unit, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-grimlog-darkGray border border-grimlog-steel"
                      >
                        <div>
                          <div className="font-bold text-white">{unit.name}</div>
                          <div className="text-sm text-grimlog-light-steel">
                            {unit.datasheet} • {unit.modelCount} models
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-grimlog-green font-mono font-bold">
                            {unit.pointsCost} pts
                          </div>
                          <button
                            onClick={() => handleRemoveUnit(idx)}
                            className="px-3 py-1 text-grimlog-red hover:text-white border border-grimlog-red hover:bg-grimlog-red transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mt-6 pt-6 border-t border-grimlog-steel">
                  <button
                    onClick={() => setStep('setup')}
                    className="flex-1 px-6 py-3 bg-grimlog-darkGray hover:bg-grimlog-steel text-white font-bold tracking-wider border-2 border-grimlog-steel transition-all"
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={() => setStep('review')}
                    disabled={manualUnits.length === 0}
                    className="flex-1 px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-black font-bold tracking-wider border-2 border-grimlog-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    REVIEW & SAVE →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Army Metadata Form */}
              <div className="border-2 border-grimlog-steel p-6 bg-grimlog-black relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-orange"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-orange"></div>
                
                <h2 className="text-2xl font-bold text-grimlog-orange mb-4 tracking-wider">
                  ARMY DETAILS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                      PLAYER NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.playerName}
                      onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                      className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
                      placeholder="Enter player name"
                    />
                  </div>
                  <div>
                    <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                      FACTION *
                    </label>
                    <input
                      type="text"
                      value={formData.faction}
                      readOnly
                      className="w-full px-4 py-2 bg-grimlog-darkGray border-2 border-grimlog-steel text-grimlog-light-steel outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                      ARMY NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.armyName}
                      onChange={(e) => setFormData({ ...formData, armyName: e.target.value })}
                      className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
                      placeholder="e.g., 'Mars Cohort', 'Blood Angels 1st Company'"
                    />
                  </div>
                  <div>
                    <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                      POINTS LIMIT
                    </label>
                    <input
                      type="number"
                      step="500"
                      min="500"
                      max="5000"
                      value={formData.pointsLimit}
                      onChange={(e) => setFormData({ ...formData, pointsLimit: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                      DETACHMENT *
                    </label>
                    {loadingDetachments ? (
                      <div className="w-full px-4 py-2 bg-grimlog-darkGray border-2 border-grimlog-steel text-grimlog-light-steel">
                        Loading detachments...
                      </div>
                    ) : (
                      <select
                        value={selectedDetachment}
                        onChange={(e) => setSelectedDetachment(e.target.value)}
                        required
                        className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
                      >
                        <option value="">-- Select Detachment --</option>
                        {availableDetachments.map((det) => (
                          <option key={det} value={det}>
                            {det}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Summary Banner */}
              {(() => {
                const stats = getReviewStats();
                const hasIssues = stats.unitsNeedingReview > 0 || stats.totalIssues > 0;
                
                return hasIssues ? (
                  <div className="border-2 border-yellow-600 bg-yellow-900/20 p-4 relative">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-500"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-500"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-500"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-500"></div>
                    
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">⚠</span>
                      <h3 className="text-lg font-bold text-yellow-400 tracking-wider">
                        REVIEW SUMMARY: {stats.unitsNeedingReview} OF {currentUnits.length} UNITS NEED ATTENTION
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      {stats.unmatchedWeapons > 0 && (
                        <div className="flex items-center gap-2 text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className="font-mono">{stats.unmatchedWeapons}</span>
                          <span className="text-grimlog-light-steel">weapons not matched</span>
                        </div>
                      )}
                      {stats.lowConfidenceWeapons > 0 && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          <span className="font-mono">{stats.lowConfidenceWeapons}</span>
                          <span className="text-grimlog-light-steel">weapons uncertain</span>
                        </div>
                      )}
                      {stats.wargearItems > 0 && (
                        <div className="flex items-center gap-2 text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className="font-mono">{stats.wargearItems}</span>
                          <span className="text-grimlog-light-steel">wargear items detected</span>
                        </div>
                      )}
                      {stats.unmatchedAbilities > 0 && (
                        <div className="flex items-center gap-2 text-purple-400">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span className="font-mono">{stats.unmatchedAbilities}</span>
                          <span className="text-grimlog-light-steel">abilities unmatched</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-grimlog-light-steel mt-3 border-t border-yellow-600/30 pt-3">
                      Review flagged units below. You can expand each unit to see specific issues, remove problematic items, or mark units as manually reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-grimlog-green bg-green-900/20 p-4 relative">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-grimlog-green"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-grimlog-green"></div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✓</span>
                      <h3 className="text-lg font-bold text-grimlog-green tracking-wider">
                        ALL UNITS VERIFIED
                      </h3>
                      <span className="text-grimlog-light-steel text-sm">
                        All {currentUnits.length} units matched successfully
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Units List */}
              <div className="border-2 border-grimlog-steel p-6 bg-grimlog-black">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-grimlog-orange tracking-wider">
                    UNITS ({currentUnits.length})
                  </h2>
                  <div className="text-grimlog-orange font-bold">
                    TOTAL: {totalPoints} / {formData.pointsLimit} PTS
                  </div>
                </div>

                <div className="space-y-4">
                  {currentUnits.map((unit, index) => {
                    const unitIssues = getUnitIssues(unit);
                    const isReviewed = reviewedUnits.has(index);
                    // Only show warning if there are actual detectable issues, not just AI's needsReview flag
                    const hasDetectableIssues = unitIssues.length > 0;
                    const showWarning = hasDetectableIssues && !isReviewed;
                    
                    return (
                      <div
                        key={index}
                        className={`border-2 p-4 relative ${
                          isReviewed 
                            ? 'border-grimlog-green bg-green-900/10' 
                            : showWarning 
                              ? 'border-yellow-600 bg-yellow-900/20' 
                              : 'border-grimlog-steel'
                        }`}
                      >
                        {/* Corner brackets for grimdark style */}
                        <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${showWarning ? 'border-yellow-500' : isReviewed ? 'border-grimlog-green' : 'border-grimlog-steel'}`}></div>
                        <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${showWarning ? 'border-yellow-500' : isReviewed ? 'border-grimlog-green' : 'border-grimlog-steel'}`}></div>
                        
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-bold text-white">{unit.name}</h3>
                              {unit.parsedDatasheet?.matchConfidence !== undefined && (
                                <span className={`text-xs px-2 py-1 rounded font-bold ${getConfidenceColor(unit.parsedDatasheet.matchConfidence)}`}>
                                  {getConfidenceLabel(unit.parsedDatasheet.matchConfidence)} ({Math.round(unit.parsedDatasheet.matchConfidence * 100)}%)
                                </span>
                              )}
                              {isReviewed && (
                                <span className="text-xs px-2 py-1 bg-grimlog-green/20 text-grimlog-green border border-grimlog-green rounded font-bold">
                                  ✓ REVIEWED
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-grimlog-light-steel mt-1">
                              {unit.datasheet} • {unit.modelCount} models
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setExpandedUnit(expandedUnit === index ? null : index)}
                              className="px-3 py-1 text-grimlog-orange border border-grimlog-orange hover:bg-grimlog-orange hover:text-black transition-all"
                            >
                              {expandedUnit === index ? '−' : '+'}
                            </button>
                            <button
                              onClick={() => handleRemoveUnit(index)}
                              className="px-3 py-1 text-grimlog-red hover:text-white border border-grimlog-red hover:bg-grimlog-red transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div>
                            <label className="block text-grimlog-light-steel text-xs mb-1 tracking-wider">MODELS</label>
                            <div className="text-white font-bold font-mono">{unit.modelCount}</div>
                          </div>
                          <div>
                            <label className="block text-grimlog-light-steel text-xs mb-1 tracking-wider">POINTS</label>
                            <div className="text-white font-bold font-mono">{unit.pointsCost}</div>
                          </div>
                          <div>
                            <label className="block text-grimlog-light-steel text-xs mb-1 tracking-wider">WEAPONS</label>
                            <div className="text-white font-bold font-mono">{unit.weapons?.length || 0}</div>
                          </div>
                        </div>

                        {/* Inline Issues Display */}
                        {showWarning && unitIssues.length > 0 && (
                          <div className="bg-yellow-900/30 border border-yellow-600/50 p-3 mb-3 text-xs">
                            <div className="flex items-center gap-2 mb-2 text-yellow-400 font-bold tracking-wider">
                              <span>⚠</span> ISSUES ({unitIssues.length}):
                            </div>
                            <div className="space-y-1">
                              {unitIssues.slice(0, 3).map((issue, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    issue.type === 'weapon' && issue.confidence === 0 ? 'bg-red-500' :
                                    issue.type === 'weapon' ? 'bg-yellow-500' :
                                    issue.type === 'wargear' ? 'bg-blue-500' :
                                    'bg-purple-500'
                                  }`}></span>
                                  <span className="text-grimlog-light-steel">
                                    {issue.name} - 
                                    <span className={
                                      issue.confidence === 0 ? ' text-red-400' :
                                      issue.confidence < 0.5 ? ' text-red-400' :
                                      ' text-yellow-400'
                                    }>
                                      {issue.confidence === 0 ? ' Not found' : ` ${Math.round(issue.confidence * 100)}% match`}
                                    </span>
                                    <span className="text-grimlog-steel ml-1">
                                      ({issue.type})
                                    </span>
                                  </span>
                                </div>
                              ))}
                              {unitIssues.length > 3 && (
                                <div className="text-grimlog-steel">
                                  +{unitIssues.length - 3} more issues...
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Expanded Details */}
                        {expandedUnit === index && (
                          <div className="border-t border-grimlog-steel pt-3 mt-3 space-y-4">
                            {/* Weapons Section */}
                            {unit.weapons && unit.weapons.length > 0 && (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="text-grimlog-orange font-bold text-sm tracking-wider">WEAPONS</h4>
                                  {unit.parsedDatasheet?.datasheetId && datasheetOptions[unit.parsedDatasheet.datasheetId]?.weapons && (
                                    <select
                                      className="text-xs bg-grimlog-darkGray border border-grimlog-steel text-grimlog-light-steel px-2 py-1"
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const weapon = datasheetOptions[unit.parsedDatasheet.datasheetId].weapons.find(w => w.id === e.target.value);
                                          if (weapon) handleAddWeaponFromDatasheet(index, weapon);
                                          e.target.value = '';
                                        }
                                      }}
                                      onFocus={() => fetchDatasheetOptions(unit.parsedDatasheet.datasheetId)}
                                      defaultValue=""
                                    >
                                      <option value="">+ Add weapon...</option>
                                      {datasheetOptions[unit.parsedDatasheet.datasheetId]?.weapons.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {unit.weapons.map((weapon: any, wIndex: number) => {
                                    const confidence = weapon.matchConfidence ?? 0;
                                    const isUnmatched = !weapon.weaponId || confidence === 0;
                                    const isLowConfidence = confidence > 0 && confidence < 0.8;
                                    const isEditing = editingItem?.unitIndex === index && editingItem?.itemType === 'weapon' && editingItem?.itemIndex === wIndex;
                                    const dsOptions = unit.parsedDatasheet?.datasheetId ? datasheetOptions[unit.parsedDatasheet.datasheetId] : null;
                                    
                                    return (
                                      <div 
                                        key={wIndex} 
                                        className={`text-xs p-2 border ${
                                          isUnmatched ? 'bg-red-900/20 border-red-600/50' :
                                          isLowConfidence ? 'bg-yellow-900/20 border-yellow-600/50' :
                                          'bg-grimlog-darkGray border-grimlog-steel'
                                        }`}
                                      >
                                        {isEditing ? (
                                          /* Edit mode - show dropdown */
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-grimlog-light-steel">Editing:</span>
                                              <span className="font-bold text-white">{weapon.name}</span>
                                            </div>
                                            {loadingDatasheetOptions === unit.parsedDatasheet?.datasheetId ? (
                                              <div className="text-grimlog-light-steel">Loading options...</div>
                                            ) : dsOptions?.weapons ? (
                                              <select
                                                className="w-full bg-grimlog-black border border-grimlog-orange text-white px-2 py-1"
                                                onChange={(e) => {
                                                  const selected = dsOptions.weapons.find(w => w.id === e.target.value);
                                                  if (selected) handleSelectWeapon(index, wIndex, selected);
                                                }}
                                                defaultValue=""
                                              >
                                                <option value="">Select correct weapon...</option>
                                                {dsOptions.weapons.map(w => (
                                                  <option key={w.id} value={w.id}>
                                                    {w.name} ({w.range}, S{w.strength}, D{w.damage})
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <div className="text-red-400">No datasheet weapons available</div>
                                            )}
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() => handleConvertToWargear(index, wIndex)}
                                                className="px-2 py-1 text-blue-400 hover:text-white hover:bg-blue-600 border border-blue-600/50 transition-all text-xs"
                                              >
                                                Convert to Wargear
                                              </button>
                                              <button
                                                onClick={handleCancelEdit}
                                                className="px-2 py-1 text-grimlog-light-steel hover:text-white border border-grimlog-steel transition-all text-xs"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          /* View mode */
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                {/* Confidence indicator dot */}
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                  confidence >= 0.8 ? 'bg-green-500' :
                                                  confidence >= 0.5 ? 'bg-yellow-500' :
                                                  'bg-red-500'
                                                }`}></span>
                                                <span className="font-bold text-white">{weapon.name}</span>
                                                <span className={`text-xs ${
                                                  confidence >= 0.8 ? 'text-green-400' :
                                                  confidence >= 0.5 ? 'text-yellow-400' :
                                                  'text-red-400'
                                                }`}>
                                                  {confidence === 0 ? 'NOT FOUND' : `${Math.round(confidence * 100)}%`}
                                                </span>
                                              </div>
                                              {weapon.range && (
                                                <div className="text-grimlog-light-steel mt-1 ml-4 font-mono">
                                                  {weapon.range} | A{weapon.attacks} | S{weapon.strength} | AP{weapon.armorPenetration} | D{weapon.damage}
                                                </div>
                                              )}
                                              {!weapon.range && isUnmatched && (
                                                <div className="text-red-400 mt-1 ml-4 italic">
                                                  No weapon profile available
                                                </div>
                                              )}
                                            </div>
                                            {mode === 'import' && (isUnmatched || isLowConfidence) && (
                                              <div className="flex gap-1 ml-2">
                                                <button
                                                  onClick={() => handleStartEdit(index, 'weapon', wIndex)}
                                                  className="px-2 py-1 text-grimlog-orange hover:text-white hover:bg-grimlog-orange border border-grimlog-orange/50 transition-all"
                                                  title="Edit weapon"
                                                >
                                                  ✎
                                                </button>
                                                <button
                                                  onClick={() => handleRemoveWeapon(index, wIndex)}
                                                  className="px-2 py-1 text-red-400 hover:text-white hover:bg-red-600 border border-red-600/50 transition-all"
                                                  title="Remove weapon"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Abilities Section */}
                            {unit.abilities && unit.abilities.length > 0 && (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="text-grimlog-orange font-bold text-sm tracking-wider">ABILITIES & WARGEAR</h4>
                                  {unit.parsedDatasheet?.datasheetId && datasheetOptions[unit.parsedDatasheet.datasheetId]?.abilities && (
                                    <select
                                      className="text-xs bg-grimlog-darkGray border border-grimlog-steel text-grimlog-light-steel px-2 py-1"
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const ability = datasheetOptions[unit.parsedDatasheet.datasheetId].abilities.find(a => a.id === e.target.value);
                                          if (ability) handleAddAbilityFromDatasheet(index, ability);
                                          e.target.value = '';
                                        }
                                      }}
                                      onFocus={() => fetchDatasheetOptions(unit.parsedDatasheet.datasheetId)}
                                      defaultValue=""
                                    >
                                      <option value="">+ Add ability...</option>
                                      {datasheetOptions[unit.parsedDatasheet.datasheetId]?.abilities.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {unit.abilities.map((ability: any, aIndex: number) => {
                                    const confidence = ability.matchConfidence ?? 0;
                                    const isWargear = ability.type === 'wargear';
                                    const isUnmatched = !ability.abilityId && confidence < 0.8;
                                    const isEditing = editingItem?.unitIndex === index && editingItem?.itemType === 'ability' && editingItem?.itemIndex === aIndex;
                                    const dsOptions = unit.parsedDatasheet?.datasheetId ? datasheetOptions[unit.parsedDatasheet.datasheetId] : null;
                                    
                                    return (
                                      <div 
                                        key={aIndex} 
                                        className={`text-xs p-2 border ${
                                          isWargear ? 'bg-blue-900/20 border-blue-600/50' :
                                          isUnmatched ? 'bg-purple-900/20 border-purple-600/50' :
                                          'bg-grimlog-darkGray border-grimlog-steel'
                                        }`}
                                      >
                                        {isEditing ? (
                                          /* Edit mode - show dropdown */
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-grimlog-light-steel">Editing:</span>
                                              <span className="font-bold text-white">{ability.name}</span>
                                            </div>
                                            {loadingDatasheetOptions === unit.parsedDatasheet?.datasheetId ? (
                                              <div className="text-grimlog-light-steel">Loading options...</div>
                                            ) : dsOptions?.abilities ? (
                                              <select
                                                className="w-full bg-grimlog-black border border-grimlog-orange text-white px-2 py-1"
                                                onChange={(e) => {
                                                  const selected = dsOptions.abilities.find(a => a.id === e.target.value);
                                                  if (selected) handleSelectAbility(index, aIndex, selected);
                                                }}
                                                defaultValue=""
                                              >
                                                <option value="">Select correct ability...</option>
                                                {dsOptions.abilities.map(a => (
                                                  <option key={a.id} value={a.id}>
                                                    {a.name} ({a.type})
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <div className="text-red-400">No datasheet abilities available</div>
                                            )}
                                            <button
                                              onClick={handleCancelEdit}
                                              className="px-2 py-1 text-grimlog-light-steel hover:text-white border border-grimlog-steel transition-all text-xs"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          /* View mode */
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                  isWargear ? 'bg-blue-500' :
                                                  confidence >= 0.8 ? 'bg-green-500' :
                                                  confidence >= 0.5 ? 'bg-yellow-500' :
                                                  'bg-purple-500'
                                                }`}></span>
                                                <span className="font-bold text-white">{ability.name}</span>
                                                <span className={`text-xs uppercase tracking-wide ${
                                                  isWargear ? 'text-blue-400' : 'text-grimlog-light-steel'
                                                }`}>
                                                  {ability.type || 'ability'}
                                                </span>
                                                {(isWargear || isUnmatched) && (
                                                  <span className={`text-xs ${
                                                    confidence >= 0.8 ? 'text-green-400' :
                                                    confidence >= 0.5 ? 'text-yellow-400' :
                                                    'text-red-400'
                                                  }`}>
                                                    {confidence === 0 ? '' : `${Math.round(confidence * 100)}%`}
                                                  </span>
                                                )}
                                              </div>
                                              {ability.description && (
                                                <div className="text-grimlog-light-steel mt-1 ml-4">
                                                  {ability.description}
                                                </div>
                                              )}
                                            </div>
                                            {mode === 'import' && (isWargear || isUnmatched) && (
                                              <div className="flex gap-1 ml-2">
                                                <button
                                                  onClick={() => handleStartEdit(index, 'ability', aIndex)}
                                                  className="px-2 py-1 text-grimlog-orange hover:text-white hover:bg-grimlog-orange border border-grimlog-orange/50 transition-all"
                                                  title="Edit ability"
                                                >
                                                  ✎
                                                </button>
                                                <button
                                                  onClick={() => handleRemoveAbility(index, aIndex)}
                                                  className={`px-2 py-1 hover:text-white transition-all ${
                                                    isWargear 
                                                      ? 'text-blue-400 hover:bg-blue-600 border border-blue-600/50'
                                                      : 'text-red-400 hover:bg-red-600 border border-red-600/50'
                                                  }`}
                                                  title="Remove"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Keywords */}
                            {unit.keywords && unit.keywords.length > 0 && (
                              <div>
                                <h4 className="text-grimlog-orange font-bold text-sm mb-2 tracking-wider">KEYWORDS</h4>
                                <div className="flex flex-wrap gap-1">
                                  {unit.keywords.map((keyword: string, kIndex: number) => (
                                    <span key={kIndex} className="text-xs px-2 py-1 bg-grimlog-darkGray border border-grimlog-steel text-grimlog-light-steel">
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mark as Reviewed Button */}
                        {showWarning && (
                          <div className="mt-3 pt-3 border-t border-yellow-600/30 flex justify-between items-center">
                            <span className="text-xs text-yellow-400">
                              ⚠ This unit has {unitIssues.length} issue{unitIssues.length !== 1 ? 's' : ''} requiring attention
                            </span>
                            <button
                              onClick={() => handleMarkReviewed(index)}
                              className="px-3 py-1 text-xs bg-grimlog-darkGray hover:bg-grimlog-steel text-grimlog-light-steel hover:text-white border border-grimlog-steel transition-all font-bold tracking-wider"
                            >
                              MARK AS REVIEWED
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setStep(mode === 'manual' ? 'build' : 'setup')}
                    className="flex-1 px-6 py-3 bg-grimlog-darkGray hover:bg-grimlog-steel text-white font-bold tracking-wider border-2 border-grimlog-steel transition-all"
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={handleSaveArmy}
                    disabled={saving || !formData.playerName || !formData.faction || !formData.armyName || !selectedDetachment}
                    className="flex-1 px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-black font-bold tracking-wider border-2 border-grimlog-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'SAVING...' : 'CREATE ARMY'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
