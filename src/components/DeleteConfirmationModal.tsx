import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "মুছে ফেলার নিশ্চিতকরণ (Confirm Delete)",
  message = "আপনি কি নিশ্চিত যে আপনি এটি মুছে ফেলতে চান? এই কর্মটি অপরিবর্তনযোগ্য।",
  itemName = ""
}: DeleteConfirmationModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim() === 'DELETE') {
      onConfirm();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-rose-100 overflow-hidden animate-fade-in-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-extrabold text-sm tracking-tight">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-rose-100/50 rounded-lg text-slate-405 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed space-y-2">
            <p className="font-semibold">{message}</p>
            {itemName && (
              <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-mono text-slate-800 text-[11px] font-bold select-all break-all">
                Target: {itemName}
              </p>
            )}
            <p className="text-rose-600 font-medium">
              নিশ্চিত করতে নিচে <span className="font-bold font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">DELETE</span> শব্দটি লিখুন (Type DELETE to confirm):
            </p>
          </div>

          <div>
            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                if (error && e.target.value === 'DELETE') {
                  setError(false);
                }
              }}
              placeholder="DELETE"
              className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-800 text-sm font-mono tracking-widest focus:ring-1.5 focus:outline-hidden transition-all uppercase placeholder-slate-350 ${
                error 
                  ? 'border-rose-400 focus:ring-rose-500' 
                  : 'border-slate-200 focus:ring-rose-500'
              }`}
            />
            {error && (
              <p className="text-[10px] text-rose-600 font-bold mt-1">
                দুঃখিত, শব্দটি সঠিক নয়। অনুগ্রহ করে "DELETE" লিখুন। (Invalid word. Please type "DELETE")
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-500 text-xs cursor-pointer transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={confirmText.trim() !== 'DELETE'}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
            >
              মুছে ফেলুন (Permanently Delete)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
