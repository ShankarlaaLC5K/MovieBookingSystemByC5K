import { Router } from "express";
import { getReports } from "../controllers/reportController";
import { protect } from "../middleware/authMiddleware";
import { requireTheatreManager } from "../middleware/rolemiddleware";

const router = Router();

router.get("/", 
        protect, 
        requireTheatreManager, 
        getReports);

export default router;
