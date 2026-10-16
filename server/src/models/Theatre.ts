import mongoose, { Document, Schema } from "mongoose";

export interface ITheatre extends Document {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  owner?: mongoose.Types.ObjectId;
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
    owner: { type: Schema.Types.ObjectId, ref: "User", index: true }
  },
  { timestamps: true }
);

export const Theatre = mongoose.model<ITheatre>("Theatre", theatreSchema);
