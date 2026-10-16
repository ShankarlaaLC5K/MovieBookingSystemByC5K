
import { Response } from "express";
import mongoose from "mongoose";

import { Booking } from "../models/Booking";
import { Show } from "../models/Show";
import { User } from "../models/User";
import { ShowSeat } from "../models/ShowSeat";
import { Seat } from "../models/Seat";
import { sendBookingCancellationEmail } from "../services/notificationService";
import { AuthRequest } from "../middleware/authMiddleware";

function getParamId(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getSeatDisplayName(seat: any): string {
  if (!seat) {
    return "Unknown";
  }

  if (seat.seatNumber) {
    return seat.seatNumber;
  }

  if (seat.row !== undefined && seat.number !== undefined) {
    return `${seat.row}${seat.number}`;
  }

  if (seat.name) {
    return seat.name;
  }

  if (seat.label) {
    return seat.label;
  }

  return seat._id?.toString() || "Unknown";
}

function formatShowDate(startTime: Date): string {
  return startTime.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatShowTime(startTime: Date): string {
  return startTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { showId, seatIds } = req.body;

    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "showId and seatIds are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
      return;
    }

    for (const seatId of seatIds) {
      if (!mongoose.Types.ObjectId.isValid(seatId)) {
        res.status(400).json({
          success: false,
          message: `Invalid seat ID: ${seatId}`,
        });
        return;
      }
    }

    const uniqueSeatIds = [...new Set(seatIds.map(String))];

    if (uniqueSeatIds.length !== seatIds.length) {
      res.status(400).json({
        success: false,
        message: "Duplicate seat IDs are not allowed",
      });
      return;
    }

    const show = await Show.findById(showId);

    if (!show) {
      res.status(404).json({
        success: false,
        message: "Show not found",
      });
      return;
    }

    const now = new Date();

    if (new Date(show.startTime) <= now) {
      res.status(400).json({
        success: false,
        message: "This show has already started",
      });
      return;
    }

    await ShowSeat.updateMany(
      {
        show: showId,
        status: "locked",
        lockedUntil: { $lte: now },
      },
      {
        $set: { status: "available" },
        $unset: {
          lockedUntil: 1,
          lockedBy: 1,
          booking: 1,
        },
      }
    );

    const showSeats = await ShowSeat.find({
      show: showId,
      seat: { $in: uniqueSeatIds },
    });

    if (showSeats.length !== uniqueSeatIds.length) {
      res.status(400).json({
        success: false,
        message: "One or more selected seats are not available for this show",
      });
      return;
    }

    const invalidSeats = showSeats.filter((showSeat) => {
      if (showSeat.status !== "locked") {
        return true;
      }

      if (!showSeat.lockedBy) {
        return true;
      }

      if (showSeat.lockedBy.toString() !== req.userId) {
        return true;
      }

      if (!showSeat.lockedUntil || new Date(showSeat.lockedUntil) <= now) {
        return true;
      }

      return false;
    });

    if (invalidSeats.length > 0) {
      res.status(409).json({
        success: false,
        message: "One or more selected seats are no longer reserved for you",
        unavailableSeatIds: invalidSeats.map((showSeat) =>
          showSeat.seat.toString()
        ),
      });
      return;
    }

    const existingPendingBooking = await Booking.findOne({
      user: req.userId,
      show: showId,
      status: "pending",
      seats: { $all: uniqueSeatIds },
    });

    if (existingPendingBooking) {
      res.status(200).json({
        success: true,
        message: "Existing pending booking reused",
        booking: existingPendingBooking,
      });
      return;
    }

    const seats = await Seat.find({
      _id: { $in: uniqueSeatIds },
    });

    if (seats.length !== uniqueSeatIds.length) {
      res.status(400).json({
        success: false,
        message: "One or more seats could not be found",
      });
      return;
    }

    const ticketPrice = Number(show.price);

    if (!Number.isFinite(ticketPrice) || ticketPrice < 0) {
      res.status(500).json({
        success: false,
        message: "Invalid show ticket price",
      });
      return;
    }

    const totalAmount = ticketPrice * uniqueSeatIds.length;

    const bookingReference =
      `BK-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    const booking = await Booking.create({
      user: req.userId,
      show: showId,
      seats: uniqueSeatIds,
      totalAmount,
      status: "pending",
      bookingReference,
    });

    await ShowSeat.updateMany(
      {
        show: showId,
        seat: { $in: uniqueSeatIds },
        status: "locked",
        lockedBy: req.userId,
      },
      {
        $set: { booking: booking._id },
      }
    );

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
};

export const getMyBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
    const skip = (page - 1) * limit;

    const total = await Booking.countDocuments({
      user: req.userId,
    });

    const bookings = await Booking.find({
      user: req.userId,
    })
      .populate({
        path: "show",
        populate: [
          { path: "movie" },
          { path: "theatre" },
          { path: "screen" },
        ],
      })
      .populate("seats")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

export const getBookingById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getParamId(req.params.id);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    const booking = await Booking.findById(id)
      .populate({
        path: "show",
        populate: [
          { path: "movie" },
          { path: "theatre" },
          { path: "screen" },
        ],
      })
      .populate("seats");

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    const currentUser = await User.findById(req.userId).select("role");

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (
      currentUser.role !== "admin" &&
      booking.user.toString() !== req.userId
    ) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to view this booking",
      });
      return;
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

export const getAllBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const currentUser = await User.findById(req.userId).select("role");

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (currentUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Administrator access required",
      });
      return;
    }

    const bookings = await Booking.find({})
      .populate("user", "name email role")
      .populate({
        path: "show",
        populate: [
          { path: "movie" },
          { path: "theatre" },
          { path: "screen" },
        ],
      })
      .populate("seats")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get all bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch all bookings",
    });
  }
};

export const cancelBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getParamId(req.params.id);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    const currentUser = await User.findById(req.userId).select("role");

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const isAdmin = currentUser.role === "admin";

    if (!isAdmin && booking.user.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking",
      });
      return;
    }

    if (booking.status === "cancelled") {
      res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
      return;
    }

    const show = await Show.findById(booking.show);

    if (!show) {
      if (!isAdmin) {
        res.status(404).json({
          success: false,
          message: "Associated show not found",
        });
        return;
      }

      booking.status = "cancelled";
      await booking.save();

      await ShowSeat.updateMany(
        {
          show: booking.show,
          seat: { $in: booking.seats },
          $or: [
            { booking: booking._id },
            { status: "locked" },
          ],
        },
        {
          $set: { status: "available" },
          $unset: {
            lockedUntil: 1,
            lockedBy: 1,
            booking: 1,
          },
        }
      );

      res.status(200).json({
        success: true,
        message:
          "Booking cancelled successfully. The associated show was already deleted.",
        booking,
      });
      return;
    }

    if (new Date(show.startTime) <= new Date()) {
      res.status(400).json({
        success: false,
        message:
          "This booking can no longer be cancelled because the show has started",
      });
      return;
    }

    booking.status = "cancelled";
    await booking.save();

    await ShowSeat.updateMany(
      {
        show: booking.show,
        seat: { $in: booking.seats },
        $or: [
          { booking: booking._id },
          {
            status: "locked",
            lockedBy: req.userId,
          },
        ],
      },
      {
        $set: { status: "available" },
        $unset: {
          lockedUntil: 1,
          lockedBy: 1,
          booking: 1,
        },
      }
    );

    const user = await User.findById(booking.user).select("email");

    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: "show",
        populate: [
          { path: "movie" },
          { path: "theatre" },
          { path: "screen" },
        ],
      })
      .populate("seats");

    if (user?.email && populatedBooking) {
      try {
        const populatedShow: any = populatedBooking.show;
        const movie = populatedShow?.movie;
        const theatre = populatedShow?.theatre;
        const screen = populatedShow?.screen;

        const seatNames = (
          populatedBooking.seats as any[]
        ).map(getSeatDisplayName);

        const startTime = populatedShow?.startTime
          ? new Date(populatedShow.startTime)
          : null;

        await sendBookingCancellationEmail({
          to: user.email,
          bookingReference: populatedBooking.bookingReference,
          movieName: movie?.title || "Movie",
          theatreName: theatre?.name || "Theatre",
          screenName: screen?.name || "Screen",
          showDate: startTime ? formatShowDate(startTime) : "N/A",
          showTime: startTime ? formatShowTime(startTime) : "N/A",
          seats: seatNames,
          amount: populatedBooking.totalAmount,
        });
      } catch (emailError) {
        console.error("Cancellation email failed:", emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: populatedBooking || booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
    });
  }
};

export const getBooking = getBookingById;
