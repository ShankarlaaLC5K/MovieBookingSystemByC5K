
import mongoose, { Document, Schema } from "mongoose";

export interface IBooking extends Document {
  user: mongoose.Types.ObjectId;
  show: mongoose.Types.ObjectId;
  seats: mongoose.Types.ObjectId[];
  totalAmount: number;
  ticketSubtotal?: number;
  platformFee?: number;
  platformFeeGst?: number;
  status: "pending" | "confirmed" | "cancelled";
  bookingReference: string;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    show: {
      type: Schema.Types.ObjectId,
      ref: "Show",
      required: true,
    },
    seats: [
      {
        type: Schema.Types.ObjectId,
        ref: "Seat",
        required: true,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    ticketSubtotal: {
      type: Number,
      min: 0,
    },
    platformFee: {
      type: Number,
      min: 0,
    },
    platformFeeGst: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      index: true,
    },
    bookingReference: {
      type: String,
      required: true,
      unique: true,
    },
    reminderSentAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({
  status: 1,
  reminderSentAt: 1,
});

export const Booking = mongoose.model<IBooking>(
  "Booking",
  bookingSchema
);
