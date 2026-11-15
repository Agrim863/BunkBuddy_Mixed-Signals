import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  if (typeof document === 'undefined') return null;

  // Render at document.body so fixed positioning is relative to the browser
  // viewport, not a transformed/overflowing page or sidebar container.
  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${
        closing ? 'bw-animate-backdrop-out pointer-events-none' : 'bw-animate-backdrop-in'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closing) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xl ${
          closing ? 'bw-animate-modal-out' : 'bw-animate-modal-in'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-[var(--text-main)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-[10px] p-1.5 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
