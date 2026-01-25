'use client';

import { useState } from 'react';

interface StratagemLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  playerCP: number;
  opponentCP: number;
  onUpdate: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export default function StratagemLoggerModal({
  isOpen,
  onClose,
  sessionId,
  playerCP,
  opponentCP,
  onUpdate,
  onShowToast
}: StratagemLoggerModalProps) {
  const [stratagemName, setStratagemName] = useState('');
  const [cpCost, setCpCost] = useState(1);
  const [usedBy, setUsedBy] = useState<'attacker' | 'defender'>('attacker');
  const [targetUnit, setTargetUnit] = useState('');
  const [description, setDescription] = useState('');
  const [logging, setLogging] = useState(false);

  const availableCP = usedBy === 'attacker' ? playerCP : opponentCP;
  const canAfford = cpCost <= availableCP;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stratagemName.trim()) {
      onShowToast('Please enter a stratagem name', 'warning');
      return;
    }

    if (!canAfford) {
      onShowToast(`${usedBy} only has ${availableCP} CP available`, 'error');
      return;
    }

    setLogging(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'log_stratagem_use',
          args: {
            stratagem_name: stratagemName.trim(),
            cp_cost: cpCost,
            used_by: usedBy,
            target_unit: targetUnit.trim() || undefined,
            description: description.trim() || undefined
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to log stratagem');
      }

      const result = await response.json();
      
      if (result.success) {
        onUpdate();
        onShowToast(result.message, 'success');
        
        // Reset form
        setStratagemName('');
        setCpCost(1);
        setTargetUnit('');
        setDescription('');
        
        // Close modal after short delay
        setTimeout(() => onClose(), 500);
      } else {
        onShowToast(result.message || 'Failed to log stratagem', 'error');
      }
    } catch (error) {
      console.error('Error logging stratagem:', error);
      onShowToast('Failed to log stratagem', 'error');
    } finally {
      setLogging(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setStratagemName('');
    setCpCost(1);
    setUsedBy('attacker');
    setTargetUnit('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={handleCancel} />
      
      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-lg mx-auto bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-2xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 tracking-wider uppercase flex items-center gap-2">
            <span>📜</span> LOG STRATAGEM
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl font-bold leading-none w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-grimlog-slate-light">
          {/* Used By */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              USED BY <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUsedBy('attacker')}
                className={`flex-1 px-4 py-2 font-bold tracking-wider transition-all rounded-lg ${
                  usedBy === 'attacker'
                    ? 'bg-green-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-green-500'
                }`}
              >
                ATTACKER ({playerCP} CP)
              </button>
              <button
                type="button"
                onClick={() => setUsedBy('defender')}
                className={`flex-1 px-4 py-2 font-bold tracking-wider transition-all rounded-lg ${
                  usedBy === 'defender'
                    ? 'bg-red-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-red-500'
                }`}
              >
                DEFENDER ({opponentCP} CP)
              </button>
            </div>
          </div>

          {/* Stratagem Name */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              STRATAGEM NAME <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={stratagemName}
              onChange={(e) => setStratagemName(e.target.value)}
              placeholder="e.g., Transhuman Physiology"
              required
              className="w-full px-3 py-2 bg-white border-2 border-gray-300 text-gray-800 font-mono focus:outline-none focus:border-grimlog-orange rounded-lg"
            />
          </div>

          {/* CP Cost */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              CP COST <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((cost) => (
                <button
                  key={cost}
                  type="button"
                  onClick={() => setCpCost(cost)}
                  className={`flex-1 px-4 py-2 font-bold tracking-wider transition-all rounded-lg ${
                    cpCost === cost
                      ? 'bg-grimlog-orange text-gray-900'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-grimlog-orange'
                  }`}
                >
                  {cost} CP
                </button>
              ))}
            </div>
            {!canAfford && (
              <p className="mt-2 text-red-500 text-sm font-bold">
                ⚠ Insufficient CP! ({usedBy} has {availableCP} CP)
              </p>
            )}
          </div>

          {/* Target Unit (Optional) */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              TARGET UNIT (Optional)
            </label>
            <input
              type="text"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="e.g., Intercessor Squad"
              className="w-full px-3 py-2 bg-white border-2 border-gray-300 text-gray-800 font-mono focus:outline-none focus:border-grimlog-orange rounded-lg"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              DESCRIPTION (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description or notes"
              rows={2}
              className="w-full px-3 py-2 bg-white border-2 border-gray-300 text-gray-800 font-mono focus:outline-none focus:border-grimlog-orange resize-none rounded-lg"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={logging || !canAfford || !stratagemName.trim()}
              className="flex-1 px-4 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {logging ? 'LOGGING...' : 'LOG STRATAGEM'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={logging}
              className="px-4 py-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold tracking-wider transition-all disabled:opacity-50 rounded-lg"
            >
              CANCEL
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 bg-grimlog-slate-dark border-t border-grimlog-steel">
          <p className="text-gray-500 text-xs text-center">
            Stratagem will be logged and CP will be automatically deducted
          </p>
        </div>
      </div>
    </div>
  );
}
