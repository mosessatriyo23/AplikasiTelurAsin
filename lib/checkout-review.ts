import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./auth";
import { fetchMidtransStatus } from "./midtrans";
import { applyMidtransStatus } from "./payment-sync";
import { restoreReservation } from "./reservation";

export async function resolveAmbiguousCheckout(id:string, adminId:string) {
 if(!adminId)throw new ApiError(401,"Admin wajib terautentikasi.");
 const before=await db.order.findUniqueOrThrow({where:{id}});
 // This resolution path is exclusively for Midtrans checkout uncertainty.
 if(before.paymentMethod!=="MIDTRANS")throw new ApiError(409,"Hanya checkout Midtrans yang dapat ditinjau.");
 if(before.checkoutState==="RESOLVED")return before;
 if(!["AMBIGUOUS","DEFINITIVE_FAILURE","TERMINAL_CONFIRMED"].includes(before.checkoutState))throw new ApiError(409,"Checkout tidak berada dalam antrean review.");
 // A fresh authenticated request, not a browser-supplied status or old saved proof.
 const status=await fetchMidtransStatus(before.orderNumber);
 await applyMidtransStatus(before.orderNumber,status,"SYNC");
 if(!["expire","cancel","deny","failure"].includes(status.transaction_status))throw new ApiError(409,"Midtrans belum mengonfirmasi transaksi berakhir. Stok tetap dicadangkan.");
 return db.$transaction(async tx=>{
  const current=await tx.order.findUniqueOrThrow({where:{id}});
  if(current.checkoutState==="RESOLVED")return current;
  if(current.paymentStatus==="PAID"||current.refundedAmount>0||current.completed||current.midtransTransactionId&&current.midtransTransactionId!==status.transaction_id)throw new ApiError(409,"Status pembayaran berubah. Jangan melepaskan stok.");
  if(current.checkoutState!=="TERMINAL_CONFIRMED"||current.checkoutTerminalStatus!==status.transaction_status||!status.transaction_id)throw new ApiError(409,"Bukti terminal belum sesuai.");
  const claimed=await tx.order.updateMany({where:{id,checkoutState:"TERMINAL_CONFIRMED",paymentStatus:"PENDING",stockRestored:false,refundedAmount:0},data:{checkoutState:"RESOLVED",checkoutReviewedAt:new Date(),paymentStatus:status.transaction_status==="failure"?"FAILED":"CANCELLED",midtransTransactionId:status.transaction_id}});
  if(!claimed.count)throw new ApiError(409,"Review sedang diproses atau status berubah.");
  await restoreReservation(tx,current,"ADMIN_VERIFIED_MIDTRANS_TERMINAL");
  await tx.paymentAudit.create({data:{orderId:id,source:"ADMIN_RESOLUTION",outcome:"RELEASED",detail:`terminal_${status.transaction_status};authorized_admin`}});
  return tx.order.findUniqueOrThrow({where:{id}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function escalateStaleCheckouts(now=new Date()) {
 return db.$transaction(async tx=>{
  const stale=await tx.order.findMany({where:{checkoutState:"CREATING",checkoutStartedAt:{lt:new Date(now.getTime()-120_000)},paymentStatus:"PENDING"},select:{id:true}});
  for(const order of stale){const claim=await tx.order.updateMany({where:{id:order.id,checkoutState:"CREATING"},data:{checkoutState:"AMBIGUOUS",fulfillmentState:"REVIEW",checkoutReviewAlertedAt:now,readyNotifiedAt:null}});if(claim.count)await tx.paymentAudit.create({data:{orderId:order.id,source:"WORKER",outcome:"CHECKOUT_ESCALATED",detail:"stale_creation_claim"}})}
  return stale.length;
 });
}
