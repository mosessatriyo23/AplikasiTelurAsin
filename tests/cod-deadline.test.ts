import test from "node:test";
import assert from "node:assert/strict";
import { codReservationDeadline, reservationDeadline } from "../lib/reservation";
test("COD holds stock until pickup eve 18 WIB for future dates", () => {
 const now=new Date("2026-10-25T03:00:00.000Z");
 assert.equal(codReservationDeadline("2026-10-30",now).toISOString(),"2026-10-29T11:00:00.000Z");
 assert.equal(reservationDeadline(now).toISOString(),"2026-10-26T03:00:00.000Z");
});
test("same-day/next-day COD always receives at least 24 hours",()=>{
 const now=new Date("2026-10-25T15:00:00.000Z");
 assert.equal(codReservationDeadline("2026-10-26",now).toISOString(),"2026-10-26T15:00:00.000Z");
});
