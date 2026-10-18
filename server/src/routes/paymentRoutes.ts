import { Router } from "express";

import {
  createPaymentOrder,
  createReschedulePaymentOrder,
  verifyPayment,
  mockPaymentSuccess,
  mockReschedulePaymentSuccess,
} from "../controllers/paymentController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/create-order", protect, createPaymentOrder);
router.post(
  "/reschedule-create-order",
  protect,
  createReschedulePaymentOrder
);
router.post("/verify", protect, verifyPayment);
router.post("/mock-success", protect, mockPaymentSuccess);
router.post(
  "/mock-reschedule-success",
  protect,
  mockReschedulePaymentSuccess
);

export default router;