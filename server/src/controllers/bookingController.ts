import { Response } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { Booking } from "../models/Booking";
import { Show } from "../models/Show";
import { User } from "../models/User";
import { ShowSeat } from "../models/ShowSeat";
import { Seat } from "../models/Seat";
import { Payment } from "../models/Payment";
import { WalletTransaction } from "../models/WalletTransaction";
import { AuthRequest } from "../middleware/authMiddleware";

const PLATFORM_FEE_PER_TICKET = 20;
const PLATFORM_FEE_GST_RATE = 0.18;

type BookingAmounts = {
  ticketSubtotal: number;
  platformFee: number;
  platformFeeGst: number;
  totalAmount: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateAmounts(
  show: any,
  seats: Array<{ type?: string }>
): BookingAmounts {
  const ticketSubtotal = roundMoney(
    seats.reduce((sum, seat) => {
      let price: unknown;

      if (seat.type === "recliner") {
        price = show.balconyPrice;
      } else if (seat.type === "premium") {
        price = show.firstClassPrice;
      } else {
        price = show.secondClassPrice;
      }

      const numericPrice =
        typeof price === "number" && Number.isFinite(price)
          ? price
          : Number(show.price);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new Error("INVALID_TICKET_PRICE");
      }

      return sum + numericPrice;
    }, 0)
  );

  const platformFee = roundMoney(
    seats.length * PLATFORM_FEE_PER_TICKET
  );

  const platformFeeGst = roundMoney(
    platformFee * PLATFORM_FEE_GST_RATE
  );

  return {
    ticketSubtotal,
    platformFee,
    platformFeeGst,
    totalAmount: roundMoney(
      ticketSubtotal + platformFee + platformFeeGst
    ),
  };
}

async function resolveSeats(
  showId: string,
  seatIds: string[],
  session?: mongoose.ClientSession
) {
  let query = ShowSeat.find({
    show: showId,
    seat: { $in: seatIds },
  }).populate("seat");

  if (session) {
    query = query.session(session);
  }

  const showSeats = await query;

  if (showSeats.length !== seatIds.length) {
    throw new Error("INVALID_SEATS");
  }

  const seats = showSeats.map((item: any) => {
    if (!item.seat) {
      throw new Error("INVALID_SEATS");
    }

    return item.seat;
  });

  return { showSeats, seats };
}

async function creditWallet(
  userId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  amount: number,
  type: "reschedule_refund" | "cancellation_refund",
  reference: string,
  description: string,
  session: mongoose.ClientSession
) {
  if (amount <= 0) return;

  const existing = await WalletTransaction.findOne({
    reference,
  }).session(session);

  if (existing) return;

  await WalletTransaction.create(
    [
      {
        user: userId,
        booking: bookingId,
        type,
        amount: roundMoney(amount),
        reference,
        description,
      },
    ],
    { session }
  );

  const updatedUser = await User.updateOne(
    { _id: userId },
    { $inc: { walletBalance: roundMoney(amount) } },
    { session }
  );

  if (updatedUser.matchedCount !== 1) {
    throw new Error("USER_NOT_FOUND");
  }
}

