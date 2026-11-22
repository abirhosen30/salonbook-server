import { Router } from "express";
import {
  createAppointment,
  getMyAppointments,
  cancelAppointment,
  getAppointmentById,
} from "../controllers/appointment.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireCustomer } from "../middleware/role.middleware.js";

const router = Router();

router.post("/", authenticateJWT, requireCustomer, createAppointment);
router.get("/my", authenticateJWT, getMyAppointments);
router.patch("/:id/cancel", authenticateJWT, cancelAppointment);
router.get("/:id", authenticateJWT, getAppointmentById);

export default router;
