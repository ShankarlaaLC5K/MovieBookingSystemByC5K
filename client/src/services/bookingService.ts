import api from "./api";

import type {
  BookingListResponse,
  BookingResponse,
} from "../types/booking";

export async function createBooking(data: {
  showId: string;
  seatIds: string[];
  paymentId?: string;
}): Promise<BookingResponse> {
  const response = await api.post<BookingResponse>("/bookings", data);
  return response.data;
}

export async function getMyBookings(
  page = 1
): Promise<BookingListResponse> {
  const response = await api.get<BookingListResponse>(
    "/bookings/my?page=" + page
  );

  return response.data;
}

export async function getAllBookings(): Promise<BookingListResponse> {
  const response = await api.get<BookingListResponse>("/bookings");
  return response.data;
}

export async function getBookingById(
  id: string
): Promise<BookingResponse> {
  const response = await api.get<BookingResponse>("/bookings/" + id);
  return response.data;
}

export async function cancelBooking(id: string) {
  const response = await api.patch("/bookings/" + id + "/cancel");
  return response.data;
}

export async function rescheduleBooking(
  bookingId: string,
  data: {
    showId: string;
    seatIds: string[];
  }
): Promise<BookingResponse> {
  const response = await api.patch<BookingResponse>(
    "/bookings/" + bookingId + "/reschedule",
    data
  );

  return response.data;
}