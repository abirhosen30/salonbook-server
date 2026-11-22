import { Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getTransactionsCollection,
  getServicesCollection,
} from "../config/database.js";
import { AuthenticatedRequest } from "../types/index.js";
import { createStripeCheckoutSession } from "../services/stripe.service.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export async function createCheckoutSession(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
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
    const query = ObjectId.isValid(appointmentId)
      ? { _id: new ObjectId(appointmentId) }
      : { _id: appointmentId as any };

    const appointment = await appointmentsCollection.findOne(query);

    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }

    // Ownership check: customer can only pay for their own appointment
    if (appointment.customerId !== user.id) {
      sendError(res, "Forbidden: You can only pay for your own appointments.", 403);
      return;
    }

    // Strict Rule from PDF Page 13:
    // "Customers cannot pay for cancelled or pending appointments. Pay for Confirmed Appointments."
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

    // Retrieve authoritative price from services collection
    const servicesCollection = getServicesCollection();
    const serviceQuery = ObjectId.isValid(appointment.serviceId)
      ? { _id: new ObjectId(appointment.serviceId) }
      : { _id: appointment.serviceId as any };
    const service = await servicesCollection.findOne(serviceQuery);

    const price = service ? service.price : appointment.servicePrice;

    const { sessionId, sessionUrl } = await createStripeCheckoutSession({
      appointmentId: appointment._id ? appointment._id.toString() : appointmentId,
      customerId: user.id,
      customerEmail: user.email,
      customerName: user.name,
      serviceName: appointment.serviceName || service?.serviceName || "Salon Service",
      servicePrice: price,
    });

    sendSuccess(
      res,
      { url: sessionUrl, sessionId },
      "Stripe checkout session initialized successfully."
    );
  } catch (error: any) {
    console.error("createCheckoutSession error:", error);
    sendError(res, error.message || "Failed to initialize payment session.", 500);
  }
}

export async function getPaymentByAppointment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const { appointmentId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const transactionsCollection = getTransactionsCollection();
    const transaction = await transactionsCollection.findOne({
      appointmentId: appointmentId,
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
  } catch (error: any) {
    console.error("getPaymentByAppointment error:", error);
    sendError(res, "Failed to retrieve transaction", 500);
  }
}
