import { Router, Response } from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { AuthenticatedRequest } from "../types/index.js";
import { sendSuccess } from "../utils/apiResponse.js";

const router = Router();

// GET /api/v1/auth/me - returns current verified user session
router.get("/me", authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, req.user, "User authenticated");
});

// POST /api/v1/auth/logout - clears session cookies
router.post("/logout", (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie("better-auth.session_token");
  res.clearCookie("session_token");
  sendSuccess(res, { loggedOut: true }, "Logged out successfully");
});

export default router;
