export type SavedOrder = {
  token: string;
  orderNumber: string;
  total: number;
  requestedDate: string;
  paymentMethod: string;
  savedAt: string;
};

const KEY = "telur-nganenin-orders-v1";
const MAX_ORDERS = 30;
function valid(entry: unknown): entry is SavedOrder {
  if (!entry || typeof entry !== "object") return false;
  const value = entry as Record<string, unknown>;
  return typeof value.token === "string" && /^[\w-]{32,100}$/.test(value.token) &&
    typeof value.orderNumber === "string" && typeof value.total === "number" &&
    typeof value.requestedDate === "string" && typeof value.paymentMethod === "string" &&
    typeof value.savedAt === "string";
}
export function readHistory(): SavedOrder[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, MAX_ORDERS) : [];
  } catch { return []; }
}
export function saveOrder(order: Omit<SavedOrder, "savedAt">): boolean {
  try {
    const previous = readHistory().filter((entry) => entry.token !== order.token);
    localStorage.setItem(KEY, JSON.stringify([{ ...order, savedAt: new Date().toISOString() }, ...previous].slice(0, MAX_ORDERS)));
    return true;
  } catch { return false; }
}
