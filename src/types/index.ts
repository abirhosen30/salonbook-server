import { Request } from "express";
import { ObjectId } from "mongodb";

export type UserRole = "customer" | "admin";

export interface UserDocument {
  _id?: ObjectId | string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  isBlocked?: boolean;
  phone?: string;
  emailVerified?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ServiceDocument {
  _id?: ObjectId | string;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number; // in minutes
  image: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt?: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";

export interface AppointmentDocument {
  _id?: ObjectId | string;
  serviceId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  serviceName?: string;
  serviceImage?: string;
  category?: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM"
  message?: string;
  servicePrice: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
}

export type TransactionStatus = "paid" | "failed";

export interface TransactionDocument {
  _id?: ObjectId | string;
  appointmentId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  serviceName?: string;
  appointmentDate?: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBlocked: boolean;
  image?: string;
  phone?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  rawBody?: Buffer;
}
