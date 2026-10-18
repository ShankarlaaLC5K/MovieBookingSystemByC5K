import { Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { Booking } from "../models/Booking";
import { Payment } from "../models/Payment";
import { Show } from "../models/Show";
import { ShowSeat } from "../models/ShowSeat";
import { Seat } from "../models/Seat";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";
import { AuthRequest } from "../middleware/authMiddleware";

const RESCHEDULE_PAYMENT_EXPIRY_MINUTES = 10;
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

function isValidObjectId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    mongoose.Types.ObjectId.isValid(value)
  );
}

function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function calculateAmounts(show: any, seats: any[]): BookingAmounts {
  const ticketSubtotal = roundMoney(
    seats.reduce((total, seat) => {
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

      return total + numericPrice;
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

function getBookingTicketSubtotal(booking: any): number {
  if (
    typeof booking.ticketSubtotal === "number" &&
    Number.isFinite(booking.ticketSubtotal)
  ) {
    return roundMoney(booking.ticketSubtotal);
  }

  const fee =
    typeof booking.platformFee === "number"
      ? booking.platformFee
      : booking.seats.length * PLATFORM_FEE_PER_TICKET;

  const gst =
    typeof booking.platformFeeGst === "number"
      ? booking.platformFeeGst
      : roundMoney(fee * PLATFORM_FEE_GST_RATE);

  return Math.max(
    0,
    roundMoney(booking.totalAmount - fee - gst)
  );
}

function handleError(
  res: Response,
  error: unknown,
  fallbackMessage: string
): void {
  const message =
    error instanceof Error ? error.message : fallbackMessage;

  const statusMap: Record<string, number> = {
    BOOKING_NOT_FOUND: 404,
    SHOW_NOT_FOUND: 404,
    SEATS_NOT_FOUND: 404,
    PAYMENT_NOT_FOUND: 404,
    INVALID_BOOKING: 400,
    INVALID_SHOW: 400,
    INVALID_SEATS: 400,
    INVALID_TICKET_PRICE: 400,
    INVALID_RESCHEDULE_DATA: 400,
    SHOW_NOT_AVAILABLE: 400,
    SEATS_NOT_AVAILABLE: 409,
    RESCHEDULE_PAYMENT_PENDING: 409,
    ADDITIONAL_PAYMENT_REQUIRED: 409,
    USER_NOT_FOUND: 404,
    INSUFFICIENT_WALLET_BALANCE: 409,
    PAYMENT_ALREADY_STARTED: 409,
    WALLET_AMOUNT_MISMATCH: 409,
  };

  const status = statusMap[message];

  if (status) {
    const messages: Record<string, string> = {
      RESCHEDULE_PAYMENT_PENDING:
        "A reschedule payment is already pending. Please wait until it completes or expires.",
      SEATS_NOT_AVAILABLE:
        "One or more selected seats are no longer available.",
      SHOW_NOT_AVAILABLE:
        "Choose another upcoming show for the same movie.",
      INSUFFICIENT_WALLET_BALANCE:
        "Your wallet balance is no longer sufficient. Please retry without wallet or add balance.",
      PAYMENT_ALREADY_STARTED:
        "A payment has already been started for this booking. Please continue with that payment.",
      WALLET_AMOUNT_MISMATCH:
        "The wallet selection differs from the existing payment. Please continue with the existing payment.",
    };

    res.status(status).json({
      success: false,
      message: messages[message] || message,
      code: message,
    });
    return;
  }

  console.error(fallbackMessage, error);

  res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

/**
 * Deduct wallet only after payment succeeds.
 * The unique transaction reference prevents a second deduction.
 * Caller must pass the active MongoDB transaction session.
 */
async function debitWallet(
  userId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  amount: number,
  reference: string,
  description: string,
  session: mongoose.ClientSession
): Promise<void> {
  const roundedAmount = roundMoney(amount);

  if (roundedAmount <= 0) {
    return;
  }

  const existing = await WalletTransaction.findOne({
    reference,
  }).session(session);

  if (existing) {
    return;
  }


  const result = await User.updateOne(
    {
      _id: userId,
      walletBalance: { $gte: roundedAmount },
    },
    {
      $inc: { walletBalance: -roundedAmount },
    },
    { session }
  );

  if (result.matchedCount !== 1) {
    const userExists = await User.exists({ _id: userId }).session(session);

    if (!userExists) {
      throw new Error("USER_NOT_FOUND");
    }

    throw new Error("INSUFFICIENT_WALLET_BALANCE");
  }

  await WalletTransaction.create(
    [
      {
        user: userId,
        booking: bookingId,
        type: "booking_wallet_debit",
        amount: roundedAmount,
        reference,
        description,
      },
    ],
    { session }
  );
}

async function expireOldReschedulePayments(
  bookingId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<void> {
  const expiryTime = new Date(
    Date.now() -
      RESCHEDULE_PAYMENT_EXPIRY_MINUTES * 60 * 1000
  );

  await Payment.updateMany(
    {
      booking: bookingId,
      purpose: "reschedule",
      status: "pending",
      createdAt: { $lte: expiryTime },
    },
    {
      $set: { status: "failed" },
    },
    { session }
  );
}

async function ensureNoActiveReschedulePayment(
  bookingId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<void> {
  await expireOldReschedulePayments(bookingId, session);

  const pendingPayment = await Payment.findOne({
    booking: bookingId,
    purpose: "reschedule",
    status: "pending",
  }).session(session);

  if (pendingPayment) {
    throw new Error("RESCHEDULE_PAYMENT_PENDING");
  }
}

async function creditWallet(
  userId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  amount: number,
  reference: string,
  description: string,
  session: mongoose.ClientSession
): Promise<void> {
  const roundedAmount = roundMoney(amount);

  if (roundedAmount <= 0) {
    return;
  }

  const existing = await WalletTransaction.findOne({
    reference,
  }).session(session);

  if (existing) {
    return;
  }

  await WalletTransaction.create(
    [
      {
        user: userId,
        booking: bookingId,
        type: "reschedule_refund",
        amount: roundedAmount,
        reference,
        description,
      },
    ],
    { session }
  );

  const result = await User.updateOne(
    { _id: userId },
    { $inc: { walletBalance: roundedAmount } },
    { session }
  );

  if (result.matchedCount !== 1) {
    throw new Error("USER_NOT_FOUND");
  }
}

async function validateTargetSeats(
  showId: mongoose.Types.ObjectId,
  seatIds: string[],
  userId: string,
  session: mongoose.ClientSession
): Promise<{
  seatRecords: any[];
  showSeatRecords: any[];
}> {
  const seatRecords = await Seat.find({
    _id: { $in: seatIds },
  }).session(session);

  if (seatRecords.length !== seatIds.length) {
    throw new Error("SEATS_NOT_FOUND");
  }

  const showSeatRecords = await ShowSeat.find({
    show: showId,
    seat: { $in: seatIds },
  }).session(session);

  if (showSeatRecords.length !== seatIds.length) {
    throw new Error("INVALID_SEATS");
  }

  const now = Date.now();

  const availableSeatIds = new Set(
    showSeatRecords
      .filter(
        (seat: any) =>
          seat.status === "available" ||
          (seat.status === "locked" &&
            String(seat.lockedBy) === userId &&
            seat.lockedUntil &&
            new Date(seat.lockedUntil).getTime() > now)
      )
      .map((seat: any) => String(seat.seat))
  );

  if (seatIds.some((id) => !availableSeatIds.has(id))) {
    throw new Error("SEATS_NOT_AVAILABLE");
  }

  return {
    seatRecords,
    showSeatRecords,
  };
}

async function releaseOldSeats(
  booking: any,
  oldShowId: mongoose.Types.ObjectId,
  oldSeatIds: mongoose.Types.ObjectId[],
  session: mongoose.ClientSession
): Promise<void> {
  await ShowSeat.updateMany(
    {
      show: oldShowId,
      seat: { $in: oldSeatIds },
      booking: booking._id,
      status: "booked",
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
}

async function claimTargetSeats(
  showId: mongoose.Types.ObjectId,
  seatIds: string[],
  bookingId: mongoose.Types.ObjectId,
  userId: string,
  session: mongoose.ClientSession
): Promise<void> {
  const now = new Date();

  const result = await ShowSeat.updateMany(
    {
      show: showId,
      seat: { $in: seatIds },
      $or: [
        { status: "available" },
        {
          status: "locked",
          lockedBy: userId,
          lockedUntil: { $gt: now },
        },
      ],
    },
    {
      $set: {
        status: "booked",
        booking: bookingId,
      },
      $unset: {
        lockedBy: "",
        lockedUntil: "",
      },
    },
    { session }
  );

  if (result.modifiedCount !== seatIds.length) {
    throw new Error("SEATS_NOT_AVAILABLE");
  }
}

export async function createPaymentOrder(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { bookingId, useWallet = false } = req.body;
    const userId = req.userId;

    if (
      !userId ||
      !isValidObjectId(bookingId) ||
      typeof useWallet !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid booking or wallet selection",
      });
      return;
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
      status: "pending",
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    const existingPayment = await Payment.findOne({
      booking: booking._id,
      purpose: "booking",
      status: "pending",
    });

    if (existingPayment) {
      const existingWalletAmount = roundMoney(
        Number(existingPayment.walletAmount) || 0
      );

      if (existingPayment.gatewayOrderId) {

        if (existingWalletAmount > 0 !== useWallet) {
          throw new Error("WALLET_AMOUNT_MISMATCH");
        }

        res.status(200).json({
          success: true,
          message: "Existing payment order returned",
          order: {
            id: existingPayment.gatewayOrderId,
            amount: Math.round(existingPayment.amount * 100),
            currency: "INR",
          },
          keyId: process.env.RAZORPAY_KEY_ID,
          payment: {
            _id: existingPayment._id,
            booking: String(existingPayment.booking),
            amount: existingPayment.amount,
            provider: existingPayment.provider,
            gatewayOrderId: existingPayment.gatewayOrderId,
            status: existingPayment.status,
            walletAmount: existingWalletAmount,
          },
        });
        return;
      }

      throw new Error("PAYMENT_ALREADY_STARTED");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const ticketSubtotal = getBookingTicketSubtotal(booking);
    const walletAmount = useWallet
      ? roundMoney(
          Math.min(
            Math.max(0, Number(user.walletBalance) || 0),
            ticketSubtotal
          )
        )
      : 0;

    const amountToPay = roundMoney(booking.totalAmount - walletAmount);

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: Math.round(amountToPay * 100),
      currency: "INR",
      receipt: String(booking._id),
    });

    const payment = new Payment({
      booking: booking._id,
      amount: amountToPay,
      walletAmount,
      provider: "razorpay",
      purpose: "booking",
      gatewayOrderId: order.id,
      status: "pending",
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: "Payment order created",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      payment: {
        _id: payment._id,
        booking: String(payment.booking),
        amount: payment.amount,
        provider: payment.provider,
        gatewayOrderId: payment.gatewayOrderId,
        status: payment.status,
        walletAmount,
      },
    });
  } catch (error) {
    handleError(res, error, "Failed to create payment order");
  }
}

export async function createReschedulePaymentOrder(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { bookingId, showId, seatIds } = req.body;
    const userId = req.userId;

    if (
      !userId ||
      !isValidObjectId(bookingId) ||
      !isValidObjectId(showId) ||
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(isValidObjectId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid reschedule details",
      });
      return;
    }

    const uniqueSeatIds = [...new Set(seatIds)] as string[];

    if (uniqueSeatIds.length !== seatIds.length) {
      throw new Error("INVALID_SEATS");
    }

    const session = await mongoose.startSession();

    try {
      let responseData: any;

      await session.withTransaction(async () => {
        const booking = await Booking.findOne({
          _id: bookingId,
          user: userId,
          status: "confirmed",
        }).session(session);

        if (!booking) {
          throw new Error("BOOKING_NOT_FOUND");
        }

        await ensureNoActiveReschedulePayment(booking._id, session);

        const targetShow = await Show.findById(showId).session(session);
        const oldShow = await Show.findById(booking.show).session(session);

        if (!targetShow || !oldShow) {
          throw new Error("SHOW_NOT_FOUND");
        }

        if (
          String(oldShow.movie) !== String(targetShow.movie) ||
          new Date(targetShow.startTime).getTime() <= Date.now() ||
          String(oldShow._id) === String(targetShow._id)
        ) {
          throw new Error("SHOW_NOT_AVAILABLE");
        }

        const { seatRecords } = await validateTargetSeats(
          targetShow._id,
          uniqueSeatIds,
          String(userId),
          session
        );

        const totals = calculateAmounts(targetShow, seatRecords);
        const difference = roundMoney(
          totals.totalAmount - booking.totalAmount
        );

        if (difference <= 0) {
          throw new Error("ADDITIONAL_PAYMENT_REQUIRED");
        }

        const razorpay = getRazorpay();

        const order = await razorpay.orders.create({
          amount: Math.round(difference * 100),
          currency: "INR",
          receipt: String(booking._id),
        });

        const payment = new Payment({
          booking: booking._id,
          amount: difference,
          walletAmount: 0,
          provider: "razorpay",
          purpose: "reschedule",
          gatewayOrderId: order.id,
          status: "pending",
          rescheduleData: {
            oldShow: booking.show,
            oldSeats: booking.seats,
            targetShow: targetShow._id,
            targetSeats: uniqueSeatIds,
            targetTotalAmount: totals.totalAmount,
            targetTicketSubtotal: totals.ticketSubtotal,
            targetPlatformFee: totals.platformFee,
            targetPlatformFeeGst: totals.platformFeeGst,
            targetBookingStatus: "confirmed",
          },
        });

        await payment.save({ session });

        responseData = {
          success: true,
          order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
          },
          keyId: process.env.RAZORPAY_KEY_ID,
          payment: {
            _id: payment._id,
            booking: String(payment.booking),
            amount: payment.amount,
            provider: payment.provider,
            gatewayOrderId: payment.gatewayOrderId,
            status: payment.status,
          },
          difference,
          targetTotalAmount: totals.totalAmount,
        };
      });

      res.status(201).json(responseData);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    handleError(res, error, "Failed to create reschedule payment order");
  }
}

export async function verifyPayment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const userId = req.userId;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !userId ||
      !isValidObjectId(bookingId) ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid payment details",
      });
      return;
    }

    if (!keySecret) {
      res.status(503).json({
        success: false,
        message: "Razorpay credentials are not configured",
      });
      return;
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const signaturesMatch =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      );

    if (!signaturesMatch) {
      res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
      return;
    }

    const razorpay = getRazorpay();
    const gatewayPayment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      gatewayPayment.status !== "captured" ||
      gatewayPayment.order_id !== razorpay_order_id
    ) {
      res.status(400).json({
        success: false,
        message: "Payment has not been captured",
      });
      return;
    }

    let updatedBooking: any = null;
    let updatedPayment: any = null;

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        booking: bookingId,
        gatewayOrderId: razorpay_order_id,
      }).session(session);

      if (!payment) {
        throw new Error("PAYMENT_NOT_FOUND");
      }

      const booking = await Booking.findOne({
        _id: payment.booking,
        user: userId,
      }).session(session);

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (payment.status === "success") {
        updatedBooking = booking;
        updatedPayment = payment;
        return;
      }

      if (payment.status !== "pending") {
        throw new Error("PAYMENT_NOT_FOUND");
      }

      if (payment.purpose === "reschedule") {
        const data = payment.rescheduleData;

        if (!data) {
          throw new Error("INVALID_RESCHEDULE_DATA");
        }

        if (
          String(booking.show) !== String(data.oldShow) ||
          booking.seats.length !== data.oldSeats.length ||
          !booking.seats.every((id) =>
            data.oldSeats.some(
              (oldId: mongoose.Types.ObjectId) =>
                String(oldId) === String(id)
            )
          )
        ) {
          throw new Error("INVALID_RESCHEDULE_DATA");
        }

        const targetSeatIds = data.targetSeats.map(
          (id: mongoose.Types.ObjectId) => String(id)
        );

        await claimTargetSeats(
          data.targetShow,
          targetSeatIds,
          booking._id,
          String(userId),
          session
        );

        await releaseOldSeats(
          booking,
          data.oldShow,
          data.oldSeats,
          session
        );

        booking.show = data.targetShow;
        booking.seats = data.targetSeats;
        booking.totalAmount = data.targetTotalAmount;
        booking.ticketSubtotal = data.targetTicketSubtotal;
        booking.platformFee = data.targetPlatformFee;
        booking.platformFeeGst = data.targetPlatformFeeGst;
        booking.status = "confirmed";

        payment.status = "success";
        payment.transactionId = razorpay_payment_id;
        payment.signature = razorpay_signature;

        await booking.save({ session });
        await payment.save({ session });

        updatedBooking = booking;
        updatedPayment = payment;
        return;
      }

      if (booking.status !== "pending") {
        throw new Error("INVALID_BOOKING");
      }

      const claim = await ShowSeat.updateMany(
        {
          show: booking.show,
          seat: { $in: booking.seats },
          status: "locked",
          lockedBy: userId,
          lockedUntil: { $gt: new Date() },
        },
        {
          $set: {
            status: "booked",
            booking: booking._id,
          },
          $unset: {
            lockedBy: "",
            lockedUntil: "",
          },
        },
        { session }
      );

      if (claim.modifiedCount !== booking.seats.length) {
        throw new Error("SEATS_NOT_AVAILABLE");
      }

      const walletAmount = roundMoney(
        Number(payment.walletAmount) || 0
      );

      if (walletAmount > 0) {
        await debitWallet(
          booking.user as mongoose.Types.ObjectId,
          booking._id as mongoose.Types.ObjectId,
          walletAmount,
          "booking-wallet:" + String(payment._id),
          "Wallet contribution to successful ticket booking",
          session
        );
      }

      booking.status = "confirmed";
      payment.status = "success";
      payment.transactionId = razorpay_payment_id;
      payment.signature = razorpay_signature;

      await booking.save({ session });
      await payment.save({ session });

      updatedBooking = booking;
      updatedPayment = payment;
    });

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking: updatedBooking,
      payment: updatedPayment,
    });
  } catch (error) {
    handleError(res, error, "Payment verification failed");
  } finally {
    await session.endSession();
  }
}

