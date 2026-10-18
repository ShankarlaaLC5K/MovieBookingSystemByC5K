
import mongoose, { Document, Schema } from "mongoose";

export type WalletTransactionType =
  | "reschedule_refund"
  | "cancellation_refund"
  | "booking_wallet_debit";

export interface IWalletTransaction extends Document {
  user: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  type: WalletTransactionType;
  amount: number;
  description: string;
  reference: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "reschedule_refund",
        "cancellation_refund",
        "booking_wallet_debit",
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model<IWalletTransaction>(
    "WalletTransaction",
    walletTransactionSchema
  );
