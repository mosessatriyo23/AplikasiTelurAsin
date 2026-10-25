"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, RefreshCw, ShoppingBag } from "lucide-react";
import { readHistory, type SavedOrder } from "@/lib/order-history";
import { dateOnlyLabel, rupiah } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

type CurrentOrder = SavedOrder & { paymentStatus?: string; waitlisted?: boolean; dateTentative?: boolean; readyNotifiedAt?: string | null; completed?: boolean; refundedAmount?: number; fulfillmentState?: string; fetchError?: "missing" | "offline" | "server" };
const paymentLabels: Record<string, string> = { PENDING: "Belum dibayar", PAID: "Sudah dibayar", FAILED: "Pembayaran gagal", CANCELLED: "Dibatalkan / kedaluwarsa", REFUNDED: "Dana dikembalikan" };
function status(order: CurrentOrder) {
  if (order.fetchError === "missing") return { label: "Pesanan tidak ditemukan (404)", tone: "gray" };
  if (order.fetchError === "server") return { label: "Server bermasalah · status lama dipertahankan", tone: "orange" };
  if (order.fetchError) return { label: "Jaringan bermasalah · status lama dipertahankan", tone: "orange" };
  const label = orderStatusLabel(order);
  return { label: label === "Menunggu stok" ? "Menunggu stok · tanggal belum pasti" : label, tone: ["Dana dikembalikan", "Pesanan dibatalkan"].includes(label) ? "gray" : label.includes("tinjauan") || label === "Menunggu stok" ? "orange" : "" };
}
export default function HistoryList() {
  const [orders, setOrders] = useState<CurrentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const saved = readHistory();
    const settled = await Promise.all(saved.map(async entry => {
      const previous = orders.find(order => order.token === entry.token) || entry;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(entry.token)}`, { cache: "no-store" });
        if (response.status === 404) return { ...previous, fetchError: "missing" as const };
        if (!response.ok) return { ...previous, fetchError: "server" as const };
        const data = await response.json();
        if (!data.order) throw new Error("Invalid response");
        return { ...entry, ...data.order } as CurrentOrder;
      } catch { return { ...previous, fetchError: "offline" as const }; }
    }));
    setOrders(settled);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  if (loading && !orders.length) return <div className="panel" role="status">Memuat riwayat pesanan...</div>;
  if (!orders.length) return <div className="panel empty-history"><ClipboardList size={55}/><h2>Belum ada riwayat pesanan</h2><p>Pesanan yang dibuat melalui browser ini akan muncul di sini.</p><Link href="/pesan" className="btn btn-primary"><ShoppingBag size={18}/> Pesan telur</Link></div>;
  return <><div className="history-info"><p><strong>{orders.length} pesanan tersimpan di perangkat ini.</strong><br/>Riwayat tidak otomatis muncul di HP atau browser lain karena pembelian tidak memakai akun.</p><button className="btn btn-light" disabled={loading} onClick={() => void load()}><RefreshCw size={17}/>{loading ? "Memperbarui status..." : "Coba lagi / perbarui status"}</button></div><div className="history-list" aria-busy={loading}>{orders.map(order => { const progress = status(order); return <Link key={order.token} className="history-card" href={`/pesanan/${order.token}`}><div className="history-main"><div className="history-code"><strong>{order.orderNumber}</strong>{!order.fetchError && order.paymentStatus && <span className={`pill ${order.paymentStatus === "PENDING" ? "orange" : order.paymentStatus !== "PAID" ? "gray" : ""}`}>{paymentLabels[order.paymentStatus] || order.paymentStatus}</span>}</div><p><CalendarDays size={17}/> Tanggal terima: <strong>{dateOnlyLabel(order.requestedDate)}</strong></p><span className={`pill ${progress.tone}`}>{progress.label}</span><small>Dipesan dari browser ini pada {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(order.savedAt))} WIB</small></div><div className="history-total"><strong>{rupiah(order.total)}</strong><span>{order.paymentMethod === "COD" ? "Bayar saat menerima" : "Bank / QRIS"}</span><ChevronRight/></div></Link>; })}</div></>;
}
