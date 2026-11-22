import { createApp } from "./app.js";
import { connectDB, closeDB } from "./config/database.js";
import { ENV } from "./config/environment.js";
import { seedInitialServicesIfNeeded } from "./utils/seed.js";

async function bootstrap() {
  try {
    console.log("🚀 Starting SalonBook Express Backend Server...");

    // 1. Connect to Database
    await connectDB();

    // 2. Seed initial services if database collection is empty
    await seedInitialServicesIfNeeded();

    // 3. Create Express app
    const app = createApp();

    // 4. Start listening
    const server = app.listen(ENV.PORT, () => {
      console.log(`\n=================================================`);
      console.log(`✨ SalonBook API Server running on port ${ENV.PORT}`);
      console.log(`🌐 Base URL: http://localhost:${ENV.PORT}/api/v1`);
      console.log(`🔒 Allowed Origin: ${ENV.CLIENT_ORIGIN}`);
      console.log(`⚙️  Environment: ${ENV.NODE_ENV}`);
      console.log(`=================================================\n`);
    });

    // 5. Graceful shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await closeDB();
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ Fatal server initialization error:", error);
    process.exit(1);
  }
}

bootstrap();
