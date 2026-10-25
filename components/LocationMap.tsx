"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
export default function LocationMap({latitude,longitude,onChange}:{latitude:number|null;longitude:number|null;onChange:(lat:number,lng:number)=>void}){
 const element=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<CircleMarker|null>(null),change=useRef(onChange);change.current=onChange;
 useEffect(()=>{let cancelled=false;void import("leaflet").then(L=>{if(cancelled||!element.current)return;const instance=L.map(element.current).setView([-2.5,118],4);map.current=instance;L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(instance);instance.on("click",event=>change.current(Number(event.latlng.lat.toFixed(7)),Number(event.latlng.lng.toFixed(7))));});return()=>{cancelled=true;map.current?.remove();map.current=null;marker.current=null}},[]);
 useEffect(()=>{let cancelled=false;void import("leaflet").then(L=>{if(cancelled||!map.current||latitude===null||longitude===null)return;marker.current?.remove();marker.current=L.circleMarker([latitude,longitude],{radius:12,color:"#fff",weight:3,fillColor:"#214e37",fillOpacity:1}).addTo(map.current);map.current.setView([latitude,longitude],17)});return()=>{cancelled=true}},[latitude,longitude]);
 return <><p className="field-hint">Perbesar peta lalu pilih titik toko. Anda juga dapat mengisi koordinat lintang dan bujur dengan keyboard atau menggunakan lokasi saya.</p><div ref={element} className="location-map" aria-label="Peta pemilihan lokasi pengantaran"/><p className="field-hint">Peta memakai OpenStreetMap. Saat peta dibuka, penyedia peta menerima permintaan jaringan dari browser Anda.</p></>
}
