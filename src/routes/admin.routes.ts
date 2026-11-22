import { Router } from "express";
import {
  getAdminStats,
  getAllAppointments,
  updateAppointmentStatus,
  getUsers,
  toggleUserBlockStatus,
  getTransactions,
} from "../controllers/admin.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router();

// All admin routes strictly enforce authentication and admin role (PDF Page 11 & 13-15)
router.use(authenticateJWT, requireAdmin);

router.get("/dashboard/stats", getAdminStats);
router.get("/appointments", getAllAppointments);
router.patch("/appointments/:id/status", updateAppointmentStatus);
router.get("/users", getUsers);
router.patch("/users/:id/status", toggleUserBlockStatus);
router.get("/transactions", getTransactions);

export default router;
