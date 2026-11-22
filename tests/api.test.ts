import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDB, closeDB } from "../src/config/database.js";
import { seedInitialServicesIfNeeded } from "../src/utils/seed.js";

const app = createApp();

describe("SalonBook Backend API Test Suite", () => {
  before(async () => {
    await connectDB();
    await seedInitialServicesIfNeeded();
  });

  after(async () => {
    await closeDB();
  });

  test("GET / should return API status ok", async () => {
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
    assert.strictEqual(res.body.name, "SalonBook API");
  });

  test("GET /api/v1/health should return healthy status", async () => {
    const res = await request(app).get("/api/v1/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "healthy");
  });

  test("GET /api/v1/services should return active services list", async () => {
    const res = await request(app).get("/api/v1/services");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 6, "Must return at least 6 services from database");
    assert.ok(res.body.data.every((s: any) => s.status === "active"));
  });

  test("GET /api/v1/services?search=Precision should filter by service name (Challenge Req 1)", async () => {
    const res = await request(app).get("/api/v1/services?search=Precision");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data[0].serviceName.includes("Precision"));
  });

  test("GET /api/v1/services?sort=price-asc should sort by price ascending (Challenge Req 3)", async () => {
    const res = await request(app).get("/api/v1/services?sort=price-asc");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const services = res.body.data;
    assert.ok(services.length >= 2);
    for (let i = 1; i < services.length; i++) {
      assert.ok(
        services[i].price >= services[i - 1].price,
        `Expected ${services[i].price} >= ${services[i - 1].price}`
      );
    }
  });

  test("GET /api/v1/appointments/my should return 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/appointments/my");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test("GET /api/v1/admin/dashboard/stats should return 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard/stats");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test("POST /api/v1/appointments should return 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/v1/appointments").send({
      serviceId: "srv-1",
      appointmentDate: "2026-12-01",
      timeSlot: "10:00 AM",
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });
});
