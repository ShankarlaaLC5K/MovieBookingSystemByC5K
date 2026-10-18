import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  MapPin,
  Monitor,
  Printer,
  Ticket,
  XCircle,
  CreditCard,
  ReceiptText,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useEffect,
  useState,
} from "react";

import {
  cancelBooking,
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

function BookingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const loadBooking = async () => {
    if (!id) {
      setError("Booking ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await getBookingById(id);
      setBooking(response.booking);
    } catch (error: any) {
      console.error("Failed to load booking:", error);

      setError(
        error?.response?.data?.message ||
          "Failed to load booking details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBooking();
  }, [id]);

  const handleProceedToPayment = () => {
    if (booking) {
      navigate("/checkout/" + booking._id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancel = async () => {
    if (!booking) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?"
    );

    if (!confirmed) return;

    try {
      setCancelling(true);
      setError("");

      await cancelBooking(booking._id);
      await loadBooking();
    } catch (error: any) {
      console.error("Failed to cancel booking:", error);

      setError(
        error?.response?.data?.message ||
          "Failed to cancel booking."
      );
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "N/A";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "N/A";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (date?: string) => {
    if (!date) return "N/A";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "N/A";
    }

    return parsedDate.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getSeatName = (
    seat:
      | string
      | {
          _id: string;
          row: string;
          number: number;
        }
  ) => {
    if (typeof seat === "string") return seat;

    if (seat.row && seat.number !== undefined) {
      return seat.row + seat.number;
    }

    return seat._id;
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "border-green-500/20 bg-green-500/10 text-green-400";

      case "cancelled":
      case "canceled":
        return "border-red-500/20 bg-red-500/10 text-red-400";

      case "pending":
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-400";

      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2
            size={40}
            className="mx-auto mb-4 animate-spin text-red-500"
          />

          <p className="text-slate-400">
            Loading booking details...
          </p>
        </div>
      </section>
    );
  }

  if (error || !booking) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <XCircle
            size={48}
            className="mx-auto text-red-500"
          />

          <h1 className="mt-5 text-2xl font-bold">
            Booking Not Found
          </h1>

          <p className="mt-2 text-slate-400">
            {error || "We couldn't find this booking."}
          </p>

          <Link
            to="/bookings"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700"
          >
            <ArrowLeft size={17} />
            My Bookings
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

  const show =
    typeof booking.show === "object"
      ? booking.show
      : null;

  const movie =
    show && typeof show.movie === "object"
      ? show.movie
      : null;

  const theatre =
    show && typeof show.theatre === "object"
      ? show.theatre
      : null;

  const screen =
    show && typeof show.screen === "object"
      ? show.screen
      : null;

  const isCancelled =
    ["cancelled", "canceled"].includes(
      booking.status.toLowerCase()
    );

  const isPending =
    booking.status.toLowerCase() === "pending";

  const isConfirmed =
    booking.status.toLowerCase() === "confirmed";

  return (
    <>
      <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-10 text-white print:min-h-0 print:bg-white print:px-0 print:py-0 print:text-black">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => navigate("/bookings")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white print:hidden"
          >
            <ArrowLeft size={17} />
            Back to My Bookings
          </button>

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:mb-5">
            <div>
              <p className="text-sm text-slate-500 print:text-slate-600">
                Booking Reference
              </p>

              <h1 className="mt-1 text-3xl font-bold print:text-2xl print:text-black">
                {booking.bookingReference || booking._id}
              </h1>
            </div>

            <span
              className={
                "inline-flex w-fit rounded-full border px-4 py-2 text-xs font-semibold uppercase print:border-slate-300 print:bg-transparent print:text-black " +
                getStatusClass(booking.status)
              }
            >
              {booking.status}
            </span>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 print:hidden">
              {error}
            </div>
          )}

          {isPending && (
            <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 print:hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-yellow-300">
                    Payment is pending
                  </p>

                  <p className="mt-1 text-sm text-yellow-200/70">
                    Your seats are reserved for this booking.
                    Complete the payment or cancel the booking.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <CreditCard size={17} />
                    Proceed to Payment
                  </button>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancel}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Cancel Booking
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            id="print-ticket"
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 print:rounded-none print:border print:border-slate-300 print:bg-white"
          >
            <div className="border-b border-slate-800 bg-linear-to-r from-red-600/20 to-slate-900 p-6 print:border-slate-300 print:bg-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-red-500/10 p-3 text-red-500 print:border print:border-red-200">
                    <Ticket size={28} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Movie Ticket
                    </p>

                    <h2 className="mt-1 text-xl font-bold print:text-black">
                      {isPending
                        ? "Booking Pending"
                        : "Booking Confirmation"}
                    </h2>
                  </div>
                </div>

                <div className="hidden text-right sm:block print:block">
                  <p className="text-xs text-slate-500">
                    Booking Reference
                  </p>

                  <p className="mt-1 font-bold print:text-black">
                    {booking.bookingReference || booking._id}
                  </p>
                </div>
              </div>
            </div>

            {movie && (
              <div className="border-b border-slate-800 p-6 print:border-slate-300">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-red-500/10 p-3 text-red-500 print:border print:border-red-200">
                    <Film size={26} />
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">
                      Movie
                    </p>

                    <h2 className="mt-1 text-2xl font-bold print:text-black">
                      {movie.title}
                    </h2>

                    {movie.language && (
                      <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                        {movie.language.toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {show && (
              <div className="grid gap-6 border-b border-slate-800 p-6 sm:grid-cols-3 print:border-slate-300">
                <div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={17} />
                    <span className="text-xs uppercase tracking-wide">
                      Theatre
                    </span>
                  </div>

                  <p className="mt-2 font-semibold print:text-black">
                    {theatre?.name || "N/A"}
                  </p>

                  {theatre?.city && (
                    <p className="mt-1 text-sm text-slate-500">
                      {theatre.city}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Monitor size={17} />
                    <span className="text-xs uppercase tracking-wide">
                      Screen
                    </span>
                  </div>

                  <p className="mt-2 font-semibold print:text-black">
                    {screen?.name || "N/A"}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock size={17} />
                    <span className="text-xs uppercase tracking-wide">
                      Show Time
                    </span>
                  </div>

                  <p className="mt-2 font-semibold print:text-black">
                    {formatDate(show.startTime)}
                  </p>

                  <p className="mt-1 text-sm text-red-400 print:text-red-600">
                    {formatTime(show.startTime)}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-6 border-b border-slate-800 p-6 sm:grid-cols-3 print:border-slate-300">
              <div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Ticket size={17} />
                  <span className="text-xs uppercase tracking-wide">
                    Seats
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.seats.length > 0 ? (
                    booking.seats.map((seat, index) => (
                      <span
                        key={getSeatName(seat) + "-" + index}
                        className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 print:border print:border-slate-300 print:bg-white print:text-black"
                      >
                        {getSeatName(seat)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">
                      No seats
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-500">
                  <CalendarDays size={17} />
                  <span className="text-xs uppercase tracking-wide">
                    Booked On
                  </span>
                </div>

                <p className="mt-2 font-semibold print:text-black">
                  {formatDate(booking.createdAt)}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-500">
                  <CheckCircle2 size={17} />
                  <span className="text-xs uppercase tracking-wide">
                    Total Amount
                  </span>
                </div>

                <p className="mt-2 text-xl font-bold text-red-400 print:text-red-600">
                  ₹{formatAmount(totalAmount)}
                </p>
              </div>
            </div>

            <div className="border-b border-slate-800 p-6 print:border-slate-300">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText size={19} className="text-red-400" />

                <h3 className="font-bold print:text-black">
                  Ticket Price Breakdown
                </h3>
              </div>

              {hasPriceBreakdown ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-200 print:text-black">
                        Ticket price
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {booking.seats.length} ticket(s)
                      </p>
                    </div>

                    <p className="font-semibold tabular-nums print:text-black">
                      ₹{formatAmount(ticketSubtotal)}
                    </p>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-200 print:text-black">
                        Platform fee
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Booking service charge
                      </p>
                    </div>

                    <p className="font-semibold tabular-nums print:text-black">
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

                  <div className="border-t border-dashed border-slate-700 pt-4 print:border-slate-300">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold print:text-black">
                          Total Amount
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Including listed charges
                        </p>
                      </div>

                      <p className="text-2xl font-extrabold tabular-nums text-red-400 print:text-red-600">
                        ₹{formatAmount(totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm leading-6 text-slate-400 print:text-slate-600">
                    The detailed breakdown is unavailable for this booking.
                    The total shown above is the amount saved on the booking.
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 print:border-slate-300">
                    <p className="font-bold print:text-black">
                      Total Amount
                    </p>

                    <p className="text-xl font-bold text-red-400 print:text-red-600">
                      ₹{formatAmount(totalAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-slate-800 p-6 print:border-slate-300">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Booking ID
              </p>

              <p className="mt-2 break-all font-mono text-sm text-slate-300 print:text-slate-700">
                {booking._id}
              </p>
            </div>

            <div className="border-b border-slate-800 p-6 print:border-slate-300">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-green-500"
                />

                <div>
                  <p className="font-semibold print:text-black">
                    {isPending
                      ? "Payment Required"
                      : "Booking Confirmation"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {isPending
                      ? "Complete payment to confirm your movie ticket."
                      : "Please show this booking confirmation at the theatre entrance."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-end print:hidden">
              <Link
                to="/bookings"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ArrowLeft size={16} />
                My Bookings
              </Link>

              {isPending && (
                <>
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <CreditCard size={17} />
                    Proceed to Payment
                  </button>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancel}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Cancel Booking
                      </>
                    )}
                  </button>
                </>
              )}

              {isConfirmed && (
                <>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <Printer size={17} />
                    Print Ticket
                  </button>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancel}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Cancel Booking
                      </>
                    )}
                  </button>
                </>
              )}

              {isCancelled && (
                <span className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-500">
                  Booking Cancelled
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 12mm;
            }

            body {
              background: white !important;
            }

            nav,
            header,
            footer {
              display: none !important;
            }

            #print-ticket {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
            }
          }
        `}
      </style>
    </>
  );
}

export default BookingDetails;