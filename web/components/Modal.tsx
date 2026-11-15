"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape, and return focus behavior is left to the browser's
  // default tab order since the dialog traps nothing exotic.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-ink/80"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-lg bg-surface border border-rule rounded-sm shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-5 py-4 border-b border-rule flex items-center justify-between sticky top-0 bg-surface">
              <h2 className="text-base text-paper" style={{ fontFamily: "var(--font-display)" }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-paper-dim hover:text-paper text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
