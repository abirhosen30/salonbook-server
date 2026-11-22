import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { ENV } from "./config/environment.js";
import routes from "./routes/index.js";
import { handleStripeWebhook } from "./controllers/webhook.controller.js";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middleware/error.middleware.js";

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // 2. CORS setup
  app.use(
    cors({
      origin: [ENV.CLIENT_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
    })
  );

  // 3. Cookie parser
  app.use(cookieParser());

  // 4. Rate Limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
    },
  });
  app.use("/api/", limiter);

  // 5. Stripe Webhook: RAW BODY parsing must occur BEFORE express.json()
  app.post(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
    (req: Request, res: Response, next) => {
      // Store raw buffer for signature verification
      (req as any).rawBody = req.body;
      next();
    },
    handleStripeWebhook
  );

  // 6. Normal Body Parsers for all other routes
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 7. Health Check
  app.get("/", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      name: "SalonBook API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/v1/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "salonbook-backend",
      uptime: process.uptime(),
    });
  });

  // 8. Mount Main API Routes
  app.use("/api/v1", routes);

  // Backward compatibility alias for any legacy routes
  app.use("/api", routes);

  // 9. Error Handling
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
