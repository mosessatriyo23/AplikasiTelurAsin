"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mayAcquirePollLease, nextOrderPollDelay } from "@/lib/order-polling";

type PublicOrder = { paymentStatus?: string; fulfillmentState?: string; completed?: boolean; readyNotifiedAt?: unknown; refundedAmount?: number; total?: number; checkoutStarted?: boolean; [key: string]: unknown };
const LEASE_MS = 19_000;
const localSubscribers = new Map<string, Set<(order: PublicOrder) => void>>();
const localLeases = new Map<string, number>();

export function useOrderPolling(token: string, initialOrder: PublicOrder) {
  const [order, setOrder] = useState(initialOrder);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const failures = useRef(0);
  const syncNotBefore = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const latestOrder = useRef(order);
  latestOrder.current = order;
  const leaseKey = `order-poll-lease:${token}`;

  const publish = useCallback((next: PublicOrder) => {
    latestOrder.current = { ...latestOrder.current, ...next };
    setOrder(latestOrder.current);
    localSubscribers.get(token)?.forEach(listener => listener(latestOrder.current));
    channel.current?.postMessage(latestOrder.current);
  }, [token]);

  const request = useCallback(async (sync = false) => {
    if (running.current || document.visibilityState === "hidden" || (sync && Date.now() < syncNotBefore.current)) return;
    if (sync) syncNotBefore.current = Date.now() + 60_000;
    if (!sync) {
      const now = Date.now();
      let stored: string | null = null;
      try { stored = localStorage.getItem(leaseKey); } catch { /* Private browsing can disable storage. */ }
      const expiry = Math.max(stored === null ? 0 : Number(stored), localLeases.get(token) || 0);
      if (!mayAcquirePollLease(expiry, now)) return;
      localLeases.set(token, now + LEASE_MS);
      try { localStorage.setItem(leaseKey, String(now + LEASE_MS)); } catch { /* In-tab deduplication still works. */ }
    }
    running.current = true;
    if (sync) setChecking(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(token)}${sync ? "/sync" : ""}`, { method: sync ? "POST" : "GET", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        const retry = Number(response.headers.get("Retry-After") || 0);
        if (sync) syncNotBefore.current = Math.max(syncNotBefore.current, Date.now() + nextOrderPollDelay(failures.current + 1, retry));
        const failure = new Error(data.error || "Belum dapat memperbarui status.") as Error & { retry?: number };
        failure.retry = retry;
        throw failure;
      }
      if (data.order) publish(data.order);
      failures.current = 0; setError("");
    } catch (cause) {
      failures.current++;
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui status.");
      throw cause;
    } finally { running.current = false; setChecking(false); }
  }, [leaseKey, publish, token]);

  useEffect(() => {
    const listener = (next: PublicOrder) => { latestOrder.current = { ...latestOrder.current, ...next }; setOrder(latestOrder.current); };
    const listeners = localSubscribers.get(token) || new Set();
    listeners.add(listener); localSubscribers.set(token, listeners);
    channel.current = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`order:${token}`);
    if (channel.current) channel.current.onmessage = event => { latestOrder.current = { ...latestOrder.current, ...event.data }; setOrder(latestOrder.current); };
    let stopped = false;
    const schedule = (delay = 0) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        let retry = 0;
        try { await request(false); } catch (cause) { retry = Number((cause as { retry?: number }).retry || 0); }
        const state = latestOrder.current;
        const terminalFulfillment = state.completed || ["COMPLETED", "CANCELLED", "REFUNDED"].includes(state.fulfillmentState || "");
        if (!stopped && !terminalFulfillment) schedule(nextOrderPollDelay(failures.current, retry));
      }, delay);
    };
    const wake = () => { if (document.visibilityState === "visible") schedule(0); else if (timer.current) clearTimeout(timer.current); };
    schedule(0);
    window.addEventListener("focus", wake); window.addEventListener("pageshow", wake); document.addEventListener("visibilitychange", wake);
    return () => { listeners.delete(listener); if (!listeners.size) localSubscribers.delete(token); stopped = true; if (timer.current) clearTimeout(timer.current); window.removeEventListener("focus", wake); window.removeEventListener("pageshow", wake); document.removeEventListener("visibilitychange", wake); channel.current?.close(); };
  }, [request, token]);

  return { order, checking, error, sync: () => request(true) };
}
