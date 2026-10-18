
import { Booking } from "../models/Booking";
import {
  sendBookingReminderEmail,
  type BookingEmailData,
} from "./notificationService";

const REMINDER_INTERVAL_MS = 60 * 1000;
const REMINDER_LEAD_TIME_MS = 60 * 60 * 1000;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeatLabel(seat: {
  seatNumber?: string;
  label?: string;
  row?: string;
}): string {
  if (seat.seatNumber) return seat.seatNumber;
  if (seat.label) return seat.label;

  return [seat.row, seat.label]
    .filter(Boolean)
    .join("-") || "Seat";
}

let schedulerStarted = false;
let schedulerRunning = false;

export function startBookingReminderScheduler(): void {
  if (schedulerStarted) return;

  schedulerStarted = true;

  const checkReminders = async (): Promise<void> => {
    if (schedulerRunning) return;

    schedulerRunning = true;

    try {
      const now = new Date();
      const windowEnd = new Date(
        now.getTime() + REMINDER_LEAD_TIME_MS
      );

      const bookings = await Booking.find({
        status: "confirmed",
        reminderSentAt: { $exists: false },
      })
        .populate("user", "name email")
        .populate({
          path: "show",
          match: {
            startTime: {
              $gt: now,
              $lte: windowEnd,
            },
          },
          populate: [
            { path: "movie", select: "title" },
            { path: "theatre", select: "name" },
            { path: "screen", select: "name" },
          ],
        })
        .populate("seats", "seatNumber label row")
        .limit(100);

      for (const booking of bookings) {
        const user = booking.user as unknown as {
          name?: string;
          email?: string;
        } | null;

        const show = booking.show as unknown as {
          _id?: unknown;
          startTime?: Date;
          movie?: { title?: string };
          theatre?: { name?: string };
          screen?: { name?: string };
        } | null;

        if (
          !user?.email ||
          !show?._id ||
          !show.startTime
        ) {
          continue;
        }

        // Claim this reminder atomically to avoid duplicates.
        const claim = await Booking.updateOne(
          {
            _id: booking._id,
            status: "confirmed",
            reminderSentAt: { $exists: false },
          },
          {
            $set: { reminderSentAt: new Date() },
          }
        );

        if (claim.modifiedCount !== 1) {
          continue;
        }

        const seats = booking.seats as unknown as Array<{
          seatNumber?: string;
          label?: string;
          row?: string;
        }>;

        const emailData: BookingEmailData = {
          to: user.email,
          bookingReference: booking.bookingReference,
          movieName: show.movie?.title || "Movie",
          theatreName: show.theatre?.name || "Theatre",
          screenName: show.screen?.name || "Screen",
          showDate: formatDate(new Date(show.startTime)),
          showTime: formatTime(new Date(show.startTime)),
          seats: seats.map(getSeatLabel),
          amount: booking.totalAmount,
        };

        try {
          await sendBookingReminderEmail(emailData);
          console.log(
            "Booking reminder sent:",
            booking.bookingReference
          );
        } catch (error) {
          // Retry on the next scheduler run if email sending fails.
          await Booking.updateOne(
            {
              _id: booking._id,
              reminderSentAt: {
                $exists: true,
              },
            },
            {
              $unset: { reminderSentAt: 1 },
            }
          );

          console.error(
            "Booking reminder email failed:",
            booking.bookingReference,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Booking reminder scheduler failed:",
        error
      );
    } finally {
      schedulerRunning = false;
    }
  };

  // Check immediately after startup.
  void checkReminders();

  // Check again every minute.
  setInterval(() => {
    void checkReminders();
  }, REMINDER_INTERVAL_MS);

  console.log("Booking reminder scheduler started.");
}
