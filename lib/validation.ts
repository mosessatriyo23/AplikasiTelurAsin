import { z } from "zod";

export const MAX_TIP = 1_000_000;
export const MAX_QUANTITY = 500;
export function jakartaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(date: string, days: number): string {
  if (!isValidDate(date)) throw new Error("Invalid date");
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function availabilityFromArrival(date: string, slug = "salted-cooked"): Date {
  const days = slug === "raw-duck" ? 0 : 2;
  return new Date(`${addDays(date, days)}T00:00:00+07:00`);
}
const dateSchema = z.string().refine(isValidDate, "Tanggal tidak valid (YYYY-MM-DD)");
export const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).transform((phone) => phone.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/, "Nomor WhatsApp Indonesia tidak valid")), 
  deliveryMethod: z.enum(["PICKUP", "GOSEND"]),
  requestedDate: dateSchema.refine((date) => date >= jakartaDate(), "Tanggal tidak boleh sebelum hari ini (WIB)"),
  paymentMethod: z.enum(["COD", "MIDTRANS"]),
  tip: z.literal(0).default(0),
  items: z.array(z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(MAX_QUANTITY) }).strict()).min(1).max(3),
}).strict().superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.productId)).size !== value.items.length) context.addIssue({ code: "custom", path: ["items"], message: "Produk duplikat tidak diperbolehkan" });
});
export const stockSchema = z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100_000), arrivalDate: dateSchema }).strict();
export const loginSchema = z.object({ username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus").transform((username) => username.toLowerCase()), password: z.string().min(1).max(200) }).strict();
export type OrderInput = z.infer<typeof orderSchema>;
