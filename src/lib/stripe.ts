import Stripe from "stripe";

// Singleton del SDK de Stripe (patrón análogo a src/lib/prisma.ts: una sola
// instancia reutilizada entre requests en dev gracias al HMR de Next.js).
// apiVersion fijo a la versión instalada del SDK (stripe@22.4.0) para que
// las respuestas de la API no cambien de forma bajo nuestros pies sin que
// también actualicemos el paquete.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2026-07-29.dahlia",
    maxNetworkRetries: 2,
  });

if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;
