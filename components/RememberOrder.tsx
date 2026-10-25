"use client";
import { useEffect, useState } from "react";
import { saveOrder, type SavedOrder } from "@/lib/order-history";
export function RememberOrder({ order }: { order: Omit<SavedOrder, "savedAt"> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(!saveOrder(order)); }, [order.token]);
  return failed ? <div className="notice">Browser ini tidak mengizinkan penyimpanan riwayat. Simpan tautan halaman ini agar pesanan dapat dibuka kembali.</div> : null;
}
