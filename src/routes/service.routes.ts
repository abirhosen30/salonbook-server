import { Router } from "express";
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router();

router.get("/", getServices);
router.get("/:id", getServiceById);
router.post("/", authenticateJWT, requireAdmin, createService);
router.patch("/:id", authenticateJWT, requireAdmin, updateService);
router.put("/:id", authenticateJWT, requireAdmin, updateService);
router.delete("/:id", authenticateJWT, requireAdmin, deleteService);

export default router;
