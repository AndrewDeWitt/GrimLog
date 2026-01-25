'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info'
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button when dialog opens
      cancelButtonRef.current?.focus();
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const confirmButtonStyles = {
    danger: 'bg-grimlog-red hover:bg-red-600 text-white',
    warning: 'bg-grimlog-amber hover:bg-grimlog-orange text-gray-900',
    info: 'bg-grimlog-orange hover:bg-grimlog-amber text-gray-900'
  };

  const titleIcon = {
    danger: '⚠',
    warning: '⚡',
    info: '📋'
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div
        ref={dialogRef}
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel max-w-lg w-full mx-auto rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-2xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <h2
            id="dialog-title"
            className="text-gray-900 font-bold text-lg tracking-wider uppercase flex items-center gap-2"
          >
            <span>{titleIcon[variant]}</span>
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-4 py-6 bg-grimlog-slate-light">
          <p
            id="dialog-description"
            className="text-gray-700 text-sm leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 border-t border-grimlog-steel bg-grimlog-slate-dark flex gap-3 justify-end">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            className="min-w-[100px] min-h-[44px] px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold tracking-wider border-2 border-gray-300 rounded-lg transition-all uppercase text-sm focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`min-w-[100px] min-h-[44px] px-4 py-2 ${confirmButtonStyles[variant]} font-bold tracking-wider rounded-lg transition-all uppercase text-sm focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2`}
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
