import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDB, closeDB } from "../src/config/database.js";

const app = createApp();

describe("SalonBook Webhook, Upload, and Security Tests", () => {
  before(async () => {
    await connectDB();
  });

  after(async () => {
    await closeDB();
  });

  test("POST /api/v1/uploads/image without file should return 400 Bad Request", async () => {
    const res = await request(app).post("/api/v1/uploads/image");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("No image file provided"));
  });

  test("POST /api/v1/payments/webhook without signature header should return 400", async () => {
    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .send({ type: "checkout.session.completed" });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes("Missing stripe-signature header"));
  });

  test("POST /api/v1/payments/webhook with invalid signature should return 400 Webhook Error", async () => {
    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("stripe-signature", "invalid_test_signature")
      .send({ type: "checkout.session.completed" });
    assert.strictEqual(res.status, 400);
  });

  test("GET /api/v1/invalid-route-xyz should return 404 Not Found", async () => {
    const res = await request(app).get("/api/v1/invalid-route-xyz");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("Route not found"));
  });

  test("GET /api/v1/services/:invalidId should return 404 when service does not exist", async () => {
    const res = await request(app).get("/api/v1/services/000000000000000000000000");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });
});
