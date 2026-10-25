import { allocateWaitlistedOrders } from "../lib/stock-allocation";
import { db } from "../lib/db";

allocateWaitlistedOrders()
  .then(count => console.log(`${count} pesanan daftar tunggu mendapat alokasi stok.`))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => db.$disconnect());
