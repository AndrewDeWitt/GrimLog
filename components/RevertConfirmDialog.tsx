'use client';

interface RevertConfirmDialogProps {
  eventDescription: string;
  subsequentCount: number;
  onConfirm: (mode: 'single' | 'cascade') => void;
  onCancel: () => void;
}

export default function RevertConfirmDialog({
  eventDescription,
  subsequentCount,
  onConfirm,
  onCancel
}: RevertConfirmDialogProps) {
  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
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
        <div className="p-4 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <h3 className="text-gray-900 text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="text-2xl">⚠</span>
            CONFIRM REVERT
          </h3>
        </div>

        {/* Content */}
        <div className="p-6 bg-grimlog-slate-light space-y-4">
          <p className="text-gray-700 font-mono">
            You are about to revert:
          </p>
          
          <div className="bg-white border-2 border-gray-300 p-3 rounded-lg">
            <p className="text-grimlog-orange font-mono text-sm">{eventDescription}</p>
          </div>
          
          {subsequentCount > 0 && (
            <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
              <p className="text-red-600 font-bold mb-2 flex items-center gap-2">
                <span className="text-xl">⚠</span>
                WARNING: {subsequentCount} event{subsequentCount !== 1 ? 's' : ''} occurred after this
              </p>
              <p className="text-gray-600 text-sm">
                Reverting this event may create inconsistent game state. 
                Do you want to also revert all subsequent events?
              </p>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="p-4 bg-grimlog-slate-dark border-t border-grimlog-steel flex gap-3 flex-wrap">
          {subsequentCount > 0 ? (
            <>
              <button
                onClick={() => onConfirm('single')}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider transition-all rounded-lg"
              >
                REVERT THIS ONLY
              </button>
              <button
                onClick={() => onConfirm('cascade')}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-wider transition-all rounded-lg"
              >
                REVERT ALL ({subsequentCount + 1})
              </button>
            </>
          ) : (
            <button
              onClick={() => onConfirm('single')}
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-wider transition-all rounded-lg"
            >
              CONFIRM REVERT
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold uppercase tracking-wider transition-all rounded-lg"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
