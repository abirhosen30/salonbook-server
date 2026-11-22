import Stripe from "stripe";
import { getStripe } from "../config/stripe.js";
import { ENV } from "../config/environment.js";

export interface CreateCheckoutSessionParams {
  appointmentId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  serviceName: string;
  servicePrice: number; // in USD dollars
  successUrl?: string;
  cancelUrl?: string;
}

export async function createStripeCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; sessionUrl: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not initialized. Please configure STRIPE_SECRET_KEY."
    );
  }

  const clientOrigin =
    ENV.CLIENT_ORIGIN && !ENV.CLIENT_ORIGIN.includes("localhost")
      ? ENV.CLIENT_ORIGIN
      : process.env.NODE_ENV === "production"
        ? "https://salonbook-client-henna.vercel.app"
        : ENV.CLIENT_ORIGIN || "http://localhost:3000";

  const successUrl =
    params.successUrl ||
    `${clientOrigin}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    params.cancelUrl ||
    `${clientOrigin}/payment/cancel`;

  const sessionParams: any = {
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.serviceName,
            description: `Salon appointment session on SalonBook`,
          },
          unit_amount: Math.round(params.servicePrice * 100), // Stripe expects cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      appointmentId: params.appointmentId,
      customerId: params.customerId,
      serviceName: params.serviceName,
      customerName: params.customerName,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error("Failed to generate Stripe checkout session URL.");
  }

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  signature: string
): Stripe.Event {
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
