export interface BookingMovie {
  _id: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  rating?: number;
  language?: string;
}

export interface BookingTheatre {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface BookingScreen {
  _id: string;
  name: string;
  totalSeats?: number;
}

export interface BookingShow {
  _id: string;
  movie: string | BookingMovie;
  theatre: string | BookingTheatre;
  screen: string | BookingScreen;
  startTime: string;
  endTime: string;
  language?: string;
  format?: "2D" | "3D" | "IMAX";
  price?: number;
  secondClassPrice?: number;
  firstClassPrice?: number;
  balconyPrice?: number;
}

export interface BookingSeat {
  _id: string;
  row: string;
  number: number;
  type?: "regular" | "premium" | "recliner";
  price?: number;
}

export interface Booking {
  _id: string;

  user:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      };

  show: string | BookingShow;

  seats: (string | BookingSeat)[];

  totalAmount: number;

  ticketSubtotal?: number;
  platformFee?: number;
  platformFeeGst?: number;

  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "canceled"
    | string;

  bookingReference?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface BookingResponse {
  success: boolean;
  booking: Booking;
}

export interface BookingListResponse {
  success: boolean;
  bookings: Booking[];
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}