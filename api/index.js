// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

// src/config/environment.ts
import dotenv from "dotenv";
dotenv.config();
var ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  MONGODB_URL: process.env.MONGODB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017/salonbook",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "default_auth_secret_salonbook_3000",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  IMGBB_API_KEY: process.env.IMGBB_API_KEY || ""
};

// src/routes/index.ts
import { Router as Router8 } from "express";

// src/routes/service.routes.ts
import { Router } from "express";

// src/controllers/service.controller.ts
import { ObjectId } from "mongodb";

// src/config/database.ts
import { MongoClient } from "mongodb";
var client = null;
var db = null;
async function connectDB() {
  if (db && client) {
    return db;
  }
  client = new MongoClient(ENV.MONGODB_URL);
  await client.connect();
  db = client.db("salonbook");
  console.log("\u2705 Successfully connected to MongoDB Atlas (salonbook)");
  initIndexes(db).catch(
    (err) => console.warn("\u26A0\uFE0F Warning initializing database indexes:", err.message)
  );
  return db;
}
function getDB() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
}
function getUsersCollection() {
  return getDB().collection("user");
}
function getServicesCollection() {
  return getDB().collection("services");
}
function getAppointmentsCollection() {
  return getDB().collection("appointments");
}
function getTransactionsCollection() {
  return getDB().collection("transactions");
}
async function initIndexes(database) {
  const services = database.collection("services");
  await services.createIndex({ status: 1 });
  await services.createIndex({ category: 1 });
  await services.createIndex({ price: 1 });
  await services.createIndex({ serviceName: "text", description: "text" });
  const appointments = database.collection("appointments");
  await appointments.createIndex({ customerId: 1 });
  await appointments.createIndex({ appointmentDate: 1, timeSlot: 1, status: 1 });
  const transactions = database.collection("transactions");
  await transactions.createIndex({ appointmentId: 1 });
  await transactions.createIndex({ customerId: 1 });
  await transactions.createIndex({ stripeSessionId: 1 });
  const users = database.collection("user");
  await users.createIndex({ email: 1 });
}

// src/utils/apiResponse.ts
function sendSuccess(res, data, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}
function sendError(res, message = "An error occurred", statusCode = 400, errors) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...errors ? { errors } : {}
  });
}

// src/controllers/service.controller.ts
async function getServices(req, res) {
  try {
    const servicesCollection = getServicesCollection();
    const { status, category, search, sort, limit } = req.query;
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    } else if (!status) {
      query.status = "active";
    }
    if (category && category !== "All") {
      query.category = category;
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      query.serviceName = { $regex: search.trim(), $options: "i" };
    }
    let sortOptions = { createdAt: -1 };
    if (sort === "price-asc" || sort === "asc" || sort === "price_asc") {
      sortOptions = { price: 1 };
    } else if (sort === "price-desc" || sort === "desc" || sort === "price_desc") {
      sortOptions = { price: -1 };
    }
    let cursor = servicesCollection.find(query).sort(sortOptions);
    if (limit) {
      cursor = cursor.limit(parseInt(limit, 10));
    }
    const services = await cursor.toArray();
    const formatted = services.map((s) => ({
      ...s,
      _id: s._id?.toString()
    }));
    sendSuccess(res, formatted, "Services retrieved successfully");
  } catch (error) {
    console.error("getServices error:", error);
    sendError(res, "Failed to retrieve services", 500);
  }
}
async function getServiceById(req, res) {
  try {
    const id = req.params.id;
    if (!id) {
      sendError(res, "Service ID is required", 400);
      return;
    }
    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const service = await servicesCollection.findOne(query);
    if (!service) {
      sendError(res, "Service not found", 404);
      return;
    }
    sendSuccess(
      res,
      { ...service, _id: service._id?.toString() },
      "Service details retrieved"
    );
  } catch (error) {
    console.error("getServiceById error:", error);
    sendError(res, "Failed to retrieve service details", 500);
  }
}
async function createService(req, res) {
  try {
    const { serviceName, category, description, price, duration, image, status } = req.body;
    if (!serviceName || !category || !description || price === void 0 || !duration) {
      sendError(
        res,
        "Missing required service fields: serviceName, category, description, price, duration",
        400
      );
      return;
    }
    const numPrice = Number(price);
    const numDuration = Number(duration);
    if (isNaN(numPrice) || numPrice <= 0) {
      sendError(res, "Price must be a positive number greater than 0", 400);
      return;
    }
    if (isNaN(numDuration) || numDuration <= 0) {
      sendError(res, "Duration must be a positive number of minutes", 400);
      return;
    }
    if (!image) {
      sendError(res, "Service image is required", 400);
      return;
    }
    const newService = {
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: numPrice,
      duration: numDuration,
      image: image.trim(),
      status: status === "inactive" ? "inactive" : "active",
      // default active
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const servicesCollection = getServicesCollection();
    const result = await servicesCollection.insertOne(newService);
    sendSuccess(
      res,
      { ...newService, _id: result.insertedId.toString() },
      "Service created successfully",
      201
    );
  } catch (error) {
    console.error("createService error:", error);
    sendError(res, "Failed to create service", 500);
  }
}
async function updateService(req, res) {
  try {
    const id = req.params.id;
    const { serviceName, category, description, price, duration, image, status } = req.body;
    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const existing = await servicesCollection.findOne(query);
    if (!existing) {
      sendError(res, "Service not found", 404);
      return;
    }
    const updates = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (serviceName !== void 0) updates.serviceName = serviceName.trim();
    if (category !== void 0) updates.category = category.trim();
    if (description !== void 0) updates.description = description.trim();
    if (image !== void 0) updates.image = image.trim();
    if (status !== void 0) updates.status = status;
    if (price !== void 0) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        sendError(res, "Price must be a positive number", 400);
        return;
      }
      updates.price = numPrice;
    }
    if (duration !== void 0) {
      const numDuration = Number(duration);
      if (isNaN(numDuration) || numDuration <= 0) {
        sendError(res, "Duration must be a positive number", 400);
        return;
      }
      updates.duration = numDuration;
    }
    await servicesCollection.updateOne(query, { $set: updates });
    const updated = await servicesCollection.findOne(query);
    sendSuccess(
      res,
      { ...updated, _id: updated?._id?.toString() },
      "Service updated successfully"
    );
  } catch (error) {
    console.error("updateService error:", error);
    sendError(res, "Failed to update service", 500);
  }
}
async function deleteService(req, res) {
  try {
    const id = req.params.id;
    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await servicesCollection.deleteOne(query);
    if (result.deletedCount === 0) {
      sendError(res, "Service not found", 404);
      return;
    }
    sendSuccess(res, { deletedId: id }, "Service deleted successfully");
  } catch (error) {
    console.error("deleteService error:", error);
    sendError(res, "Failed to delete service", 500);
  }
}

