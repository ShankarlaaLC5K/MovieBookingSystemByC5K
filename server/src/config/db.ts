
import dns from "node:dns";
import mongoose from "mongoose";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
let cachedConnection: typeof mongoose | null = null;
let cachedPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGO_URI is missing in environment variables"
    );
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 60000,
      })
      .then((connection) => {
        console.log(
          "MongoDB connected successfully"
        );

        cachedConnection = connection;

        return connection;
      })
      .catch((error) => {
        cachedPromise = null;

        console.error(
          "MongoDB connection failed:",
          error
        );

        throw error;
      });
  }

  return cachedPromise;
}