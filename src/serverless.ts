import { createApp } from "./app.js";
import { connectDB } from "./config/database.js";
import { seedInitialServicesIfNeeded } from "./utils/seed.js";

const app = createApp();
let isInitialized = false;

app.use(async (req, res, next) => {
  if (!isInitialized) {
    try {
      await connectDB();
      await seedInitialServicesIfNeeded();
      isInitialized = true;
    } catch (err: any) {
      console.error("⚠️ Failed to initialize database in serverless function:", err?.message);
    }
  }
  next();
});

export default app;
