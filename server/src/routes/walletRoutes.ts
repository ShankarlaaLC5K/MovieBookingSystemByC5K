import { Router } from "express";
import { getWallet } from "../controllers/walletController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, getWallet);

export default router;