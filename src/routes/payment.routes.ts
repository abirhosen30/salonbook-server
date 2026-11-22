import { Router } from "express";
import {
  createCheckoutSession,
  getPaymentByAppointment,
} from "../controllers/payment.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-checkout-session", authenticateJWT, createCheckoutSession);
router.get("/:appointmentId", authenticateJWT, getPaymentByAppointment);

export default router;