export async function mockPaymentSuccess(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      success: false,
      message: "Test payments are disabled in production",
    });
    return;
  }

  const session = await mongoose.startSession();

  try {
    const { bookingId, useWallet = false } = req.body;
    const userId = req.userId;

    if (
      !userId ||
      !isValidObjectId(bookingId) ||
      typeof useWallet !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid booking or wallet selection",
      });
      return;
    }

    let updatedBooking: any = null;
    let updatedPayment: any = null;

    await session.withTransaction(async () => {

      const alreadyConfirmed = await Booking.findOne({
        _id: bookingId,
        user: userId,
        status: "confirmed",
      }).session(session);

      if (alreadyConfirmed) {
        const successfulPayment = await Payment.findOne({
          booking: alreadyConfirmed._id,
          purpose: "booking",
          status: "success",
        }).session(session);

        if (successfulPayment) {
          updatedBooking = alreadyConfirmed;
          updatedPayment = successfulPayment;
          return;
        }
      }

      const booking = await Booking.findOne({
        _id: bookingId,
        user: userId,
        status: "pending",
      }).session(session);

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      const existingSuccessfulPayment = await Payment.findOne({
        booking: booking._id,
        purpose: "booking",
        status: "success",
      }).session(session);

      if (existingSuccessfulPayment) {
        throw new Error("INVALID_BOOKING");
      }

      let payment = await Payment.findOne({
        booking: booking._id,
        purpose: "booking",
        status: "pending",
      }).session(session);

      if (payment?.provider === "razorpay") {
        throw new Error("PAYMENT_ALREADY_STARTED");
      }

      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const ticketSubtotal = getBookingTicketSubtotal(booking);

      const walletAmount = useWallet
        ? roundMoney(
            Math.min(
              Math.max(0, Number(user.walletBalance) || 0),
              ticketSubtotal
            )
          )
        : 0;

      if (payment) {
        if (
          roundMoney(Number(payment.walletAmount) || 0) !== walletAmount
        ) {
          throw new Error("WALLET_AMOUNT_MISMATCH");
        }
      } else {
        payment = new Payment({
          booking: booking._id,
          amount: roundMoney(booking.totalAmount - walletAmount),
          walletAmount,
          provider: "test",
          purpose: "booking",
          status: "pending",
        });
      }

      const claim = await ShowSeat.updateMany(
        {
          show: booking.show,
          seat: { $in: booking.seats },
          status: "locked",
          lockedBy: userId,
          lockedUntil: { $gt: new Date() },
        },
        {
          $set: {
            status: "booked",
            booking: booking._id,
          },
          $unset: {
            lockedBy: "",
            lockedUntil: "",
          },
        },
        { session }
      );

      if (claim.modifiedCount !== booking.seats.length) {
        throw new Error("SEATS_NOT_AVAILABLE");
      }

      if (walletAmount > 0) {
        await debitWallet(
          booking.user as mongoose.Types.ObjectId,
          booking._id as mongoose.Types.ObjectId,
          walletAmount,
          "booking-wallet:" + String(payment._id),
          "Wallet contribution to successful ticket booking",
          session
        );
      }

      payment.status = "success";
      payment.walletAmount = walletAmount;
      payment.transactionId =
        payment.transactionId || "TEST_" + crypto.randomUUID();

      await payment.save({ session });

      booking.status = "confirmed";
      await booking.save({ session });

      updatedBooking = booking;
      updatedPayment = payment;
    });

    res.status(200).json({
      success: true,
      message: "Test payment completed successfully",
      booking: updatedBooking,
      payment: updatedPayment,
    });
  } catch (error) {
    handleError(res, error, "Test payment failed");
  } finally {
    await session.endSession();
  }
}