// src/middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
import { ObjectId as ObjectId2 } from "mongodb";
async function authenticateJWT(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token && req.cookies) {
      token = req.cookies["better-auth.session_token"] || req.cookies["session_token"] || req.cookies["token"];
    }
    if (!token) {
      sendError(res, "Authentication required. Please log in.", 401);
      return;
    }
    let userId = null;
    let userEmail = null;
    if (token.split(".").length === 3) {
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          userId = decoded.sub || decoded.id || decoded.userId;
          userEmail = decoded.email;
        }
        try {
          const verified = jwt.verify(token, ENV.BETTER_AUTH_SECRET);
          if (verified) {
            userId = verified.sub || verified.id || verified.userId || userId;
            userEmail = verified.email || userEmail;
          }
        } catch {
        }
      } catch {
      }
    }
    if (!userId) {
      try {
        const sessionCol = getDB().collection("session");
        const session = await sessionCol.findOne({
          token,
          expiresAt: { $gt: /* @__PURE__ */ new Date() }
        });
        if (session) {
          userId = session.userId?.toString();
        }
      } catch {
      }
    }
    if (!userId && !userEmail) {
      sendError(res, "Invalid or expired session. Please log in again.", 401);
      return;
    }
    const usersCollection = getUsersCollection();
    let query = {};
    if (userId) {
      query = ObjectId2.isValid(userId) ? { _id: new ObjectId2(userId) } : { id: userId };
    } else if (userEmail) {
      query = { email: userEmail };
    }
    const userDoc = await usersCollection.findOne(query);
    if (!userDoc) {
      sendError(res, "User account not found.", 401);
      return;
    }
    if (userDoc.isBlocked === true) {
      sendError(
        res,
        "Your account is blocked. Please contact support at support@salonbook.com.",
        403
      );
      return;
    }
    const authUser = {
      id: userDoc._id ? userDoc._id.toString() : userId || "",
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role === "admin" ? "admin" : "customer",
      isBlocked: Boolean(userDoc.isBlocked),
      image: userDoc.image,
      phone: userDoc.phone
    };
    req.user = authUser;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    sendError(res, "Authentication failed.", 401);
  }
}

