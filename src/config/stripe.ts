import Stripe from "stripe";
import { ENV } from "./environment.js";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (stripeClient) {
    return stripeClient;
  }

  if (!ENV.STRIPE_SECRET_KEY) {
    console.warn("⚠️ STRIPE_SECRET_KEY is not set. Stripe operations will be restricted.");
    return null;
  }

  stripeClient = new Stripe(ENV.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia" as any,
  });

  return stripeClient;
}
