import { Request, Response } from "express";
import mongoose from "mongoose";
import { Seat } from "../models/Seat";
import { Screen } from "../models/Screen";

type SeatType = "regular" | "premium" | "recliner";

type SeatToCreate = {
  screen: string;
  row: string;
  number: number;
  type: SeatType;
  price: number;
};

function allocateSeatClasses(totalRows: number): SeatType[] {
  if (totalRows <= 0) {
    return [];
  }

  if (totalRows === 1) {
    return ["regular"];
  }

  if (totalRows === 2) {
    return ["recliner", "regular"];
  }

  let balconyCount = Math.floor(totalRows / 4);
  let firstClassCount = Math.floor(totalRows / 2);

  if (balconyCount === 0) {
    balconyCount = 1;
  }

  if (firstClassCount === 0) {
    firstClassCount = 1;
  }

  while (balconyCount + firstClassCount >= totalRows) {
    if (firstClassCount > 1) {
      firstClassCount -= 1;
    } else {
      balconyCount -= 1;
    }
  }

  const secondClassCount =
    totalRows - balconyCount - firstClassCount;

  return [
    ...Array<SeatType>(balconyCount).fill("recliner"),
    ...Array<SeatType>(firstClassCount).fill("premium"),
    ...Array<SeatType>(secondClassCount).fill("regular"),
  ];
}

export async function generateSeats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { screen, rows, seatsPerRow } = req.body;

    if (
      !screen ||
      rows === undefined ||
      seatsPerRow === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "Screen, rows and seatsPerRow are required",
      });
      return;
    }

    const screenId = String(screen);

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      res.status(400).json({
        success: false,
        message: "Invalid screen ID",
      });
      return;
    }

    const screenExists = await Screen.findById(screenId);

    if (!screenExists) {
      res.status(404).json({
        success: false,
        message: "Screen not found",
      });
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({
        success: false,
        message: "Rows must be a non-empty array",
      });
      return;
    }

    const seatCount = Number(seatsPerRow);

    if (!Number.isInteger(seatCount) || seatCount < 1) {
      res.status(400).json({
        success: false,
        message: "seatsPerRow must be a positive integer",
      });
      return;
    }

    const normalizedRows = rows.map((row: unknown) =>
      String(row).trim().toUpperCase()
    );

    if (
      normalizedRows.some((row: string) => !row) ||
      new Set(normalizedRows).size !== normalizedRows.length
    ) {
      res.status(400).json({
        success: false,
        message: "Rows must have unique, non-empty names",
      });
      return;
    }

    const totalSeatsToCreate =
      normalizedRows.length * seatCount;

    if (totalSeatsToCreate !== screenExists.totalSeats) {
      res.status(400).json({
        success: false,
        message:
          "Seat configuration creates " +
          totalSeatsToCreate +
          " seats, but screen capacity is " +
          screenExists.totalSeats,
      });
      return;
    }

    const existingSeats = await Seat.countDocuments({
      screen: screenId,
    });

    if (existingSeats > 0) {
      res.status(409).json({
        success: false,
        message:
          "Seats already exist for this screen. Existing seats were not changed.",
      });
      return;
    }

    const rowTypes = allocateSeatClasses(normalizedRows.length);

    const seats: SeatToCreate[] = [];

    for (
      let rowIndex = 0;
      rowIndex < normalizedRows.length;
      rowIndex++
    ) {
      const type = rowTypes[rowIndex];

      let price = 150;

      if (type === "recliner") {
        price = 250;
      } else if (type === "premium") {
        price = 200;
      }

      for (
        let number = 1;
        number <= seatCount;
        number++
      ) {
        seats.push({
          screen: screenId,
          row: normalizedRows[rowIndex],
          number,
          type,
          price,
        });
      }
    }

    const createdSeats = await Seat.insertMany(seats);

    res.status(201).json({
      success: true,
      message: "Seats generated successfully",
      count: createdSeats.length,
      classAllocation: {
        balconyRows: rowTypes.filter(
          (type) => type === "recliner"
        ).length,
        firstClassRows: rowTypes.filter(
          (type) => type === "premium"
        ).length,
        secondClassRows: rowTypes.filter(
          (type) => type === "regular"
        ).length,
      },
      seats: createdSeats,
    });
  } catch (error) {
    console.error("Generate seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate seats",
    });
  }
}

export async function getSeatsByScreen(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const screenId = String(req.params.screenId);

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      res.status(400).json({
        success: false,
        message: "Invalid screen ID",
      });
      return;
    }

    const screenExists = await Screen.findById(screenId);

    if (!screenExists) {
      res.status(404).json({
        success: false,
        message: "Screen not found",
      });
      return;
    }

    const seats = await Seat.find({
      screen: screenId,
    }).sort({
      row: 1,
      number: 1,
    });

    res.json({
      success: true,
      count: seats.length,
      seats,
    });
  } catch (error) {
    console.error("Get seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch seats",
    });
  }
}

export async function deleteSeatsByScreen(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const screenId = String(req.params.screenId);

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      res.status(400).json({
        success: false,
        message: "Invalid screen ID",
      });
      return;
    }

    const screenExists = await Screen.findById(screenId);

    if (!screenExists) {
      res.status(404).json({
        success: false,
        message: "Screen not found",
      });
      return;
    }

    const result = await Seat.deleteMany({
      screen: screenId,
    });

    res.json({
      success: true,
      message: "Seats deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete seats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete seats",
    });
  }
}