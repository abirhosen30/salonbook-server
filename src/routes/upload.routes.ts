import { Router } from "express";
import { uploadImageHandler } from "../controllers/upload.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Allow both signup users and authenticated users to upload image files with strict MIME & size validation
router.post("/image", upload.single("image"), uploadImageHandler);

export default router;
