"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Egg, LayoutDashboard, LogOut, Package, Settings, TrendingUp } from "lucide-react";
const links=[
 {href:"/admin",label:"Ringkasan",icon:LayoutDashboard,exact:true},
 {href:"/admin/pesanan",label:"Pesanan",icon:ClipboardList},
 {href:"/admin/stok",label:"Stok & Pembuatan",icon:Package},
 {href:"/admin/pemasukan",label:"Pemasukan",icon:TrendingUp},
 {href:"/admin/pengaturan",label:"Pengaturan Toko",icon:Settings},
];
export function AdminShell({children}:{children:React.ReactNode}){const path=usePathname();const router=useRouter();async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/admin/login")}return <div className="admin-shell"><a className="skip-link" href="#main-content">Lewati ke konten utama</a><aside className="sidebar"><Link href="/" className="brand"><span className="brand-icon"><Egg/></span><span>Telur Asinnya<br/>Asin Nganenin</span></Link><nav>{links.map(({href,label,icon:Icon,exact})=><Link key={href} href={href} className={(exact?path===href:path.startsWith(href))?"active":""} aria-current={(exact?path===href:path.startsWith(href))?"page":undefined}><Icon size={20}/>{label}</Link>)}</nav><nav className="sidebar-bottom"><button onClick={logout}><LogOut size={20}/>Keluar</button></nav></aside><div className="admin-content"><nav className="mobile-admin-nav">{links.map(({href,label,exact})=><Link key={href} href={href} className={(exact?path===href:path.startsWith(href))?"active":""} aria-current={(exact?path===href:path.startsWith(href))?"page":undefined}>{label}</Link>)}<button onClick={logout}>Keluar</button></nav>{children}</div></div>}
