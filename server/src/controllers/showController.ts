import { Request, Response } from "express";
import mongoose from "mongoose";

import { Show } from "../models/Show";
import { Movie } from "../models/Movie";
import { Theatre } from "../models/Theatre";
import { Screen } from "../models/Screen";
import { Seat } from "../models/Seat";
import { ShowSeat } from "../models/ShowSeat";

const IST_OFFSET = "+05:30";

type ShowFormat = "2D" | "3D" | "IMAX";

interface ScheduleRequest {
  movie: string;
  theatre: string;
  screen: string;
  dates: string[];
  showTimes: string[];
  language: string;
  format?: ShowFormat;
  balconyPrice: number;
  firstClassPrice: number;
  secondClassPrice: number;
}

interface ClassPrices {
  balconyPrice: number;
  firstClassPrice: number;
  secondClassPrice: number;
}

function validatePrices(
  balconyPrice: unknown,
  firstClassPrice: unknown,
  secondClassPrice: unknown
): ClassPrices | null {
  const values = [
    balconyPrice,
    firstClassPrice,
    secondClassPrice,
  ];

  for (const value of values) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return null;
    }
  }

  const balcony = Number(balconyPrice);
  const first = Number(firstClassPrice);
  const second = Number(secondClassPrice);

  if (
    !Number.isFinite(balcony) ||
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    balcony < 0 ||
    first < 0 ||
    second < 0
  ) {
    return null;
  }

  return {
    balconyPrice: balcony,
    firstClassPrice: first,
    secondClassPrice: second,
  };
}

function normalizeFormat(
  format: unknown
): ShowFormat | null {
  const value = String(
    format === undefined ? "2D" : format
  ).toUpperCase();

  if (
    value !== "2D" &&
    value !== "3D" &&
    value !== "IMAX"
  ) {
    return null;
  }

  return value as ShowFormat;
}

async function validateShowReferences(
  movie: string,
  theatre: string,
  screen: string,
  res: Response
): Promise<boolean> {
  if (
    !mongoose.Types.ObjectId.isValid(movie) ||
    !mongoose.Types.ObjectId.isValid(theatre) ||
    !mongoose.Types.ObjectId.isValid(screen)
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid movie, theatre or screen ID",
    });
    return false;
  }

  const movieExists = await Movie.findById(movie);

  if (!movieExists) {
    res.status(404).json({
      success: false,
      message: "Movie not found",
    });
    return false;
  }

  const theatreExists = await Theatre.findById(theatre);

  if (!theatreExists) {
    res.status(404).json({
      success: false,
      message: "Theatre not found",
    });
    return false;
  }

  const screenExists = await Screen.findById(screen);

  if (!screenExists) {
    res.status(404).json({
      success: false,
      message: "Screen not found",
    });
    return false;
  }

  if (screenExists.theatre.toString() !== theatre) {
    res.status(400).json({
      success: false,
      message: "Screen does not belong to the selected theatre",
    });
    return false;
  }

  return true;
}

async function findScheduleConflict(
  screenId: string,
  startTime: Date,
  endTime: Date,
  excludedShowId?: string
) {
  const query: Record<string, unknown> = {
    screen: new mongoose.Types.ObjectId(screenId),
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludedShowId) {
    query._id = {
      $ne: new mongoose.Types.ObjectId(excludedShowId),
    };
  }

  return Show.findOne(query).select(
    "_id startTime endTime"
  );
}

