
import api from "./api";

import type {
  Show,
  ShowListResponse,
  ShowResponse,
} from "../types/show";

export interface CreateShowScheduleData {
  movie: string;
  theatre: string;
  screen: string;
  dates: string[];
  showTimes: string[];
  language: string;
  format: "2D" | "3D" | "IMAX";
  balconyPrice: number;
  firstClassPrice: number;
  secondClassPrice: number;
}

export interface CreateShowScheduleResponse {
  success: boolean;
  message: string;
  count: number;
  shows: Show[];
}

export interface ScheduleConflict {
  date: string;
  time: string;
  existingShowId?: string;
  existingStartTime?: string;
  existingEndTime?: string;
}

export async function getShows(): Promise<ShowListResponse> {
  const response = await api.get<ShowListResponse>("/shows");
  return response.data;
}

export async function getShowsByMovie(
  movieId: string
): Promise<ShowListResponse> {
  const response = await api.get<ShowListResponse>(
    "/shows/movie/" + movieId
  );

  return response.data;
}

export async function getShowsByTheatre(
  theatreId: string
): Promise<ShowListResponse> {
  const response = await api.get<ShowListResponse>(
    "/shows/theatre/" + theatreId
  );

  return response.data;
}

export async function getShowById(
  showId: string
): Promise<ShowResponse> {
  const response = await api.get<ShowResponse>(
    "/shows/" + showId
  );

  return response.data;
}

export async function createShowSchedule(
  data: CreateShowScheduleData
): Promise<CreateShowScheduleResponse> {
  const response = await api.post<CreateShowScheduleResponse>(
    "/shows/schedule",
    data
  );

  return response.data;
}
