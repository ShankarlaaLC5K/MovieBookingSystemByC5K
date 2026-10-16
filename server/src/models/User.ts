import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "user" | "theatreOwner" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "theatreOwner", "admin"], default: "user" }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