export async function createBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { showId, seatIds } = req.body;

    if (
      !mongoose.isValidObjectId(showId) ||
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every((id: unknown) => typeof id === "string") ||
      new Set(seatIds).size !== seatIds.length
    ) {
      res.status(400).json({
        success: false,
        message: "Valid showId and unique seatIds are required",
      });
      return;
    }

    let result: any;

    await session.withTransaction(async () => {
      const show = await Show.findById(showId).session(session);

      if (!show || new Date(show.startTime).getTime() <= Date.now()) {
        throw new Error("SHOW_UNAVAILABLE");
      }

      const { showSeats, seats } = await resolveSeats(
        showId,
        seatIds,
        session
      );

      const invalidSeat = showSeats.some(
        (item: any) =>
          item.status !== "locked" ||
          !item.lockedBy ||
          item.lockedBy.toString() !== req.userId ||
          !item.lockedUntil ||
          new Date(item.lockedUntil).getTime() <= Date.now()
      );

      if (invalidSeat) {
        throw new Error("SEAT_LOCK_REQUIRED");
      }

      const amounts = calculateAmounts(show, seats);

      let booking = await Booking.findOne({
        user: req.userId,
        show: showId,
        status: "pending",
        seats: { $all: seatIds, $size: seatIds.length },
      }).session(session);

      if (booking) {
        const paymentExists = await Payment.exists({
          booking: booking._id,
          status: { $in: ["pending", "success"] },
        }).session(session);

        if (paymentExists) {
          throw new Error("PAYMENT_ALREADY_STARTED");
        }

        booking.totalAmount = amounts.totalAmount;
        (booking as any).ticketSubtotal = amounts.ticketSubtotal;
        (booking as any).platformFee = amounts.platformFee;
        (booking as any).platformFeeGst = amounts.platformFeeGst;

        await booking.save({ session });
      } else {
        booking = new Booking({
          user: req.userId,
          show: showId,
          seats: seatIds,
          totalAmount: amounts.totalAmount,
          ticketSubtotal: amounts.ticketSubtotal,
          platformFee: amounts.platformFee,
          platformFeeGst: amounts.platformFeeGst,
          status: "pending",
          bookingReference:
            "MB" + crypto.randomBytes(6).toString("hex").toUpperCase(),
        });

        await booking.save({ session });
      }

      const seatUpdate = await ShowSeat.updateMany(
        {
          _id: { $in: showSeats.map((item: any) => item._id) },
          status: "locked",
          lockedBy: req.userId,
          lockedUntil: { $gt: new Date() },
        },
        { $set: { booking: booking._id } },
        { session }
      );

      if (seatUpdate.modifiedCount !== showSeats.length) {
        throw new Error("SEAT_LOCK_REQUIRED");
      }

      result = booking;
    });

    res.status(201).json({
      success: true,
      message: "Booking created",
      booking: result,
    });
  } catch (error: any) {
    const messages: Record<string, [number, string]> = {
      SHOW_UNAVAILABLE: [400, "Show is unavailable"],
      INVALID_SEATS: [400, "Selected seats are invalid"],
      SEAT_LOCK_REQUIRED: [409, "Please reserve the selected seats again"],
      PAYMENT_ALREADY_STARTED: [
        409,
        "A payment already exists for this booking",
      ],
      INVALID_TICKET_PRICE: [400, "Ticket price is invalid"],
      USER_NOT_FOUND: [404, "User not found"],
    };

    const mapped = messages[error?.message];

    res.status(mapped?.[0] || 500).json({
      success: false,
      message: mapped?.[1] || "Unable to create booking",
    });
  } finally {
    await session.endSession();
  }
}

