
import { NextFunction, Response } from "express";
import { AuthRequest } from "./authMiddleware";
import { User } from "../models/User";

export async function requireRoles(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  roles: string[]
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const user = await User.findById(req.userId).select("role");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      success: false,
      message: "Authorization check failed",
    });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  void requireRoles(req, res, next, ["admin"]);
}

export function requireTheatreManager(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  void requireRoles(req, res, next, ["admin"]);
}

export async function requireOwnedResource(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const user = await User.findById(req.userId).select("role");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Administrator access required",
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      success: false,
      message: "Authorization check failed",
    });
  }
}
