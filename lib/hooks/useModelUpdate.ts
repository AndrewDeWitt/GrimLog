import { useCallback } from 'react';

interface ModelUpdateOptions {
  sessionId: string;
  unitId: string;
  onSuccess?: () => void;
  onOptimisticUpdate?: (modelIndex: number, change: number | 'destroy') => void;
}

export function useModelUpdate({ sessionId, unitId, onSuccess, onOptimisticUpdate }: ModelUpdateOptions) {
  const updateModelWounds = useCallback(async (modelIndex: number, woundChange: number) => {
    // Optimistic update first
    onOptimisticUpdate?.(modelIndex, woundChange);
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/units/${unitId}/model/${modelIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ woundChange })
      });

      if (!response.ok) {
        console.error('Failed to update model wounds');
        // Silently refetch to fix optimistic update
        onSuccess?.();
        return;
      }

      // Background sync successful - silently update
      onSuccess?.();
    } catch (error) {
      console.error('Error updating model wounds:', error);
      // Refetch on error
      onSuccess?.();
    }
  }, [sessionId, unitId, onSuccess, onOptimisticUpdate]);

  const destroyModel = useCallback(async (modelIndex: number) => {
    // Optimistic update first
    onOptimisticUpdate?.(modelIndex, 'destroy');
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/units/${unitId}/model/${modelIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destroy: true })
      });

      if (!response.ok) {
        console.error('Failed to destroy model');
        // Refetch to fix optimistic update
        onSuccess?.();
        return;
      }

      // Background sync successful
      onSuccess?.();
    } catch (error) {
      console.error('Error destroying model:', error);
      onSuccess?.();
    }
  }, [sessionId, unitId, onSuccess, onOptimisticUpdate]);

  return {
    updateModelWounds,
    destroyModel
  };
}