export async function createShow(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      movie,
      theatre,
      screen,
      startTime,
      endTime,
      language,
      format,
      balconyPrice,
      firstClassPrice,
      secondClassPrice,
    } = req.body;

    if (
      !movie ||
      !theatre ||
      !screen ||
      !startTime ||
      !endTime ||
      !language
    ) {
      res.status(400).json({
        success: false,
        message:
          "Movie, theatre, screen, startTime, endTime and language are required",
      });
      return;
    }

    const movieId = String(movie);
    const theatreId = String(theatre);
    const screenId = String(screen);
    const normalizedLanguage = String(language).trim();

    if (!normalizedLanguage) {
      res.status(400).json({
        success: false,
        message: "Language cannot be empty",
      });
      return;
    }

    const prices = validatePrices(
      balconyPrice,
      firstClassPrice,
      secondClassPrice
    );

    if (!prices) {
      res.status(400).json({
        success: false,
        message:
          "Valid non-negative prices for Balcony, First Class and Second Class are required",
      });
      return;
    }

    const normalizedFormat = normalizeFormat(format);

    if (!normalizedFormat) {
      res.status(400).json({
        success: false,
        message: "Format must be 2D, 3D or IMAX",
      });
      return;
    }

    const referencesValid = await validateShowReferences(
      movieId,
      theatreId,
      screenId,
      res
    );

    if (!referencesValid) {
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid startTime or endTime",
      });
      return;
    }

    if (end <= start) {
      res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
      return;
    }

    const overlappingShow = await findScheduleConflict(
      screenId,
      start,
      end
    );

    if (overlappingShow) {
      res.status(409).json({
        success: false,
        message:
          "Another show is already scheduled on this screen during this time",
        conflictingShow: {
          id: overlappingShow._id.toString(),
          startTime: overlappingShow.startTime,
          endTime: overlappingShow.endTime,
        },
      });
      return;
    }

    const show = await Show.create({
      movie: new mongoose.Types.ObjectId(movieId),
      theatre: new mongoose.Types.ObjectId(theatreId),
      screen: new mongoose.Types.ObjectId(screenId),
      startTime: start,
      endTime: end,
      language: normalizedLanguage,
      format: normalizedFormat,
      price: prices.secondClassPrice,
      balconyPrice: prices.balconyPrice,
      firstClassPrice: prices.firstClassPrice,
      secondClassPrice: prices.secondClassPrice,
    });

    const seats = await Seat.find({
      screen: new mongoose.Types.ObjectId(screenId),
    });

    if (seats.length > 0) {
      await ShowSeat.insertMany(
        seats.map((seat) => ({
          show: show._id,
          seat: seat._id,
          status: "available" as const,
        }))
      );
    }

    const populatedShow = await Show.findById(show._id)
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats");

    res.status(201).json({
      success: true,
      message: "Show created successfully",
      show: populatedShow,
    });
  } catch (error) {
    console.error("Create show error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create show",
    });
  }
}

