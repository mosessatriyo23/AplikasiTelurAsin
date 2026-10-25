"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Egg, ShoppingBag } from "lucide-react";

export function StoreHeader() {
  const path = usePathname();
  return <><a className="skip-link" href="#main-content">Lewati ke konten utama</a><header className="site-header"><div className="container header-inner">
    <Link className="brand" href="/"><span className="brand-icon"><Egg size={25}/></span><span>Telur Asinnya<br/>Asin Nganenin</span></Link>
    <nav className="header-actions" aria-label="Navigasi toko"><Link className="history-link" href="/pesanan" aria-current={path==="/pesanan"||path.startsWith("/pesanan/")?"page":undefined}><ClipboardList size={18}/> Pesanan Saya</Link><Link className="btn btn-primary" href="/pesan" aria-current={path==="/pesan"?"page":undefined}><ShoppingBag size={19}/> Pesan Telur</Link></nav>
  </div></header></>;
}
