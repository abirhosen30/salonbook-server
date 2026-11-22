import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  MONGODB_URL:
    process.env.MONGODB_URL ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/salonbook",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "default_auth_secret_salonbook_3000",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",
};
