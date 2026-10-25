import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("Set ADMIN_INITIAL_EMAIL dan ADMIN_INITIAL_PASSWORD (minimal 12 karakter) sebelum seed.");
  const products = [
    { slug: "raw-duck", name: "Telur Bebek Mentah", price: 2000 },
    { slug: "salted-raw", name: "Telur Asin Mentah", price: 2500 },
    { slug: "salted-cooked", name: "Telur Asin Matang", price: 3000 },
  ];
  for (const product of products) await db.product.upsert({ where: { slug: product.slug }, create: { ...product, readyStockReconciled: true }, update: { name: product.name, price: product.price } });
  await db.admin.upsert({ where: { email }, create: { email, username: "admin", passwordHash: await hash(password, 12) }, update: {} });
  console.log("Seed selesai: 3 produk, akun admin; tidak ada pesanan demo.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