export async function createShowSchedule(
  req: Request,
  res: Response
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    const {
      movie,
      theatre,
      screen,
      dates,
      showTimes,
      language,
      format,
      balconyPrice,
      firstClassPrice,
      secondClassPrice,
    } = req.body as ScheduleRequest;

    if (
      !movie ||
      !theatre ||
      !screen ||
      !Array.isArray(dates) ||
      dates.length === 0 ||
      !Array.isArray(showTimes) ||
      showTimes.length === 0 ||
      !language
    ) {
      res.status(400).json({
        success: false,
        message:
          "Movie, theatre, screen, dates, showTimes, language and class prices are required",
      });
      return;
    }

    const movieId = String(movie);
    const theatreId = String(theatre);
    const screenId = String(screen);
    const normalizedLanguage = String(language).trim();

    if (!normalizedLanguage) {
      res.status(400).json({
        success: false,
        message: "Language cannot be empty",
      });
      return;
    }

    const prices = validatePrices(
      balconyPrice,
      firstClassPrice,
      secondClassPrice
    );

    if (!prices) {
      res.status(400).json({
        success: false,
        message:
          "Valid non-negative prices for Balcony, First Class and Second Class are required",
      });
      return;
    }

    const normalizedFormat = normalizeFormat(format);

    if (!normalizedFormat) {
      res.status(400).json({
        success: false,
        message: "Format must be 2D, 3D or IMAX",
      });
      return;
    }

    const referencesValid = await validateShowReferences(
      movieId,
      theatreId,
      screenId,
      res
    );

    if (!referencesValid) {
      return;
    }

    const uniqueDates = Array.from(
      new Set(dates.map((date) => String(date).trim()))
    );

    const uniqueShowTimes = Array.from(
      new Set(showTimes.map((time) => String(time).trim()))
    );

    for (const date of uniqueDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          success: false,
          message: "Invalid date: " + date,
        });
        return;
      }

      const dateParts = date.split("-").map(Number);
      const testDate = new Date(
        Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])
      );

      if (
        testDate.getUTCFullYear() !== dateParts[0] ||
        testDate.getUTCMonth() !== dateParts[1] - 1 ||
        testDate.getUTCDate() !== dateParts[2]
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid date: " + date,
        });
        return;
      }
    }

    for (const time of uniqueShowTimes) {
      if (!/^\d{2}:\d{2}$/.test(time)) {
        res.status(400).json({
          success: false,
          message: "Invalid show time: " + time,
        });
        return;
      }

      const timeParts = time.split(":").map(Number);
      const hours = timeParts[0];
      const minutes = timeParts[1];

      if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid show time: " + time,
        });
        return;
      }
    }

    const movieExists = await Movie.findById(movieId);

    if (!movieExists) {
      res.status(404).json({
        success: false,
        message: "Movie not found",
      });
      return;
    }

    const runtimeMinutes =
      Number(movieExists.runtime) > 0
        ? Number(movieExists.runtime)
        : 180;

    const schedules: {
      date: string;
      time: string;
      startTime: Date;
      endTime: Date;
    }[] = [];

    for (const date of uniqueDates) {
      for (const time of uniqueShowTimes) {
        const startTime = new Date(
          date + "T" + time + ":00" + IST_OFFSET
        );

        if (Number.isNaN(startTime.getTime())) {
          res.status(400).json({
            success: false,
            message: "Invalid schedule: " + date + " " + time,
          });
          return;
        }

        const endTime = new Date(
          startTime.getTime() + runtimeMinutes * 60 * 1000
        );

        schedules.push({
          date,
          time,
          startTime,
          endTime,
        });
      }
    }

    schedules.sort(
      (a, b) =>
        a.startTime.getTime() - b.startTime.getTime()
    );

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        if (
          schedules[j].startTime.getTime() >=
          schedules[i].endTime.getTime()
        ) {
          break;
        }

        if (schedules[i].date === schedules[j].date) {
          res.status(409).json({
            success: false,
            message:
              "Selected show timings overlap with each other",
            conflicts: [
              {
                date: schedules[i].date,
                time: schedules[i].time,
              },
              {
                date: schedules[j].date,
                time: schedules[j].time,
              },
            ],
          });
          return;
        }
      }
    }

    const conflicts: {
      date: string;
      time: string;
      existingShowId: string;
      existingStartTime: Date;
      existingEndTime: Date;
    }[] = [];

    for (const schedule of schedules) {
      const conflictingShow = await findScheduleConflict(
        screenId,
        schedule.startTime,
        schedule.endTime
      );

      if (conflictingShow) {
        conflicts.push({
          date: schedule.date,
          time: schedule.time,
          existingShowId: conflictingShow._id.toString(),
          existingStartTime: conflictingShow.startTime,
          existingEndTime: conflictingShow.endTime,
        });
      }
    }

    if (conflicts.length > 0) {
      res.status(409).json({
        success: false,
        message:
          "One or more selected show timings are already scheduled",
        conflicts,
      });
      return;
    }

    const seats = await Seat.find({
      screen: new mongoose.Types.ObjectId(screenId),
    }).session(session);

    if (seats.length === 0) {
      res.status(404).json({
        success: false,
        message: "No seats found for the selected screen",
      });
      return;
    }

    let createdShowIds: mongoose.Types.ObjectId[] = [];

    await session.withTransaction(async () => {
      const showIds: mongoose.Types.ObjectId[] = [];

      for (const schedule of schedules) {
        const showDocuments = await Show.create(
          [
            {
              movie: new mongoose.Types.ObjectId(movieId),
              theatre: new mongoose.Types.ObjectId(theatreId),
              screen: new mongoose.Types.ObjectId(screenId),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              language: normalizedLanguage,
              format: normalizedFormat,
              price: prices.secondClassPrice,
              balconyPrice: prices.balconyPrice,
              firstClassPrice: prices.firstClassPrice,
              secondClassPrice: prices.secondClassPrice,
            },
          ],
          { session }
        );

        const createdShow = showDocuments[0];
        showIds.push(createdShow._id);

        await ShowSeat.insertMany(
          seats.map((seat) => ({
            show: createdShow._id,
            seat: seat._id,
            status: "available" as const,
          })),
          { session }
        );
      }

      createdShowIds = showIds;
    });

    const populatedShows = await Show.find({
      _id: { $in: createdShowIds },
    })
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats")
      .sort({ startTime: 1 });

    res.status(201).json({
      success: true,
      message: String(populatedShows.length) + " shows created successfully",
      count: populatedShows.length,
      shows: populatedShows,
    });
  } catch (error) {
    console.error("Create show schedule error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create show schedule",
    });
  } finally {
    await session.endSession();
  }
}

