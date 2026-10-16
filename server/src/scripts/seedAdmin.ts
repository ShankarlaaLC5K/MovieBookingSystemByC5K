
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";



async function seedAdmin(): Promise<void> {
  const uri = process.env.MONGO_URI;
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!uri || !name || !email || !password || password.length < 8) {
    throw new Error(
      "Set MONGO_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters)"
    );
  }

  await mongoose.connect(uri);

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const existing = await User.findOne({ email });

    if (existing) {
      existing.name = name.trim();
      existing.password = hashedPassword;
      existing.role = "admin";
      await existing.save();
      process.stdout.write("Admin account updated.\n");
    } else {
      await User.create({
        name: name.trim(),
        email,
        password: hashedPassword,
        role: "admin",
      });
      process.stdout.write("Admin account created.\n");
    }
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Admin setup failed"}\n`
  );
  process.exitCode = 1;
});
