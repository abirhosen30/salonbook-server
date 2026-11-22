import { Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getTransactionsCollection,
  getServicesCollection,
} from "../config/database.js";
import { AuthenticatedRequest, TransactionDocument } from "../types/index.js";
import { createStripeCheckoutSession } from "../services/stripe.service.js";
import { getStripe } from "../config/stripe.js";
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

export async function verifyCheckoutSession(
  req: any,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      sendError(res, "sessionId is required", 400);
      return;
    }

    const stripe = getStripe();
    if (!stripe) {
      sendError(res, "Stripe is not configured", 500);
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      sendError(res, "Stripe session not found", 404);
      return;
    }

    const appointmentId = session.metadata?.appointmentId;
    const isPaid = session.payment_status === "paid";

    if (isPaid && appointmentId) {
      const transactionsCollection = getTransactionsCollection();
      const appointmentsCollection = getAppointmentsCollection();

      // Idempotently store transaction in transactions collection (PDF Page 13 & 18)
      const existingTx = await transactionsCollection.findOne({
        stripeSessionId: session.id,
      });

      if (!existingTx) {
        const txDoc: TransactionDocument = {
          appointmentId: appointmentId,
          customerId: session.metadata?.customerId || "",
          customerName:
            session.metadata?.customerName ||
            session.customer_details?.name ||
            "Customer",
          customerEmail: session.customer_details?.email || session.customer_email || "",
          serviceName: session.metadata?.serviceName || "Salon Service",
          amount: (session.amount_total || 0) / 100,
          currency: session.currency?.toUpperCase() || "USD",
          stripeSessionId: session.id,
          status: "paid",
          createdAt: new Date().toISOString(),
        };
        await transactionsCollection.insertOne(txDoc as any);
        console.log(`✅ [Verification] Transaction created for appointment ${appointmentId}`);
      }

      // Update appointment status to paid (PDF Page 13 & 17)
      const aptQuery = ObjectId.isValid(appointmentId)
        ? { _id: new ObjectId(appointmentId) }
        : { _id: appointmentId as any };

      await appointmentsCollection.updateOne(aptQuery, {
        $set: {
          paymentStatus: "paid",
          updatedAt: new Date().toISOString(),
        },
      });
      console.log(`✅ [Verification] Appointment ${appointmentId} updated to paid`);
    }

    const appointmentsCollection = getAppointmentsCollection();
    const aptQuery =
      appointmentId && ObjectId.isValid(appointmentId)
        ? { _id: new ObjectId(appointmentId) }
        : { _id: appointmentId as any };
    const appointment = appointmentId ? await appointmentsCollection.findOne(aptQuery) : null;

    sendSuccess(
      res,
      {
        isPaid,
        sessionId: session.id,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency?.toUpperCase() || "USD",
        customerEmail: session.customer_details?.email || session.customer_email || "",
        customerName: session.customer_details?.name || session.metadata?.customerName || "Customer",
        serviceName: session.metadata?.serviceName || "Salon Service",
        appointmentId: appointmentId || "",
        appointment: appointment
          ? { ...appointment, _id: appointment._id?.toString() }
          : null,
      },
      "Checkout session verified successfully"
    );
  } catch (error: any) {
    console.error("verifyCheckoutSession error:", error);
    sendError(res, error.message || "Failed to verify checkout session", 500);
  }
}
