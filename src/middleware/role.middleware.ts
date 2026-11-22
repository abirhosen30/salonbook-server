import { Response, NextFunction } from "express";
import { AuthenticatedRequest, UserRole } from "../types/index.js";
import { sendError } from "../utils/apiResponse.js";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Authentication required.", 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Forbidden: Access restricted to ${allowedRoles.join(" or ")} users.`,
        403
      );
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireCustomer = requireRole("customer");
