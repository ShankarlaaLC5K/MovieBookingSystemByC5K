import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, Ticket } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getShowSeats, lockSeats } from "../services/seatService";
import type { Seat, ShowSeat } from "../types/seat";
import { useBooking } from "../context/BookingContext";

type SeatClass = "recliner" | "premium" | "regular";

type SeatRow = {
  rowName: string;
  seats: ShowSeat[];
};

type SeatSection = {
  type: SeatClass;
  title: string;
  rows: SeatRow[];
};

interface RescheduleLocationState {
  rescheduleBookingId?: string;
}

function hasValidSeat(
  showSeat: ShowSeat | null | undefined
): showSeat is ShowSeat & { seat: Seat } {
  if (!showSeat || !showSeat.seat || typeof showSeat.seat === "string") {
    return false;
  }

  return (
    typeof showSeat.seat._id === "string" &&
    typeof showSeat.seat.row === "string" &&
    Number.isFinite(Number(showSeat.seat.number))
  );
}

function getSeatId(showSeat: ShowSeat): string {
  return hasValidSeat(showSeat) ? showSeat.seat._id : "";
}

function getSeatName(showSeat: ShowSeat): string {
  return hasValidSeat(showSeat)
    ? String(showSeat.seat.row) + String(showSeat.seat.number)
    : "";
}

function getSeatRow(showSeat: ShowSeat): string {
  return hasValidSeat(showSeat) ? showSeat.seat.row : "";
}

function getSeatNumber(showSeat: ShowSeat): number {
  return hasValidSeat(showSeat) ? Number(showSeat.seat.number) : 0;
}

function getSeatType(showSeat: ShowSeat): SeatClass {
  if (!hasValidSeat(showSeat)) return "regular";
  if (showSeat.seat.type === "recliner") return "recliner";
  if (showSeat.seat.type === "premium") return "premium";
  return "regular";
}

function SeatSelection() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as RescheduleLocationState | null;
  const rescheduleBookingId = locationState?.rescheduleBookingId;
  const isRescheduling = Boolean(rescheduleBookingId);

  const { setBooking, clearBooking, expiresAt } = useBooking();

  const [seats, setSeats] = useState<ShowSeat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!showId) {
      setError("Show ID is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSeats() {
      try {
        setLoading(true);
        setError("");

        const response = await getShowSeats(showId as string);

        if (cancelled) return;

        const receivedSeats = Array.isArray(response.seats)
          ? response.seats
          : [];

        setSeats(receivedSeats.filter(hasValidSeat));
      } catch (loadError: any) {
        if (cancelled) return;

        setError(
          loadError?.response?.data?.message || "Failed to load seats."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSeats();

    return () => {
      cancelled = true;
    };
  }, [showId]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        setTimeLeft(null);
        setSelected([]);
        clearBooking();
        return;
      }

      setTimeLeft(remaining);
    };

    updateTimer();

    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, clearBooking]);

  const seatSections = useMemo<SeatSection[]>(() => {
    const sections: SeatSection[] = [
      { type: "recliner", title: "BALCONY", rows: [] },
      { type: "premium", title: "FIRST CLASS", rows: [] },
      { type: "regular", title: "SECOND CLASS", rows: [] },
    ];

    sections.forEach((section) => {
      const sectionSeats = seats.filter(
        (seat) => getSeatType(seat) === section.type
      );

      const rowNames = Array.from(
        new Set(
          sectionSeats
            .map(getSeatRow)
            .filter((name) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      section.rows = rowNames.map((rowName) => ({
        rowName,
        seats: sectionSeats
          .filter((seat) => getSeatRow(seat) === rowName)
          .sort((a, b) => getSeatNumber(a) - getSeatNumber(b)),
      }));
    });

    return sections.filter((section) => section.rows.length > 0);
  }, [seats]);

  const selectedNames = useMemo(
    () =>
      seats
        .filter((seat) => selected.includes(getSeatId(seat)))
        .map(getSeatName),
    [seats, selected]
  );

  const availableCount = seats.filter(
    (seat) => seat.status === "available"
  ).length;

  const toggleSeat = (showSeat: ShowSeat) => {
    if (
      !hasValidSeat(showSeat) ||
      showSeat.status !== "available" ||
      locking
    ) {
      return;
    }

    const seatId = getSeatId(showSeat);
    if (!seatId) return;

    setSelected((current) =>
      current.includes(seatId)
        ? current.filter((id) => id !== seatId)
        : [...current, seatId]
    );

    setError("");
  };

  const handleContinue = async () => {
    if (!showId) {
      setError("Show ID is missing.");
      return;
    }

    if (!selected.length) {
      setError("Please select at least one seat.");
      return;
    }

    try {
      setLocking(true);
      setError("");

      const response = await lockSeats(showId, selected);
      const lockedUntil = new Date(response.lockedUntil).getTime();

      if (!Number.isFinite(lockedUntil) || lockedUntil <= Date.now()) {
        throw new Error("The seat reservation expiry time is invalid.");
      }

      setBooking(showId, selected, selectedNames, lockedUntil);

      navigate("/checkout", {
        state: isRescheduling && rescheduleBookingId
          ? { rescheduleBookingId }
          : undefined,
      });
    } catch (continueError: any) {
      setError(
        continueError?.response?.data?.message ||
          continueError?.message ||
          "Unable to continue. Please try again."
      );
    } finally {
      setLocking(false);
    }
  };

  const formatTimer = (milliseconds: number) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  };

  const renderSeat = (showSeat: ShowSeat) => {
    if (!hasValidSeat(showSeat)) return null;

    const seatId = getSeatId(showSeat);
    const seatName = getSeatName(showSeat);
    const isSelected = selected.includes(seatId);
    const isUnavailable = showSeat.status !== "available";

    return (
      <button
        key={showSeat._id}
        type="button"
        title={seatName}
        aria-label={"Seat " + seatName}
        aria-pressed={isSelected}
        disabled={isUnavailable || locking || !seatId}
        onClick={() => toggleSeat(showSeat)}
        className={
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold transition sm:h-9 sm:w-9 sm:text-xs " +
          (isSelected
            ? "border-green-600 bg-green-600 text-white"
            : isUnavailable
              ? "cursor-not-allowed border-slate-700 bg-slate-700 text-slate-400"
              : "border-green-500 bg-white text-slate-900 hover:bg-green-50")
        }
      >
        {isSelected && (
          <Check size={11} className="absolute right-0.5 top-0.5" />
        )}
        {getSeatNumber(showSeat)}
      </button>
    );
  };

  if (loading) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />
          <p className="text-slate-400">Loading seats...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-lg bg-red-500/10 p-2 text-red-500">
            <Ticket size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              {isRescheduling ? "Choose New Seats" : "Select Your Seats"}
            </h1>
            <p className="mt-1 text-slate-400">
              {isRescheduling
                ? "Choose seats for your rescheduled show."
                : "Choose your preferred seats."}
            </p>
          </div>
        </div>

        {timeLeft !== null && timeLeft > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="flex items-center gap-3">
              <Clock size={21} className="text-yellow-400" />
              <div>
                <p className="text-sm text-slate-400">Seat reservation</p>
                <p className="font-semibold">
                  Complete your booking before the timer ends
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold tabular-nums text-yellow-400">
              {formatTimer(timeLeft)}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-8">
          {seats.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold">No valid seats available</p>
              <p className="mt-2 text-slate-400">
                This show has no usable seat records.
              </p>
            </div>
          ) : (
            <>
              <div className="mx-auto flex w-full flex-col items-center gap-10">
                {seatSections.map((section) => (
                  <div key={section.type} className="w-full">
                    <h2 className="mb-5 text-center text-sm font-bold tracking-[0.2em] text-white">
                      {section.title}
                    </h2>
                    <div className="mx-auto w-full max-w-5xl space-y-3">
                      {section.rows.map((row) => {
                        const splitIndex = Math.ceil(row.seats.length / 2);
                        const leftSeats = row.seats.slice(0, splitIndex);
                        const rightSeats = row.seats.slice(splitIndex);

                        return (
                          <div
                            key={section.type + "-" + row.rowName}
                            className="mx-auto grid w-full max-w-3xl grid-cols-[24px_minmax(0,1fr)] items-center gap-2 sm:gap-4"
                          >
                            <span className="text-center text-xs font-semibold text-slate-400">
                              {row.rowName}
                            </span>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                              <div className="flex min-w-0 flex-nowrap justify-end gap-1.5 sm:gap-2">
                                {leftSeats.map(renderSeat)}
                              </div>
                              <div
                                aria-hidden="true"
                                className="flex h-full min-h-8 flex-col items-center justify-center gap-1.5"
                              >
                                {Array.from(
                                  {
                                    length: Math.max(
                                      leftSeats.length,
                                      rightSeats.length
                                    ),
                                  },
                                  (_, index) => (
                                    <span
                                      key={index}
                                      className="h-1.5 w-4 rounded-full bg-slate-700 sm:w-5"
                                    />
                                  )
                                )}
                              </div>
                              <div className="flex min-w-0 flex-nowrap justify-start gap-1.5 sm:gap-2">
                                {rightSeats.map(renderSeat)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mx-auto mt-12 w-full max-w-5xl px-3">
                <svg
                  viewBox="0 0 800 90"
                  className="h-16 w-full overflow-visible"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 8 12 Q 400 92 792 12"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="mt-1 text-center text-xs font-semibold tracking-[0.3em] text-slate-400">
                  ALL EYES THIS WAY PLEASE
                </p>
              </div>
            </>
          )}

          <div className="mt-10 flex flex-wrap justify-center gap-5 border-t border-slate-800 pt-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-green-500 bg-white" />
              Available
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-green-600" />
              Selected
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-slate-700" />
              Unavailable
            </div>
          </div>

          <div className="mt-5 text-center text-sm text-slate-400">
            Available seats:{" "}
            <strong className="text-white">{availableCount}</strong>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Selected seats</p>
              <p className="mt-1 font-semibold">
                {selectedNames.length
                  ? selectedNames.join(", ")
                  : "No seats selected"}
              </p>
            </div>
            <button
              type="button"
              disabled={!selected.length || locking}
              onClick={handleContinue}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-7 py-3 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {locking
                ? "Reserving Seats..."
                : isRescheduling
                  ? "Continue Reschedule"
                  : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SeatSelection;