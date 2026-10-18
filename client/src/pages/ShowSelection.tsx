
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Ticket,
  RefreshCw,
} from "lucide-react";

import {
  getMovieById,
  getTMDBMovieDetails,
  saveMovie,
} from "../services/movieService";

import { getShowsByMovie } from "../services/showService";

import type { Movie } from "../types/movie";
import type { Show } from "../types/show";

const TMDB_IMAGE_BASE_URL =
  "https://image.tmdb.org/t/p/w500";

interface RescheduleLocationState {
  rescheduleBookingId?: string;
}

function getPosterUrl(posterPath?: string) {
  if (!posterPath) {
    return "";
  }

  if (
    posterPath.startsWith("http://") ||
    posterPath.startsWith("https://")
  ) {
    return posterPath;
  }

  return `${TMDB_IMAGE_BASE_URL}${
    posterPath.startsWith("/") ? "" : "/"
  }${posterPath}`;
}

function ShowSelection() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const locationState =
    location.state as RescheduleLocationState | null;

  const rescheduleBookingId =
    locationState?.rescheduleBookingId;

  const isRescheduling = Boolean(rescheduleBookingId);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Movie ID is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (id.startsWith("tmdb-")) {
          const tmdbIdText = id.replace("tmdb-", "");
          const tmdbId = Number(tmdbIdText);

          if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
            throw new Error("Invalid TMDB movie ID.");
          }

          const tmdbData =
            await getTMDBMovieDetails(tmdbId);

          const mappedMovie: Movie = {
            _id: id,
            tmdbId: tmdbData.id,
            title: tmdbData.title,
            overview: tmdbData.overview,
            posterPath:
              tmdbData.poster_path || undefined,
            backdropPath:
              tmdbData.backdrop_path || undefined,
            releaseDate:
              tmdbData.release_date || undefined,
            runtime:
              tmdbData.runtime || undefined,
            genres:
              tmdbData.genres?.map(
                (genre) => genre.name
              ) || [],
            rating: tmdbData.vote_average,
            language: tmdbData.original_language,
          };

          if (cancelled) return;
          setMovie(mappedMovie);

          const saveResponse = await saveMovie(tmdbId);
          const savedMovie = saveResponse.movie;

          if (!savedMovie?._id) {
            throw new Error("Movie could not be saved.");
          }

          const showsResponse =
            await getShowsByMovie(savedMovie._id);

          if (cancelled) return;

          setMovie(savedMovie);
          setShows(
            Array.isArray(showsResponse.shows)
              ? showsResponse.shows
              : []
          );

          return;
        }

        const [movieResponse, showsResponse] =
          await Promise.all([
            getMovieById(id),
            getShowsByMovie(id),
          ]);

        if (cancelled) return;

        setMovie(movieResponse.movie);
        setShows(
          Array.isArray(showsResponse.shows)
            ? showsResponse.shows
            : []
        );
      } catch (err: any) {
        if (cancelled) return;

        console.error("Failed to load shows:", err);

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load shows."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const upcomingShows = useMemo(() => {
    const now = Date.now();

    return shows.filter(
      (show) =>
        new Date(show.startTime).getTime() > now
    );
  }, [shows]);

  const groupedShows = useMemo(() => {
    const groups: Record<string, Show[]> = {};

    upcomingShows.forEach((show) => {
      const date = new Date(
        show.startTime
      ).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(show);
    });

    return groups;
  }, [upcomingShows]);

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    );
  };

  if (loading) {
    return (
      <section className="min-h-[calc(100vh-140px)] bg-slate-50 px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="mx-auto flex max-w-7xl justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-red-500 dark:border-slate-700 dark:border-t-red-500" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading available shows...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="min-h-[calc(100vh-140px)] bg-slate-50 px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-500 dark:text-red-400">
              {error}
            </p>

            <Link
              to={isRescheduling ? "/bookings" : "/movies"}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              <ArrowLeft size={18} />
              {isRescheduling
                ? "Back to My Bookings"
                : "Back to Movies"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          to={isRescheduling ? "/bookings" : "/movies"}
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={17} />
          {isRescheduling
            ? "Back to My Bookings"
            : "Back to Movies"}
        </Link>

        {isRescheduling && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <RefreshCw
              size={21}
              className="mt-0.5 shrink-0 text-blue-400"
            />
            <div>
              <p className="font-semibold text-blue-300">
                Reschedule Your Booking
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Select a different upcoming show for this movie,
                then choose your new seats.
              </p>
            </div>
          </div>
        )}

        <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            {movie?.posterPath ? (
              <img
                src={getPosterUrl(movie.posterPath)}
                alt={movie.title}
                className="h-40 w-28 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-40 w-28 items-center justify-center rounded-xl bg-slate-100 text-4xl dark:bg-slate-800">
                🎬
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-red-500">
                {isRescheduling
                  ? "Choose a New Show"
                  : "Select Your Show"}
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
                {movie?.title}
              </h1>

              <p className="mt-3 text-slate-600 dark:text-slate-400">
                {isRescheduling
                  ? "Choose a different showtime. You will select new seats next."
                  : "Choose a theatre and showtime to continue."}
              </p>
            </div>
          </div>
        </div>

        {upcomingShows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CalendarDays
              className="mx-auto text-slate-400 dark:text-slate-600"
              size={48}
            />

            <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
              No Upcoming Shows
            </h2>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              There are currently no upcoming shows for this movie.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedShows).map(
              ([date, dateShows]) => (
                <div key={date}>
                  <div className="mb-5 flex items-center gap-3">
                    <CalendarDays
                      size={22}
                      className="text-red-500"
                    />

                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {date}
                    </h2>
                  </div>

                  <div className="space-y-5">
                    {dateShows.map((show) => (
                      <div
                        key={show._id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <MapPin
                                size={18}
                                className="text-red-500"
                              />

                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {show.theatre.name}
                              </h3>
                            </div>

                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              {show.theatre.address}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {show.theatre.city},{" "}
                              {show.theatre.state}
                            </p>

                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                              Screen:{" "}
                              <span className="text-slate-800 dark:text-slate-200">
                                {show.screen.name}
                              </span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-950">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Clock3 size={18} />

                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                  {formatTime(show.startTime)}
                                </span>
                              </div>
                            </div>

                            <span className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {show.language}
                            </span>

                            <span className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {show.format}
                            </span>

                            <span className="rounded-lg bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                              ₹{show.price}
                            </span>

                            <Link
                              to={`/shows/${show._id}/seats`}
                              state={
                                rescheduleBookingId
                                  ? { rescheduleBookingId }
                                  : undefined
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                            >
                              <Ticket size={18} />
                              {isRescheduling
                                ? "Choose New Seats"
                                : "Select Seats"}
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ShowSelection;
