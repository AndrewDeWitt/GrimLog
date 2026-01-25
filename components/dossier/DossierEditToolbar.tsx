'use client';

interface DossierEditToolbarProps {
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDone: () => void;
  isSaving: boolean;
}

/**
 * DossierEditToolbar - Contextual toolbar shown when in edit mode
 *
 * Shows Save, Discard, and Done buttons
 * Save always creates a version (opens modal for optional label/notes)
 */
export function DossierEditToolbar({
  hasUnsavedChanges,
  onSave,
  onDiscard,
  onDone,
  isSaving,
}: DossierEditToolbarProps) {
  return (
    <div className="sticky top-0 z-40 bg-grimlog-orange/10 backdrop-blur-sm border-b-2 border-grimlog-orange/50">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-1.5 flex items-center justify-between gap-2">
        {/* Left side - Edit indicator + unsaved status stacked */}
        <div className="flex items-center gap-2 text-grimlog-orange min-w-0">
          <span className="text-base flex-shrink-0">✎</span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold uppercase tracking-wider">Editing</span>
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-grimlog-amber text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-grimlog-amber animate-pulse flex-shrink-0" />
                Unsaved
              </span>
            )}
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Save button - always creates a version */}
          <button
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`
              px-2 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider
              transition-all
              ${hasUnsavedChanges
                ? 'bg-grimlog-green text-grimlog-black hover:bg-grimlog-green/80'
                : 'bg-grimlog-black border border-grimlog-steel text-grimlog-steel cursor-not-allowed'
              }
              disabled:opacity-50
            `}
          >
            {isSaving ? '...' : 'Save'}
          </button>

          {/* Discard button */}
          {hasUnsavedChanges && (
            <button
              onClick={onDiscard}
              disabled={isSaving}
              className="px-2 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-grimlog-black border border-grimlog-red/50 text-grimlog-red hover:bg-grimlog-red/10 transition-all disabled:opacity-50"
            >
              Discard
            </button>
          )}

          {/* Done button */}
          <button
            onClick={onDone}
            disabled={isSaving}
            className="px-2 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-grimlog-orange text-grimlog-black hover:bg-grimlog-amber transition-all disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default DossierEditToolbar;
