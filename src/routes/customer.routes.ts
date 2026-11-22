import { Router } from "express";
import {
  getCustomerStats,
  updateProfile,
  getProfile,
} from "../controllers/customer.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticateJWT);

router.get("/stats", getCustomerStats);
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.put("/profile", updateProfile);

export default router;