// src/middleware/role.middleware.ts
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      sendError(res, "Authentication required.", 401);
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Forbidden: Access restricted to ${allowedRoles.join(" or ")} users.`,
        403
      );
      return;
    }
    next();
  };
}
var requireAdmin = requireRole("admin");
var requireCustomer = requireRole("customer");

// src/routes/service.routes.ts
var router = Router();
router.get("/", getServices);
router.get("/:id", getServiceById);
router.post("/", authenticateJWT, requireAdmin, createService);
router.patch("/:id", authenticateJWT, requireAdmin, updateService);
router.put("/:id", authenticateJWT, requireAdmin, updateService);
router.delete("/:id", authenticateJWT, requireAdmin, deleteService);
var service_routes_default = router;

// src/routes/appointment.routes.ts
import { Router as Router2 } from "express";

// src/controllers/appointment.controller.ts
import { ObjectId as ObjectId3 } from "mongodb";
async function createAppointment(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    if (user.role === "admin") {
      sendError(
        res,
        "Admins cannot submit appointment requests. Please use a customer account.",
        403
      );
      return;
    }
    const { serviceId, appointmentDate, timeSlot, message } = req.body;
    if (!serviceId || !appointmentDate || !timeSlot) {
      sendError(
        res,
        "Missing required booking fields: serviceId, appointmentDate, timeSlot",
        400
      );
      return;
    }
    const servicesCollection = getServicesCollection();
    const serviceQuery = ObjectId3.isValid(serviceId) ? { _id: new ObjectId3(serviceId) } : { _id: serviceId };
    const service = await servicesCollection.findOne(serviceQuery);
    if (!service) {
      sendError(res, "Selected salon service not found", 404);
      return;
    }
    if (service.status !== "active") {
      sendError(
        res,
        "This service is currently inactive and unavailable for booking.",
        400
      );
      return;
    }
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (appointmentDate < todayStr) {
      sendError(res, "Cannot book an appointment for a past date.", 400);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const existingSlot = await appointmentsCollection.findOne({
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
      status: { $ne: "cancelled" }
    });
    if (existingSlot) {
      sendError(
        res,
        "This appointment slot is already booked. Please select another time or date.",
        409
      );
      return;
    }
    const newAppointment = {
      serviceId: service._id ? service._id.toString() : serviceId,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      serviceName: service.serviceName,
      serviceImage: service.image,
      category: service.category,
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
      message: message ? message.trim() : "",
      servicePrice: service.price,
      // Authoritative server-side price
      status: "pending",
      // Default: Pending
      paymentStatus: "unpaid",
      // Default: Unpaid
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const result = await appointmentsCollection.insertOne(newAppointment);
    sendSuccess(
      res,
      { ...newAppointment, _id: result.insertedId.toString() },
      "Appointment request submitted successfully.",
      201
    );
  } catch (error) {
    console.error("createAppointment error:", error);
    sendError(res, "Failed to submit appointment request.", 500);
  }
}
async function getMyAppointments(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const appointments = await appointmentsCollection.find({ customerId: user.id }).sort({ createdAt: -1 }).toArray();
    const formatted = appointments.map((a) => ({
      ...a,
      _id: a._id?.toString()
    }));
    sendSuccess(res, formatted, "Customer appointments retrieved successfully.");
  } catch (error) {
    console.error("getMyAppointments error:", error);
    sendError(res, "Failed to retrieve your appointments.", 500);
  }
}
async function cancelAppointment(req, res) {
  try {
    const user = req.user;
    const id = req.params.id;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId3.isValid(id) ? { _id: new ObjectId3(id) } : { _id: id };
    const appointment = await appointmentsCollection.findOne(query);
    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }
    if (user.role !== "admin" && appointment.customerId !== user.id) {
      sendError(res, "Forbidden: You can only cancel your own appointments.", 403);
      return;
    }
    if (user.role !== "admin") {
      if (appointment.status === "confirmed") {
        sendError(
          res,
          "Confirmed appointments cannot be cancelled by the customer. Please contact salon staff.",
          400
        );
        return;
      }
      if (appointment.status === "cancelled") {
        sendError(res, "Appointment is already cancelled.", 400);
        return;
      }
    }
    await appointmentsCollection.updateOne(query, {
      $set: {
        status: "cancelled",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    sendSuccess(res, { id, status: "cancelled" }, "Appointment cancelled successfully.");
  } catch (error) {
    console.error("cancelAppointment error:", error);
    sendError(res, "Failed to cancel appointment.", 500);
  }
}
async function getAppointmentById(req, res) {
  try {
    const user = req.user;
    const id = req.params.id;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId3.isValid(id) ? { _id: new ObjectId3(id) } : { _id: id };
    const appointment = await appointmentsCollection.findOne(query);
    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }
    if (user.role !== "admin" && appointment.customerId !== user.id) {
      sendError(res, "Forbidden: Access denied to this appointment", 403);
      return;
    }
    sendSuccess(
      res,
      { ...appointment, _id: appointment._id?.toString() },
      "Appointment details retrieved"
    );
  } catch (error) {
    console.error("getAppointmentById error:", error);
    sendError(res, "Failed to retrieve appointment", 500);
  }
}

// src/routes/appointment.routes.ts
var router2 = Router2();
router2.post("/", authenticateJWT, requireCustomer, createAppointment);
router2.get("/my", authenticateJWT, getMyAppointments);
router2.patch("/:id/cancel", authenticateJWT, cancelAppointment);
router2.get("/:id", authenticateJWT, getAppointmentById);
var appointment_routes_default = router2;

// src/routes/payment.routes.ts
import { Router as Router3 } from "express";

// src/controllers/payment.controller.ts
import { ObjectId as ObjectId4 } from "mongodb";

// src/config/stripe.ts
import Stripe from "stripe";
var stripeClient = null;
function getStripe() {
  if (stripeClient) {
    return stripeClient;
  }
  if (!ENV.STRIPE_SECRET_KEY) {
    console.warn("\u26A0\uFE0F STRIPE_SECRET_KEY is not set. Stripe operations will be restricted.");
    return null;
  }
  stripeClient = new Stripe(ENV.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });
  return stripeClient;
}

// src/services/stripe.service.ts
async function createStripeCheckoutSession(params) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not initialized. Please configure STRIPE_SECRET_KEY."
    );
  }
  const successUrl = params.successUrl || `${ENV.CLIENT_ORIGIN}/dashboard/customer/appointments?payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = params.cancelUrl || `${ENV.CLIENT_ORIGIN}/dashboard/customer/appointments?payment_cancelled=true`;
  const sessionParams = {
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.serviceName,
            description: `Salon appointment session on SalonBook`
          },
          unit_amount: Math.round(params.servicePrice * 100)
          // Stripe expects cents
        },
        quantity: 1
      }
    ],
    metadata: {
      appointmentId: params.appointmentId,
      customerId: params.customerId,
      serviceName: params.serviceName,
      customerName: params.customerName
    },
    success_url: successUrl,
    cancel_url: cancelUrl
  };
  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) {
    throw new Error("Failed to generate Stripe checkout session URL.");
  }
  return {
    sessionId: session.id,
    sessionUrl: session.url
  };
}
function verifyStripeWebhookSignature(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }
  if (!ENV.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured on the server.");
  }
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    ENV.STRIPE_WEBHOOK_SECRET
  );
}

