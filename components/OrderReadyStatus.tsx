"use client";
import { orderStatusLabel, type VisibleOrderState } from "@/lib/order-status";
import { useOrderPolling } from "./useOrderPolling";

export function OrderReadyStatus({token,initialOrder,gosend}:{token:string;initialOrder:VisibleOrderState;gosend:boolean}) {
 const { order } = useOrderPolling(token, initialOrder);
 const label=orderStatusLabel(order as VisibleOrderState),ready=label==="Pesanan siap";
 return <div className={ready?"success":"notice"} role="status"><strong>{ready?(gosend?"Pesanan siap dijemput GoSend":"Pesanan siap diambil di toko"):label}</strong><p style={{margin:"6px 0 0"}}>{ready?(gosend?"Pesan GoSend melalui aplikasi Gojek dengan titik penjemputan toko. Ongkir dibayar terpisah.":"Silakan datang ke toko untuk mengambil pesanan."):label==="Sedang disiapkan"?"Status terbaru tersedia di halaman ini. Notifikasi merupakan pemberitahuan tambahan.":"Hubungi pengelola bila membutuhkan penjelasan status pesanan."}</p></div>;
}