export async function rescheduleBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;
    const { showId, seatIds } = req.body;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(showId) ||
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every((seatId: unknown) => typeof seatId === "string") ||
      new Set(seatIds).size !== seatIds.length
    ) {
      res.status(400).json({
        success: false,
        message: "Valid booking, show and seat IDs are required",
      });
      return;
    }

    let result: any;

    await session.withTransaction(async () => {
      const booking = await Booking.findById(id).session(session);

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      if (booking.user.toString() !== req.userId) {
        throw new Error("BOOKING_FORBIDDEN");
      }

      if (!["confirmed", "pending"].includes(booking.status)) {
        throw new Error("BOOKING_NOT_RESCHEDULABLE");
      }

      const pendingReschedule = await Payment.findOne({
        booking: booking._id,
        purpose: "reschedule",
        status: "pending",
      }).session(session);

      if (pendingReschedule) {
        throw new Error("RESCHEDULE_PAYMENT_PENDING");
      }

      if (booking.status === "pending") {
        const existingPayment = await Payment.findOne({
          booking: booking._id,
          status: { $in: ["pending", "success"] },
        }).session(session);

        if (existingPayment) {
          throw new Error("BOOKING_PAYMENT_EXISTS");
        }
      }

      const oldShow = await Show.findById(booking.show).session(session);
      const newShow = await Show.findById(showId).session(session);

      if (!oldShow || !newShow) {
        throw new Error("SHOW_NOT_FOUND");
      }

      if (oldShow.movie.toString() !== newShow.movie.toString()) {
        throw new Error("DIFFERENT_MOVIE");
      }

      if (
        new Date(newShow.startTime).getTime() <= Date.now() ||
        newShow._id.toString() === oldShow._id.toString()
      ) {
        throw new Error("INVALID_TARGET_SHOW");
      }

      const { showSeats: targetShowSeats, seats: targetSeats } =
        await resolveSeats(showId, seatIds, session);

      const targetSeatUnavailable = targetShowSeats.some(
        (item: any) =>
          item.status !== "available" &&
          !(
            item.status === "locked" &&
            item.lockedBy?.toString() === req.userId &&
            item.lockedUntil &&
            new Date(item.lockedUntil).getTime() > Date.now()
          )
      );

      if (targetSeatUnavailable) {
        throw new Error("TARGET_SEATS_UNAVAILABLE");
      }

      const oldSeatRecords = await Seat.find({
        _id: { $in: booking.seats },
      }).session(session);

      const oldAmounts = (booking as any).ticketSubtotal !== undefined
        ? {
            ticketSubtotal: Number((booking as any).ticketSubtotal),
          }
        : calculateAmounts(oldShow, oldSeatRecords);

      const targetAmounts = calculateAmounts(newShow, targetSeats);

      if (targetAmounts.totalAmount > booking.totalAmount) {
        throw new Error("ADDITIONAL_PAYMENT_REQUIRED");
      }

      const targetClaim = await ShowSeat.updateMany(
        {
          _id: { $in: targetShowSeats.map((item: any) => item._id) },
          $or: [
            { status: "available" },
            {
              status: "locked",
              lockedBy: req.userId,
              lockedUntil: { $gt: new Date() },
            },
          ],
        },
        {
          $set: {
            status: booking.status === "confirmed" ? "booked" : "locked",
            booking: booking._id,
          },
          $unset: {
            lockedBy: "",
            lockedUntil: "",
          },
        },
        { session }
      );

      if (targetClaim.modifiedCount !== targetShowSeats.length) {
        throw new Error("TARGET_SEATS_UNAVAILABLE");
      }

      await ShowSeat.updateMany(
        {
          show: booking.show,
          seat: { $in: booking.seats },
          booking: booking._id,
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

      if (
        booking.status === "confirmed" &&
        targetAmounts.ticketSubtotal < oldAmounts.ticketSubtotal
      ) {
        const refund = roundMoney(
          oldAmounts.ticketSubtotal - targetAmounts.ticketSubtotal
        );

        await creditWallet(
          booking.user as mongoose.Types.ObjectId,
          booking._id as mongoose.Types.ObjectId,
          refund,
          "reschedule_refund",
          "reschedule:" + booking._id.toString() + ":" + Date.now(),
          "Eligible ticket-price difference after rescheduling",
          session
        );
      }

      booking.show = new mongoose.Types.ObjectId(showId);
      booking.seats = seatIds.map(
        (seatId: string) => new mongoose.Types.ObjectId(seatId)
      );
      booking.totalAmount = targetAmounts.totalAmount;
      (booking as any).ticketSubtotal = targetAmounts.ticketSubtotal;
      (booking as any).platformFee = targetAmounts.platformFee;
      (booking as any).platformFeeGst = targetAmounts.platformFeeGst;

      await booking.save({ session });

      result = booking;
    });

    res.status(200).json({
      success: true,
      message: "Booking rescheduled",
      booking: result,
    });
  } catch (error: any) {
    const messages: Record<string, [number, string]> = {
      BOOKING_NOT_FOUND: [404, "Booking not found"],
      BOOKING_FORBIDDEN: [403, "You cannot modify this booking"],
      BOOKING_NOT_RESCHEDULABLE: [400, "This booking cannot be rescheduled"],
      RESCHEDULE_PAYMENT_PENDING: [
        409,
        "A reschedule payment is already pending",
      ],
      BOOKING_PAYMENT_EXISTS: [
        409,
        "This booking already has a payment",
      ],
      SHOW_NOT_FOUND: [404, "Show not found"],
      DIFFERENT_MOVIE: [400, "Rescheduling requires the same movie"],
      INVALID_TARGET_SHOW: [400, "Choose a different upcoming show"],
      TARGET_SEATS_UNAVAILABLE: [409, "One or more selected seats are unavailable"],
      ADDITIONAL_PAYMENT_REQUIRED: [
        409,
        "Additional payment is required to reschedule",
      ],
      INVALID_SEATS: [400, "Selected seats are invalid"],
      INVALID_TICKET_PRICE: [400, "Ticket price is invalid"],
      USER_NOT_FOUND: [404, "User not found"],
    };

    const mapped = messages[error?.message];

    res.status(mapped?.[0] || 500).json({
      success: false,
      message: mapped?.[1] || "Unable to reschedule booking",
    });
  } finally {
    await session.endSession();
  }
}