export async function getShows(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const shows = await Show.find()
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats")
      .sort({ startTime: 1 });

    res.json({
      success: true,
      count: shows.length,
      shows,
    });
  } catch (error) {
    console.error("Get shows error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shows",
    });
  }
}

export async function getShow(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const showId = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
      return;
    }

    const show = await Show.findById(showId)
      .populate(
        "movie",
        "title overview posterPath backdropPath tmdbId runtime"
      )
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats");

    if (!show) {
      res.status(404).json({
        success: false,
        message: "Show not found",
      });
      return;
    }

    res.json({
      success: true,
      show,
    });
  } catch (error) {
    console.error("Get show error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch show",
    });
  }
}

export async function getShowsByMovie(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const movieId = String(req.params.movieId);

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      res.status(400).json({
        success: false,
        message: "Invalid movie ID",
      });
      return;
    }

    const movieExists = await Movie.findById(movieId);

    if (!movieExists) {
      res.status(404).json({
        success: false,
        message: "Movie not found",
      });
      return;
    }

    const shows = await Show.find({
      movie: new mongoose.Types.ObjectId(movieId),
      startTime: { $gte: new Date() },
    })
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats")
      .sort({ startTime: 1 });

    res.json({
      success: true,
      count: shows.length,
      shows,
    });
  } catch (error) {
    console.error("Get movie shows error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch movie shows",
    });
  }
}

export async function getShowsByTheatre(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const theatreId = String(req.params.theatreId);

    if (!mongoose.Types.ObjectId.isValid(theatreId)) {
      res.status(400).json({
        success: false,
        message: "Invalid theatre ID",
      });
      return;
    }

    const theatreExists = await Theatre.findById(theatreId);

    if (!theatreExists) {
      res.status(404).json({
        success: false,
        message: "Theatre not found",
      });
      return;
    }

    const shows = await Show.find({
      theatre: new mongoose.Types.ObjectId(theatreId),
      startTime: { $gte: new Date() },
    })
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats")
      .sort({ startTime: 1 });

    res.json({
      success: true,
      count: shows.length,
      shows,
    });
  } catch (error) {
    console.error("Get theatre shows error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch theatre shows",
    });
  }
}

