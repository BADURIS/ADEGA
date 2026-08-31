'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastNotificationProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-[#161616]/95 text-white',
    error: 'border-red-500/30 bg-[#161616]/95 text-white',
    warning: 'border-[#F59E0B]/40 bg-[#161616]/95 text-white',
  };

  return (
    <div
      className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
        borders[toast.type]
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icons[toast.type]}
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-zinc-400 hover:text-white transition shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
