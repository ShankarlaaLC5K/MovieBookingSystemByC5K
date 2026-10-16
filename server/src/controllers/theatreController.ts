import { Request, Response } from "express";
import mongoose from "mongoose";
import { Theatre } from "../models/Theatre";
import { AuthRequest } from "../middleware/authMiddleware";
import { User } from "../models/User";

export async function createTheatre(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const {
      name,
      address,
      city,
      state,
      pincode,
    } = req.body;

    if (!name || !address || !city || !state) {
      res.status(400).json({
        success: false,
        message: "Name, address, city and state are required",
      });
      return;
    }

    const actor = req.userId ? await User.findById(req.userId).select("role") : null;
    const theatre = await Theatre.create({
      owner: actor?.role === "theatreOwner" ? req.userId : undefined,
      name: String(name).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: pincode ? String(pincode).trim() : "",
    });

    res.status(201).json({
      success: true,
      message: "Theatre created successfully",
      theatre,
    });
  } catch (error) {
    console.error("Create theatre error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create theatre",
    });
  }
}

export async function getTheatres(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.userId ? await User.findById(req.userId).select("role") : null;
    const filter = actor?.role === "theatreOwner" ? { owner: req.userId } : {};
    const theatres = await Theatre.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: theatres.length,
      theatres,
    });
  } catch (error) {
    console.error("Get theatres error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch theatres",
    });
  }
}

export async function getTheatre(
  req: Request,
  res: Response
): Promise<void> {
  try {
const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid theatre ID",
      });
      return;
    }

    const theatre = await Theatre.findById(id);

    if (!theatre) {
      res.status(404).json({
        success: false,
        message: "Theatre not found",
      });
      return;
    }

    res.json({
      success: true,
      theatre,
    });
  } catch (error) {
    console.error("Get theatre error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch theatre",
    });
  }
}

export async function updateTheatre(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid theatre ID",
      });
      return;
    }

    const actor = req.userId ? await User.findById(req.userId).select("role") : null;
    const existingTheatre = await Theatre.findById(id);
    if (!existingTheatre) { res.status(404).json({ success: false, message: "Theatre not found" }); return; }
    if (actor?.role === "theatreOwner" && existingTheatre.owner?.toString() !== req.userId) { res.status(403).json({ success: false, message: "You can only manage your own theatre" }); return; }
    const {
      name,
      address,
      city,
      state,
      pincode,
    } = req.body;

    const updateData: Record<string, string> = {};

    if (name !== undefined) {
      updateData.name = String(name).trim();
    }

    if (address !== undefined) {
      updateData.address = String(address).trim();
    }

    if (city !== undefined) {
      updateData.city = String(city).trim();
    }

    if (state !== undefined) {
      updateData.state = String(state).trim();
    }

    if (pincode !== undefined) {
      updateData.pincode = String(pincode).trim();
    }

    const theatre = await Theatre.findByIdAndUpdate(
      id,
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!theatre) {
      res.status(404).json({
        success: false,
        message: "Theatre not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Theatre updated successfully",
      theatre,
    });
  } catch (error) {
    console.error("Update theatre error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update theatre",
    });
  }
}

export async function deleteTheatre(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
  const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid theatre ID",
      });
      return;
    }

    const actor = req.userId ? await User.findById(req.userId).select("role") : null;
    const existingTheatre = await Theatre.findById(id);
    if (!existingTheatre) { res.status(404).json({ success: false, message: "Theatre not found" }); return; }
    if (actor?.role === "theatreOwner" && existingTheatre.owner?.toString() !== req.userId) { res.status(403).json({ success: false, message: "You can only manage your own theatre" }); return; }
    const theatre = await Theatre.findByIdAndDelete(id);

    if (!theatre) {
      res.status(404).json({
        success: false,
        message: "Theatre not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Theatre deleted successfully",
    });
  } catch (error) {
    console.error("Delete theatre error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete theatre",
    });
  }
}
