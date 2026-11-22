import { Request, Response } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getTransactionsCollection,
} from "../config/database.js";
import { verifyStripeWebhookSignature } from "../services/stripe.service.js";
import { TransactionDocument } from "../types/index.js";

export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const sig = req.headers["stripe-signature"];

  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || req.body;
    event = verifyStripeWebhookSignature(rawBody, sig);
  } catch (err: any) {
    console.error("⚠️ Stripe webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId = session.metadata?.appointmentId;
        const customerId = session.metadata?.customerId;

        if (appointmentId) {
          const transactionsCollection = getTransactionsCollection();
          const appointmentsCollection = getAppointmentsCollection();

          // 1. Idempotency Check: check if transaction already exists for this Stripe session
          const existingTransaction = await transactionsCollection.findOne({
            stripeSessionId: session.id,
          });

          if (!existingTransaction) {
            // 2. Insert transaction in transactions collection (PDF Page 18 & 21)
            const transaction: TransactionDocument = {
              appointmentId: appointmentId,
              customerId: customerId || "",
              customerName: session.metadata?.customerName || session.customer_details?.name || "Customer",
              customerEmail: session.customer_details?.email || "",
              serviceName: session.metadata?.serviceName || "Salon Service",
              amount: (session.amount_total || 0) / 100,
              currency: session.currency?.toUpperCase() || "USD",
              stripeSessionId: session.id,
              status: "paid",
              createdAt: new Date().toISOString(),
            };

            await transactionsCollection.insertOne(transaction as any);
            console.log(`✅ Recorded payment transaction for appointment ${appointmentId}`);

            // 3. Authoritatively update appointment paymentStatus to 'paid' (PDF Page 4 & 17)
            const aptQuery = ObjectId.isValid(appointmentId)
              ? { _id: new ObjectId(appointmentId) }
              : { _id: appointmentId as any };

            await appointmentsCollection.updateOne(aptQuery, {
              $set: {
                paymentStatus: "paid",
                updatedAt: new Date().toISOString(),
              },
            });

            console.log(`✅ Updated appointment ${appointmentId} payment status to PAID`);
          }
        }
        break;
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId = session.metadata?.appointmentId;
        const customerId = session.metadata?.customerId;

        if (appointmentId) {
          const transactionsCollection = getTransactionsCollection();
          const failedTransaction: TransactionDocument = {
            appointmentId: appointmentId,
            customerId: customerId || "",
            amount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || "USD",
            stripeSessionId: session.id,
            status: "failed",
            createdAt: new Date().toISOString(),
          };

          await transactionsCollection.insertOne(failedTransaction as any);
          console.warn(`⚠️ Logged failed payment transaction for appointment ${appointmentId}`);
        }
        break;
      }

      default:
        // Other events ignored
        break;
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Error processing Stripe webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