export async function updateShow(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const showId = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
      return;
    }

    const existingShow = await Show.findById(showId);

    if (!existingShow) {
      res.status(404).json({
        success: false,
        message: "Show not found",
      });
      return;
    }

    const {
      movie,
      theatre,
      screen,
      startTime,
      endTime,
      language,
      format,
      balconyPrice,
      firstClassPrice,
      secondClassPrice,
    } = req.body;

    const updateData: {
      movie?: mongoose.Types.ObjectId;
      theatre?: mongoose.Types.ObjectId;
      screen?: mongoose.Types.ObjectId;
      startTime?: Date;
      endTime?: Date;
      language?: string;
      format?: ShowFormat;
      price?: number;
      balconyPrice?: number;
      firstClassPrice?: number;
      secondClassPrice?: number;
    } = {};

    if (movie !== undefined) {
      const movieId = String(movie);

      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        res.status(400).json({
          success: false,
          message: "Invalid movie ID",
        });
        return;
      }

      const movieExists = await Movie.findById(movieId);

      if (!movieExists) {
        res.status(404).json({
          success: false,
          message: "Movie not found",
        });
        return;
      }

      updateData.movie = new mongoose.Types.ObjectId(movieId);
    }

    if (theatre !== undefined) {
      const theatreId = String(theatre);

      if (!mongoose.Types.ObjectId.isValid(theatreId)) {
        res.status(400).json({
          success: false,
          message: "Invalid theatre ID",
        });
        return;
      }

      const theatreExists = await Theatre.findById(theatreId);

      if (!theatreExists) {
        res.status(404).json({
          success: false,
          message: "Theatre not found",
        });
        return;
      }

      updateData.theatre = new mongoose.Types.ObjectId(theatreId);
    }

    if (screen !== undefined) {
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

      updateData.screen = new mongoose.Types.ObjectId(screenId);
    }

    if (language !== undefined) {
      const normalizedLanguage = String(language).trim();

      if (!normalizedLanguage) {
        res.status(400).json({
          success: false,
          message: "Language cannot be empty",
        });
        return;
      }

      updateData.language = normalizedLanguage;
    }

    if (format !== undefined) {
      const normalizedFormat = normalizeFormat(format);

      if (!normalizedFormat) {
        res.status(400).json({
          success: false,
          message: "Format must be 2D, 3D or IMAX",
        });
        return;
      }

      updateData.format = normalizedFormat;
    }

    const hasAnyPrice =
      balconyPrice !== undefined ||
      firstClassPrice !== undefined ||
      secondClassPrice !== undefined;

    if (hasAnyPrice) {
      const prices = validatePrices(
        balconyPrice !== undefined
          ? balconyPrice
          : existingShow.balconyPrice,
        firstClassPrice !== undefined
          ? firstClassPrice
          : existingShow.firstClassPrice,
        secondClassPrice !== undefined
          ? secondClassPrice
          : existingShow.secondClassPrice
      );

      if (!prices) {
        res.status(400).json({
          success: false,
          message:
            "Valid non-negative prices for all three classes are required",
        });
        return;
      }

      updateData.balconyPrice = prices.balconyPrice;
      updateData.firstClassPrice = prices.firstClassPrice;
      updateData.secondClassPrice = prices.secondClassPrice;
      updateData.price = prices.secondClassPrice;
    }

    if (startTime !== undefined) {
      const start = new Date(startTime);

      if (Number.isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid startTime",
        });
        return;
      }

      updateData.startTime = start;
    }

    if (endTime !== undefined) {
      const end = new Date(endTime);

      if (Number.isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid endTime",
        });
        return;
      }

      updateData.endTime = end;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
      return;
    }

    const finalStart =
      updateData.startTime !== undefined
        ? updateData.startTime
        : existingShow.startTime;

    const finalEnd =
      updateData.endTime !== undefined
        ? updateData.endTime
        : existingShow.endTime;

    if (finalEnd <= finalStart) {
      res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
      return;
    }

    const finalTheatreId =
      updateData.theatre !== undefined
        ? updateData.theatre.toString()
        : existingShow.theatre.toString();

    const finalScreenId =
      updateData.screen !== undefined
        ? updateData.screen.toString()
        : existingShow.screen.toString();

    const finalScreen = await Screen.findById(finalScreenId);

    if (!finalScreen) {
      res.status(404).json({
        success: false,
        message: "Screen not found",
      });
      return;
    }

    if (finalScreen.theatre.toString() !== finalTheatreId) {
      res.status(400).json({
        success: false,
        message: "Screen does not belong to the selected theatre",
      });
      return;
    }

    const conflictingShow = await findScheduleConflict(
      finalScreenId,
      finalStart,
      finalEnd,
      showId
    );

    if (conflictingShow) {
      res.status(409).json({
        success: false,
        message:
          "Another show is already scheduled on this screen during this time",
        conflictingShow: {
          id: conflictingShow._id.toString(),
          startTime: conflictingShow.startTime,
          endTime: conflictingShow.endTime,
        },
      });
      return;
    }

    const updatedShow = await Show.findByIdAndUpdate(
      showId,
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!updatedShow) {
      res.status(404).json({
        success: false,
        message: "Show not found",
      });
      return;
    }

    const populatedShow = await Show.findById(updatedShow._id)
      .populate("movie", "title posterPath tmdbId runtime")
      .populate("theatre", "name address city state pincode")
      .populate("screen", "name totalSeats");

    res.json({
      success: true,
      message: "Show updated successfully",
      show: populatedShow,
    });
  } catch (error) {
    console.error("Update show error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update show",
    });
  }
}

export async function deleteShow(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const showId = String(req.params.id);

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

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await ShowSeat.deleteMany(
          { show: showId },
          { session }
        );

        await Show.deleteOne(
          { _id: showId },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    res.json({
      success: true,
      message: "Show deleted successfully",
    });
  } catch (error) {
    console.error("Delete show error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete show",
    });
  }
}