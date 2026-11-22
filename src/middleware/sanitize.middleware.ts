import { Request, Response, NextFunction } from "express";

function cleanInPlace(obj: any): void {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach(cleanInPlace);
    return;
  }

  for (const key of Object.keys(obj)) {
    // Delete keys that start with $ or contain . to prevent Mongo operator injection
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      cleanInPlace(obj[key]);
    }
  }
}

export function sanitizeMongoInput(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    cleanInPlace(req.body);
  }
  if (req.query && typeof req.query === "object") {
    cleanInPlace(req.query);
  }
  if (req.params && typeof req.params === "object") {
    cleanInPlace(req.params);
  }
  next();
}
