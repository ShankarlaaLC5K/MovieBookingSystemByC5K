import { Request, Response } from "express";
import mongoose from "mongoose";

import { ShowSeat } from "../models/ShowSeat";
import { Show } from "../models/Show";
import { Seat } from "../models/Seat";
import { AuthRequest } from "../middleware/authMiddleware";

const LOCK_DURATION_MINUTES = 10;


async function releaseExpiredLocks(showId: string): Promise<void> {
  await ShowSeat.updateMany(
    {
      show: showId,
      status: "locked",
      lockedUntil: { $lte: new Date() },
    },
    {
      $set: { status: "available" },
      $unset: {
        lockedUntil: 1,
        lockedBy: 1,
      },
    }
  );
}

export async function initializeShowSeats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const showId = String(req.body.show ?? "");

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "A valid show ID is required",
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

    const existingCount = await ShowSeat.countDocuments({
      show: showId,
    });

    if (existingCount > 0) {
      res.status(409).json({
        success: false,
        message: "Show seats are already initialized",
        count: existingCount,
      });
      return;
    }

    const seats = await Seat.find({
      screen: show.screen,
    }).sort({ row: 1, number: 1 });

    if (seats.length === 0) {
      res.status(404).json({
        success: false,
        message: "No seats found for this screen",
      });
      return;
    }

    const showSeats = seats.map((seat) => ({
      show: show._id,
      seat: seat._id,
      status: "available" as const,
    }));

    const createdShowSeats = await ShowSeat.insertMany(
      showSeats,
      { ordered: true }
    );

    res.status(201).json({
      success: true,
      message: "Show seats initialized successfully",
      count: createdShowSeats.length,
    });
  } catch (error) {
    console.error("Initialize show seats error:", error);

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "Show seats have already been initialized",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to initialize show seats",
    });
  }
}

export async function getShowSeats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const showId = String(req.params.showId ?? "");

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "Invalid show ID",
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

    await releaseExpiredLocks(showId);

    const showSeats = await ShowSeat.find({ show: showId })
      .populate("seat", "row number type price")
      .populate("lockedBy", "name email")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: showSeats.length,
      seats: showSeats,
    });
  } catch (error) {
    console.error("Get show seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch show seats",
    });
  }
}

export async function lockShowSeats(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userIdValue = req.userId;

  if (!userIdValue || !mongoose.Types.ObjectId.isValid(userIdValue)) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const showId = String(req.params.showId ?? "");
  const { seatIds } = req.body;

  if (!mongoose.Types.ObjectId.isValid(showId)) {
    res.status(400).json({
      success: false,
      message: "Invalid show ID",
    });
    return;
  }

  if (
    !Array.isArray(seatIds) ||
    seatIds.length === 0 ||
    seatIds.some(
      (seatId: unknown) =>
        typeof seatId !== "string" ||
        !mongoose.Types.ObjectId.isValid(seatId)
    )
  ) {
    res.status(400).json({
      success: false,
      message: "seatIds must be a non-empty array of valid seat IDs",
    });
    return;
  }

  const uniqueSeatIds = [...new Set(seatIds as string[])];

  if (uniqueSeatIds.length !== seatIds.length) {
    res.status(400).json({
      success: false,
      message: "Duplicate seat IDs are not allowed",
    });
    return;
  }

  try {
    const show = await Show.findById(showId);

    if (!show) {
      res.status(404).json({
        success: false,
        message: "Show not found",
      });
      return;
    }

    await releaseExpiredLocks(showId);

    const requestedSeats = await ShowSeat.find({
      show: showId,
      seat: { $in: uniqueSeatIds },
    });

    if (requestedSeats.length !== uniqueSeatIds.length) {
      res.status(400).json({
        success: false,
        message: "One or more seats do not belong to this show",
      });
      return;
    }

    const userId = new mongoose.Types.ObjectId(userIdValue);

    const unavailableSeats = requestedSeats.filter(
      (showSeat) =>
        showSeat.status === "booked" ||
        (showSeat.status === "locked" &&
          String(showSeat.lockedBy) !== String(userId))
    );

    if (unavailableSeats.length > 0) {
      res.status(409).json({
        success: false,
        message: "One or more selected seats are unavailable",
        unavailableSeatIds: unavailableSeats.map((showSeat) =>
          String(showSeat.seat)
        ),
      });
      return;
    }

    const lockedUntil = new Date(
      Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
    );


    const lockedSeats = [];

    for (const seatId of uniqueSeatIds) {
      const lockedSeat = await ShowSeat.findOneAndUpdate(
        {
          show: showId,
          seat: seatId,
          $or: [
            { status: "available" },
            {
              status: "locked",
              lockedBy: userId,
              lockedUntil: { $gt: new Date() },
            },
          ],
        },
        {
          $set: {
            status: "locked",
            lockedUntil,
            lockedBy: userId,
          },
        },
        { new: true }
      );

      if (!lockedSeat) {

        const acquiredSeatIds = lockedSeats
          .filter((seat) => !requestedSeats.some(
            (original) =>
              String(original.seat) === String(seat.seat) &&
              original.status === "locked" &&
              String(original.lockedBy) === String(userId)
          ))
          .map((seat) => seat.seat);

        if (acquiredSeatIds.length > 0) {
          await ShowSeat.updateMany(
            {
              show: showId,
              seat: { $in: acquiredSeatIds },
              status: "locked",
              lockedBy: userId,
            },
            {
              $set: { status: "available" },
              $unset: {
                lockedUntil: 1,
                lockedBy: 1,
              },
            }
          );
        }

        res.status(409).json({
          success: false,
          message: "One or more seats were taken by another user. Please refresh and try again.",
        });
        return;
      }

      lockedSeats.push(lockedSeat);
    }

    res.status(200).json({
      success: true,
      message: `Seats locked for ${LOCK_DURATION_MINUTES} minutes`,
      lockedUntil,
      seats: lockedSeats,
    });
  } catch (error) {
    console.error("Lock show seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to lock seats",
    });
  }
}

export async function unlockShowSeats(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userIdValue = req.userId;

    if (
      !userIdValue ||
      !mongoose.Types.ObjectId.isValid(userIdValue)
    ) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const showId = String(req.params.showId ?? "");
    const { seatIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
      return;
    }

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      seatIds.some(
        (seatId: unknown) =>
          typeof seatId !== "string" ||
          !mongoose.Types.ObjectId.isValid(seatId)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "seatIds must be a non-empty array of valid seat IDs",
      });
      return;
    }

    const uniqueSeatIds = [...new Set(seatIds as string[])];
    const userId = new mongoose.Types.ObjectId(userIdValue);

    const result = await ShowSeat.updateMany(
      {
        show: showId,
        seat: { $in: uniqueSeatIds },
        status: "locked",
        lockedBy: userId,
      },
      {
        $set: { status: "available" },
        $unset: {
          lockedUntil: 1,
          lockedBy: 1,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Seats unlocked successfully",
      unlockedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Unlock show seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to unlock seats",
    });
  }
}