// src/controllers/payment.controller.ts
async function createCheckoutSession(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const { appointmentId } = req.body;
    if (!appointmentId) {
      sendError(res, "appointmentId is required", 400);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId4.isValid(appointmentId) ? { _id: new ObjectId4(appointmentId) } : { _id: appointmentId };
    const appointment = await appointmentsCollection.findOne(query);
    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }
    if (appointment.customerId !== user.id) {
      sendError(res, "Forbidden: You can only pay for your own appointments.", 403);
      return;
    }
    if (appointment.status !== "confirmed") {
      sendError(
        res,
        `Payment is only available for confirmed appointments. Current status: ${appointment.status}`,
        400
      );
      return;
    }
    if (appointment.paymentStatus === "paid") {
      sendError(res, "This appointment has already been paid.", 400);
      return;
    }
    const servicesCollection = getServicesCollection();
    const serviceQuery = ObjectId4.isValid(appointment.serviceId) ? { _id: new ObjectId4(appointment.serviceId) } : { _id: appointment.serviceId };
    const service = await servicesCollection.findOne(serviceQuery);
    const price = service ? service.price : appointment.servicePrice;
    const { sessionId, sessionUrl } = await createStripeCheckoutSession({
      appointmentId: appointment._id ? appointment._id.toString() : appointmentId,
      customerId: user.id,
      customerEmail: user.email,
      customerName: user.name,
      serviceName: appointment.serviceName || service?.serviceName || "Salon Service",
      servicePrice: price
    });
    sendSuccess(
      res,
      { url: sessionUrl, sessionId },
      "Stripe checkout session initialized successfully."
    );
  } catch (error) {
    console.error("createCheckoutSession error:", error);
    sendError(res, error.message || "Failed to initialize payment session.", 500);
  }
}
async function getPaymentByAppointment(req, res) {
  try {
    const user = req.user;
    const { appointmentId } = req.params;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const transactionsCollection = getTransactionsCollection();
    const transaction = await transactionsCollection.findOne({
      appointmentId
    });
    if (!transaction) {
      sendError(res, "No transaction found for this appointment", 404);
      return;
    }
    if (user.role !== "admin" && transaction.customerId !== user.id) {
      sendError(res, "Forbidden: Access denied to transaction details", 403);
      return;
    }
    sendSuccess(
      res,
      { ...transaction, _id: transaction._id?.toString() },
      "Transaction retrieved"
    );
  } catch (error) {
    console.error("getPaymentByAppointment error:", error);
    sendError(res, "Failed to retrieve transaction", 500);
  }
}

// src/routes/payment.routes.ts
var router3 = Router3();
router3.post("/create-checkout-session", authenticateJWT, createCheckoutSession);
router3.get("/:appointmentId", authenticateJWT, getPaymentByAppointment);
var payment_routes_default = router3;

// src/routes/upload.routes.ts
import { Router as Router4 } from "express";

