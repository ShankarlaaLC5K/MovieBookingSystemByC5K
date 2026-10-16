import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";

async function seedSuperadmin(): Promise<void> {
  const uri = process.env.MONGO_URI;
  const name = process.env.SUPERADMIN_NAME;
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!uri || !name || !email || !password || password.length < 12) {
    throw new Error("Set MONGO_URI, SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (at least 12 characters)");
  }
  await mongoose.connect(uri);
  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = name.trim();
    existing.password = hashedPassword;
    existing.role = "admin";
    await existing.save();
    process.stdout.write("Superadmin account updated.\n");
  } else {
    await User.create({ name: name.trim(), email, password: hashedPassword, role: "admin" });
    process.stdout.write("Superadmin account created.\n");
  }
  await mongoose.disconnect();
}

seedSuperadmin().catch(async (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Superadmin setup failed"}\n`);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