export async function mockReschedulePaymentSuccess(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      success: false,
      message: "Test payments are disabled in production",
    });
    return;
  }

  const session = await mongoose.startSession();

  try {
    const { bookingId, showId, seatIds } = req.body;
    const userId = req.userId;

    if (
      !userId ||
      !isValidObjectId(bookingId) ||
      !isValidObjectId(showId) ||
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(isValidObjectId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid reschedule details",
      });
      return;
    }

    const uniqueSeatIds = [...new Set(seatIds)] as string[];

    if (uniqueSeatIds.length !== seatIds.length) {
      throw new Error("INVALID_SEATS");
    }

    let updatedBooking: any = null;
    let additionalPayment = 0;
    let walletCredit = 0;

    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: bookingId,
        user: userId,
        status: "confirmed",
      }).session(session);

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      await ensureNoActiveReschedulePayment(booking._id, session);

      const targetShow = await Show.findById(showId).session(session);
      const oldShow = await Show.findById(booking.show).session(session);

      if (!targetShow || !oldShow) {
        throw new Error("SHOW_NOT_FOUND");
      }

      if (
        String(oldShow.movie) !== String(targetShow.movie) ||
        new Date(targetShow.startTime).getTime() <= Date.now() ||
        String(oldShow._id) === String(targetShow._id)
      ) {
        throw new Error("SHOW_NOT_AVAILABLE");
      }

      const oldShowId = booking.show;
      const oldSeatIds = [...booking.seats];

      const oldSeatRecords = await Seat.find({
        _id: { $in: booking.seats },
      }).session(session);

      const oldTicketSubtotal = roundMoney(
        Number(
          booking.ticketSubtotal ??
            calculateAmounts(oldShow, oldSeatRecords).ticketSubtotal
        )
      );

      const { seatRecords } = await validateTargetSeats(
        targetShow._id,
        uniqueSeatIds,
        String(userId),
        session
      );

      const totals = calculateAmounts(targetShow, seatRecords);
      const difference = roundMoney(
        totals.totalAmount - booking.totalAmount
      );

      additionalPayment = Math.max(0, difference);

      await claimTargetSeats(
        targetShow._id,
        uniqueSeatIds,
        booking._id,
        String(userId),
        session
      );

      // Credit only the eligible ticket-subtotal difference.
      // Platform fee and GST are never refunded.
      if (totals.ticketSubtotal < oldTicketSubtotal) {
        walletCredit = roundMoney(
          oldTicketSubtotal - totals.ticketSubtotal
        );

        const refundReference =
          "reschedule:" +
          booking._id.toString() +
          ":" +
          oldShowId.toString() +
          ":" +
          targetShow._id.toString() +
          ":" +
          oldSeatIds.map(String).sort().join(",") +
          ":" +
          uniqueSeatIds.slice().sort().join(",");

        await creditWallet(
          booking.user as mongoose.Types.ObjectId,
          booking._id as mongoose.Types.ObjectId,
          walletCredit,
          refundReference,
          "Eligible ticket-price difference after rescheduling",
          session
        );
      }

      if (difference > 0) {
        const payment = new Payment({
          booking: booking._id,
          amount: additionalPayment,
          walletAmount: 0,
          provider: "test",
          purpose: "reschedule",
          transactionId: "TEST_" + crypto.randomUUID(),
          status: "success",
          rescheduleData: {
            oldShow: oldShowId,
            oldSeats: oldSeatIds,
            targetShow: targetShow._id,
            targetSeats: uniqueSeatIds,
            targetTotalAmount: totals.totalAmount,
            targetTicketSubtotal: totals.ticketSubtotal,
            targetPlatformFee: totals.platformFee,
            targetPlatformFeeGst: totals.platformFeeGst,
            targetBookingStatus: "confirmed",
          },
        });

        await payment.save({ session });
      }

      await releaseOldSeats(
        booking,
        oldShowId,
        oldSeatIds,
        session
      );

      booking.show = targetShow._id;
      booking.seats = uniqueSeatIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      booking.totalAmount = totals.totalAmount;
      booking.ticketSubtotal = totals.ticketSubtotal;
      booking.platformFee = totals.platformFee;
      booking.platformFeeGst = totals.platformFeeGst;
      booking.status = "confirmed";

      await booking.save({ session });

      updatedBooking = booking;
    });

    const updatedUser = await User.findById(userId).select("walletBalance");

    res.status(200).json({
      success: true,
      message: "Test reschedule completed successfully",
      additionalPayment,
      walletCredit,
      walletBalance: Number(updatedUser?.walletBalance || 0),
      booking: updatedBooking,
    });
  } catch (error) {
    handleError(res, error, "Test reschedule payment failed");
  } finally {
    await session.endSession();
  }
}