// src/services/imgbb.service.ts
import FormData from "form-data";
async function uploadToImgBB(fileBuffer, fileName) {
  if (!ENV.IMGBB_API_KEY) {
    console.warn("\u26A0\uFE0F IMGBB_API_KEY is not configured in environment.");
    throw new Error(
      "ImgBB API key is not configured on the server. Please set IMGBB_API_KEY in server environment."
    );
  }
  const form = new FormData();
  form.append("image", fileBuffer.toString("base64"));
  form.append("name", fileName);
  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${ENV.IMGBB_API_KEY}`,
    {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    const errorMsg = result?.error?.message || "Failed to upload image to ImgBB service.";
    throw new Error(errorMsg);
  }
  return {
    url: result.data.url,
    displayUrl: result.data.display_url || result.data.url,
    deleteUrl: result.data.delete_url
  };
}

// src/controllers/upload.controller.ts
async function uploadImageHandler(req, res) {
  try {
    if (!req.file) {
      sendError(res, "No image file provided. Please attach an image.", 400);
      return;
    }
    if (ENV.IMGBB_API_KEY) {
      try {
        const result = await uploadToImgBB(
          req.file.buffer,
          req.file.originalname || "salonbook-upload"
        );
        sendSuccess(
          res,
          {
            url: result.url,
            displayUrl: result.displayUrl
          },
          "Image uploaded to ImgBB successfully"
        );
        return;
      } catch (imgbbErr) {
        console.warn(
          "\u26A0\uFE0F ImgBB API error, using fallback data URI to prevent blocking upload:",
          imgbbErr.message
        );
      }
    }
    console.warn(
      "\u26A0\uFE0F IMGBB_API_KEY not set in environment. Returning data URL for local development."
    );
    const mime = req.file.mimetype;
    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${mime};base64,${base64}`;
    sendSuccess(
      res,
      {
        url: dataUri,
        displayUrl: dataUri
      },
      "Image uploaded (local data URI fallback)"
    );
  } catch (error) {
    console.error("uploadImageHandler error:", error);
    sendError(res, error.message || "Failed to process image upload", 500);
  }
}

// src/middleware/upload.middleware.ts
import multer from "multer";
var storage = multer.memoryStorage();
var allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
];
var fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, WEBP, and GIF images are permitted."
      )
    );
  }
};
var upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit
  },
  fileFilter
});

// src/routes/upload.routes.ts
var router4 = Router4();
router4.post("/image", upload.single("image"), uploadImageHandler);
var upload_routes_default = router4;

// src/routes/admin.routes.ts
import { Router as Router5 } from "express";

