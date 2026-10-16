import { NextFunction, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "./authMiddleware";
import { User } from "../models/User";
import { Theatre } from "../models/Theatre";
import { Screen } from "../models/Screen";
import { Show } from "../models/Show";
import { Booking } from "../models/Booking";

export async function requireRoles(req: AuthRequest, res: Response, next: NextFunction, roles: string[]): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    const user = await User.findById(req.userId).select("role");
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ success: false, message: "Authorization check failed" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  void requireRoles(req, res, next, ["admin"]);
}

export function requireTheatreManager(req: AuthRequest, res: Response, next: NextFunction): void {
  void requireRoles(req, res, next, ["admin", "theatreOwner"]);
}

export async function requireOwnedResource(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    const user = await User.findById(req.userId).select("role");
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }
    if (user.role === "admin") {
      next();
      return;
    }
    if (user.role !== "theatreOwner") {
      res.status(403).json({ success: false, message: "Theatre owner access required" });
      return;
    }
    const id = String(req.params.id || "");
    const theatreId = String(req.params.theatreId || req.body?.theatre || "");
    let owned = false;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      if (req.baseUrl.includes("theatres")) owned = Boolean(await Theatre.exists({ _id: id, owner: req.userId }));
      else if (req.baseUrl.includes("screens")) {
        const screen = await Screen.findById(id).select("theatre");
        owned = Boolean(screen && await Theatre.exists({ _id: screen.theatre, owner: req.userId }));
      } else if (req.baseUrl.includes("shows")) {
        const show = await Show.findById(id).select("theatre");
        owned = Boolean(show && await Theatre.exists({ _id: show.theatre, owner: req.userId }));
      } else if (req.baseUrl.includes("bookings")) {
        const booking = await Booking.findById(id).select("show");
        const show = booking ? await Show.findById(booking.show).select("theatre") : null;
        owned = Boolean(show && await Theatre.exists({ _id: show.theatre, owner: req.userId }));
      }
    } else if (theatreId && mongoose.Types.ObjectId.isValid(theatreId)) {
      owned = Boolean(await Theatre.exists({ _id: theatreId, owner: req.userId }));
    }
    if (!owned) {
      res.status(403).json({ success: false, message: "You can only manage resources belonging to your theatre" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ success: false, message: "Ownership verification failed" });
  }
}
