import { MongoClient, Db, Collection } from "mongodb";
import { ENV } from "./environment.js";
import {
  UserDocument,
  ServiceDocument,
  AppointmentDocument,
  TransactionDocument,
} from "../types/index.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db && client) {
    return db;
  }

  client = new MongoClient(ENV.MONGODB_URL);
  await client.connect();
  db = client.db("salonbook");

  console.log("✅ Successfully connected to MongoDB Atlas (salonbook)");

  // Initialize essential indexes asynchronously
  initIndexes(db).catch((err) =>
    console.warn("⚠️ Warning initializing database indexes:", err.message)
  );

  return db;
}

export function getDB(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error("MongoClient not initialized. Call connectDB() first.");
  }
  return client;
}

export function getUsersCollection(): Collection<UserDocument> {
  return getDB().collection<UserDocument>("user");
}

export function getServicesCollection(): Collection<ServiceDocument> {
  return getDB().collection<ServiceDocument>("services");
}

export function getAppointmentsCollection(): Collection<AppointmentDocument> {
  return getDB().collection<AppointmentDocument>("appointments");
}

export function getTransactionsCollection(): Collection<TransactionDocument> {
  return getDB().collection<TransactionDocument>("transactions");
}

async function initIndexes(database: Db): Promise<void> {
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

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed.");
  }
}
