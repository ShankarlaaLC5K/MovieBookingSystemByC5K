import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/authMiddleware";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";

export async function getWallet(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const user = await User.findById(req.userId).select("walletBalance");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const transactions = await WalletTransaction.find({
      user: new mongoose.Types.ObjectId(req.userId),
    }).sort({ createdAt: -1 }).limit(50).populate("booking", "bookingReference status");

    res.status(200).json({ success: true, walletBalance: Number(user.walletBalance || 0), transactions });
  } catch {
    res.status(500).json({ success: false, message: "Unable to load wallet" });
  }
}