export async function getMyBookings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 10;

    const [bookings, total] = await Promise.all([
      Booking.find({ user: req.userId })
        .populate({
          path: "show",
          populate: [{ path: "movie" }, { path: "theatre" }, { path: "screen" }],
        })
        .populate("seats")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments({ user: req.userId }),
    ]);

    res.status(200).json({
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to load bookings",
    });
  }
}

export async function getBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const booking = await Booking.findById(req.params.id)
      .populate({
        path: "show",
        populate: [{ path: "movie" }, { path: "theatre" }, { path: "screen" }],
      })
      .populate("seats")
      .populate("user", "name email");

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    const userId =
      typeof booking.user === "object" &&
      booking.user &&
      "_id" in booking.user
        ? String((booking.user as any)._id)
        : String(booking.user);

    if (
      userId !== req.userId &&
      (req as any).user?.role !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You cannot access this booking",
      });
      return;
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to load booking",
    });
  }
}

export async function getAllBookings(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate({
        path: "show",
        populate: [{ path: "movie" }, { path: "theatre" }, { path: "screen" }],
      })
      .populate("seats")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      bookings,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to load bookings",
    });
  }
}

export async function cancelBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    let cancelledBooking: any;

    await session.withTransaction(async () => {
      const booking = await Booking.findById(req.params.id).session(session);

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const isAdmin = (req as any).user?.role === "admin";

      if (!isAdmin && booking.user.toString() !== req.userId) {
        throw new Error("BOOKING_FORBIDDEN");
      }

      if (booking.status === "cancelled") {
        cancelledBooking = booking;
        return;
      }

      const successfulPayment = await Payment.findOne({
        booking: booking._id,
        status: "success",
      }).session(session);

      if (booking.status === "confirmed" && successfulPayment) {
        const refund = Number(
          (booking as any).ticketSubtotal ?? 0
        );

        if (refund > 0) {
          await creditWallet(
            booking.user as mongoose.Types.ObjectId,
            booking._id as mongoose.Types.ObjectId,
            refund,
            "cancellation_refund",
            "cancellation:" + booking._id.toString(),
            "Eligible ticket-price refund after cancellation",
            session
          );
        }
      }

      booking.status = "cancelled";
      await booking.save({ session });

      await ShowSeat.updateMany(
        {
          booking: booking._id,
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

      cancelledBooking = booking;
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled",
      booking: cancelledBooking,
    });
  } catch (error: any) {
    const messages: Record<string, [number, string]> = {
      BOOKING_NOT_FOUND: [404, "Booking not found"],
      BOOKING_FORBIDDEN: [403, "You cannot cancel this booking"],
      USER_NOT_FOUND: [404, "User not found"],
    };

    const mapped = messages[error?.message];

    res.status(mapped?.[0] || 500).json({
      success: false,
      message: mapped?.[1] || "Unable to cancel booking",
    });
  } finally {
    await session.endSession();
  }
}