// src/controllers/admin.controller.ts
import { ObjectId as ObjectId5 } from "mongodb";
async function getAdminStats(req, res) {
  try {
    const usersCollection = getUsersCollection();
    const servicesCollection = getServicesCollection();
    const appointmentsCollection = getAppointmentsCollection();
    const transactionsCollection = getTransactionsCollection();
    const [
      totalRegisteredCustomers,
      totalActiveServices,
      totalAppointmentRequests,
      pendingAppointments,
      confirmedAppointments,
      cancelledAppointments,
      paidTransactions
    ] = await Promise.all([
      usersCollection.countDocuments({ role: "customer" }),
      servicesCollection.countDocuments({ status: "active" }),
      appointmentsCollection.countDocuments({}),
      appointmentsCollection.countDocuments({ status: "pending" }),
      appointmentsCollection.countDocuments({ status: "confirmed" }),
      appointmentsCollection.countDocuments({ status: "cancelled" }),
      transactionsCollection.find({ status: "paid" }).toArray()
    ]);
    const totalRevenue = paidTransactions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    sendSuccess(
      res,
      {
        totalRegisteredCustomers,
        totalActiveServices,
        totalAppointmentRequests,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        totalSuccessfulPayments: paidTransactions.length,
        totalRevenue
      },
      "Admin stats retrieved successfully"
    );
  } catch (error) {
    console.error("getAdminStats error:", error);
    sendError(res, "Failed to calculate admin metrics", 500);
  }
}
async function getAllAppointments(req, res) {
  try {
    const appointmentsCollection = getAppointmentsCollection();
    const { status, date } = req.query;
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (date) {
      query.appointmentDate = date;
    }
    const appointments = await appointmentsCollection.find(query).sort({ createdAt: -1 }).toArray();
    const formatted = appointments.map((a) => ({
      ...a,
      _id: a._id?.toString()
    }));
    sendSuccess(res, formatted, "All appointments retrieved successfully");
  } catch (error) {
    console.error("getAllAppointments error:", error);
    sendError(res, "Failed to retrieve appointments", 500);
  }
}
async function updateAppointmentStatus(req, res) {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!status || !["pending", "confirmed", "cancelled"].includes(status)) {
      sendError(
        res,
        "Valid status is required: 'pending', 'confirmed', or 'cancelled'",
        400
      );
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId5.isValid(id) ? { _id: new ObjectId5(id) } : { _id: id };
    const appointment = await appointmentsCollection.findOne(query);
    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }
    if (status === "confirmed" && appointment.status !== "pending") {
      sendError(
        res,
        `Only pending appointments can be confirmed. Current status is ${appointment.status}.`,
        400
      );
      return;
    }
    await appointmentsCollection.updateOne(query, {
      $set: {
        status,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const updated = await appointmentsCollection.findOne(query);
    sendSuccess(
      res,
      { ...updated, _id: updated?._id?.toString() },
      `Appointment status updated to ${status}`
    );
  } catch (error) {
    console.error("updateAppointmentStatus error:", error);
    sendError(res, "Failed to update appointment status", 500);
  }
}
async function getUsers(req, res) {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();
    const formatted = users.map((u) => ({
      id: u._id?.toString() || u.id,
      name: u.name,
      email: u.email,
      role: u.role || "customer",
      isBlocked: Boolean(u.isBlocked),
      image: u.image,
      phone: u.phone,
      createdAt: u.createdAt
    }));
    sendSuccess(res, formatted, "Users list retrieved successfully");
  } catch (error) {
    console.error("getUsers error:", error);
    sendError(res, "Failed to retrieve users", 500);
  }
}
async function toggleUserBlockStatus(req, res) {
  try {
    const id = req.params.id;
    const { isBlocked } = req.body;
    if (isBlocked === void 0) {
      sendError(res, "isBlocked boolean field is required", 400);
      return;
    }
    const usersCollection = getUsersCollection();
    const query = ObjectId5.isValid(id) ? { _id: new ObjectId5(id) } : { id };
    const user = await usersCollection.findOne(query);
    if (!user) {
      sendError(res, "User not found", 404);
      return;
    }
    if (user.role === "admin") {
      sendError(res, "Cannot block an administrator account.", 400);
      return;
    }
    await usersCollection.updateOne(query, {
      $set: {
        isBlocked: Boolean(isBlocked),
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    sendSuccess(
      res,
      { id, isBlocked: Boolean(isBlocked) },
      `User ${isBlocked ? "blocked" : "unblocked"} successfully`
    );
  } catch (error) {
    console.error("toggleUserBlockStatus error:", error);
    sendError(res, "Failed to update user block status", 500);
  }
}
async function getTransactions(req, res) {
  try {
    const transactionsCollection = getTransactionsCollection();
    const transactions = await transactionsCollection.find({}).sort({ createdAt: -1 }).toArray();
    const formatted = transactions.map((t) => ({
      ...t,
      _id: t._id?.toString()
    }));
    sendSuccess(res, formatted, "Transactions retrieved successfully");
  } catch (error) {
    console.error("getTransactions error:", error);
    sendError(res, "Failed to retrieve transactions", 500);
  }
}

// src/routes/admin.routes.ts
var router5 = Router5();
router5.use(authenticateJWT, requireAdmin);
router5.get("/dashboard/stats", getAdminStats);
router5.get("/appointments", getAllAppointments);
router5.patch("/appointments/:id/status", updateAppointmentStatus);
router5.get("/users", getUsers);
router5.patch("/users/:id/status", toggleUserBlockStatus);
router5.get("/transactions", getTransactions);
var admin_routes_default = router5;

// src/routes/customer.routes.ts
import { Router as Router6 } from "express";

// src/controllers/customer.controller.ts
import { ObjectId as ObjectId6 } from "mongodb";
async function getCustomerStats(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const appointmentsCollection = getAppointmentsCollection();
    const [total, pending, confirmed, cancelled] = await Promise.all([
      appointmentsCollection.countDocuments({ customerId: user.id }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "pending"
      }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "confirmed"
      }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "cancelled"
      })
    ]);
    sendSuccess(
      res,
      { total, pending, confirmed, cancelled },
      "Customer metrics retrieved successfully"
    );
  } catch (error) {
    console.error("getCustomerStats error:", error);
    sendError(res, "Failed to load customer stats", 500);
  }
}
async function updateProfile(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const { name, image, phone } = req.body;
    const updates = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (name !== void 0) {
      if (typeof name !== "string" || !name.trim()) {
        sendError(res, "Name cannot be empty", 400);
        return;
      }
      updates.name = name.trim();
    }
    if (image !== void 0) {
      updates.image = image.trim();
    }
    if (phone !== void 0) {
      updates.phone = phone.trim();
    }
    const usersCollection = getUsersCollection();
    const query = ObjectId6.isValid(user.id) ? { _id: new ObjectId6(user.id) } : { id: user.id };
    await usersCollection.updateOne(query, { $set: updates });
    const updatedUser = await usersCollection.findOne(query);
    sendSuccess(
      res,
      {
        id: updatedUser?._id?.toString() || user.id,
        name: updatedUser?.name,
        email: updatedUser?.email,
        role: updatedUser?.role || "customer",
        image: updatedUser?.image,
        phone: updatedUser?.phone,
        isBlocked: Boolean(updatedUser?.isBlocked)
      },
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("updateProfile error:", error);
    sendError(res, "Failed to update profile", 500);
  }
}
async function getProfile(req, res) {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    const usersCollection = getUsersCollection();
    const query = ObjectId6.isValid(user.id) ? { _id: new ObjectId6(user.id) } : { id: user.id };
    const userDoc = await usersCollection.findOne(query);
    sendSuccess(
      res,
      {
        id: userDoc?._id?.toString() || user.id,
        name: userDoc?.name || user.name,
        email: userDoc?.email || user.email,
        role: userDoc?.role || user.role,
        image: userDoc?.image,
        phone: userDoc?.phone,
        isBlocked: Boolean(userDoc?.isBlocked)
      },
      "Profile retrieved successfully"
    );
  } catch (error) {
    console.error("getProfile error:", error);
    sendError(res, "Failed to retrieve profile", 500);
  }
}

