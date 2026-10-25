export function completionBlockReason(items: { name: string; readyAt: Date | null }[], now = new Date()): string | null {
  const pending = items.filter(item => !item.readyAt || item.readyAt > now);
  if (!pending.length) return null;
  const lines = pending.map(item => item.readyAt
    ? `${item.name}: siap ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(item.readyAt)}`
    : `${item.name}: kesiapan stok belum dapat dipastikan`);
  return `Pesanan belum dapat diselesaikan. Semua telur dalam pesanan harus siap terlebih dahulu.\n${lines.join("\n")}`;
}
