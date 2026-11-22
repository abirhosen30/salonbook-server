import { Router } from "express";
import serviceRoutes from "./service.routes.js";
import appointmentRoutes from "./appointment.routes.js";
import paymentRoutes from "./payment.routes.js";
import uploadRoutes from "./upload.routes.js";
import adminRoutes from "./admin.routes.js";
import customerRoutes from "./customer.routes.js";
import authRoutes from "./auth.routes.js";

const router = Router();

router.use("/services", serviceRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/uploads", uploadRoutes);
router.use("/admin", adminRoutes);
router.use("/customer", customerRoutes);
router.use("/auth", authRoutes);

export default router;