// src/routes/customer.routes.ts
var router6 = Router6();
router6.use(authenticateJWT);
router6.get("/stats", getCustomerStats);
router6.get("/profile", getProfile);
router6.patch("/profile", updateProfile);
router6.put("/profile", updateProfile);
var customer_routes_default = router6;

// src/routes/auth.routes.ts
import { Router as Router7 } from "express";
var router7 = Router7();
router7.get("/me", authenticateJWT, (req, res) => {
  sendSuccess(res, req.user, "User authenticated");
});
router7.post("/logout", (req, res) => {
  res.clearCookie("better-auth.session_token");
  res.clearCookie("session_token");
  sendSuccess(res, { loggedOut: true }, "Logged out successfully");
});
var auth_routes_default = router7;

// src/routes/index.ts
var router8 = Router8();
router8.use("/services", service_routes_default);
router8.use("/appointments", appointment_routes_default);
router8.use("/payments", payment_routes_default);
router8.use("/uploads", upload_routes_default);
router8.use("/admin", admin_routes_default);
router8.use("/customer", customer_routes_default);
router8.use("/auth", auth_routes_default);
var routes_default = router8;

// src/controllers/webhook.controller.ts
import { ObjectId as ObjectId7 } from "mongodb";
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }
  let event;
  try {
    const rawBody = req.rawBody || req.body;
    event = verifyStripeWebhookSignature(rawBody, sig);
  } catch (err) {
    console.error("\u26A0\uFE0F Stripe webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const appointmentId = session.metadata?.appointmentId;
        const customerId = session.metadata?.customerId;
        if (appointmentId) {
          const transactionsCollection = getTransactionsCollection();
          const appointmentsCollection = getAppointmentsCollection();
          const existingTransaction = await transactionsCollection.findOne({
            stripeSessionId: session.id
          });
          if (!existingTransaction) {
            const transaction = {
              appointmentId,
              customerId: customerId || "",
              customerName: session.metadata?.customerName || session.customer_details?.name || "Customer",
              customerEmail: session.customer_details?.email || "",
              serviceName: session.metadata?.serviceName || "Salon Service",
              amount: (session.amount_total || 0) / 100,
              currency: session.currency?.toUpperCase() || "USD",
              stripeSessionId: session.id,
              status: "paid",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            await transactionsCollection.insertOne(transaction);
            console.log(`\u2705 Recorded payment transaction for appointment ${appointmentId}`);
            const aptQuery = ObjectId7.isValid(appointmentId) ? { _id: new ObjectId7(appointmentId) } : { _id: appointmentId };
            await appointmentsCollection.updateOne(aptQuery, {
              $set: {
                paymentStatus: "paid",
                updatedAt: (/* @__PURE__ */ new Date()).toISOString()
              }
            });
            console.log(`\u2705 Updated appointment ${appointmentId} payment status to PAID`);
          }
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const appointmentId = session.metadata?.appointmentId;
        const customerId = session.metadata?.customerId;
        if (appointmentId) {
          const transactionsCollection = getTransactionsCollection();
          const failedTransaction = {
            appointmentId,
            customerId: customerId || "",
            amount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || "USD",
            stripeSessionId: session.id,
            status: "failed",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          await transactionsCollection.insertOne(failedTransaction);
          console.warn(`\u26A0\uFE0F Logged failed payment transaction for appointment ${appointmentId}`);
        }
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

// src/middleware/error.middleware.ts
function notFoundHandler(req, res) {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}
function globalErrorHandler(err, req, res, _next) {
  console.error("Unhandled Error:", err);
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "An unexpected server error occurred.";
  const errorResponse = {
    success: false,
    message
  };
  if (ENV.NODE_ENV !== "production") {
    errorResponse.stack = err.stack;
  }
  res.status(statusCode).json(errorResponse);
}

// src/middleware/sanitize.middleware.ts
function cleanInPlace(obj) {
  if (obj === null || typeof obj !== "object") {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(cleanInPlace);
    return;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      cleanInPlace(obj[key]);
    }
  }
}
function sanitizeMongoInput(req, _res, next) {
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

// src/app.ts
function createApp() {
  const app2 = express();
  app2.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app2.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000" || origin === ENV.CLIENT_ORIGIN || origin.endsWith(".vercel.app")) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"]
    })
  );
  app2.use(cookieParser());
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 1e3,
    // Limit each IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later."
    }
  });
  app2.use("/api/", limiter);
  app2.post(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
    (req, res, next) => {
      req.rawBody = req.body;
      next();
    },
    handleStripeWebhook
  );
  app2.use(express.json({ limit: "10mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app2.use(sanitizeMongoInput);
  app2.get("/", (req, res) => {
    res.json({
      status: "ok",
      name: "SalonBook API",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/v1/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "salonbook-backend",
      uptime: process.uptime()
    });
  });
  app2.use("/api/v1", routes_default);
  app2.use("/api", routes_default);
  app2.use(notFoundHandler);
  app2.use(globalErrorHandler);
  return app2;
}

// src/utils/seed.ts
var initialServices = [
  {
    serviceName: "Luxe Balayage & Glossing",
    category: "Hair Coloring",
    description: "Multi-dimensional sun-kissed custom hand-painted color and conditioning gloss for effortless radiance.",
    price: 185,
    duration: 120,
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-10T10:00:00.000Z"
  },
  {
    serviceName: "Signature Botanical Hair & Scalp Ritual",
    category: "Hair Treatment",
    description: "Deep steam therapy with organic rosemary and keratin infusion for restorative shine and root health.",
    price: 95,
    duration: 60,
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-12T10:00:00.000Z"
  },
  {
    serviceName: "Precision Master Cut & Blowout",
    category: "Haircut & Styling",
    description: "Bespoke sculptural dry cut tailored to your facial architecture and natural hair movement, finished with our signature blowout.",
    price: 75,
    duration: 45,
    image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-14T10:00:00.000Z"
  },
  {
    serviceName: "Hydra-Luxe Radiance Facial",
    category: "Facial & Skincare",
    description: "Deep sonic pore extraction, peptide infusion and cold cryogenic lifting massage for luminous, poreless skin.",
    price: 130,
    duration: 75,
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-15T10:00:00.000Z"
  },
  {
    serviceName: "Velvet Couture Gel & Pedicure",
    category: "Manicure & Pedicure",
    description: "Botanical soak, gentle cuticle revival, exfoliating brown sugar scrub, and long-wear biocompatible gel finish.",
    price: 85,
    duration: 90,
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-18T10:00:00.000Z"
  },
  {
    serviceName: "Aromatherapy Hot Stone Relief",
    category: "Spa & Massage",
    description: "Warm basalt stones and organic lavender-eucalyptus oil melting neck, shoulder and back tension effortlessly.",
    price: 120,
    duration: 60,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-20T10:00:00.000Z"
  },
  {
    serviceName: "Bridal Glamour & Airbrush Makeup",
    category: "Makeup",
    description: "Sweat-proof, HD-camera ready airbrushed complexion design including lash styling and evening glamour.",
    price: 150,
    duration: 90,
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-22T10:00:00.000Z"
  },
  {
    serviceName: "Japanese Hair Smoothing Restructure",
    category: "Hair Treatment",
    description: "Long-lasting silk restructuring protocol that seals the cuticle and eliminates humidity frizz.",
    price: 220,
    duration: 150,
    image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80",
    status: "inactive",
    createdAt: "2026-01-25T10:00:00.000Z"
  }
];
async function seedInitialServicesIfNeeded() {
  try {
    const servicesCollection = getServicesCollection();
    const count = await servicesCollection.countDocuments();
    if (count === 0) {
      console.log("\u{1F331} Seeding initial salon services into database...");
      await servicesCollection.insertMany(initialServices);
      console.log(`\u2705 Seeded ${initialServices.length} initial services.`);
    }
  } catch (error) {
    console.warn("\u26A0\uFE0F Could not run service seeder:", error.message);
  }
}

// src/serverless.ts
var app = createApp();
var isInitialized = false;
async function init() {
  if (!isInitialized) {
    try {
      await connectDB();
      await seedInitialServicesIfNeeded();
      isInitialized = true;
    } catch (err) {
      console.error("\u26A0\uFE0F Failed to initialize database in serverless function:", err.message);
    }
  }
}
async function handler(req, res) {
  await init();
  return app(req, res);
}
export {
  handler as default
};
