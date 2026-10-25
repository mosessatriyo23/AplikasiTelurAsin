import { StoreHeader } from "@/components/StoreHeader";
import HistoryList from "./HistoryList";
export default function OrderHistoryPage() {
  return <><StoreHeader/><main id="main-content" className="container" style={{paddingBottom:80}}><header className="page-heading"><span className="eyebrow">RIWAYAT PEMBELIAN</span><h1>Pesanan Saya</h1><p>Lihat kembali pesanan dan status pembayaran dari perangkat ini.</p></header><HistoryList/></main></>;
}
