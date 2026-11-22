import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/environment.js";
import { sendError } from "../utils/apiResponse.js";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Unhandled Error:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "An unexpected server error occurred.";

  const errorResponse: any = {
    success: false,
    message,
  };

  if (ENV.NODE_ENV !== "production") {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}
