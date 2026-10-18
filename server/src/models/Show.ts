
import mongoose, { Document, Schema } from "mongoose";

export interface IShow extends Document {
  movie: mongoose.Types.ObjectId;
  theatre: mongoose.Types.ObjectId;
  screen: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  language: string;
  format: "2D" | "3D" | "IMAX";
  price: number;
  balconyPrice: number;
  firstClassPrice: number;
  secondClassPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const showSchema = new Schema<IShow>(
  {
    movie: {
      type: Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
    theatre: {
      type: Schema.Types.ObjectId,
      ref: "Theatre",
      required: true,
    },
    screen: {
      type: Schema.Types.ObjectId,
      ref: "Screen",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
    },
    format: {
      type: String,
      enum: ["2D", "3D", "IMAX"],
      default: "2D",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    balconyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    firstClassPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    secondClassPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Show = mongoose.model<IShow>("Show", showSchema);
