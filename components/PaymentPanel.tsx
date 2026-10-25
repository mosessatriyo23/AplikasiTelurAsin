"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleX, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useOrderPolling } from "./useOrderPolling";

const labels: Record<string, string> = {
  PENDING: "Menunggu pembayaran", PAID: "Sudah dibayar", FAILED: "Pembayaran gagal",
  CANCELLED: "Pembayaran dibatalkan / kedaluwarsa", REFUNDED: "Dana dikembalikan",
};
const terminal = new Set(["PAID", "FAILED", "CANCELLED", "REFUNDED"]);
export function PaymentPanel({ token, initialStatus, method, waitlisted }: {
  token: string; initialStatus: string; method: string; waitlisted: boolean;
}) {
  const { order, checking, error: pollError, sync } = useOrderPolling(token, { paymentStatus: initialStatus });
  const status = order.paymentStatus || initialStatus;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const popup = useRef<Window | null>(null);
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current !== status) setAnnouncement(`Status pembayaran: ${labels[status] || status}`);
    previous.current = status;
  }, [status]);

  useEffect(() => {
    if (!popup.current || terminal.has(status)) return;
    const watcher = window.setInterval(() => {
      if (popup.current?.closed) {
        popup.current = null; window.clearInterval(watcher);
        window.setTimeout(() => void sync().catch(() => {}), 1500); // Give the gateway redirect time to settle.
      }
    }, 700);
    return () => window.clearInterval(watcher);
  }, [status, busy, sync]);

  async function checkout() {
    setBusy(true); setError("");
    // Open immediately from the button click so mobile browsers do not block it.
    const paymentWindow = window.open("about:blank", "telur-nganenin-payment");
    if (paymentWindow) {
      paymentWindow.opener = null;
      paymentWindow.document.title = "Membuka pembayaran...";
      paymentWindow.document.body.innerHTML = "<p style='font:20px Arial;padding:30px'>Membuka pembayaran Midtrans...</p>";
      popup.current = paymentWindow;
    }
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pembayaran belum dapat dibuka.");
      const url = new URL(data.redirectUrl || data.redirect_url || data.checkout?.redirectUrl || "");
      if (url.protocol !== "https:" || !["app.sandbox.midtrans.com", "app.midtrans.com"].includes(url.hostname)) {
        throw new Error("Alamat pembayaran tidak valid. Silakan hubungi pengelola.");
      }
      void sync().catch(() => {});
      if (paymentWindow) paymentWindow.location.replace(url.href);
      else window.location.assign(url.href); // Fallback when the browser blocks a new tab.
    } catch (error) {
      paymentWindow?.close(); popup.current = null;
      setError(error instanceof Error ? error.message : "Pembayaran belum dapat dibuka.");
    } finally { setBusy(false); }
  }

  const failed = status === "FAILED" || status === "CANCELLED" || status === "REFUNDED";
  const statusClass = status === "PAID" ? "payment-paid" : failed ? "payment-failed" : "payment-status";
  return <section style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
    <h2>Pembayaran</h2><p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    <div className={statusClass} aria-live="off">
      {status === "PAID" ? <CheckCircle2 size={27}/> : failed ? <CircleX size={27}/> : checking ? <LoaderCircle className="spin" size={27}/> : <CreditCard size={27}/>}
      <div><small>Status pembayaran</small><strong>{labels[status] || status}</strong>
        {status === "PAID" && <span>Pesanan Anda sudah tercatat lunas.</span>}
        {failed && <span>Pembayaran tidak berhasil dicatat. Hubungi pengelola sebelum mencoba kembali.</span>}
        {status === "PENDING" && <span>Status akan berubah otomatis setelah pembayaran.</span>}
      </div>
    </div>
    {method === "COD" ? <p className="muted">COD harus dikonfirmasi sebelum H-1 pukul 18.00 WIB dari tanggal ambil, dengan waktu minimal 24 jam sejak pesanan dibuat. Bayar kepada pengelola; pengelola mencatat pembayaran secara terpisah.</p> : <>
      {waitlisted && status !== "PAID" && <div className="notice"><strong>Pesanan lama menunggu stok.</strong> Pesanan ini dibuat sebelum aturan pembelian stok siap diterapkan. Hubungi pengelola untuk memastikan tanggal terima sebelum melanjutkan pembayaran.</div>}
      {status === "PENDING" && <button className="btn btn-primary full" onClick={() => void checkout()} disabled={busy}><CreditCard size={20}/>{busy ? "Membuka pembayaran..." : "Bayar lewat Bank / QRIS"}</button>}
      {failed && <p className="error">Jangan membayar ulang pesanan ini sebelum menghubungi pengelola.</p>}
      {!terminal.has(status) && <p className="auto-check"><LoaderCircle className={checking ? "spin" : ""} size={17}/>{checking ? "Memeriksa pembayaran..." : "Pemeriksaan otomatis aktif"}</p>}
      {status === "PENDING" && order.checkoutStarted && <button type="button" className="btn" disabled={checking} onClick={() => void sync().catch(() => {})}>Periksa pembayaran di Midtrans</button>}
      <p className="field-hint"><ShieldCheck size={15}/> Status pembayaran diperbarui otomatis. Jika pembayaran belum tercatat, status akan diperiksa kembali setelah jendela pembayaran ditutup.</p>
    </>}
    {(error || pollError) && <div role="alert" className="error">Pemeriksaan otomatis sempat terganggu. Aplikasi akan mencoba lagi. {error || pollError}</div>}
  </section>;
}
