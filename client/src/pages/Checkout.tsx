import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";

import { useBooking } from "../context/BookingContext";
import { useAuth } from "../context/AuthContext";
import {
  createBooking,
  getBookingById,
  rescheduleBooking,
} from "../services/bookingService";
import {
  createPaymentOrder,
  createReschedulePaymentOrder,
  mockPaymentSuccess,
  mockReschedulePaymentSuccess,
  verifyPayment,
} from "../services/paymentService";
import { getShowSeats, unlockSeats } from "../services/seatService";
import type { ShowSeat } from "../types/seat";
import "../types/razorpay";
import api from "../services/api";

interface ShowPriceResponse {
  success: boolean;
  show: {
    _id: string;
    price: number;
    balconyPrice?: number;
    firstClassPrice?: number;
    secondClassPrice?: number;
    language: string;
    format: string;
  };
}

interface CheckoutLocationState {
  rescheduleBookingId?: string;
}

interface ExistingBooking {
  _id: string;
  totalAmount: number;
  ticketSubtotal?: number;
  platformFee?: number;
  platformFeeGst?: number;
  seats?: unknown[];
  status?: string;
}

function money(value: number): string {
  return "₹" + value.toFixed(2);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function seatTypeName(type?: string): string {
  if (type === "recliner") return "Balcony";
  if (type === "premium") return "First Class";
  return "Second Class";
}

function seatPrice(
  show: ShowPriceResponse["show"],
  type?: string
): number {
  const value =
    type === "recliner"
      ? show.balconyPrice
      : type === "premium"
        ? show.firstClassPrice
        : show.secondClassPrice;

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(show.price) || 0;
}

function getSeatParts(name: string): { row: string; number: number } | null {
  const match = name.match(/^([A-Za-z]+)\s*[- ]?\s*(\d+)$/);
  if (!match) return null;
  return { row: match[1].toUpperCase(), number: Number(match[2]) };
}

function formatSeatRanges(seats: Array<{ name: string }>): string {
  const parsed = seats
    .map((seat) => ({ name: seat.name, parts: getSeatParts(seat.name) }))
    .filter((seat) => seat.parts !== null)
    .sort((a, b) => {
      const rowCompare = a.parts!.row.localeCompare(b.parts!.row, undefined, { numeric: true });
      return rowCompare !== 0 ? rowCompare : a.parts!.number - b.parts!.number;
    });

  const ranges: string[] = [];
  let index = 0;

  while (index < parsed.length) {
    const first = parsed[index];
    const row = first.parts!.row;
    let start = first.parts!.number;
    let end = start;
    index += 1;

    while (index < parsed.length) {
      const current = parsed[index].parts!;
      if (current.row !== row || current.number > end + 1) break;
      if (current.number > end) end = current.number;
      index += 1;
    }

    ranges.push(start === end ? row + start : row + start + " – " + row + end);
  }

  const invalidNames = seats
    .filter((seat) => getSeatParts(seat.name) === null)
    .map((seat) => seat.name);

  return ranges.concat(invalidNames).join(", ");
}

function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CheckoutLocationState | null;
  const rescheduleBookingId = locationState?.rescheduleBookingId;
  const isRescheduling = Boolean(rescheduleBookingId);

  const { user, refreshUser } = useAuth();

  const {
    showId,
    selectedSeatIds,
    selectedSeatNames,
    expiresAt,
    clearBooking,
  } = useBooking();

  const [show, setShow] = useState<ShowPriceResponse["show"] | null>(null);
  const [showSeats, setShowSeats] = useState<ShowSeat[]>([]);
  const [oldBooking, setOldBooking] = useState<ExistingBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [backLoading, setBackLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const walletBalance = Math.max(0, Number(user?.walletBalance) || 0);

  useEffect(() => {
    let active = true;

    async function loadWalletBalance() {
      try {
        setWalletLoading(true);
        await refreshUser();
      } catch {
        if (active) {
          setError("Unable to refresh wallet balance. Please try again.");
        }
      } finally {
        if (active) {
          setWalletLoading(false);
        }
      }
    }

    void loadWalletBalance();

    return () => {
      active = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (!showId) {
      setShow(null);
      setShowSeats([]);
      setPriceLoading(false);
      return;
    }

    let active = true;

    async function loadData() {
      try {
        setPriceLoading(true);
        setError("");

        const [showResponse, seatsResponse] = await Promise.all([
          api.get<ShowPriceResponse>("/shows/" + showId),
          getShowSeats(showId as string),
        ]);

        if (!active) return;

        setShow(showResponse.data.show);
        setShowSeats(seatsResponse.seats);
      } catch (loadError: any) {
        if (!active) return;

        setShow(null);
        setShowSeats([]);
        setError(
          loadError?.response?.data?.message ||
            "Unable to load checkout details."
        );
      } finally {
        if (active) setPriceLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [showId]);

  useEffect(() => {
    if (!isRescheduling || !rescheduleBookingId) {
      setOldBooking(null);
      return;
    }

    let active = true;

    async function loadOldBooking() {
      try {
        const bookingId = rescheduleBookingId;
        if (!bookingId) return;

        const response = await getBookingById(bookingId);

        if (!active) return;

        setOldBooking(response.booking as ExistingBooking);
      } catch (loadError: any) {
        if (!active) return;

        setError(
          loadError?.response?.data?.message ||
            "Unable to load your existing booking."
        );
      }
    }

    void loadOldBooking();

    return () => {
      active = false;
    };
  }, [isRescheduling, rescheduleBookingId]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      setTimeLeft(Math.max(0, expiresAt - Date.now()));
    };

    update();

    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const selectedSeats = useMemo(
    () =>
      selectedSeatIds.map((seatId, index) => {
        const showSeat = showSeats.find((item) =>
          typeof item.seat === "string"
            ? item.seat === seatId
            : item.seat?._id === seatId
        );

        const seatType =
          typeof showSeat?.seat === "object"
            ? showSeat.seat.type
            : undefined;

        return {
          id: seatId,
          name: selectedSeatNames[index] || seatId,
          type: seatType,
        };
      }),
    [selectedSeatIds, selectedSeatNames, showSeats]
  );

  const groupedSeats = useMemo(() => {
    const groups: Record<string, typeof selectedSeats> = {};

    selectedSeats.forEach((seat) => {
      const label = seatTypeName(seat.type);
      if (!groups[label]) groups[label] = [];
      groups[label].push(seat);
    });

    return Object.entries(groups).map(([label, seats]) => ({
      label,
      seats: seats.slice().sort((a, b) => {
        const aParts = getSeatParts(a.name);
        const bParts = getSeatParts(b.name);
        if (!aParts || !bParts) return a.name.localeCompare(b.name);
        const rowCompare = aParts.row.localeCompare(bParts.row, undefined, { numeric: true });
        return rowCompare !== 0 ? rowCompare : aParts.number - bParts.number;
      }),
      seatNames: formatSeatRanges(seats),
      unitPrice: seats.length > 0 && show ? seatPrice(show, seats[0].type) : 0,
      totalPrice: show ? roundMoney(seats.reduce((sum, seat) => sum + seatPrice(show, seat.type), 0)) : 0,
    }));
  }, [selectedSeats, show]);

  const ticketSubtotal = show
    ? roundMoney(
        selectedSeats.reduce(
          (total, seat) => total + seatPrice(show, seat.type),
          0
        )
      )
    : 0;

  const platformFee = roundMoney(selectedSeatIds.length * 20);
  const platformFeeGst = roundMoney(platformFee * 0.18);

  const totalAmount = roundMoney(
    ticketSubtotal + platformFee + platformFeeGst
  );

  const walletUsed =
    !isRescheduling && useWallet
      ? roundMoney(Math.min(walletBalance, ticketSubtotal))
      : 0;

  const payableNow = roundMoney(totalAmount - walletUsed);

  const oldTotal = Number(oldBooking?.totalAmount) || 0;

  const oldTicketSubtotal =
    typeof oldBooking?.ticketSubtotal === "number"
      ? oldBooking.ticketSubtotal
      : Math.max(
          0,
          roundMoney(
            oldTotal -
              (Number(oldBooking?.platformFee) ||
                (Array.isArray(oldBooking?.seats)
                  ? oldBooking.seats.length * 20
                  : 0)) -
              (Number(oldBooking?.platformFeeGst) ||
                roundMoney(
                  (Array.isArray(oldBooking?.seats)
                    ? oldBooking.seats.length * 20
                    : 0) * 0.18
                ))
          )
        );

  const amountDifference = roundMoney(totalAmount - oldTotal);
  const payableDifference = Math.max(0, amountDifference);

  const walletCreditEstimate = Math.max(
    0,
    roundMoney(oldTicketSubtotal - ticketSubtotal)
  );

  const timerExpired = timeLeft !== null && timeLeft <= 0;

  const amountReady =
    !priceLoading &&
    Boolean(show) &&
    selectedSeatIds.length > 0 &&
    (!isRescheduling || Boolean(oldBooking));

  const formattedTime =
    timeLeft === null
      ? null
      : String(
          Math.floor(Math.ceil(timeLeft / 1000) / 60)
        ).padStart(2, "0") +
        ":" +
        String(Math.ceil(timeLeft / 1000) % 60).padStart(2, "0");

  const checkReservation = (): boolean => {
    if (!showId) {
      setError("Please select a show and seats again.");
      return false;
    }

    if (selectedSeatIds.length === 0) {
      setError("Please select at least one seat.");
      return false;
    }

    if (expiresAt && expiresAt <= Date.now()) {
      setError(
        "Your seat reservation has expired. Please select seats again."
      );
      return false;
    }

    return true;
  };

  const handleBackToSeats = async () => {
    if (!showId) return;

    try {
      setBackLoading(true);
      setError("");

      await unlockSeats(showId, selectedSeatIds);
      clearBooking();

      navigate("/shows/" + showId + "/seats", {
        state:
          isRescheduling && rescheduleBookingId
            ? { rescheduleBookingId }
            : undefined,
      });
    } catch (backError: any) {
      setError(
        backError?.response?.data?.message ||
          "Unable to return to seat selection."
      );
    } finally {
      setBackLoading(false);
    }
  };

  const finishBooking = async (bookingId: string) => {
    try {
      await refreshUser();
    } catch {
    }

    clearBooking();
    navigate("/booking-success/" + bookingId, { replace: true });
  };

  const handleMockPayment = async () => {
    if (!checkReservation() || !showId) return;

    try {
      setLoading(true);
      setError("");

      if (isRescheduling && rescheduleBookingId) {
        const result = await mockReschedulePaymentSuccess({
          bookingId: rescheduleBookingId,
          showId,
          seatIds: selectedSeatIds,
        });

        await finishBooking(result.booking._id);
        return;
      }

      const bookingResponse = await createBooking({
        showId,
        seatIds: selectedSeatIds,
      });

      const paymentResponse = await mockPaymentSuccess(
        bookingResponse.booking._id,
        useWallet
      );

      await finishBooking(paymentResponse.booking._id);
    } catch (paymentError: any) {
      setError(
        paymentError?.response?.data?.message ||
          "Test payment failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!checkReservation() || !showId) return;

    try {
      setLoading(true);
      setError("");

      const razorpayLoaded = await loadRazorpayScript();

      if (!razorpayLoaded) {
        setError("Unable to load Razorpay. Check your internet connection.");
        return;
      }

      let bookingId = "";
      let paymentOrder;

      if (isRescheduling && rescheduleBookingId) {
        if (payableDifference <= 0) {
          const response = await rescheduleBooking(rescheduleBookingId, {
            showId,
            seatIds: selectedSeatIds,
          });

          await finishBooking(response.booking._id);
          return;
        }

        paymentOrder = await createReschedulePaymentOrder({
          bookingId: rescheduleBookingId,
          showId,
          seatIds: selectedSeatIds,
        });

        bookingId = rescheduleBookingId;
      } else {
        const bookingResponse = await createBooking({
          showId,
          seatIds: selectedSeatIds,
        });

        bookingId = bookingResponse.booking._id;

        paymentOrder = await createPaymentOrder(bookingId, useWallet);
      }

      const razorpay = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.order.amount,
        currency: paymentOrder.order.currency,
        name: "MovieBooking",
        description: isRescheduling
          ? "Movie booking reschedule payment"
          : "Movie ticket booking",
        order_id: paymentOrder.order.id,
        handler: async (razorpayResponse) => {
          try {
            setLoading(true);
            setError("");

            const verified = await verifyPayment({
              bookingId,
              razorpay_order_id: razorpayResponse.razorpay_order_id,
              razorpay_payment_id: razorpayResponse.razorpay_payment_id,
              razorpay_signature: razorpayResponse.razorpay_signature,
            });

            await finishBooking(verified.booking._id);
          } catch (verificationError: any) {
            setError(
              verificationError?.response?.data?.message ||
                "Payment verification failed. Please contact support."
            );
          } finally {
            setLoading(false);
          }
        },
        theme: { color: "#dc2626" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError(
              "Payment was cancelled. Your existing booking remains unchanged."
            );
          },
        },
      });

      razorpay.open();
    } catch (paymentError: any) {
      setError(
        paymentError?.response?.data?.message ||
          "Unable to process payment. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!showId || selectedSeatIds.length === 0) {
    return (
      <section className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-slate-50 px-4 py-20 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="text-center">
          <Ticket size={28} className="mx-auto text-red-500" />
          <h1 className="mt-5 text-2xl font-bold">No seats selected</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Please select seats before continuing.
          </p>
          <button
            type="button"
            onClick={() => navigate("/movies")}
            className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
          >
            Browse Movies
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={handleBackToSeats}
            disabled={loading || backLoading}
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
          >
            <ArrowLeft size={17} />
            {backLoading ? "Returning..." : "Back to Seats"}
          </button>

          <h1 className="text-3xl font-bold sm:text-4xl">
            {isRescheduling ? "Reschedule Summary" : "Booking Summary"}
          </h1>

          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {isRescheduling
              ? "Review your new seats and confirm the reschedule."
              : "Review your seats and complete your payment."}
          </p>
        </div>

        {formattedTime !== null && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="flex items-center gap-3">
              <Clock size={21} className="text-yellow-600" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Seat reservation
                </p>
                <p className="font-semibold">
                  {timerExpired ? "Reservation expired" : "Time remaining"}
                </p>
              </div>
            </div>

            <span className="text-2xl font-bold tabular-nums">
              {formattedTime}
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-red-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selected Seats
            </p>
          </div>

          {groupedSeats.map((group) => (
            <div key={group.label} className="mt-4 border-b border-slate-200 pb-4 last:border-b-0 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold">{group.label}</p>
                <p className="font-semibold">{money(group.totalPrice)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                <p className="text-slate-600 dark:text-slate-300">{group.seatNames}</p>
                <p className="shrink-0 text-slate-500 dark:text-slate-400">
                  {money(group.unitPrice)} × {group.seats.length}
                </p>
              </div>
            </div>
          ))}

          <div className="my-6 border-t border-slate-200 dark:border-slate-800" />

          <div className="space-y-4">
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-400">
                Ticket subtotal
              </span>
              <span>{priceLoading ? "Loading..." : money(ticketSubtotal)}</span>
            </div>

            {groupedSeats.map((group) => (
              <div key={group.label + "-price"} className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {group.label}: {group.seatNames}
                </span>
                <span>{money(group.totalPrice)}</span>
              </div>
            ))}

            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-400">
                Platform fee ({selectedSeatIds.length} × ₹20.00)
              </span>
              <span>{money(platformFee)}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-400">
                GST on platform fee (18%)
              </span>
              <span>{money(platformFeeGst)}</span>
            </div>
          </div>

          {!isRescheduling && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <Wallet size={22} className="mt-0.5 text-green-600" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Wallet Balance</p>
                    <p className="font-bold text-green-600 dark:text-green-400">
                      {walletLoading ? "Loading..." : money(walletBalance)}
                    </p>
                  </div>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Use your wallet for ticket charges. Platform fee and GST
                    are paid separately.
                  </p>

                  <label className="mt-4 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      disabled={
                        loading ||
                        walletLoading ||
                        priceLoading ||
                        walletBalance <= 0 ||
                        ticketSubtotal <= 0
                      }
                      onChange={(event) => setUseWallet(event.target.checked)}
                      className="h-5 w-5 accent-green-600"
                    />

                    <span className="text-sm font-semibold">
                      Use Wallet Balance
                    </span>
                  </label>

                  {useWallet && walletUsed > 0 && (
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-600 dark:text-slate-400">
                          Wallet applied to tickets
                        </span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          −{money(walletUsed)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-slate-600 dark:text-slate-400">
                          Remaining ticket amount
                        </span>
                        <span>{money(ticketSubtotal - walletUsed)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="my-5 border-t border-slate-200 dark:border-slate-800" />

          {isRescheduling && (
            <div className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">
                  Old booking total
                </span>
                <span>{oldBooking ? money(oldTotal) : "Loading..."}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">
                  New booking total
                </span>
                <span>{priceLoading ? "Loading..." : money(totalAmount)}</span>
              </div>

              {amountDifference > 0 ? (
                <div className="flex justify-between gap-4 font-bold text-red-600 dark:text-red-400">
                  <span>Additional amount payable</span>
                  <span>{money(payableDifference)}</span>
                </div>
              ) : amountDifference < 0 ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4 font-semibold text-green-600 dark:text-green-400">
                    <span>Additional payment</span>
                    <span>{money(0)}</span>
                  </div>

                  <p className="text-slate-500 dark:text-slate-400">
                    Estimated eligible ticket-subtotal wallet credit:{" "}
                    {money(walletCreditEstimate)}. Platform fee and GST are
                    not refundable.
                  </p>
                </div>
              ) : (
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Additional payment</span>
                  <span>{money(0)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold">
                {isRescheduling ? "New booking total" : "Total amount"}
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {selectedSeatIds.length} seat
                {selectedSeatIds.length === 1 ? "" : "s"} including charges
              </p>
            </div>

            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {priceLoading ? "Loading..." : money(totalAmount)}
            </span>
          </div>

          {!isRescheduling && useWallet && walletUsed > 0 && (
            <div className="mt-4 space-y-2 rounded-xl bg-green-500/10 p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-green-700 dark:text-green-400">
                  Wallet deduction after successful payment
                </span>
                <span className="font-semibold text-green-700 dark:text-green-400">
                  −{money(walletUsed)}
                </span>
              </div>

              <div className="flex justify-between gap-4 font-bold">
                <span>Payable now</span>
                <span>{money(payableNow)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-red-500" />

                <div>
                  <p className="font-semibold">Payment</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Test payment is the primary booking option.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-md bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400">
                <ShieldCheck size={14} />
                Test
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={
              loading ||
              backLoading ||
              walletLoading ||
              timerExpired ||
              !amountReady
            }
            onClick={handleMockPayment}
            className="mt-5 w-full rounded-lg bg-yellow-500 px-5 py-3.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : timerExpired
                ? "Reservation Expired"
                : isRescheduling && payableDifference > 0
                  ? "Complete Test Payment · " + money(payableDifference)
                  : !isRescheduling && useWallet && payableNow === 0
                    ? "Confirm Booking with Wallet"
                    : "Complete Test Payment"}
          </button>

          <button
            type="button"
            disabled={
              loading ||
              backLoading ||
              walletLoading ||
              timerExpired ||
              !amountReady
            }
            onClick={handleRazorpayPayment}
            className="mt-3 w-full rounded-lg bg-red-600 px-5 py-3.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Processing Payment..."
              : timerExpired
                ? "Reservation Expired"
                : priceLoading
                  ? "Loading Amount..."
                  : isRescheduling
                    ? "Pay Difference / Confirm Reschedule with Razorpay"
                    : "Pay " + money(payableNow) + " with Razorpay"}
          </button>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          <p className="mt-4 text-center text-xs text-slate-500">
            Your selected seats remain reserved until the timer expires.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Checkout;