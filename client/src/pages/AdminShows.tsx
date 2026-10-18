import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getMovies,
  getRecentTamilMovies,
  saveMovie,
  type TMDBMovie,
} from "../services/movieService";

import {
  getTheatres,
  type Theatre,
} from "../services/theatreService";

import {
  getScreensByTheatre,
  type Screen,
} from "../services/screenService";

import {
  createShowSchedule,
  getShows,
} from "../services/showService";

import type { Movie } from "../types/movie";
import type { Show } from "../types/show";

const SHOW_TIMES = [
  { value: "10:00", label: "10:00 AM" },
  { value: "13:30", label: "1:30 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "21:00", label: "9:00 PM" },
];

function getReferenceId(
  value: string | { _id?: string } | undefined
): string {
  if (typeof value === "string") {
    return value;
  }

  return value?._id || "";
}

function getMovieTitle(movie: Show["movie"] | undefined): string {
  if (typeof movie === "object" && movie !== null && "title" in movie) {
    return movie.title || "Unknown Movie";
  }

  return "Unknown Movie";
}

function getMoviePoster(movie: Show["movie"] | undefined): string {
  if (
    typeof movie === "object" &&
    movie !== null &&
    "posterPath" in movie
  ) {
    return movie.posterPath || "";
  }

  return "";
}

function getMovieTmdbId(
  movie: Show["movie"] | undefined
): number | undefined {
  if (typeof movie === "object" && movie !== null && "tmdbId" in movie) {
    return movie.tmdbId;
  }

  return undefined;
}

function getTheatreName(theatre: Show["theatre"] | undefined): string {
  if (
    typeof theatre === "object" &&
    theatre !== null &&
    "name" in theatre
  ) {
    return theatre.name || "Unknown Theatre";
  }

  return "Unknown Theatre";
}

function getTheatreCity(theatre: Show["theatre"] | undefined): string {
  if (
    typeof theatre === "object" &&
    theatre !== null &&
    "city" in theatre
  ) {
    return theatre.city || "";
  }

  return "";
}

function getScreenName(screen: Show["screen"] | undefined): string {
  if (typeof screen === "object" && screen !== null && "name" in screen) {
    return screen.name || "Unknown Screen";
  }

  return "Unknown Screen";
}

function getTmdbPosterUrl(posterPath?: string | null): string {
  if (!posterPath) {
    return "";
  }

  if (
    posterPath.startsWith("http://") ||
    posterPath.startsWith("https://")
  ) {
    return posterPath;
  }

  return (
    "https://image.tmdb.org/t/p/w500" +
    (posterPath.startsWith("/") ? "" : "/") +
    posterPath
  );
}

function AdminShows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tamilMovies, setTamilMovies] = useState<TMDBMovie[]>([]);
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingForm, setLoadingForm] = useState(true);
  const [loadingTamilMovies, setLoadingTamilMovies] = useState(false);
  const [savingTamilMovie, setSavingTamilMovie] = useState(false);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [movieId, setMovieId] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [screenId, setScreenId] = useState("");

  const [dateInput, setDateInput] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const [selectedTimes, setSelectedTimes] = useState<string[]>(
    SHOW_TIMES.map((time) => time.value)
  );

  const [language, setLanguage] = useState("Tamil");
  const [format, setFormat] = useState<"2D" | "3D" | "IMAX">("2D");

  const [balconyPrice, setBalconyPrice] = useState("");
  const [firstClassPrice, setFirstClassPrice] = useState("");
  const [secondClassPrice, setSecondClassPrice] = useState("");

  const loadShows = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getShows();

      setShows(Array.isArray(response.shows) ? response.shows : []);
    } catch (error: any) {
      console.error("Failed to load shows:", error);

      setError(
        error?.response?.data?.message || "Failed to load shows."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async () => {
    try {
      setLoadingForm(true);
      setFormError("");

      const [moviesResponse, theatresResponse] = await Promise.all([
        getMovies(),
        getTheatres(),
      ]);

      const existingMovies = Array.isArray(moviesResponse.movies)
        ? moviesResponse.movies
        : [];

      setMovies(
        existingMovies.filter(
          (movie) => movie.title.trim().toLowerCase() !== "avatar"
        )
      );

      setTheatres(
        Array.isArray(theatresResponse.theatres)
          ? theatresResponse.theatres
          : []
      );
    } catch (error: any) {
      console.error("Failed to load form data:", error);

      setFormError(
        error?.response?.data?.message ||
          "Failed to load movies and theatres."
      );
    } finally {
      setLoadingForm(false);
    }
  };

  const loadTamilMovies = async () => {
    try {
      setLoadingTamilMovies(true);

      const response = await getRecentTamilMovies();

      const existingTmdbIds = new Set(
        movies
          .map((movie) => movie.tmdbId)
          .filter(
            (tmdbId): tmdbId is number =>
              typeof tmdbId === "number"
          )
      );

      setTamilMovies(
        Array.isArray(response.results)
          ? response.results.filter(
              (movie) =>
                movie.title.trim().toLowerCase() !== "avatar" &&
                !existingTmdbIds.has(movie.id)
            )
          : []
      );
    } catch (error: any) {
      console.error("Failed to load Tamil movies:", error);

      setFormError(
        error?.response?.data?.message ||
          "Failed to load Tamil movies."
      );
    } finally {
      setLoadingTamilMovies(false);
    }
  };

  useEffect(() => {
    void loadShows();
    void loadFormData();
  }, []);

  useEffect(() => {
    if (!loadingForm) {
      void loadTamilMovies();
    }
  }, [loadingForm]);

  const handleMovieChange = async (value: string) => {
    if (!value) {
      setMovieId("");
      return;
    }

    if (!value.startsWith("tmdb:")) {
      setMovieId(value);
      return;
    }

    const tmdbId = Number(value.replace("tmdb:", ""));

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return;
    }

    try {
      setSavingTamilMovie(true);
      setFormError("");
      setSuccess("");

      const response = await saveMovie(tmdbId);
      const savedMovie = response.movie;

      setMovies((currentMovies) => {
        if (currentMovies.some((movie) => movie._id === savedMovie._id)) {
          return currentMovies;
        }

        return currentMovies.concat(savedMovie);
      });

      setTamilMovies((currentMovies) =>
        currentMovies.filter((movie) => movie.id !== tmdbId)
      );

      setMovieId(savedMovie._id);
      setSuccess(savedMovie.title + " added successfully.");
    } catch (error: any) {
      console.error("Failed to save Tamil movie:", error);

      setFormError(
        error?.response?.data?.message ||
          "Failed to add Tamil movie."
      );

      setMovieId("");
    } finally {
      setSavingTamilMovie(false);
    }
  };

  useEffect(() => {
    const loadScreens = async () => {
      if (!theatreId) {
        setScreens([]);
        setScreenId("");
        return;
      }

      try {
        setLoadingScreens(true);
        setFormError("");
        setScreens([]);
        setScreenId("");

        const response = await getScreensByTheatre(theatreId);

        setScreens(
          Array.isArray(response.screens) ? response.screens : []
        );
      } catch (error: any) {
        console.error("Failed to load screens:", error);

        setFormError(
          error?.response?.data?.message || "Failed to load screens."
        );
      } finally {
        setLoadingScreens(false);
      }
    };

    void loadScreens();
  }, [theatreId]);

  const addDate = () => {
    setFormError("");

    if (!dateInput) {
      setFormError("Please select a date.");
      return;
    }

    if (selectedDates.includes(dateInput)) {
      setFormError("This date is already selected.");
      return;
    }

    setSelectedDates((current) =>
      current.concat(dateInput).sort()
    );

    setDateInput("");
  };

  const removeDate = (date: string) => {
    setSelectedDates((current) =>
      current.filter((item) => item !== date)
    );
  };

  const toggleTime = (time: string) => {
    setSelectedTimes((current) =>
      current.includes(time)
        ? current.filter((item) => item !== time)
        : current.concat(time).sort()
    );
  };

  const selectAllTimes = () => {
    setSelectedTimes(SHOW_TIMES.map((time) => time.value));
  };

  const clearAllTimes = () => {
    setSelectedTimes([]);
  };

  const resetForm = () => {
    setMovieId("");
    setTheatreId("");
    setScreenId("");
    setScreens([]);
    setDateInput("");
    setSelectedDates([]);
    setSelectedTimes(SHOW_TIMES.map((time) => time.value));
    setLanguage("Tamil");
    setFormat("2D");
    setBalconyPrice("");
    setFirstClassPrice("");
    setSecondClassPrice("");
    setSuccess("");
  };

  const handleCreateSchedule = async () => {
    try {
      setCreating(true);
      setFormError("");
      setSuccess("");

      if (!movieId) {
        setFormError("Please select a movie.");
        return;
      }

      if (!theatreId) {
        setFormError("Please select a theatre.");
        return;
      }

      if (!screenId) {
        setFormError("Please select a screen.");
        return;
      }

      if (selectedDates.length === 0) {
        setFormError("Please select at least one date.");
        return;
      }

      if (selectedTimes.length === 0) {
        setFormError("Please select at least one show time.");
        return;
      }

      if (!language.trim()) {
        setFormError("Please enter the language.");
        return;
      }

      const numericBalconyPrice = Number(balconyPrice);
      const numericFirstClassPrice = Number(firstClassPrice);
      const numericSecondClassPrice = Number(secondClassPrice);

      if (
        balconyPrice.trim() === "" ||
        firstClassPrice.trim() === "" ||
        secondClassPrice.trim() === "" ||
        !Number.isFinite(numericBalconyPrice) ||
        !Number.isFinite(numericFirstClassPrice) ||
        !Number.isFinite(numericSecondClassPrice) ||
        numericBalconyPrice < 0 ||
        numericFirstClassPrice < 0 ||
        numericSecondClassPrice < 0
      ) {
        setFormError(
          "Please enter valid prices for all three classes."
        );
        return;
      }

      const response = await createShowSchedule({
        movie: movieId,
        theatre: theatreId,
        screen: screenId,
        dates: selectedDates,
        showTimes: selectedTimes,
        language: language.trim(),
        format,
        balconyPrice: numericBalconyPrice,
        firstClassPrice: numericFirstClassPrice,
        secondClassPrice: numericSecondClassPrice,
      });

      setSuccess(response.message);
      resetForm();
      await loadShows();
    } catch (error: any) {
      console.error("Failed to create schedule:", error);

      const conflicts = error?.response?.data?.conflicts;

      if (Array.isArray(conflicts) && conflicts.length > 0) {
        const conflictText = conflicts
          .map((conflict: any) => conflict.date + " " + conflict.time)
          .join(", ");

        setFormError("Schedule conflict: " + conflictText);
      } else {
        setFormError(
          error?.response?.data?.message ||
            "Failed to create show schedule."
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatDateOnly = (value: string) => {
    const date = new Date(value + "T00:00:00");

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalShowsToCreate =
    selectedDates.length * selectedTimes.length;

  const selectedMovie = movies.find(
    (movie) => movie._id === movieId
  );

  const selectedMoviePoster = selectedMovie?.posterPath
    ? getTmdbPosterUrl(selectedMovie.posterPath)
    : "";

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Manage Shows
            </h1>
            <p className="mt-2 text-slate-400">
              Create multiple movie shows across multiple dates.
            </p>
          </div>

          <Link
            to="/admin"
            className="inline-flex w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold transition hover:bg-slate-700"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Create Show Schedule
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Select dates and daily show timings.
            </p>
          </div>

          {loadingForm ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
              Loading movies and theatres...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Movie
                  </label>

                  <select
                    value={movieId}
                    onChange={(event) =>
                      void handleMovieChange(event.target.value)
                    }
                    disabled={savingTamilMovie}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500 disabled:opacity-50"
                  >
                    <option value="">
                      {savingTamilMovie ? "Adding Movie..." : "Select Movie"}
                    </option>

                    <optgroup label="Added Movies">
                      {movies.map((movie) => (
                        <option key={movie._id} value={movie._id}>
                          {movie.title}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Tamil Movies - Select to Add">
                      {loadingTamilMovies ? (
                        <option disabled>Loading Tamil movies...</option>
                      ) : tamilMovies.length === 0 ? (
                        <option disabled>No new Tamil movies</option>
                      ) : (
                        tamilMovies.map((movie) => (
                          <option
                            key={movie.id}
                            value={"tmdb:" + movie.id}
                          >
                            {movie.title}
                          </option>
                        ))
                      )}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Theatre
                  </label>

                  <select
                    value={theatreId}
                    onChange={(event) =>
                      setTheatreId(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  >
                    <option value="">Select Theatre</option>

                    {theatres.map((theatre) => (
                      <option key={theatre._id} value={theatre._id}>
                        {theatre.name} - {theatre.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Screen
                  </label>

                  <select
                    value={screenId}
                    onChange={(event) =>
                      setScreenId(event.target.value)
                    }
                    disabled={!theatreId || loadingScreens}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingScreens
                        ? "Loading Screens..."
                        : theatreId
                        ? "Select Screen"
                        : "Select Theatre First"}
                    </option>

                    {screens.map((screen) => (
                      <option key={screen._id} value={screen._id}>
                        {screen.name} ({screen.totalSeats} seats)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Show Date
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="date"
                    value={dateInput}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(event) =>
                      setDateInput(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-white sm:w-64"
                  />

                  <button
                    type="button"
                    onClick={addDate}
                    className="rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700"
                  >
                    + Add Date
                  </button>
                </div>

                {selectedDates.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Selected Dates
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          onClick={() => removeDate(date)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400"
                        >
                          {formatDateOnly(date)} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Daily Show Times
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Select timings for every selected date.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllTimes}
                      className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={clearAllTimes}
                      className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SHOW_TIMES.map((time) => {
                    const selected = selectedTimes.includes(time.value);

                    return (
                      <label
                        key={time.value}
                        className={
                          "cursor-pointer rounded-xl border p-4 transition " +
                          (selected
                            ? "border-red-500 bg-red-500/10"
                            : "border-slate-700 bg-slate-950 hover:border-slate-600")
                        }
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleTime(time.value)}
                            className="h-4 w-4 accent-red-600"
                          />

                          <span
                            className={
                              "font-semibold " +
                              (selected
                                ? "text-red-400"
                                : "text-slate-300")
                            }
                          >
                            {time.label}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Language
                  </label>

                  <select
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  >
                    <option value="Tamil">Tamil</option>
                    <option value="English">English</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Kannada">Kannada</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Format
                  </label>

                  <select
                    value={format}
                    onChange={(event) =>
                      setFormat(
                        event.target.value as "2D" | "3D" | "IMAX"
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  >
                    <option value="2D">2D</option>
                    <option value="3D">3D</option>
                    <option value="IMAX">IMAX</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Balcony Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={balconyPrice}
                    onChange={(event) =>
                      setBalconyPrice(event.target.value)
                    }
                    placeholder="Enter Balcony price"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    First Class Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={firstClassPrice}
                    onChange={(event) =>
                      setFirstClassPrice(event.target.value)
                    }
                    placeholder="Enter First Class price"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Second Class Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={secondClassPrice}
                    onChange={(event) =>
                      setSecondClassPrice(event.target.value)
                    }
                    placeholder="Enter Second Class price"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">Movie</p>
                    <p className="mt-1 font-semibold">
                      {selectedMovie?.title || "Not selected"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Dates</p>
                    <p className="mt-1 font-semibold">
                      {selectedDates.length}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Shows to create
                    </p>
                    <p className="mt-1 text-lg font-bold text-red-400">
                      {totalShowsToCreate}
                    </p>
                  </div>
                </div>
              </div>

              {selectedMovie && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="shrink-0">
                      {selectedMoviePoster ? (
                        <img
                          src={selectedMoviePoster}
                          alt={selectedMovie.title}
                          className="h-40 w-28 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-28 items-center justify-center rounded-xl bg-slate-800 text-xs text-slate-500">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                        Selected Movie
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-white">
                        {selectedMovie.title}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedMovie.language && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {selectedMovie.language.toUpperCase()}
                          </span>
                        )}

                        {selectedMovie.releaseDate && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {new Date(
                              selectedMovie.releaseDate
                            ).getFullYear()}
                          </span>
                        )}

                        {selectedMovie.runtime !== undefined &&
                          selectedMovie.runtime > 0 && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                              {selectedMovie.runtime} min
                            </span>
                          )}

                        {selectedMovie.rating !== undefined && (
                          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                            {"⭐ " + selectedMovie.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-400">
                        {selectedMovie.overview?.trim() ||
                          "No description available for this movie."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                  {formError}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                  {success}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateSchedule}
                disabled={creating}
                className="w-full rounded-lg bg-red-600 px-5 py-3.5 font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? "Creating Schedule..."
                  : "Create " + totalShowsToCreate + " Shows"}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Existing Shows</h2>
            <p className="mt-1 text-sm text-slate-400">
              All scheduled shows sorted by date and time.
            </p>
          </div>

          {loading && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading shows...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && shows.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="text-slate-400">No shows found.</p>
            </div>
          )}

          {!loading && !error && shows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-275">
                  <thead className="border-b border-slate-800 bg-slate-950">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Movie
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Theatre
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Screen
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Show Time
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Language
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Format
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Class Prices
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {shows
                      .filter(
                        (show) =>
                          show.movie &&
                          typeof show.movie === "object"
                      )
                      .map((show) => {
                        const movieTitle = getMovieTitle(show.movie);
                        const moviePoster = getMoviePoster(show.movie);
                        const tmdbId = getMovieTmdbId(show.movie);
                        const theatreName = getTheatreName(show.theatre);
                        const theatreCity = getTheatreCity(show.theatre);
                        const screenName = getScreenName(show.screen);
                        const movieId = getReferenceId(show.movie);

                        return (
                          <tr
                            key={show._id}
                            className="border-b border-slate-800 last:border-b-0"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {moviePoster ? (
                                  <img
                                    src={getTmdbPosterUrl(moviePoster)}
                                    alt={movieTitle}
                                    className="h-14 w-10 rounded object-cover"
                                  />
                                ) : (
                                  <div className="flex h-14 w-10 items-center justify-center rounded bg-slate-800 text-[10px] text-slate-500">
                                    No Image
                                  </div>
                                )}

                                <div>
                                  <p className="font-semibold">
                                    {movieTitle}
                                  </p>
                                  {tmdbId && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      TMDB ID: {tmdbId}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-medium">
                                {theatreName}
                              </p>
                              {theatreCity && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {theatreCity}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4 text-slate-300">
                              {screenName}
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm text-slate-200">
                                {formatDateTime(show.startTime)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Ends: {formatDateTime(show.endTime)}
                              </p>
                            </td>

                            <td className="px-5 py-4 text-slate-300">
                              {show.language}
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                                {show.format}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-1 text-sm">
                                <p className="text-amber-400">
                                  Balcony: ₹{show.balconyPrice}
                                </p>
                                <p className="text-sky-400">
                                  First Class: ₹{show.firstClassPrice}
                                </p>
                                <p className="text-green-400">
                                  Second Class: ₹{show.secondClassPrice}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {movieId ? (
                                <Link
                                  to={"/movies/" + movieId + "/shows"}
                                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
                                >
                                  View
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-600">
                                  No Movie ID
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminShows;