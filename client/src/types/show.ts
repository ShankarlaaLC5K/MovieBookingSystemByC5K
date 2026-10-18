
export type ShowFormat = "2D" | "3D" | "IMAX";

export interface ShowMovie {
  _id: string;
  title: string;
  posterPath?: string;
  tmdbId?: number;
}

export interface ShowTheatre {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface ShowScreen {
  _id: string;
  name: string;
  totalSeats?: number;
}

export interface Show {
  _id: string;
  movie: ShowMovie;
  theatre: ShowTheatre;
  screen: ShowScreen;
  startTime: string;
  endTime: string;
  language: string;
  format: ShowFormat;
  price: number;
  balconyPrice?: number;
  firstClassPrice?: number;
  secondClassPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShowListResponse {
  success: boolean;
  count: number;
  shows: Show[];
}

export interface ShowResponse {
  success: boolean;
  show: Show;
}
