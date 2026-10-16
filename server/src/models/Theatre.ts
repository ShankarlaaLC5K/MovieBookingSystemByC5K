
import { Document, Schema, model } from "mongoose";

export interface ITheatre extends Document {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const theatreSchema = new Schema<ITheatre>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Theatre = model<ITheatre>("Theatre", theatreSchema);
