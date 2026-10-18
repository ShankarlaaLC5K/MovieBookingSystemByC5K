import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { Payment } from "../models/Payment";
import { ShowSeat } from "../models/ShowSeat";

const BOOKING_EXPIRY_MINUTES = 10;
const CLEANUP_INTERVAL_MS = 30 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | undefined;
let cleanupRunning = false;

export async function cleanupExpiredBookings(): Promise<void> {
  if (cleanupRunning || mongoose.connection.readyState !== 1) {
    return;
  }

  cleanupRunning = true;

  try {
    const expiryTime = new Date(
      Date.now() - BOOKING_EXPIRY_MINUTES * 60 * 1000
    );

    const expiredBookings = await Booking.find({
      status: "pending",
      createdAt: { $lte: expiryTime },
    }).select("_id");

    for (const booking of expiredBookings) {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const currentBooking = await Booking.findOne({
            _id: booking._id,
            status: "pending",
            createdAt: { $lte: expiryTime },
          }).session(session);

          if (!currentBooking) {
            return;
          }

          const successfulPayment = await Payment.exists({
            booking: currentBooking._id,
            status: "success",
          }).session(session);

          if (successfulPayment) {
            return;
          }

          await Payment.updateMany(
            {
              booking: currentBooking._id,
              status: "pending",
              createdAt: { $lte: expiryTime },
            },
            {
              $set: { status: "failed" },
            },
            { session }
          );

          currentBooking.status = "cancelled";
          await currentBooking.save({ session });

          await ShowSeat.updateMany(
            {
              show: currentBooking.show,
              seat: { $in: currentBooking.seats },
              booking: currentBooking._id,
              status: { $ne: "booked" },
            },
            {
              $set: { status: "available" },
              $unset: {
                booking: "",
                lockedBy: "",
                lockedUntil: "",
              },
            },
            { session }
          );

          await ShowSeat.updateMany(
            {
              show: currentBooking.show,
              seat: { $in: currentBooking.seats },
              status: "locked",
              lockedBy: currentBooking.user,
              lockedUntil: { $lte: new Date() },
            },
            {
              $set: { status: "available" },
              $unset: {
                booking: "",
                lockedBy: "",
                lockedUntil: "",
              },
            },
            { session }
          );
        });
      } catch (error) {
        console.error("Expired booking cleanup error:", error);
      } finally {
        await session.endSession();
      }
    }
  } finally {
    cleanupRunning = false;
  }
}

export function startBookingExpiryCleanup(): void {
  if (cleanupTimer) {
    return;
  }

  void cleanupExpiredBookings();

  cleanupTimer = setInterval(() => {
    void cleanupExpiredBookings();
  }, CLEANUP_INTERVAL_MS);
}

export function stopBookingExpiryCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = undefined;
  }
}