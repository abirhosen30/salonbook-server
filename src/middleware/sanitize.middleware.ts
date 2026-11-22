import { Request, Response, NextFunction } from "express";

function cleanObject(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Strip keys starting with $ or containing a dot to prevent Mongo operator injection
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }
    cleaned[key] = cleanObject(value);
  }
  return cleaned;
}

export function sanitizeMongoInput(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    req.body = cleanObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = cleanObject(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = cleanObject(req.params);
  }
  next();
}
