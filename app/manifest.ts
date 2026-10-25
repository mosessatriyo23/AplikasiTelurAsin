import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {return {
 name:"Telur Asinnya Asin Nganenin",short_name:"Telur Nganenin",description:"Pesan telur dan dapatkan kabar ketika pesanan siap.",start_url:"/",id:"/",scope:"/",display:"standalone",background_color:"#fcfaf4",theme_color:"#214e37",lang:"id-ID",
 icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png"},{src:"/icons/icon-maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}]
}}
