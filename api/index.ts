import { createApp } from "../src/app.js";
import { connectDB } from "../src/config/database.js";
import { seedInitialServicesIfNeeded } from "../src/utils/seed.js";

const app = createApp();
let isInitialized = false;

async function init() {
  if (!isInitialized) {
    try {
      await connectDB();
      await seedInitialServicesIfNeeded();
      isInitialized = true;
    } catch (err) {
      console.error("⚠️ Failed to initialize database connection in serverless function:", err);
    }
  }
}

export default async function handler(req: any, res: any) {
  await init();
  return app(req, res);
}
