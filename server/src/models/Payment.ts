
import mongoose, { Document, Schema } from "mongoose";

export type PaymentPurpose = "booking" | "reschedule";
export type PaymentProvider = "razorpay" | "stripe" | "test";

export interface IReschedulePaymentData {
  oldShow: mongoose.Types.ObjectId;
  oldSeats: mongoose.Types.ObjectId[];
  targetShow: mongoose.Types.ObjectId;
  targetSeats: mongoose.Types.ObjectId[];
  targetTotalAmount: number;
  targetTicketSubtotal: number;
  targetPlatformFee: number;
  targetPlatformFeeGst: number;
  targetBookingStatus: "pending" | "confirmed";
}

export interface IPayment extends Document {
  booking: mongoose.Types.ObjectId;
  amount: number;
  walletAmount?: number;
  provider: PaymentProvider;
  purpose?: PaymentPurpose;
  rescheduleData?: IReschedulePaymentData;
  gatewayOrderId?: string;
  transactionId?: string;
  signature?: string;
  status: "pending" | "success" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const reschedulePaymentSchema = new Schema<IReschedulePaymentData>(
  {
    oldShow: {
      type: Schema.Types.ObjectId,
      ref: "Show",
      required: true,
    },
    oldSeats: [
      {
        type: Schema.Types.ObjectId,
        ref: "Seat",
        required: true,
      },
    ],
    targetShow: {
      type: Schema.Types.ObjectId,
      ref: "Show",
      required: true,
    },
    targetSeats: [
      {
        type: Schema.Types.ObjectId,
        ref: "Seat",
        required: true,
      },
    ],
    targetTotalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    targetTicketSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    targetPlatformFee: {
      type: Number,
      required: true,
      min: 0,
    },
    targetPlatformFeeGst: {
      type: Number,
      required: true,
      min: 0,
    },
    targetBookingStatus: {
      type: String,
      enum: ["pending", "confirmed"],
      required: true,
    },
  },
  { _id: false }
);

const paymentSchema = new Schema<IPayment>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    walletAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    provider: {
      type: String,
      enum: ["razorpay", "stripe", "test"],
      required: true,
    },
    purpose: {
      type: String,
      enum: ["booking", "reschedule"],
      default: "booking",
    },
    rescheduleData: {
      type: reschedulePaymentSchema,
      required: false,
    },
    gatewayOrderId: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    signature: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index(
  { gatewayOrderId: 1 },
  { unique: true, sparse: true }
);

export const Payment =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", paymentSchema);
