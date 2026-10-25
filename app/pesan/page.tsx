import { StoreHeader } from "@/components/StoreHeader";
import OrderForm from "./OrderForm";
export default function OrderPage(){return <><StoreHeader/><main id="main-content"><div className="container"><header className="page-heading"><span className="eyebrow">FORMULIR PEMESANAN</span><h1>Pesan telur dengan mudah</h1><p>Isi empat bagian berikut. Tanda * berarti wajib diisi.</p></header><OrderForm/></div></main></>}
