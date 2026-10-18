import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface BookingContextType {
  showId: string | null;
  seatIds: string[];
  selectedSeatIds: string[];
  seatNames: string[];
  selectedSeatNames: string[];
  expiresAt: number | null;
  setBooking: (
    showId: string,
    seatIds: string[],
    seatNames: string[],
    expiresAt: number
  ) => void;
  clearBooking: () => void;
}

const BookingContext =
  createContext<BookingContextType | undefined>(undefined);

interface BookingProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = "movie_booking";

interface StoredBooking {
  showId: string;
  seatIds: string[];
  seatNames: string[];
  expiresAt: number;
}

export function BookingProvider({
  children,
}: BookingProviderProps) {
  const [showId, setShowId] = useState<string | null>(null);
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [seatNames, setSeatNames] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) return;

      const booking: StoredBooking = JSON.parse(stored);

      const valid =
        typeof booking.showId === "string" &&
        booking.showId.length > 0 &&
        Array.isArray(booking.seatIds) &&
        booking.seatIds.length > 0 &&
        typeof booking.expiresAt === "number" &&
        Number.isFinite(booking.expiresAt) &&
        booking.expiresAt > Date.now();

      if (!valid) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setShowId(booking.showId);
      setSeatIds(booking.seatIds);
      setSeatNames(
        Array.isArray(booking.seatNames) ? booking.seatNames : []
      );
      setExpiresAt(booking.expiresAt);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (expiresAt === null) return;

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      clearBooking();
      return;
    }

    const timer = window.setTimeout(() => {
      clearBooking();
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  const setBooking = (
    newShowId: string,
    newSeatIds: string[],
    newSeatNames: string[],
    newExpiresAt: number
  ) => {
    if (
      !newShowId ||
      newSeatIds.length === 0 ||
      !Number.isFinite(newExpiresAt) ||
      newExpiresAt <= Date.now()
    ) {
      clearBooking();
      return;
    }

    const booking: StoredBooking = {
      showId: newShowId,
      seatIds: [...newSeatIds],
      seatNames: [...newSeatNames],
      expiresAt: newExpiresAt,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));

    setShowId(newShowId);
    setSeatIds([...newSeatIds]);
    setSeatNames([...newSeatNames]);
    setExpiresAt(newExpiresAt);
  };

  const clearBooking = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowId(null);
    setSeatIds([]);
    setSeatNames([]);
    setExpiresAt(null);
  };

  return (
    <BookingContext.Provider
      value={{
        showId,
        seatIds,
        selectedSeatIds: seatIds,
        seatNames,
        selectedSeatNames: seatNames,
        expiresAt,
        setBooking,
        clearBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking(): BookingContextType {
  const context = useContext(BookingContext);

  if (!context) {
    throw new Error("useBooking must be used inside BookingProvider");
  }

  return context;
}
