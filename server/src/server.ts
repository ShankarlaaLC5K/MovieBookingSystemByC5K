
import "dotenv/config";

import app from "./app";
import { connectDB } from "./config/db";
import { startBookingExpiryCleanup } from "./services/bookingExpiryService";
import { startBookingReminderScheduler } from "./services/automatedNotificationService";

const PORT = Number(process.env.PORT || 5000);

async function startServer(): Promise<void> {
  try {
    await connectDB();

    startBookingExpiryCleanup();
    startBookingReminderScheduler();

    app.listen(PORT, () => {
      console.log("Server running on port " + PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
