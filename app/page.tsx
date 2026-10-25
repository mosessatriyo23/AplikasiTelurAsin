import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Egg, HandCoins, MapPin, ShoppingBag } from "lucide-react";
import { StoreHeader } from "@/components/StoreHeader";

const products = [
  { name: "Telur bebek mentah", description: "Telur bebek segar untuk diolah sendiri di rumah.", price: "Rp2.000", icon: "🥚" },
  { name: "Telur bebek mentah asin", description: "Sudah diasinkan, siap dimasak sesuai selera.", price: "Rp2.500", icon: "🥚" },
  { name: "Telur bebek matang asin", description: "Telur asin matang, praktis dan siap dinikmati.", price: "Rp3.000", icon: "🍳" },
];
export default function Home() {
  return <><StoreHeader/><main id="main-content">
    <section className="hero"><div className="container hero-grid"><div>
      <span className="eyebrow">TELUR BEBEK & TELUR ASIN RUMAHAN</span>
      <h1>Pesan telur asin, <em>gampang dan nggak ribet.</em></h1>
      <p>Pilih telur kesukaan Anda, tentukan tanggal terima, lalu ambil di lokasi atau minta diantar. Semua jelas sejak awal.</p>
      <div className="hero-actions"><Link href="/pesan" className="btn btn-primary"><ShoppingBag size={19}/> Pesan sekarang <ArrowRight size={18}/></Link><Link href="#produk" className="btn btn-light">Lihat pilihan telur</Link></div>
      <div className="trust-row"><span><CheckCircle2 size={18}/> Harga jelas</span><span><CalendarDays size={18}/> Pilih tanggal terima</span><span><HandCoins size={18}/> Bisa bayar saat terima</span></div>
    </div><div className="hero-art" aria-hidden="true"><div className="hero-circle"><span className="egg-picture">🥚</span></div><span className="hero-badge top">🌿 Dibuat dengan sepenuh hati</span><span className="hero-badge bottom">⭐ Mulai Rp2.000 / butir</span></div></div></section>
    <section className="section" id="produk"><div className="container"><div className="section-heading"><span className="eyebrow">PILIHAN TELUR</span><h2>Ada yang pas untuk setiap selera</h2><p>Tiga pilihan telur dengan harga yang mudah dipahami.</p></div><div className="product-grid">{products.map(p=><article className="product-card" key={p.name}><div className="product-art" aria-hidden="true">{p.icon}</div><div className="product-body"><h3>{p.name}</h3><p>{p.description}</p><span className="price">{p.price}</span><small> / butir</small></div></article>)}</div></div></section>
    <section className="section step-section"><div className="container"><div className="section-heading"><span className="eyebrow">CARA MEMESAN</span><h2>Cukup tiga langkah sederhana</h2></div><div className="step-grid"><div className="step-card"><span className="step-number">1</span><h3><Egg size={20}/> Pilih telur</h3><p>Tentukan jenis dan jumlah telur yang Anda inginkan.</p></div><div className="step-card"><span className="step-number">2</span><h3><CalendarDays size={20}/> Pilih tanggal</h3><p>Isi data diri dan tentukan kapan ingin menerima pesanan.</p></div><div className="step-card"><span className="step-number">3</span><h3><MapPin size={20}/> Terima pesanan</h3><p>Ambil sendiri atau minta diantar. Bisa bayar saat menerima.</p></div></div></div></section>
    <section className="section"><div className="container"><div className="cta-panel"><div><h2>Sudah tahu mau pesan yang mana?</h2><p>Pesan tanpa perlu membuat akun. Isi data, pilih telur, selesai.</p></div><Link href="/pesan" className="btn btn-light">Mulai pesan <ArrowRight size={18}/></Link></div></div></section>
  </main><footer className="footer"><div className="container footer-inner"><span>© {new Date().getFullYear()} Telur Asinnya Asin Nganenin</span><Link href="/admin/login">Masuk pengelola</Link></div></footer></>;
}
