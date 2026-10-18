
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes";
import movieRoutes from "./routes/movieRoutes";
import theatreRoutes from "./routes/theatreRoutes";
import screenRoutes from "./routes/screenRoutes";
import seatRoutes from "./routes/seatRoutes";
import showRoutes from "./routes/showRoutes";
import showSeatRoutes from "./routes/showSeatRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import reportRoutes from "./routes/reportRoutes";
import walletRoutes from "./routes/walletRoutes";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://ticketbookingsystembyc5k.netlify.app",
  "https://movie-booking-system-smoky.vercel.app",
];

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/theatres", theatreRoutes);
app.use("/api/screens", screenRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/show-seats", showSeatRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (_req, res) => {
  res.send("Movie Booking API is running");
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Movie booking API is running",
  });
});

export default app;
