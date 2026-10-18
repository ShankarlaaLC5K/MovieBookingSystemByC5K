import {
  CheckCircle2,
  Home,
  Ticket,
  ReceiptText,
} from "lucide-react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  useEffect,
  useState,
} from "react";

import {
  getBookingById,
} from "../services/bookingService";

import type {
  Booking,
} from "../types/booking";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function BookingConfirmation() {
  const { id } = useParams();

  const [booking, setBooking] =
    useState<Booking | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!id) {
      setError("Booking ID is missing.");
      setLoading(false);
      return;
    }

    const loadBooking = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await getBookingById(id);

        setBooking(response.booking);
      } catch (error: any) {
        console.error(
          "Failed to load booking:",
          error
        );

        setError(
          error?.response?.data?.message ||
            "Failed to load booking details."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadBooking();
  }, [id]);

  if (loading) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500" />

          <p className="text-slate-400">
            Loading booking...
          </p>
        </div>
      </section>
    );
  }

  if (error || !booking) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-red-400">
            {error || "Booking not found."}
          </p>

          <Link
            to="/movies"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700"
          >
            <Home size={18} />
            Browse Movies
          </Link>
        </div>
      </section>
    );
  }

  const bookingData = booking as Booking & {
    ticketSubtotal?: number;
    platformFee?: number;
    platformFeeGst?: number;
  };

  const ticketSubtotal =
    typeof bookingData.ticketSubtotal === "number"
      ? bookingData.ticketSubtotal
      : null;

  const platformFee =
    typeof bookingData.platformFee === "number"
      ? bookingData.platformFee
      : null;

  const platformFeeGst =
    typeof bookingData.platformFeeGst === "number"
      ? bookingData.platformFeeGst
      : null;

  const hasPriceBreakdown =
    ticketSubtotal !== null &&
    platformFee !== null &&
    platformFeeGst !== null;

  const totalAmount = Number(booking.totalAmount || 0);

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-8 text-white sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 bg-linear-to-r from-red-950/60 to-slate-900 px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <Ticket
                  size={25}
                  className="text-red-500"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Movie Ticket
                </p>

                <h1 className="mt-1 text-xl font-bold sm:text-2xl">
                  Booking Confirmation
                </h1>
              </div>

              <CheckCircle2
                size={28}
                className="shrink-0 text-green-500"
              />
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <ReceiptText
                  size={24}
                  className="text-red-500"
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-slate-400">
                  Booking Reference
                </p>

                <p className="mt-1 break-all text-lg font-bold">
                  {booking.bookingReference || booking._id}
                </p>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-sm font-semibold capitalize text-green-400">
                  <CheckCircle2 size={15} />
                  {booking.status}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div>
                <p className="text-sm text-slate-400">
                  Tickets
                </p>

                <p className="mt-1 text-lg font-bold">
                  {booking.seats.length}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  Booking ID
                </p>

                <p className="mt-1 break-all text-sm font-medium">
                  {booking._id}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-4 py-4">
                <ReceiptText
                  size={19}
                  className="text-red-400"
                />

                <h2 className="font-bold">
                  Ticket Price Breakdown
                </h2>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                {hasPriceBreakdown ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-200">
                          Ticket price
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {booking.seats.length} ticket(s)
                        </p>
                      </div>

                      <p className="font-semibold tabular-nums">
                        ₹{formatAmount(ticketSubtotal)}
                      </p>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-200">
                          Platform fee
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Booking service charge
                        </p>
                      </div>

                      <p className="font-semibold tabular-nums">
                        ₹{formatAmount(platformFee)}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-200 print:text-black">
                          GST (18%)
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          18% of platform fee
                        </p>
                      </div>

                      <p className="font-semibold tabular-nums print:text-black">
                        ₹{formatAmount(platformFeeGst)}
                      </p>
                    </div>
                    <div className="border-t border-dashed border-slate-700 pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold">
                            Total Paid
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Including applicable charges
                          </p>
                        </div>

                        <p className="text-2xl font-extrabold tabular-nums text-red-400">
                          ₹{formatAmount(totalAmount)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-sm text-slate-400">
                      Detailed price breakdown is not available for this booking.
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
                      <p className="font-bold">
                        Total Paid
                      </p>

                      <p className="text-2xl font-extrabold tabular-nums text-red-400">
                        ₹{formatAmount(totalAmount)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-green-500"
                />

                <div>
                  <p className="font-semibold text-green-400">
                    Booking Confirmation
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Please show this booking confirmation at the theatre entrance.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/bookings"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                <Ticket size={18} />
                My Bookings
              </Link>

              <Link
                to="/movies"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <Home size={18} />
                Browse Movies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BookingConfirmation;