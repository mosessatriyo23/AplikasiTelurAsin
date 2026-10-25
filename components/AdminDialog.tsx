"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, X } from "lucide-react";

type DialogProps = {
  kind: "confirm" | "error" | "success";
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

export function AdminDialog({ kind, title, message, confirmLabel, busy, onConfirm, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab") return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      lastFocus.current?.focus();
    };
  }, [onClose, busy]);
  const Icon = kind === "confirm" ? HelpCircle : kind === "error" ? AlertTriangle : CheckCircle2;
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
      <button ref={closeRef} type="button" className="dialog-close" onClick={onClose} disabled={busy} aria-label="Tutup dialog"><X size={22}/></button>
      <div className={`dialog-icon ${kind}`}><Icon size={30}/></div>
      <h2 id="dialog-title">{title}</h2>
      <p id="dialog-message" className="dialog-message">{message}</p>
      <div className="dialog-actions">
        {kind === "confirm" ? <>
          <button className="btn btn-light" type="button" onClick={onClose} disabled={busy}>Kembali</button>
          <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Menyimpan..." : confirmLabel || "Ya, lanjutkan"}</button>
        </> : <button className="btn btn-primary full" type="button" onClick={onClose}>Mengerti</button>}
      </div>
    </div>
  </div>;
}
