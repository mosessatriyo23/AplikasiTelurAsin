/* No page or payment caching: this worker handles notifications only. */
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const target = typeof payload.url === 'string' && payload.url.startsWith('/pesanan/') ? payload.url : '/pesanan';
  event.waitUntil(self.registration.showNotification(payload.title || 'Kabar pesanan telur', {
    body: payload.body || 'Ada pembaruan pesanan Anda. Buka rincian pesanan.',
    tag: payload.tag || `telur-order-${Date.now()}`,
    data: { url: target },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/pesanan', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      if (client.url === target && 'focus' in client) return client.focus();
    }
    return clients.openWindow(target);
  }));
});
