import { Router } from "express";
import { uploadImageHandler } from "../controllers/upload.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Allow authenticated users (customers and admins) to upload images
router.post("/image", authenticateJWT, upload.single("image"), uploadImageHandler);

export default router;
