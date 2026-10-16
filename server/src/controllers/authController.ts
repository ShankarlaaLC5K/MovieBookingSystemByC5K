import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { generateToken } from "../utils/generateToken";
import { AuthRequest } from "../middleware/authMiddleware";

export async function register(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
      return;
    }

    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
      return;
    }

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
      return;
    }

    const passwordErrors: string[] = [];

    if (password.length < 8) {
      passwordErrors.push("Minimum 8 characters");
    }

    if (!/[A-Z]/.test(password)) {
      passwordErrors.push("At least one capital letter (A-Z)");
    }

    if (!/[a-z]/.test(password)) {
      passwordErrors.push("At least one small letter (a-z)");
    }

    if (!/[0-9]/.test(password)) {
      passwordErrors.push("At least one number (0-9)");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      passwordErrors.push("At least one special character");
    }

    if (passwordErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Password does not meet all requirements",
        errors: passwordErrors,
      });
      return;
    }

    if (role !== undefined && role !== "user") {
    res.status(400).json({
    success: false,
    message: "Only user registration is allowed",
    });
    return;
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User already exists",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      });

    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
}

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
}

export async function getMe(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

export async function listUsersForAdmin(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const users = await User.find()
      .select("name email role createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to list users",
    });
  }
}

export async function updateUserRole(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { role } = req.body;
    const allowedRoles = ["user", "admin"];

    if (
      typeof role !== "string" ||
      !allowedRoles.includes(role)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid role",
      });
      return;
    }

    if (
      String(req.params.id) === req.userId &&
      role !== "admin"
    ) {
      res.status(400).json({
        success: false,
        message: "You cannot change your own administrator role",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("name email role createdAt");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      user,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
}