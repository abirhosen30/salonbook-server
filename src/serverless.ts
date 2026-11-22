import { createApp } from "./app.js";
import { connectDB } from "./config/database.js";
import { seedInitialServicesIfNeeded } from "./utils/seed.js";

const app = createApp();
let isInitialized = false;

async function init() {
  if (!isInitialized) {
    try {
      await connectDB();
      await seedInitialServicesIfNeeded();
      isInitialized = true;
    } catch (err: any) {
      console.error("⚠️ Failed to initialize database in serverless function:", err.message);
    }
  }
}

export default async function handler(req: any, res: any) {
  await init();
  return app(req, res);
}
